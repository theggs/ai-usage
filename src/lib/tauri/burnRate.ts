import type { BurnRateSample } from "./contracts";

export type BurnRatePace = "on-track" | "behind" | "far-behind";

export interface BurnRateDisplay {
  pace: BurnRatePace;
  depletionEtaMs: number | null;
  willLastUntilReset: boolean;
}

const parseSampleTimestamp = (capturedAt: string): number | undefined => {
  const timestamp = /^\d+$/.test(capturedAt)
    ? Number(capturedAt) * 1000
    : Date.parse(capturedAt);

  return Number.isFinite(timestamp) ? timestamp : undefined;
};

export const getBurnRateDisplay = ({
  remainingPercent,
  resetsAt,
  samples,
  nowMs = Date.now()
}: {
  remainingPercent?: number;
  resetsAt?: string;
  samples?: readonly BurnRateSample[];
  nowMs?: number;
}): BurnRateDisplay | undefined => {
  if (!Number.isFinite(remainingPercent)) {
    return undefined;
  }

  if (!resetsAt) {
    return undefined;
  }

  const resetMs = Date.parse(resetsAt);
  if (!Number.isFinite(resetMs) || resetMs <= nowMs) {
    return undefined;
  }

  const validSamples = (samples ?? [])
    .map((sample) => ({
      timestampMs: parseSampleTimestamp(sample.capturedAt),
      remainingPercent: sample.remainingPercent
    }))
    .filter(
      (sample): sample is { timestampMs: number; remainingPercent: number } =>
        sample.timestampMs !== undefined
    )
    .sort((left, right) => left.timestampMs - right.timestampMs);

  if (validSamples.length < 2) {
    return undefined;
  }

  const first = validSamples[0];
  const last = validSamples[validSamples.length - 1];
  if (!first || !last) {
    return undefined;
  }

  const consumed = first.remainingPercent - last.remainingPercent;
  const elapsedMs = last.timestampMs - first.timestampMs;
  if (elapsedMs <= 0) {
    return undefined;
  }

  if (consumed <= 0) {
    return {
      pace: "on-track",
      depletionEtaMs: null,
      willLastUntilReset: true
    };
  }

  const ratePerMs = consumed / elapsedMs;
  const depletionEtaMs = remainingPercent / ratePerMs;
  const timeUntilResetMs = resetMs - nowMs;
  const coverage = depletionEtaMs / timeUntilResetMs;

  return {
    pace: coverage >= 1 ? "on-track" : coverage >= 0.5 ? "behind" : "far-behind",
    depletionEtaMs,
    willLastUntilReset: coverage >= 1
  };
};
