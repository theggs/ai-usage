import type { PanelPlaceholderItem, SummaryMode } from "./contracts";

const firstDimension = (items: PanelPlaceholderItem[]) => items[0]?.quotaDimensions[0];

export const formatTraySummary = (
  summaryMode: SummaryMode,
  items: PanelPlaceholderItem[]
): string | undefined => {
  if (summaryMode === "icon-only") {
    return undefined;
  }

  if (summaryMode === "single-dimension") {
    const dimension = firstDimension(items);
    return dimension ? `${dimension.remainingPercent}%` : undefined;
  }

  const dimensions = items.flatMap((item) => item.quotaDimensions.slice(0, 1));
  if (!dimensions.length) {
    return undefined;
  }

  return dimensions.map((dimension) => `${dimension.remainingPercent}%`).join(" / ");
};
