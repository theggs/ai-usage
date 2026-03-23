import {
  createDemoPanelState
} from "../../features/demo-services/demoData";
import { defaultPreferences } from "../../features/preferences/defaultPreferences";
import {
  loadCodexAccounts,
  removeCodexAccount,
  saveCodexAccount,
  setCodexAccountEnabled
} from "../persistence/codexAccountStore";
import {
  loadPreferences,
  savePreferences as saveLocalPreferences
} from "../persistence/preferencesStore";
import type {
  CodexAccount,
  CodexAccountDraft,
  CodexPanelState,
  NotificationCheckResult,
  PreferencePatch,
  RuntimeFlags,
  UserPreferences
} from "./contracts";
import { formatTraySummary } from "./summary";

declare global {
  interface Window {
    __TAURI_INTERNALS__?: unknown;
  }
}

const hasTauriRuntime = () => typeof window !== "undefined" && !!window.__TAURI_INTERNALS__;

const withSummary = (panelState: CodexPanelState, preferences: UserPreferences): CodexPanelState => {
  return {
    ...panelState,
    desktopSurface: {
      ...panelState.desktopSurface,
      summaryMode: preferences.traySummaryMode,
      summaryText: formatTraySummary(preferences.traySummaryMode, panelState.items)
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
      return createDemoPanelState(preferences.traySummaryMode) as T;
    }
    case "get_codex_panel_state":
    case "refresh_codex_panel_state": {
      const preferences = loadPreferences();
      return createDemoPanelState(preferences.traySummaryMode) as T;
    }
    case "get_claude_code_panel_state":
    case "refresh_claude_code_panel_state": {
      const preferences = loadPreferences();
      return createDemoPanelState(preferences.traySummaryMode) as T;
    }
    case "get_codex_accounts":
      return loadCodexAccounts() as T;
    case "save_codex_account":
      return saveCodexAccount((args?.draft ?? {}) as CodexAccountDraft) as T;
    case "remove_codex_account":
      return removeCodexAccount(String(args?.accountId ?? "")) as T;
    case "set_codex_account_enabled":
      return setCodexAccountEnabled(String(args?.accountId ?? ""), !!args?.enabled) as T;
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
    case "get_runtime_flags":
      return {
        isE2E: false
      } as T;
    default:
      throw new Error(`Unsupported command: ${command}`);
  }
};

export const tauriClient = {
  getCodexPanelState: async () => {
    const [panelState, preferences] = await Promise.all([
      invoke<CodexPanelState>("get_codex_panel_state"),
      tauriClient.getPreferences()
    ]);
    return withSummary(panelState, preferences);
  },
  refreshCodexPanelState: async () => {
    const [panelState, preferences] = await Promise.all([
      invoke<CodexPanelState>("refresh_codex_panel_state"),
      tauriClient.getPreferences()
    ]);
    return withSummary(panelState, preferences);
  },
  getClaudeCodePanelState: async () => {
    const [panelState, preferences] = await Promise.all([
      invoke<CodexPanelState>("get_claude_code_panel_state"),
      tauriClient.getPreferences()
    ]);
    return withSummary(panelState, preferences);
  },
  refreshClaudeCodePanelState: async () => {
    const [panelState, preferences] = await Promise.all([
      invoke<CodexPanelState>("refresh_claude_code_panel_state"),
      tauriClient.getPreferences()
    ]);
    return withSummary(panelState, preferences);
  },
  getCodexAccounts: () =>
    invoke<CodexAccount[]>("get_codex_accounts"),
  saveCodexAccount: (draft: CodexAccountDraft) =>
    invoke<CodexAccount[]>("save_codex_account", { draft }),
  removeCodexAccount: (accountId: string) =>
    invoke<CodexAccount[]>("remove_codex_account", { accountId }),
  setCodexAccountEnabled: (accountId: string, enabled: boolean) =>
    invoke<CodexAccount[]>("set_codex_account_enabled", { accountId, enabled }),
  getPreferences: async (): Promise<UserPreferences> => {
    const preferences = await invoke<UserPreferences>("get_preferences");
    return preferences ?? defaultPreferences;
  },
  savePreferences: (patch: PreferencePatch) =>
    invoke<UserPreferences>("save_preferences", { patch }),
  setAutostart: (enabled: boolean) =>
    invoke<UserPreferences>("set_autostart", { enabled }),
  getRuntimeFlags: () =>
    invoke<RuntimeFlags>("get_runtime_flags"),
  sendTestNotification: (message?: string) =>
    invoke<NotificationCheckResult>("send_test_notification", { message })
};

Object.assign(tauriClient, {
  getDemoPanelState: tauriClient.getCodexPanelState,
  refreshDemoPanelState: tauriClient.refreshCodexPanelState
});
