export type BurnRatePace = "on-track" | "behind" | "far-behind";

export interface BurnRateDisplay {
  pace: BurnRatePace;
  depletionEtaMs: number | null;
  willLastUntilReset: boolean;
}

const HIDE_PACE_REMAINING_PERCENT = 10;
const FIVE_HOUR_WINDOW_MS = 5 * 60 * 60 * 1000;
const WEEKLY_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

const inferWindowDurationMs = (label?: string) => {
  if (!label) return undefined;
  const normalized = label.toLowerCase();
  if (normalized.includes("5h")) {
    return FIVE_HOUR_WINDOW_MS;
  }
  if (normalized.includes("week") || normalized.includes("7d")) {
    return WEEKLY_WINDOW_MS;
  }
  return undefined;
};

export const getBurnRateDisplay = ({
  label,
  remainingPercent,
  resetsAt,
  nowMs = Date.now()
}: {
  label?: string;
  remainingPercent?: number;
  resetsAt?: string;
  nowMs?: number;
}): BurnRateDisplay | undefined => {
  if (!Number.isFinite(remainingPercent)) {
    return undefined;
  }

  if (remainingPercent <= HIDE_PACE_REMAINING_PERCENT) {
    return undefined;
  }

  if (!resetsAt) {
    return undefined;
  }

  const resetMs = Date.parse(resetsAt);
  if (!Number.isFinite(resetMs) || resetMs <= nowMs) {
    return undefined;
  }

  const windowDurationMs = inferWindowDurationMs(label);
  if (!windowDurationMs) {
    return undefined;
  }

  const timeUntilResetMs = resetMs - nowMs;
  if (timeUntilResetMs <= 0 || timeUntilResetMs > windowDurationMs) {
    return undefined;
  }

  const elapsedMs = windowDurationMs - timeUntilResetMs;
  if (elapsedMs <= 0) {
    return undefined;
  }

  const usedPercent = 100 - remainingPercent;
  if (usedPercent <= 0) {
    return {
      pace: "on-track",
      depletionEtaMs: null,
      willLastUntilReset: true
    };
  }

  const ratePerMs = usedPercent / elapsedMs;
  const depletionEtaMs = remainingPercent / ratePerMs;
  const coverage = depletionEtaMs / timeUntilResetMs;

  return {
    pace: coverage >= 1 ? "on-track" : coverage >= 0.5 ? "behind" : "far-behind",
    depletionEtaMs,
    willLastUntilReset: coverage >= 1
  };
};
