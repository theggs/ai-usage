import type { UserPreferences } from "../../lib/tauri/contracts";

export const defaultPreferences: UserPreferences = {
  language: "zh-CN",
  refreshIntervalMinutes: 15,
  traySummaryMode: "lowest-remaining",
  autostartEnabled: true,
  notificationTestEnabled: true,
  lastSavedAt: new Date(0).toISOString(),
  menubarService: "codex",
  serviceOrder: ["codex", "claude-code"],
  networkProxyMode: "system",
  networkProxyUrl: "",
  onboardingDismissedAt: undefined
};
