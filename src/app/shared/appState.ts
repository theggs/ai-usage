import { createContext, useContext } from "react";
import type {
  CodexPanelState,
  NotificationCheckResult,
  PreferencePatch,
  UserPreferences
} from "../../lib/tauri/contracts";

export interface AppStateValue {
  panelState: CodexPanelState | null;
  preferences: UserPreferences | null;
  notificationResult: NotificationCheckResult | null;
  currentView: "panel" | "settings";
  isLoading: boolean;
  error: string | null;
  refreshPanel: () => Promise<void>;
  savePreferences: (patch: PreferencePatch) => Promise<void>;
  sendTestNotification: () => Promise<void>;
  setAutostart: (enabled: boolean) => Promise<void>;
  openSettings: () => void;
  closeSettings: () => void;
}

export const AppStateContext = createContext<AppStateValue | null>(null);

export const useAppState = () => {
  const value = useContext(AppStateContext);
  if (!value) {
    throw new Error("AppStateContext is not available");
  }
  return value;
};
