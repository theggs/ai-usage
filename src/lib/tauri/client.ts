import {
  createDemoPanelState
} from "../../features/demo-services/demoData";
import { defaultPreferences } from "../../features/preferences/defaultPreferences";
import {
  loadPreferences,
  savePreferences as saveLocalPreferences
} from "../persistence/preferencesStore";
import type {
  DemoPanelState,
  NotificationCheckResult,
  PreferencePatch,
  UserPreferences
} from "./contracts";
import { formatTraySummary } from "./summary";

declare global {
  interface Window {
    __TAURI_INTERNALS__?: unknown;
  }
}

const hasTauriRuntime = () => typeof window !== "undefined" && !!window.__TAURI_INTERNALS__;

const withSummary = (panelState: DemoPanelState, preferences: UserPreferences): DemoPanelState => {
  const summaryMode =
    preferences.displayMode === "icon-only"
      ? "icon-only"
      : preferences.displayMode === "icon-plus-percent"
        ? "single-dimension"
        : "multi-dimension";

  return {
    ...panelState,
    desktopSurface: {
      ...panelState.desktopSurface,
      summaryMode,
      summaryText: formatTraySummary(summaryMode, panelState.items)
    }
  };
};

const invoke = async <T>(command: string, args?: Record<string, unknown>): Promise<T> => {
  if (hasTauriRuntime()) {
    const { invoke: tauriInvoke } = await import("@tauri-apps/api/core");
    return tauriInvoke<T>(command, args);
  }

  switch (command) {
    case "get_demo_panel_state":
    case "refresh_demo_panel_state": {
      const preferences = loadPreferences();
      const summaryMode =
        preferences.displayMode === "icon-only"
          ? "icon-only"
          : preferences.displayMode === "icon-plus-percent"
            ? "single-dimension"
            : "multi-dimension";
      return createDemoPanelState(summaryMode) as T;
    }
    case "get_preferences":
      return loadPreferences() as T;
    case "save_preferences":
      return saveLocalPreferences((args?.patch ?? {}) as PreferencePatch) as T;
    case "set_autostart":
      return saveLocalPreferences({ autostartEnabled: !!args?.enabled }) as T;
    case "send_test_notification":
      return {
        notificationId: "demo-notification",
        triggeredAt: new Date().toISOString(),
        result: "sent",
        messagePreview: typeof args?.message === "string" ? args.message : "AIUsage demo notification"
      } as T;
    default:
      throw new Error(`Unsupported command: ${command}`);
  }
};

export const tauriClient = {
  getDemoPanelState: async () => {
    const [panelState, preferences] = await Promise.all([
      invoke<DemoPanelState>("get_demo_panel_state"),
      tauriClient.getPreferences()
    ]);
    return withSummary(panelState, preferences);
  },
  refreshDemoPanelState: async () => {
    const [panelState, preferences] = await Promise.all([
      invoke<DemoPanelState>("refresh_demo_panel_state"),
      tauriClient.getPreferences()
    ]);
    return withSummary(panelState, preferences);
  },
  getPreferences: async (): Promise<UserPreferences> => {
    const preferences = await invoke<UserPreferences>("get_preferences");
    return preferences ?? defaultPreferences;
  },
  savePreferences: (patch: PreferencePatch) =>
    invoke<UserPreferences>("save_preferences", { patch }),
  setAutostart: (enabled: boolean) =>
    invoke<UserPreferences>("set_autostart", { enabled }),
  sendTestNotification: (message?: string) =>
    invoke<NotificationCheckResult>("send_test_notification", { message })
};
