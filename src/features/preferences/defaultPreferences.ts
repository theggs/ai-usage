import type { UserPreferences } from "../../lib/tauri/contracts";
import { PROVIDERS } from "../../lib/tauri/registry";

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
  onboardingDismissedAt: undefined,
  claudeCodeUsageEnabled: false,
  claudeCodeDisclosureDismissedAt: undefined,
  providerEnabled: Object.fromEntries(PROVIDERS.map((p) => [p.id, p.defaultEnabled])),
};
