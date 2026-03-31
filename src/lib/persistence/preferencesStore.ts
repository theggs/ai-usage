import { defaultPreferences } from "../../features/preferences/defaultPreferences";
import type { PreferencePatch, UserPreferences } from "../tauri/contracts";
import { providerIds, menubarServiceIds, PROVIDERS } from "../tauri/registry";

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

const normalizeNetworkProxyMode = (
  value?: string
): UserPreferences["networkProxyMode"] => {
  switch (value) {
    case "system":
    case "manual":
    case "off":
      return value;
    default:
      return defaultPreferences.networkProxyMode;
  }
};

const DEFAULT_MENUBAR_SERVICE: UserPreferences["menubarService"] = "codex";

const normalizeServiceOrder = (value: string[] | undefined, current: UserPreferences["serviceOrder"]) => {
  const known = providerIds();
  const next = (value ?? current).filter((serviceId): serviceId is string => known.includes(serviceId));
  const deduped = Array.from(new Set(next));
  for (const serviceId of known) {
    if (!deduped.includes(serviceId)) {
      deduped.push(serviceId);
    }
  }
  return deduped;
};

const normalizeMenubarService = (
  value: string | undefined,
  serviceOrder: UserPreferences["serviceOrder"],
  providerEnabledMap: Record<string, boolean>
) : UserPreferences["menubarService"] => {
  const knownMenubar = menubarServiceIds();
  const candidate: string =
    value && knownMenubar.includes(value)
      ? value
      : DEFAULT_MENUBAR_SERVICE;

  if (candidate === "auto") {
    return "auto";
  }

  if (candidate !== "auto" && providerEnabledMap[candidate] === false) {
    // Fall back to the first enabled provider or default
    const firstEnabled = serviceOrder.find((id) => providerEnabledMap[id] !== false);
    return firstEnabled ?? DEFAULT_MENUBAR_SERVICE;
  }

  if (serviceOrder.includes(candidate)) {
    return candidate;
  }

  return serviceOrder[0] ?? DEFAULT_MENUBAR_SERVICE;
};

export const normalizePreferences = (
  patch: PreferencePatch & { displayMode?: string } = {},
  current: UserPreferences = defaultPreferences
): UserPreferences => {
  const traySummaryMode = normalizeLegacyTraySummaryMode(
    patch.traySummaryMode ?? patch.displayMode ?? current.traySummaryMode
  );
  const networkProxyMode = normalizeNetworkProxyMode(
    patch.networkProxyMode ?? current.networkProxyMode
  );

  // Seed providerEnabled from registry defaults / legacy migration
  const rawProviderEnabled = patch.providerEnabled ?? current.providerEnabled ?? {};
  const providerEnabledMap: Record<string, boolean> = { ...rawProviderEnabled };
  if (Object.keys(providerEnabledMap).length === 0) {
    // Seed from registry defaults, migrating legacy claudeCodeUsageEnabled
    for (const provider of PROVIDERS) {
      if (provider.id === "claude-code") {
        providerEnabledMap[provider.id] =
          patch.claudeCodeUsageEnabled ?? current.claudeCodeUsageEnabled ?? provider.defaultEnabled;
      } else {
        providerEnabledMap[provider.id] = provider.defaultEnabled;
      }
    }
  } else {
    // Ensure all registry providers have an entry
    for (const provider of PROVIDERS) {
      if (!(provider.id in providerEnabledMap)) {
        providerEnabledMap[provider.id] = provider.defaultEnabled;
      }
    }
    // Migrate legacy claudeCodeUsageEnabled into providerEnabled when explicitly patched
    if (patch.claudeCodeUsageEnabled !== undefined && !patch.providerEnabled) {
      providerEnabledMap["claude-code"] = patch.claudeCodeUsageEnabled;
    }
  }

  const next: UserPreferences = {
    ...current,
    ...patch,
    traySummaryMode,
    networkProxyMode,
    networkProxyUrl: (patch.networkProxyUrl ?? current.networkProxyUrl ?? "").trim(),
    serviceOrder: normalizeServiceOrder(patch.serviceOrder, current.serviceOrder),
    onboardingDismissedAt: patch.onboardingDismissedAt ?? current.onboardingDismissedAt,
    claudeCodeUsageEnabled: patch.claudeCodeUsageEnabled ?? current.claudeCodeUsageEnabled,
    claudeCodeDisclosureDismissedAt:
      patch.claudeCodeDisclosureDismissedAt ?? current.claudeCodeDisclosureDismissedAt,
    providerEnabled: providerEnabledMap,
    refreshIntervalMinutes: Math.max(
      MIN_REFRESH_INTERVAL,
      patch.refreshIntervalMinutes ?? current.refreshIntervalMinutes
    ),
    lastSavedAt: new Date().toISOString()
  };

  next.menubarService = normalizeMenubarService(
    patch.menubarService ?? current.menubarService,
    next.serviceOrder,
    next.providerEnabled
  );

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

  if (!["system", "manual", "off"].includes(next.networkProxyMode)) {
    throw new Error("Unsupported network proxy mode");
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
