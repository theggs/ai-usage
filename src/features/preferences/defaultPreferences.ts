import type { UserPreferences } from "../../lib/tauri/contracts";

export const defaultPreferences: UserPreferences = {
  language: "zh-CN",
  refreshIntervalMinutes: 15,
  displayMode: "icon-plus-percent",
  autostartEnabled: true,
  notificationTestEnabled: true,
  lastSavedAt: new Date(0).toISOString()
};
