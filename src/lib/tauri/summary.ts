import type {
  CodexLimitStatus,
  CodexPanelState,
  PanelPlaceholderItem,
  QuotaDimension,
  QuotaProgressTone,
  ServiceStatusCard,
  SnapshotStatus,
  SummaryMode,
  UserPreferences
} from "./contracts";
import { getBurnRateDisplay as getComputedBurnRateDisplay } from "./burnRate";
import { getProvider, providerIds } from "./registry";

export { getBurnRateDisplay } from "./burnRate";

export type ServiceAlertLevel = "normal" | "warning" | "danger";
export type QuotaHealthSource = "pace" | "fallback" | "none";

export interface QuotaHealthSignal {
  level: ServiceAlertLevel;
  source: QuotaHealthSource;
  pace?: "on-track" | "behind" | "far-behind";
  status: CodexLimitStatus;
  progressTone: QuotaProgressTone;
}

export interface PanelHealthSummary {
  tone: "healthy" | "warning" | "danger" | "empty";
  serviceId?: string;
  serviceName?: string;
  dimensionLabel?: string;
  remainingPercent?: number;
  source?: QuotaHealthSource;
  pace?: "on-track" | "behind" | "far-behind";
}

export interface TrayVisualState {
  serviceId: string;
  serviceName: string;
  summaryText?: string;
  tooltipText: string;
  severity: "normal" | "warning" | "danger" | "empty";
}

export interface VisibleServiceScope {
  visiblePanelServiceOrder: string[];
  visibleMenubarServices: string[];
  hasVisibleClaudeCode: boolean;
}

export interface QuotaHealthCandidate {
  item: PanelPlaceholderItem;
  dimension: QuotaDimension;
  health: QuotaHealthSignal;
}

const assertNever = (value: never): never => {
  throw new Error(`Unhandled value: ${JSON.stringify(value)}`);
};

const MENUBAR_AUTO_SERVICE = "auto";

export const getVisibleServiceScope = (
  preferences?: Pick<UserPreferences, "serviceOrder" | "providerEnabled"> | null
): VisibleServiceScope => {
  const allIds = providerIds();
  const serviceOrder = preferences?.serviceOrder?.length ? preferences.serviceOrder : allIds;
  const visiblePanelServiceOrder = serviceOrder.filter((serviceId) => {
    const explicitEnabled = preferences?.providerEnabled?.[serviceId];
    if (explicitEnabled !== undefined) return explicitEnabled;
    return getProvider(serviceId)?.defaultEnabled ?? false;
  });

  return {
    visiblePanelServiceOrder,
    visibleMenubarServices: [...visiblePanelServiceOrder, MENUBAR_AUTO_SERVICE],
    hasVisibleClaudeCode: visiblePanelServiceOrder.includes("claude-code")
  };
};

export const markPanelStateRefreshing = (
  panelState: CodexPanelState | null
): CodexPanelState | null => {
  if (!panelState) {
    return null;
  }

  return {
    ...panelState,
    items: panelState.items.map((item) => ({
      ...item,
      badgeLabel: "Refreshing",
      statusLabel: "refreshing"
    }))
  };
};

export const getQuotaStatus = (remainingPercent?: number): CodexLimitStatus => {
  if (remainingPercent === undefined) {
    return "unknown";
  }

  if (remainingPercent > 50) {
    return "healthy";
  }

  if (remainingPercent >= 20) {
    return "warning";
  }

  return "exhausted";
};

export const getQuotaProgressTone = (remainingPercent?: number): QuotaProgressTone => {
  switch (getQuotaStatus(remainingPercent)) {
    case "healthy":
      return "success";
    case "warning":
      return "warning";
    case "exhausted":
      return "danger";
    default:
      return "muted";
  }
};

export const decorateQuotaDimension = (
  dimension: Omit<QuotaDimension, "status" | "progressTone">
): QuotaDimension => ({
  ...dimension,
  status: getQuotaStatus(dimension.remainingPercent),
  progressTone: getQuotaProgressTone(dimension.remainingPercent)
});

export const getQuotaBurnRateDisplay = (
  dimension: QuotaDimension,
  nowMs?: number
) =>
  getComputedBurnRateDisplay({
    label: dimension.label,
    remainingPercent: dimension.remainingPercent,
    resetsAt: dimension.resetsAt,
    nowMs
  });

const statusToAlertLevel = (status: CodexLimitStatus): ServiceAlertLevel => {
  switch (status) {
    case "exhausted":
      return "danger";
    case "warning":
      return "warning";
    default:
      return "normal";
  }
};

export const getQuotaHealthSignal = (
  dimension: QuotaDimension,
  nowMs?: number
): QuotaHealthSignal => {
  const burnRate = getQuotaBurnRateDisplay(dimension, nowMs);
  if (burnRate?.pace === "far-behind") {
    return {
      level: "danger",
      source: "pace",
      pace: "far-behind",
      status: "exhausted",
      progressTone: "danger"
    };
  }

  if (burnRate?.pace === "behind") {
    return {
      level: "warning",
      source: "pace",
      pace: "behind",
      status: "warning",
      progressTone: "warning"
    };
  }

  if (burnRate?.pace === "on-track") {
    return {
      level: "normal",
      source: "pace",
      pace: "on-track",
      status: "healthy",
      progressTone: "success"
    };
  }

  if (dimension.remainingPercent === undefined) {
    return {
      level: "normal",
      source: "none",
      status: "unknown",
      progressTone: "muted"
    };
  }

  const status = getQuotaStatus(dimension.remainingPercent);
  return {
    level: statusToAlertLevel(status),
    source: "fallback",
    status,
    progressTone: getQuotaProgressTone(dimension.remainingPercent)
  };
};

const allDimensions = (items: PanelPlaceholderItem[]) => items.flatMap((item) => item.quotaDimensions);

const parseTimestamp = (value?: string) => {
  if (!value) return undefined;
  const timestamp = /^\d+$/.test(value) ? Number(value) * 1000 : Date.parse(value);
  return Number.isNaN(timestamp) ? undefined : timestamp;
};

const sortByRemainingPercent = (dimensions: QuotaDimension[]) =>
  dimensions
    .filter((dimension) => dimension.remainingPercent !== undefined)
    .sort((left, right) => (left.remainingPercent ?? 101) - (right.remainingPercent ?? 101));

const matches5h = (label: string) => /(^|\/)\s*5h\b/i.test(label) || /\b5h\b/i.test(label);
const matchesWeek = (label: string) => /\bweek\b/i.test(label) || /\/\s*7d\b/i.test(label) || /\b7d\b/i.test(label);
const inferWindowMinutes = (label: string) => {
  const normalized = label.toLowerCase();
  if (normalized.includes("5h")) return 300;
  if (normalized.includes("week") || normalized.includes("7d")) return 10080;
  const hourMatch = normalized.match(/(\d+)\s*h\b/);
  if (hourMatch) return Number(hourMatch[1]) * 60;
  const dayMatch = normalized.match(/(\d+)\s*d\b/);
  if (dayMatch) return Number(dayMatch[1]) * 1440;
  const minuteMatch = normalized.match(/(\d+)\s*m\b/);
  if (minuteMatch) return Number(minuteMatch[1]);
  return Number.MAX_SAFE_INTEGER;
};
export const sortQuotaDimensionsForDisplay = (dimensions: QuotaDimension[]) =>
  dimensions
    .map((dimension, index) => ({
      dimension,
      index
    }))
    .sort((left, right) => {
      const durationDifference = inferWindowMinutes(left.dimension.label) - inferWindowMinutes(right.dimension.label);
      if (durationDifference !== 0) {
        return durationDifference;
      }
      return left.index - right.index;
    })
    .map(({ dimension }) => dimension);

const sortByWindowDuration = (dimensions: QuotaDimension[]) =>
  sortQuotaDimensionsForDisplay(dimensions).filter((dimension) => dimension.remainingPercent !== undefined);

const healthLevelRank: Record<ServiceAlertLevel, number> = {
  danger: 0,
  warning: 1,
  normal: 2
};

const healthSourceRank: Record<QuotaHealthSource, number> = {
  pace: 0,
  fallback: 1,
  none: 2
};

export const getMostUrgentQuotaDimension = (
  items: PanelPlaceholderItem[],
  nowMs?: number
): QuotaHealthCandidate | undefined => {
  const rankedCandidates = items.flatMap((item, itemIndex) =>
    item.quotaDimensions.map((dimension, dimensionIndex) => ({
      item,
      dimension,
      health: getQuotaHealthSignal(dimension, nowMs),
      itemIndex,
      dimensionIndex
    }))
  );

  rankedCandidates.sort((left, right) => {
    const levelDifference = healthLevelRank[left.health.level] - healthLevelRank[right.health.level];
    if (levelDifference !== 0) {
      return levelDifference;
    }

    const sourceDifference = healthSourceRank[left.health.source] - healthSourceRank[right.health.source];
    if (sourceDifference !== 0) {
      return sourceDifference;
    }

    const windowDifference = inferWindowMinutes(left.dimension.label) - inferWindowMinutes(right.dimension.label);
    if (windowDifference !== 0) {
      return windowDifference;
    }

    if (left.itemIndex !== right.itemIndex) {
      return left.itemIndex - right.itemIndex;
    }

    return left.dimensionIndex - right.dimensionIndex;
  });

  return rankedCandidates[0];
};

const pickDimension = (summaryMode: SummaryMode, items: PanelPlaceholderItem[]) => {
  const dimensions = allDimensions(items);
  const sorted = sortByRemainingPercent(dimensions);

  if (summaryMode === "lowest-remaining") {
    return sorted[0];
  }

  if (summaryMode === "window-5h") {
    return sortByRemainingPercent(dimensions.filter((dimension) => matches5h(dimension.label)))[0] ?? sorted[0];
  }

  if (summaryMode === "window-week") {
    return sortByRemainingPercent(dimensions.filter((dimension) => matchesWeek(dimension.label)))[0] ?? sorted[0];
  }

  return undefined;
};

export const formatTraySummary = (
  summaryMode: SummaryMode,
  items: PanelPlaceholderItem[]
): string | undefined => {
  if (summaryMode === "icon-only") {
    return undefined;
  }

  if (summaryMode !== "multi-dimension") {
    const dimension = pickDimension(summaryMode, items);
    return dimension?.remainingPercent !== undefined ? `${dimension.remainingPercent}%` : undefined;
  }

  const dimensions = sortByWindowDuration(allDimensions(items));
  if (!dimensions.length) {
    return undefined;
  }

  return dimensions
    .filter((dimension) => dimension.remainingPercent !== undefined)
    .map((dimension) => `${dimension.remainingPercent}%`)
    .join(" / ") || undefined;
};

export const getServiceAlertLevel = (
  item: PanelPlaceholderItem,
  nowMs?: number
): ServiceAlertLevel => {
  return getMostUrgentQuotaDimension([item], nowMs)?.health.level ?? "normal";
};

export const getSeverityLabelKey = (item: PanelPlaceholderItem, nowMs?: number) => {
  const level = getServiceAlertLevel(item, nowMs);
  if (level === "danger") {
    return "danger";
  }
  if (level === "warning") {
    return "warning";
  }
  return undefined;
};

export const getPanelHealthSummary = (items: PanelPlaceholderItem[], nowMs?: number): PanelHealthSummary => {
  if (items.length === 0) {
    return { tone: "empty" };
  }

  const candidate = getMostUrgentQuotaDimension(items, nowMs);
  if (!candidate) {
    return { tone: "healthy" };
  }

  return {
    tone:
      candidate.health.level === "danger"
        ? "danger"
        : candidate.health.level === "warning"
          ? "warning"
          : "healthy",
    serviceId: candidate.item.serviceId,
    serviceName: candidate.item.serviceName,
    dimensionLabel: candidate.dimension.label,
    remainingPercent: candidate.dimension.remainingPercent,
    source: candidate.health.source,
    pace: candidate.health.pace
  };
};

export const haveAlignedRefreshTimes = (items: PanelPlaceholderItem[]) => {
  const parsed = items.map((item) => parseTimestamp(item.lastSuccessfulRefreshAt)).filter((value): value is number => value !== undefined);
  if (parsed.length <= 1) {
    return parsed.length === items.length;
  }

  const first = parsed[0];
  return first !== undefined && parsed.every((value) => value === first);
};

export const getSharedRefreshTimestamp = (items: PanelPlaceholderItem[]) => {
  if (!items.length || !haveAlignedRefreshTimes(items)) {
    return undefined;
  }

  return parseTimestamp(items[0]?.lastSuccessfulRefreshAt);
};

export const getTrayVisualState = (
  summaryMode: SummaryMode,
  menubarService: string,
  items: PanelPlaceholderItem[],
  nowMs?: number
): TrayVisualState => {
  const selectedItems = items.filter((item) => item.serviceId === menubarService);
  const serviceName = selectedItems[0]?.serviceName ?? (getProvider(menubarService)?.displayName ?? menubarService);
  const summaryText = formatTraySummary(summaryMode, selectedItems);
  const severity = selectedItems.length === 0
    ? "empty"
    : getMostUrgentQuotaDimension(selectedItems, nowMs)?.health.level ?? "normal";

  return {
    serviceId: menubarService,
    serviceName,
    summaryText,
    tooltipText: summaryText ? `AIUsage · ${serviceName} · ${summaryText}` : `AIUsage · ${serviceName}`,
    severity
  };
};

const statusToConnectionState = (status?: SnapshotStatus): ServiceStatusCard["connectionState"] => {
  if (!status) return "disconnected";
  switch (status.kind) {
    case "Fresh": return "connected";
    case "CliNotFound": case "NoCredentials": return "empty";
    case "NotLoggedIn": case "SessionRecovery": return "stale";
    case "RateLimited": return "disconnected";
    case "AccessDenied": case "ProxyInvalid": return "failed";
    case "TemporarilyUnavailable": return "disconnected";
    case "NoData": return "disconnected";
    case "Disabled": return "disconnected";
  }

  return assertNever(status);
};

const statusToPrimaryMessage = (status?: SnapshotStatus): string => {
  if (!status) return "Not connected";
  switch (status.kind) {
    case "Fresh": return "Connected";
    case "CliNotFound": return "CLI not installed";
    case "NotLoggedIn": return "Sign in required";
    case "NoCredentials": return "Not connected";
    case "SessionRecovery": return "Recovering session";
    case "RateLimited": return "Rate limited";
    case "AccessDenied": return "Access denied";
    case "ProxyInvalid": return "Proxy invalid";
    case "TemporarilyUnavailable": return `Temporarily unavailable: ${status.detail}`;
    case "NoData": return "No data yet";
    case "Disabled": return "Disabled";
  }

  return assertNever(status);
};

export const getServiceStatusCard = (
  serviceId: string,
  serviceName: string,
  panelState: {
    status?: SnapshotStatus;
    activeSession?: { sessionLabel?: string; source?: string } | null;
    items?: PanelPlaceholderItem[];
  } | null
): ServiceStatusCard => {
  const items = panelState?.items ?? [];

  if (!panelState || items.length === 0) {
    return {
      serviceId,
      serviceName,
      connectionState: statusToConnectionState(panelState?.status),
      dataSource: panelState?.activeSession?.source ?? "local",
      primaryMessage: statusToPrimaryMessage(panelState?.status),
      sessionLabel: panelState?.activeSession?.sessionLabel
    };
  }

  const firstDimension = items[0]?.quotaDimensions[0];

  return {
    serviceId,
    serviceName,
    connectionState: panelState.status?.kind === "Fresh" ? "connected" : "stale",
    dataSource: panelState.activeSession?.source ?? "snapshot",
    primaryMessage: statusToPrimaryMessage(panelState.status),
    secondaryMessage: firstDimension?.resetHint,
    sessionLabel: panelState.activeSession?.sessionLabel
  };
};
