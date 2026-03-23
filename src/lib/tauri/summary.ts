import type {
  CodexLimitStatus,
  PanelPlaceholderItem,
  QuotaDimension,
  QuotaProgressTone,
  SummaryMode
} from "./contracts";

export type ServiceAlertLevel = "normal" | "warning" | "danger";

export interface PanelHealthSummary {
  tone: "healthy" | "warning" | "danger" | "empty";
  serviceId?: string;
  serviceName?: string;
  dimensionLabel?: string;
  remainingPercent?: number;
}

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
const sortByWindowDuration = (dimensions: QuotaDimension[]) =>
  dimensions
    .filter((dimension) => dimension.remainingPercent !== undefined)
    .sort((left, right) => inferWindowMinutes(left.label) - inferWindowMinutes(right.label));

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

export const getServiceAlertLevel = (item: PanelPlaceholderItem): ServiceAlertLevel => {
  if (item.quotaDimensions.some((dimension) => dimension.status === "exhausted")) {
    return "danger";
  }

  if (item.quotaDimensions.some((dimension) => dimension.status === "warning")) {
    return "warning";
  }

  return "normal";
};

export const getPanelHealthSummary = (items: PanelPlaceholderItem[]): PanelHealthSummary => {
  if (items.length === 0) {
    return { tone: "empty" };
  }

  const candidates = items
    .flatMap((item) =>
      item.quotaDimensions.map((dimension) => ({
        item,
        dimension
      }))
    )
    .filter(({ dimension }) => dimension.remainingPercent !== undefined)
    .sort((left, right) => (left.dimension.remainingPercent ?? 101) - (right.dimension.remainingPercent ?? 101));

  const critical = candidates.find(({ dimension }) => dimension.status === "exhausted");
  if (critical) {
    return {
      tone: "danger",
      serviceId: critical.item.serviceId,
      serviceName: critical.item.serviceName,
      dimensionLabel: critical.dimension.label,
      remainingPercent: critical.dimension.remainingPercent
    };
  }

  const warning = candidates.find(({ dimension }) => dimension.status === "warning");
  if (warning) {
    return {
      tone: "warning",
      serviceId: warning.item.serviceId,
      serviceName: warning.item.serviceName,
      dimensionLabel: warning.dimension.label,
      remainingPercent: warning.dimension.remainingPercent
    };
  }

  return { tone: "healthy" };
};

export const haveAlignedRefreshTimes = (items: PanelPlaceholderItem[]) => {
  const parsed = items.map((item) => parseTimestamp(item.lastRefreshedAt)).filter((value): value is number => value !== undefined);
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

  return parseTimestamp(items[0]?.lastRefreshedAt);
};
