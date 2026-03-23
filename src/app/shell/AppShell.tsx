import { useEffect, useMemo, useRef, useState } from "react";
import { PanelView } from "../panel/PanelView";
import { SettingsView } from "../settings/SettingsView";
import { AppStateContext } from "../shared/appState";
import { getCopy, localizeDimensionLabel } from "../shared/i18n";
import { loadPanelState, refreshPanelState, loadClaudeCodePanelState, refreshClaudeCodePanelState } from "../../features/demo-services/panelController";
import { sendDemoNotification } from "../../features/notifications/notificationController";
import {
  applyAutostart,
  getPreferences,
  persistPreferences
} from "../../features/preferences/preferencesController";
import type {
  CodexPanelState,
  NotificationCheckResult,
  PreferencePatch,
  UserPreferences
} from "../../lib/tauri/contracts";
import { formatTraySummary, getPanelHealthSummary } from "../../lib/tauri/summary";

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
  const [panelState, setPanelState] = useState<CodexPanelState | null>(null);
  const [claudeCodePanelState, setClaudeCodePanelState] = useState<CodexPanelState | null>(null);
  const [preferences, setPreferences] = useState<UserPreferences | null>(null);
  const [notificationResult, setNotificationResult] = useState<NotificationCheckResult | null>(null);
  const [currentView, setCurrentView] = useState<"panel" | "settings">("panel");
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshFeedback, setRefreshFeedback] = useState<"idle" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [isScrolled, setIsScrolled] = useState(false);
  const lastStablePanelState = useRef<CodexPanelState | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const [panel, claudeCodePanel, prefs] = await Promise.all([
          loadPanelState(),
          loadClaudeCodePanelState(),
          getPreferences()
        ]);
        setPanelState(panel);
        lastStablePanelState.current = panel;
        setClaudeCodePanelState(claudeCodePanel);
        setPreferences(prefs);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Failed to initialize app");
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

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
    if (isRefreshing) {
      return;
    }
    setIsRefreshing(true);
    setError(null);
    try {
      const [nextPanel, nextClaudeCodePanel] = await Promise.all([
        refreshPanelState(),
        manual ? refreshClaudeCodePanelState() : loadClaudeCodePanelState()
      ]);
      setPanelState(nextPanel);
      lastStablePanelState.current = nextPanel;
      setClaudeCodePanelState(nextClaudeCodePanel);
    } catch (refreshError) {
      setRefreshFeedback("error");
      window.setTimeout(() => setRefreshFeedback("idle"), 1000);
      setError(refreshError instanceof Error ? refreshError.message : "Refresh failed");
    } finally {
      setIsRefreshing(false);
    }
  };

  const savePreferences = async (patch: PreferencePatch) => {
    setError(null);
    try {
      const nextPreferences = await persistPreferences(patch);
      setPreferences(nextPreferences);
      if ("networkProxyMode" in patch || "networkProxyUrl" in patch) {
        const nextClaudeCodePanel = await refreshClaudeCodePanelState();
        setClaudeCodePanelState(nextClaudeCodePanel);
      }
      setPanelState((current) =>
        current
          ? {
              ...current,
              desktopSurface: {
                ...current.desktopSurface,
                summaryMode: nextPreferences.traySummaryMode,
                summaryText: formatTraySummary(
                  nextPreferences.traySummaryMode,
                  current.items
                )
              }
            }
          : current
      );
      return nextPreferences;
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Save failed");
      return null;
    }
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
    setError(null);
    try {
      const next = await applyAutostart(enabled);
      setPreferences(next);
      return next;
    } catch (autostartError) {
      setError(autostartError instanceof Error ? autostartError.message : "Autostart failed");
      return null;
    }
  };

  const copy = getCopy(preferences?.language ?? "zh-CN");
  const visiblePanelState = panelState ?? lastStablePanelState.current;
  const serviceOrder = preferences?.serviceOrder ?? ["codex", "claude-code"];
  const stateByServiceId: Record<string, CodexPanelState | null> = {
    codex: visiblePanelState,
    "claude-code": claudeCodePanelState
  };
  const visibleItems = useMemo(
    () =>
      serviceOrder.flatMap((serviceId) => {
        const state = stateByServiceId[serviceId];
        return state?.items ?? [];
      }),
    [claudeCodePanelState, serviceOrder, visiblePanelState]
  );
  const panelSummary = getPanelHealthSummary(visibleItems);
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
        : panelSummary.tone === "danger"
          ? copy.panelDangerSummary
              .replace("{service}", panelSummary.serviceName ?? "")
              .replace("{dimension}", ` ${localizeDimensionLabel(copy, panelSummary.dimensionLabel ?? "")}`)
          : copy.panelWarningSummary
              .replace("{service}", panelSummary.serviceName ?? "")
              .replace("{dimension}", ` ${localizeDimensionLabel(copy, panelSummary.dimensionLabel ?? "")}`);

  return (
    <AppStateContext.Provider
      value={{
        panelState: visiblePanelState,
        claudeCodePanelState,
        preferences,
        notificationResult,
        currentView,
        isLoading,
        isRefreshing,
        error,
        refreshPanel,
        savePreferences,
        sendTestNotification,
        setAutostart,
        openSettings: () => { setCurrentView("settings"); setIsScrolled(false); },
        closeSettings: () => { setCurrentView("panel"); setIsScrolled(false); }
      }}
    >
      <main className="h-screen overflow-hidden bg-transparent p-3 text-slate-900">
        <div className="mx-auto flex h-full w-full max-w-[380px] flex-col rounded-2xl border border-white/70 bg-white/90 p-3 shadow-sm">
          <div
            className={`sticky top-0 z-10 -mx-3 -mt-3 mb-3 flex items-center justify-between rounded-t-2xl bg-white/95 px-4 py-3 backdrop-blur-sm transition-shadow ${isScrolled ? "border-b border-slate-200 shadow-sm" : ""}`}
          >
            {currentView === "panel" ? (
              <>
                <div className="min-w-0">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">{copy.subtitle}</div>
                  <div className={`truncate text-sm font-semibold ${summaryToneClass}`}>{summaryText}</div>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    aria-label={isRefreshing ? copy.refreshing : copy.refresh}
                    className={`flex h-9 w-9 items-center justify-center rounded-full border bg-white transition-colors hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-60 ${
                      refreshFeedback === "error"
                        ? "border-rose-200 text-rose-600"
                        : "border-slate-200 text-slate-700 hover:border-slate-300"
                    }`}
                    disabled={isRefreshing}
                    onClick={() => void refreshPanel()}
                    title={isRefreshing ? copy.refreshing : copy.refresh}
                    type="button"
                  >
                    <span className={isRefreshing ? "animate-spin" : ""}>
                      <RefreshIcon />
                    </span>
                  </button>
                  <button
                    aria-label={copy.settings}
                    className="flex h-9 w-9 items-center justify-center rounded-full border border-emerald-200 bg-white text-emerald-700 transition-colors hover:border-emerald-300 hover:text-emerald-800"
                    onClick={() => setCurrentView("settings")}
                    title={copy.settings}
                    type="button"
                  >
                    <SettingsIcon />
                  </button>
                </div>
              </>
            ) : (
              <>
                <span className="text-xs uppercase tracking-[0.16em] text-slate-500">{copy.settings}</span>
                <button
                  aria-label={copy.back}
                  className="inline-flex items-center gap-1 rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-medium text-slate-700"
                  onClick={() => setCurrentView("panel")}
                  type="button"
                >
                  <BackIcon />
                  {copy.back}
                </button>
              </>
            )}
          </div>
          <div
            className="relative flex-1 overflow-hidden"
          >
            {isLoading && !panelState && !preferences ? (
              <div className="rounded-2xl bg-white p-8 text-center text-sm text-slate-500">{copy.loading}</div>
            ) : (
              <div
                className={`flex h-full w-[200%] gap-6 transition-transform duration-300 ease-out ${currentView === "panel" ? "translate-x-0" : "-translate-x-[calc(50%+0.75rem)]"}`}
              >
                <div
                  ref={scrollContainerRef}
                  className="w-1/2 shrink-0 overflow-y-auto overflow-x-hidden"
                  onScroll={(event) => setIsScrolled(event.currentTarget.scrollTop > 4)}
                >{<PanelView />}</div>
                <div
                  className="w-1/2 shrink-0 overflow-y-auto overflow-x-hidden"
                  onScroll={(event) => setIsScrolled(event.currentTarget.scrollTop > 4)}
                >{preferences ? <SettingsView /> : null}</div>
              </div>
            )}
          </div>
        </div>
      </main>
    </AppStateContext.Provider>
  );
};
