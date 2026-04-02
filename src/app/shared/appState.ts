import { createContext, useContext } from "react";
import type {
  CodexPanelState,
  NotificationCheckResult,
  PreferencePatch,
  UserPreferences
} from "../../lib/tauri/contracts";

export interface AppStateValue {
  providerStates: Record<string, CodexPanelState | null>;
  refreshingProviders: Set<string>;
  preferences: UserPreferences | null;
  notificationResult: NotificationCheckResult | null;
  currentView: "panel" | "settings" | "about";
  displayNowMs: number;
  isLoading: boolean;
  isE2EMode: boolean;
  error: string | null;
  refreshPanel: (manual?: boolean) => Promise<void>;
  savePreferences: (patch: PreferencePatch) => Promise<UserPreferences | null>;
  sendTestNotification: () => Promise<NotificationCheckResult | null>;
  setAutostart: (enabled: boolean) => Promise<UserPreferences | null>;
  openSettings: () => void;
  closeSettings: () => void;
  openAbout: () => void;
  closeAbout: () => void;
}

export const AppStateContext = createContext<AppStateValue | null>(null);

export const useAppState = () => {
  const value = useContext(AppStateContext);
  if (!value) {
    throw new Error("AppStateContext is not available");
  }
  return value;
};
