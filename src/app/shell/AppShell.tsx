import { useEffect, useState } from "react";
import { PanelView } from "../panel/PanelView";
import { SettingsView } from "../settings/SettingsView";
import { AppStateContext } from "../shared/appState";
import { getCopy } from "../shared/i18n";
import { loadPanelState, refreshPanelState } from "../../features/demo-services/panelController";
import { sendDemoNotification } from "../../features/notifications/notificationController";
import {
  applyAutostart,
  getPreferences,
  persistPreferences
} from "../../features/preferences/preferencesController";
import type {
  DemoPanelState,
  NotificationCheckResult,
  PreferencePatch,
  UserPreferences
} from "../../lib/tauri/contracts";
import { formatTraySummary } from "../../lib/tauri/summary";

export const AppShell = () => {
  const [panelState, setPanelState] = useState<DemoPanelState | null>(null);
  const [preferences, setPreferences] = useState<UserPreferences | null>(null);
  const [notificationResult, setNotificationResult] = useState<NotificationCheckResult | null>(null);
  const [currentView, setCurrentView] = useState<"panel" | "settings">("panel");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const [panel, prefs] = await Promise.all([loadPanelState(), getPreferences()]);
        setPanelState(panel);
        setPreferences(prefs);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Failed to initialize app");
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const refreshPanel = async () => {
    setIsLoading(true);
    setError(null);
    try {
      setPanelState(await refreshPanelState());
    } catch (refreshError) {
      setError(refreshError instanceof Error ? refreshError.message : "Refresh failed");
    } finally {
      setIsLoading(false);
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
                summaryMode:
                  nextPreferences.displayMode === "icon-only"
                    ? "icon-only"
                    : nextPreferences.displayMode === "icon-plus-percent"
                      ? "single-dimension"
                      : "multi-dimension",
                summaryText: formatTraySummary(
                  nextPreferences.displayMode === "icon-only"
                    ? "icon-only"
                    : nextPreferences.displayMode === "icon-plus-percent"
                      ? "single-dimension"
                      : "multi-dimension",
                  current.items
                )
              }
            }
          : current
      );
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Save failed");
    }
  };

  const sendTestNotification = async () => {
    setError(null);
    try {
      setNotificationResult(await sendDemoNotification());
    } catch (notifyError) {
      setError(notifyError instanceof Error ? notifyError.message : "Notification failed");
    }
  };

  const setAutostart = async (enabled: boolean) => {
    setError(null);
    try {
      setPreferences(await applyAutostart(enabled));
    } catch (autostartError) {
      setError(autostartError instanceof Error ? autostartError.message : "Autostart failed");
    }
  };

  const copy = getCopy(preferences?.language ?? "zh-CN");

  return (
    <AppStateContext.Provider
      value={{
        panelState,
        preferences,
        notificationResult,
        currentView,
        isLoading,
        error,
        refreshPanel,
        savePreferences,
        sendTestNotification,
        setAutostart,
        openSettings: () => setCurrentView("settings"),
        closeSettings: () => setCurrentView("panel")
      }}
    >
      <main className="min-h-screen bg-transparent p-4 text-slate-900">
        <div className="mx-auto grid max-w-xl gap-4 rounded-[32px] border border-white/60 bg-white/45 p-4 shadow-2xl shadow-emerald-950/10 backdrop-blur-xl">
          <div className="flex items-center justify-between rounded-full bg-white/70 px-4 py-2 text-xs uppercase tracking-[0.2em] text-slate-500">
            <span>{copy.title}</span>
            <span>{currentView === "panel" ? copy.subtitle : copy.settings}</span>
          </div>
          {isLoading && !panelState && !preferences ? (
            <div className="rounded-3xl bg-white/70 p-8 text-center text-sm text-slate-500">{copy.loading}</div>
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
