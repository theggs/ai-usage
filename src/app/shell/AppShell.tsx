import { useEffect, useRef, useState } from "react";
import { PanelView } from "../panel/PanelView";
import { SettingsView } from "../settings/SettingsView";
import { AppStateContext } from "../shared/appState";
import { getCopy } from "../shared/i18n";
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
import { formatTraySummary } from "../../lib/tauri/summary";

export const AppShell = () => {
  const [panelState, setPanelState] = useState<CodexPanelState | null>(null);
  const [claudeCodePanelState, setClaudeCodePanelState] = useState<CodexPanelState | null>(null);
  const [preferences, setPreferences] = useState<UserPreferences | null>(null);
  const [notificationResult, setNotificationResult] = useState<NotificationCheckResult | null>(null);
  const [currentView, setCurrentView] = useState<"panel" | "settings">("panel");
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastStablePanelState = useRef<CodexPanelState | null>(null);

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

  const refreshPanel = async () => {
    if (isRefreshing) {
      return;
    }
    setIsRefreshing(true);
    setError(null);
    try {
      const [nextPanel, nextClaudeCodePanel] = await Promise.all([
        refreshPanelState(),
        refreshClaudeCodePanelState()
      ]);
      setPanelState(nextPanel);
      lastStablePanelState.current = nextPanel;
      setClaudeCodePanelState(nextClaudeCodePanel);
    } catch (refreshError) {
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
        openSettings: () => setCurrentView("settings"),
        closeSettings: () => setCurrentView("panel")
      }}
    >
      <main className="min-h-screen bg-transparent p-3 text-slate-900">
        <div className="mx-auto grid w-full max-w-[380px] gap-3 rounded-2xl border border-white/70 bg-white/90 p-3 shadow-sm">
          <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-2 text-xs uppercase tracking-[0.16em] text-slate-500">
            <span>{copy.title}</span>
            <span>{currentView === "panel" ? copy.subtitle : copy.settings}</span>
          </div>
          {isLoading && !panelState && !preferences ? (
            <div className="rounded-2xl bg-white p-8 text-center text-sm text-slate-500">{copy.loading}</div>
          ) : currentView === "panel" ? (
            <PanelView />
          ) : preferences ? (
            <SettingsView />
          ) : null}
        </div>
      </main>
    </AppStateContext.Provider>
  );
};
