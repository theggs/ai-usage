import type { PanelPlaceholderItem, QuotaDimension, SummaryMode } from "./contracts";

const allDimensions = (items: PanelPlaceholderItem[]) => items.flatMap((item) => item.quotaDimensions);

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
