import { useEffect, useMemo, useRef, useState } from "react";
import { PanelView } from "../panel/PanelView";
import { SettingsView } from "../settings/SettingsView";
import { AboutView } from "../about/AboutView";
import { AppStateContext } from "../shared/appState";
import { getCopy, localizeDimensionLabel } from "../shared/i18n";
import { PromotionStatusLine } from "../../components/panel/PromotionStatusLine";
import { loadProviderState, refreshProviderState } from "../../features/demo-services/panelController";
import { sendDemoNotification } from "../../features/notifications/notificationController";
import {
  applyAutostart,
  getPreferences,
  persistPreferences
} from "../../features/preferences/preferencesController";
import { tauriClient } from "../../lib/tauri/client";
import type {
  CodexPanelState,
  NotificationCheckResult,
  PreferencePatch,
  UserPreferences
} from "../../lib/tauri/contracts";
import {
  formatTraySummary,
  getPanelHealthSummary,
  getVisibleServiceScope,
  markPanelStateRefreshing
} from "../../lib/tauri/summary";
import { hideMainWindow } from "../../lib/tauri/windowShell";
import {
  resolvePromotionDisplayDecision
} from "../../features/promotions/resolver";
import type { PromotionOverlayState } from "../../features/promotions/types";

const RefreshIcon = () => (
  <svg aria-hidden="true" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24">
    <path
      d="M20 5v5h-5M4 19v-5h5M6.9 9A7 7 0 0 1 18 6.2L20 10M4 14l2 3.8A7 7 0 0 0 17.1 15"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.8"
    />
  </svg>
);

const SettingsIcon = () => (
  <svg aria-hidden="true" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24">
    <path
      d="M12 8.75a3.25 3.25 0 1 1 0 6.5 3.25 3.25 0 0 1 0-6.5Z"
      stroke="currentColor"
      strokeWidth="1.8"
    />
    <path
      d="M19.4 15a1 1 0 0 0 .2 1.1l.1.1a1.5 1.5 0 0 1 0 2.1l-.9.9a1.5 1.5 0 0 1-2.1 0l-.1-.1a1 1 0 0 0-1.1-.2 1 1 0 0 0-.6.9v.2A1.5 1.5 0 0 1 13.4 22h-1.3a1.5 1.5 0 0 1-1.5-1.5v-.2a1 1 0 0 0-.6-.9 1 1 0 0 0-1.1.2l-.1.1a1.5 1.5 0 0 1-2.1 0l-.9-.9a1.5 1.5 0 0 1 0-2.1l.1-.1a1 1 0 0 0 .2-1.1 1 1 0 0 0-.9-.6h-.2A1.5 1.5 0 0 1 2 13.4v-1.3a1.5 1.5 0 0 1 1.5-1.5h.2a1 1 0 0 0 .9-.6 1 1 0 0 0-.2-1.1l-.1-.1a1.5 1.5 0 0 1 0-2.1l.9-.9a1.5 1.5 0 0 1 2.1 0l.1.1a1 1 0 0 0 1.1.2 1 1 0 0 0 .6-.9v-.2A1.5 1.5 0 0 1 10.6 2h1.3a1.5 1.5 0 0 1 1.5 1.5v.2a1 1 0 0 0 .6.9 1 1 0 0 0 1.1-.2l.1-.1a1.5 1.5 0 0 1 2.1 0l.9.9a1.5 1.5 0 0 1 0 2.1l-.1.1a1 1 0 0 0-.2 1.1 1 1 0 0 0 .9.6h.2A1.5 1.5 0 0 1 22 10.6v1.3a1.5 1.5 0 0 1-1.5 1.5h-.2a1 1 0 0 0-.9.6Z"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.6"
    />
  </svg>
);

const BackIcon = () => (
  <svg aria-hidden="true" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24">
    <path
      d="M15 6l-6 6 6 6"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.8"
    />
  </svg>
);

export const AppShell = () => {
  const [providerStates, setProviderStates] = useState<Record<string, CodexPanelState | null>>({});
  const [refreshingProviders, setRefreshingProviders] = useState<Set<string>>(new Set());
  const [preferences, setPreferences] = useState<UserPreferences | null>(null);
  const [notificationResult, setNotificationResult] = useState<NotificationCheckResult | null>(null);
  const [currentView, setCurrentView] = useState<"panel" | "settings" | "about">("panel");
  const [promotionOverlayState, setPromotionOverlayState] = useState<PromotionOverlayState>("closed");
  const [displayNowMs, setDisplayNowMs] = useState(() => Date.now());
  const [isLoading, setIsLoading] = useState(true);
  const [isE2EMode, setIsE2EMode] = useState(false);
  const [isWindowVisible, setIsWindowVisible] = useState(
    () => typeof document === "undefined" || document.visibilityState !== "hidden"
  );
  const [refreshFeedback, setRefreshFeedback] = useState<"idle" | "error">("idle");
  const [settingsHeaderStatus, setSettingsHeaderStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [isScrolled, setIsScrolled] = useState(false);
  const [reopenCycle, setReopenCycle] = useState(0);
  const lastStableProviderStates = useRef<Record<string, CodexPanelState | null>>({});
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const settingsScrollContainerRef = useRef<HTMLDivElement | null>(null);
  const aboutScrollContainerRef = useRef<HTMLDivElement | null>(null);
  const settingsHeaderTimerRef = useRef<number | null>(null);
  const promotionInteractionRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const [prefs, runtimeFlags] = await Promise.all([
          getPreferences(),
          tauriClient.getRuntimeFlags()
        ]);
        const enabledIds = getVisibleServiceScope(prefs).visiblePanelServiceOrder;
        const results = await Promise.all(
          enabledIds.map(async (id) => [id, await loadProviderState(id)] as const)
        );
        const states: Record<string, CodexPanelState | null> = {};
        for (const [id, state] of results) {
          states[id] = state;
        }
        setProviderStates(states);
        lastStableProviderStates.current = states;
        setPreferences(prefs);
        setIsE2EMode(runtimeFlags.isE2E);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Failed to initialize app");
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  useEffect(
    () => () => {
      if (settingsHeaderTimerRef.current) {
        window.clearTimeout(settingsHeaderTimerRef.current);
      }
    },
    []
  );

  useEffect(() => {
    if (currentView !== "panel") {
      setPromotionOverlayState("closed");
    }
  }, [currentView]);

  useEffect(() => {
    if (!isE2EMode) {
      return undefined;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) {
        return;
      }

      if (event.key === "F5" || event.key.toLowerCase() === "r") {
        event.preventDefault();
        void refreshPanel();
        return;
      }

      if (currentView === "panel" && (event.key === "F6" || event.key.toLowerCase() === "s")) {
        event.preventDefault();
        setCurrentView("settings");
        setIsScrolled(false);
        return;
      }

      if (currentView === "settings" && (event.key === "F7" || event.key.toLowerCase() === "b")) {
        event.preventDefault();
        setCurrentView("panel");
        setIsScrolled(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentView, isE2EMode]);

  useEffect(() => {
    if (promotionOverlayState !== "pinned") {
      return undefined;
    }

    const handleDocumentMouseDown = (event: MouseEvent) => {
      if (
        promotionInteractionRef.current &&
        event.target instanceof Node &&
        !promotionInteractionRef.current.contains(event.target)
      ) {
        setPromotionOverlayState("closed");
      }
    };

    const handleDocumentKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setPromotionOverlayState("closed");
      }
    };

    document.addEventListener("mousedown", handleDocumentMouseDown);
    document.addEventListener("keydown", handleDocumentKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleDocumentMouseDown);
      document.removeEventListener("keydown", handleDocumentKeyDown);
    };
  }, [promotionOverlayState]);

  const flashSettingsSaved = () => {
    setSettingsHeaderStatus("saved");
    if (settingsHeaderTimerRef.current) {
      window.clearTimeout(settingsHeaderTimerRef.current);
    }
    settingsHeaderTimerRef.current = window.setTimeout(() => setSettingsHeaderStatus("idle"), 1200);
  };

  const runSettingsMutation = async <T,>(
    mutation: () => Promise<T>,
    onSuccess: (result: T) => void,
    fallbackMessage: string
  ) => {
    setError(null);
    setSettingsHeaderStatus("saving");
    try {
      const result = await mutation();
      onSuccess(result);
      flashSettingsSaved();
      return result;
    } catch (mutationError) {
      setSettingsHeaderStatus("error");
      setError(mutationError instanceof Error ? mutationError.message : fallbackMessage);
      return null;
    }
  };

  // Auto-refresh panel on the configured interval.
  // Re-starts whenever the interval preference changes.
  useEffect(() => {
    if (!preferences) return;
    const intervalMs = preferences.refreshIntervalMinutes * 60 * 1000;
    const id = setInterval(() => { void refreshPanel(false); }, intervalMs);
    return () => clearInterval(id);
    // refreshPanel is intentionally omitted from deps — it is recreated each
    // render but the panelController dedup guard prevents concurrent calls.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preferences?.refreshIntervalMinutes]);

  const refreshPanel = async (manual = true) => {
    if (refreshingProviders.size > 0) {
      return;
    }
    const enabledIds = getVisibleServiceScope(preferences).visiblePanelServiceOrder;
    setRefreshingProviders(new Set(enabledIds));
    setError(null);
    try {
      // Mark refreshing providers in UI
      for (const id of enabledIds) {
        setProviderStates((prev) => ({
          ...prev,
          [id]: markPanelStateRefreshing(prev[id] ?? null)
        }));
      }

      const results = await Promise.all(
        enabledIds.map(async (id) => {
          // For non-manual refresh of claude-code, use load (preserving cooldown behavior)
          const fetcher = (!manual && id === "claude-code") ? loadProviderState : refreshProviderState;
          return [id, await fetcher(id)] as const;
        })
      );
      const nextStates: Record<string, CodexPanelState | null> = {};
      for (const [id, state] of results) {
        nextStates[id] = state;
      }
      setProviderStates((prev) => ({ ...prev, ...nextStates }));
      lastStableProviderStates.current = { ...lastStableProviderStates.current, ...nextStates };
    } catch (refreshError) {
      setRefreshFeedback("error");
      window.setTimeout(() => setRefreshFeedback("idle"), 1000);
      setError(refreshError instanceof Error ? refreshError.message : "Refresh failed");
    } finally {
      setRefreshingProviders(new Set());
    }
  };

  const savePreferences = async (patch: PreferencePatch) => {
    const previousPreferences = preferences;
    return runSettingsMutation(
      async () => {
        const nextPreferences = await persistPreferences(patch);
        const refreshIds: string[] = [];
        // Check which providers need refresh after preference change
        const previousEnabled = new Set(getVisibleServiceScope(previousPreferences).visiblePanelServiceOrder);
        const nextEnabled = getVisibleServiceScope(nextPreferences).visiblePanelServiceOrder;
        const proxyChanged = "networkProxyMode" in patch || "networkProxyUrl" in patch;
        const tokenChanged = "providerTokens" in patch;
        for (const id of nextEnabled) {
          const enablingProvider = !previousEnabled.has(id);
          if (enablingProvider || proxyChanged || tokenChanged) {
            refreshIds.push(id);
          }
        }

        let refreshedStates: Record<string, CodexPanelState | null> = {};
        if (refreshIds.length > 0) {
          setRefreshingProviders(new Set(refreshIds));
          for (const id of refreshIds) {
            const seedState = providerStates[id] ?? (await loadProviderState(id));
            setProviderStates((prev) => ({ ...prev, [id]: markPanelStateRefreshing(seedState) }));
          }
          const results = await Promise.all(
            refreshIds.map(async (id) => [id, await refreshProviderState(id)] as const)
          );
          refreshedStates = Object.fromEntries(results);
        }
        return { nextPreferences, refreshedStates };
      },
      ({ nextPreferences, refreshedStates }) => {
        setPreferences(nextPreferences);
        if (Object.keys(refreshedStates).length > 0) {
          setProviderStates((prev) => ({ ...prev, ...refreshedStates }));
        }
        // Update summary text for all providers
        setProviderStates((prev) => {
          const updated: Record<string, CodexPanelState | null> = {};
          for (const [id, state] of Object.entries(prev)) {
            updated[id] = state
              ? {
                  ...state,
                  desktopSurface: {
                    ...state.desktopSurface,
                    summaryMode: nextPreferences.traySummaryMode,
                    summaryText: formatTraySummary(nextPreferences.traySummaryMode, state.items)
                  }
                }
              : state;
          }
          return updated;
        });
      },
      "Save failed"
    )
      .then((result) => result?.nextPreferences ?? null)
      .finally(() => {
        setRefreshingProviders(new Set());
      });
  };

  const sendTestNotification = async () => {
    setError(null);
    try {
      const result = await sendDemoNotification();
      setNotificationResult(result);
      return result;
    } catch (notifyError) {
      setError(notifyError instanceof Error ? notifyError.message : "Notification failed");
      return null;
    }
  };

  const setAutostart = async (enabled: boolean) => {
    return runSettingsMutation(
      () => applyAutostart(enabled),
      (next) => setPreferences(next),
      "Autostart failed"
    );
  };

  const resetShellViewState = () => {
    setCurrentView("panel");
    setPromotionOverlayState("closed");
    setIsScrolled(false);
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0;
    }
    if (settingsScrollContainerRef.current) {
      settingsScrollContainerRef.current.scrollTop = 0;
    }
    if (aboutScrollContainerRef.current) {
      aboutScrollContainerRef.current.scrollTop = 0;
    }
  };

  useEffect(() => {
    const handleWindowFocus = () => {
      setIsWindowVisible(true);
      setDisplayNowMs(Date.now());
      resetShellViewState();
      setReopenCycle((current) => current + 1);
    };

    window.addEventListener("focus", handleWindowFocus);
    return () => window.removeEventListener("focus", handleWindowFocus);
  }, []);

  useEffect(() => {
    const handleWindowBlur = () => {
      setIsWindowVisible(false);
    };
    const handleVisibilityChange = () => {
      const visible = document.visibilityState !== "hidden";
      setIsWindowVisible(visible);
      if (visible) {
        setDisplayNowMs(Date.now());
      }
    };

    window.addEventListener("blur", handleWindowBlur);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      window.removeEventListener("blur", handleWindowBlur);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  useEffect(() => {
    if (!isWindowVisible || currentView !== "panel") {
      return undefined;
    }

    setDisplayNowMs(Date.now());
    const tickerId = window.setInterval(() => {
      setDisplayNowMs(Date.now());
    }, 60_000);

    return () => window.clearInterval(tickerId);
  }, [currentView, isWindowVisible]);

  useEffect(() => {
    const handleEscapeToHide = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) {
        return;
      }

      if (event.key !== "Escape") {
        return;
      }

      event.preventDefault();
      setPromotionOverlayState("closed");
      void hideMainWindow();
    };

    window.addEventListener("keydown", handleEscapeToHide);
    return () => window.removeEventListener("keydown", handleEscapeToHide);
  }, []);

  const copy = getCopy(preferences?.language ?? "zh-CN");
  const visibleServiceScope = getVisibleServiceScope(preferences);
  const serviceOrder = visibleServiceScope.visiblePanelServiceOrder;
  // Merge last-stable with current for display continuity
  const mergedProviderStates = useMemo(
    () => ({ ...lastStableProviderStates.current, ...providerStates }),
    [providerStates]
  );
  const visibleItems = useMemo(
    () =>
      serviceOrder.flatMap((serviceId) => {
        const state = mergedProviderStates[serviceId];
        return state?.items ?? [];
      }),
    [mergedProviderStates, serviceOrder]
  );
  const panelSummary = getPanelHealthSummary(visibleItems, displayNowMs);
  const promotionDecision = useMemo(
    () =>
      resolvePromotionDisplayDecision({
        visibleServiceScope,
        panelStates: mergedProviderStates
      }),
    [mergedProviderStates, visibleServiceScope]
  );
  const shouldShowPromotionLine = promotionDecision.inlineServices.length > 0 || promotionDecision.fallbackState !== "none";
  const summaryToneClass =
    panelSummary.tone === "danger"
      ? "text-rose-700"
      : panelSummary.tone === "warning"
        ? "text-amber-700"
        : panelSummary.tone === "healthy"
          ? "text-emerald-700"
          : "text-slate-500";
  const summaryText =
    panelSummary.tone === "empty"
      ? copy.noServicesConnected
      : panelSummary.tone === "healthy"
        ? copy.allServicesHealthy
        : (
            panelSummary.source === "pace" && panelSummary.pace === "far-behind"
              ? copy.panelPaceDangerSummary
              : panelSummary.source === "pace" && panelSummary.pace === "behind"
                ? copy.panelPaceWarningSummary
                : panelSummary.tone === "danger"
                  ? copy.panelDangerSummary
                  : copy.panelWarningSummary
          )
              .replace("{service}", panelSummary.serviceName ?? "")
              .replace(
                "{dimension}",
                ` ${localizeDimensionLabel(copy, panelSummary.dimensionLabel ?? "")}`
              )
              .replace(/\s+/g, " ")
              .trim();
  const settingsHeaderText =
    settingsHeaderStatus === "saving"
      ? copy.saving
      : settingsHeaderStatus === "saved"
        ? copy.savedInline
        : settingsHeaderStatus === "error"
          ? copy.failed
          : "";
  const openSettings = () => {
    setCurrentView("settings");
    setIsScrolled(false);
  };
  const closeSettings = () => {
    setCurrentView("panel");
    setIsScrolled(false);
  };
  const openAbout = () => {
    setCurrentView("about");
    setIsScrolled(false);
  };
  const closeAbout = () => {
    setCurrentView("settings");
    setIsScrolled(false);
  };

  return (
    <AppStateContext.Provider
      value={{
        providerStates: mergedProviderStates,
        refreshingProviders,
        preferences,
        notificationResult,
        currentView,
        displayNowMs,
        isLoading,
        isE2EMode,
        error,
        refreshPanel,
        savePreferences,
        sendTestNotification,
        setAutostart,
        openSettings,
        closeSettings,
        openAbout,
        closeAbout
      }}
    >
      <main className="h-screen overflow-hidden bg-white text-slate-900">
        <div
          data-testid="app-shell-surface"
          className="flex h-full w-full flex-col overflow-hidden bg-white px-4 pb-4 pt-3"
        >
          <div
            className={`sticky top-0 z-10 -mx-4 mb-3 flex min-h-[3.75rem] items-center justify-between bg-white px-4 py-3 transition-shadow ${isScrolled ? "border-b border-slate-200 shadow-sm" : ""}`}
          >
            {currentView === "panel" ? (
              <>
                <div className="min-w-0 pr-3">
                  <div className={`truncate text-sm font-semibold leading-tight ${summaryToneClass}`}>{summaryText}</div>
                  {shouldShowPromotionLine && (
                    <PromotionStatusLine
                      copy={copy}
                      onPin={() => setPromotionOverlayState("pinned")}
                      onPreviewEnd={() =>
                        setPromotionOverlayState((current) => (current === "pinned" ? current : "closed"))
                      }
                      onPreviewStart={() =>
                        setPromotionOverlayState((current) => (current === "pinned" ? current : "preview"))
                      }
                      overlayState={promotionOverlayState}
                      promotionDecision={promotionDecision}
                      rootRef={promotionInteractionRef}
                    />
                  )}
                </div>
                <div className="flex items-center gap-1.5">
                  {isE2EMode ? (
                    <button
                      aria-label="E2E Refresh"
                      className="rounded-full border border-slate-300 px-2 py-1 text-[10px] font-medium text-slate-500"
                      onClick={() => void refreshPanel()}
                      type="button"
                    >
                      E2E Refresh
                    </button>
                  ) : null}
                  <button
                    aria-label={refreshingProviders.size > 0 ? copy.refreshing : copy.refresh}
                    className={`flex h-9 w-9 items-center justify-center rounded-full border bg-white transition-colors hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-60 ${
                      refreshFeedback === "error"
                        ? "border-rose-200 text-rose-600"
                        : "border-slate-200 text-slate-700 hover:border-slate-300"
                    }`}
                    disabled={refreshingProviders.size > 0}
                    onClick={() => void refreshPanel()}
                    title={refreshingProviders.size > 0 ? copy.refreshing : copy.refresh}
                    type="button"
                  >
                    <span className={refreshingProviders.size > 0 ? "animate-spin" : ""}>
                      <RefreshIcon />
                    </span>
                  </button>
                  <button
                    aria-label={copy.settings}
                    className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 transition-colors hover:border-slate-300 hover:text-slate-900"
                    onClick={openSettings}
                    title={copy.settings}
                    type="button"
                  >
                    <SettingsIcon />
                  </button>
                </div>
              </>
            ) : currentView === "settings" ? (
              <>
                <div>
                  {settingsHeaderText ? <div className="text-sm font-semibold leading-tight text-slate-600">{settingsHeaderText}</div> : null}
                </div>
                <button
                  aria-label={copy.back}
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 transition-colors hover:border-slate-300 hover:text-slate-900"
                  onClick={closeSettings}
                  type="button"
                >
                  <BackIcon />
                </button>
              </>
            ) : (
              <>
                <div>
                  <div className="text-sm font-semibold leading-tight text-slate-900">{copy.aboutTitle}</div>
                </div>
                <button
                  aria-label={copy.back}
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 transition-colors hover:border-slate-300 hover:text-slate-900"
                  onClick={closeAbout}
                  type="button"
                >
                  <BackIcon />
                </button>
              </>
            )}
          </div>
          <div
            className="relative flex-1 overflow-hidden"
          >
            {isLoading && Object.keys(providerStates).length === 0 && !preferences ? (
              <div className="rounded-2xl bg-slate-50 p-8 text-center text-sm text-slate-500">{copy.loading}</div>
            ) : (
              <div
                data-testid="app-shell-viewport"
                data-reopen-cycle={reopenCycle}
                key={reopenCycle}
                className={`flex h-full w-[300%] gap-4 transition-transform duration-300 ease-out ${currentView === "panel" ? "translate-x-0" : currentView === "settings" ? "-translate-x-[calc(33.333%+0.667rem)]" : "-translate-x-[calc(66.667%+1.333rem)]"}`}
              >
                <div
                  ref={scrollContainerRef}
                  className="w-1/3 shrink-0 overflow-y-auto overflow-x-hidden pr-2"
                  onScroll={(event) => setIsScrolled(event.currentTarget.scrollTop > 4)}
                >{<PanelView />}</div>
                <div
                  ref={settingsScrollContainerRef}
                  className="w-1/3 shrink-0 overflow-y-auto overflow-x-hidden pr-2"
                  onScroll={(event) => setIsScrolled(event.currentTarget.scrollTop > 4)}
                >{preferences ? <SettingsView /> : null}</div>
                <div
                  ref={aboutScrollContainerRef}
                  className="w-1/3 shrink-0 overflow-y-auto overflow-x-hidden pr-2"
                  onScroll={(event) => setIsScrolled(event.currentTarget.scrollTop > 4)}
                >
                  {currentView === "about" ? <AboutView /> : null}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </AppStateContext.Provider>
  );
};
