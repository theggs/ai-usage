import { defaultPreferences } from "../../features/preferences/defaultPreferences";
import type { PreferencePatch, UserPreferences } from "../tauri/contracts";

const STORAGE_KEY = "ai-usage.preferences";
const MIN_REFRESH_INTERVAL = 5;

const normalizeLegacyTraySummaryMode = (value?: string): UserPreferences["traySummaryMode"] => {
  switch (value) {
    case "icon-only":
      return "icon-only";
    case "icon-plus-percent":
      return "lowest-remaining";
    case "multi-dimension":
      return "multi-dimension";
    case "lowest-remaining":
    case "window-5h":
    case "window-week":
      return value;
    default:
      return defaultPreferences.traySummaryMode;
  }
};

export const normalizePreferences = (
  patch: PreferencePatch & { displayMode?: string } = {},
  current: UserPreferences = defaultPreferences
): UserPreferences => {
  const traySummaryMode = normalizeLegacyTraySummaryMode(
    patch.traySummaryMode ?? patch.displayMode ?? current.traySummaryMode
  );

  const next: UserPreferences = {
    ...current,
    ...patch,
    traySummaryMode,
    refreshIntervalMinutes: Math.max(
      MIN_REFRESH_INTERVAL,
      patch.refreshIntervalMinutes ?? current.refreshIntervalMinutes
    ),
    lastSavedAt: new Date().toISOString()
  };

  if (!["zh-CN", "en-US"].includes(next.language)) {
    throw new Error("Unsupported language");
  }

  if (
    !["icon-only", "lowest-remaining", "window-5h", "window-week", "multi-dimension"].includes(
      next.traySummaryMode
    )
  ) {
    throw new Error("Unsupported tray summary mode");
  }

  return next;
};

export const loadPreferences = (): UserPreferences => {
  if (typeof localStorage === "undefined") {
    return defaultPreferences;
  }

  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return defaultPreferences;
  }

  try {
    return normalizePreferences(JSON.parse(raw), defaultPreferences);
  } catch {
    return defaultPreferences;
  }
};

export const savePreferences = (patch: PreferencePatch): UserPreferences => {
  const next = normalizePreferences(patch, loadPreferences());
  if (typeof localStorage !== "undefined") {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }
  return next;
};
