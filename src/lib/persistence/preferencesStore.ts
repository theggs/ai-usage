import { defaultPreferences } from "../../features/preferences/defaultPreferences";
import type { PreferencePatch, UserPreferences } from "../tauri/contracts";

const STORAGE_KEY = "ai-usage.preferences";
const MIN_REFRESH_INTERVAL = 5;

export const normalizePreferences = (
  patch: PreferencePatch = {},
  current: UserPreferences = defaultPreferences
): UserPreferences => {
  const next: UserPreferences = {
    ...current,
    ...patch,
    refreshIntervalMinutes: Math.max(
      MIN_REFRESH_INTERVAL,
      patch.refreshIntervalMinutes ?? current.refreshIntervalMinutes
    ),
    lastSavedAt: new Date().toISOString()
  };

  if (!["zh-CN", "en-US"].includes(next.language)) {
    throw new Error("Unsupported language");
  }

  if (!["icon-only", "icon-plus-percent", "multi-dimension"].includes(next.displayMode)) {
    throw new Error("Unsupported display mode");
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
