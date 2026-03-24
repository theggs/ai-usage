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

const KNOWN_SERVICE_IDS = ["codex", "claude-code"] as const;
const DEFAULT_MENUBAR_SERVICE = "codex";

const normalizeServiceOrder = (value: string[] | undefined, current: UserPreferences["serviceOrder"]) => {
  const next = (value ?? current).filter((serviceId): serviceId is string => KNOWN_SERVICE_IDS.includes(serviceId as typeof KNOWN_SERVICE_IDS[number]));
  const deduped = Array.from(new Set(next));
  for (const serviceId of KNOWN_SERVICE_IDS) {
    if (!deduped.includes(serviceId)) {
      deduped.push(serviceId);
    }
  }
  return deduped;
};

const normalizeMenubarService = (
  value: string | undefined,
  serviceOrder: UserPreferences["serviceOrder"],
  claudeCodeUsageEnabled: boolean
) => {
  const candidate =
    value && KNOWN_SERVICE_IDS.includes(value as typeof KNOWN_SERVICE_IDS[number])
      ? value
      : DEFAULT_MENUBAR_SERVICE;

  if (!claudeCodeUsageEnabled && candidate === "claude-code") {
    return DEFAULT_MENUBAR_SERVICE;
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
    refreshIntervalMinutes: Math.max(
      MIN_REFRESH_INTERVAL,
      patch.refreshIntervalMinutes ?? current.refreshIntervalMinutes
    ),
    lastSavedAt: new Date().toISOString()
  };

  next.menubarService = normalizeMenubarService(
    patch.menubarService ?? current.menubarService,
    next.serviceOrder,
    next.claudeCodeUsageEnabled
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
