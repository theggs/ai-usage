import { describe, expect, it } from "vitest";
import {
  decorateQuotaDimension,
  formatTraySummary,
  getBurnRateDisplay,
  getPanelHealthSummary,
  getQuotaBurnRateDisplay,
  getQuotaProgressTone,
  getQuotaStatus,
  getServiceAlertLevel,
  getServiceStatusCard,
  getVisibleServiceScope,
  getTrayVisualState,
  haveAlignedRefreshTimes
} from "./summary";
import type { PanelPlaceholderItem } from "./contracts";

const items: PanelPlaceholderItem[] = [
  {
    serviceId: "codex",
    serviceName: "Codex",
    iconKey: "codex",
    statusLabel: "refreshing",
    lastSuccessfulRefreshAt: "1742321579",
    quotaDimensions: [
      {
        label: "codex / 5h",
        remainingPercent: 52,
        remainingAbsolute: "52% remaining",
        resetHint: "Resets in 2h",
        status: "healthy",
        progressTone: "success"
      },
      {
        label: "codex / week",
        remainingPercent: 6,
        remainingAbsolute: "6% remaining",
        resetHint: "Resets in 34h",
        status: "exhausted",
        progressTone: "danger"
      }
    ]
  }
];

describe("formatTraySummary", () => {
  it("uses the lowest remaining percentage for lowest-remaining mode", () => {
    expect(formatTraySummary("lowest-remaining", items)).toBe("6%");
  });

  it("selects the 5h window when requested", () => {
    expect(formatTraySummary("window-5h", items)).toBe("52%");
  });

  it("selects the week window when requested", () => {
    expect(formatTraySummary("window-week", items)).toBe("6%");
  });

  it("orders multi-dimension summaries from shorter to longer windows", () => {
    expect(formatTraySummary("multi-dimension", items)).toBe("52% / 6%");
  });

  it("maps quota thresholds to normalized status and tone", () => {
    expect(getQuotaStatus(80)).toBe("healthy");
    expect(getQuotaStatus(50)).toBe("warning");
    expect(getQuotaStatus(2)).toBe("exhausted");
    expect(getQuotaStatus(undefined)).toBe("unknown");
    expect(getQuotaProgressTone(undefined)).toBe("muted");
    expect(decorateQuotaDimension({
      label: "codex / 5h",
      remainingPercent: 20,
      remainingAbsolute: "20% remaining"
    }).progressTone).toBe("warning");
  });

  it("derives the most urgent panel health summary", () => {
    expect(getPanelHealthSummary(items)).toMatchObject({
      tone: "danger",
      serviceName: "Codex",
      remainingPercent: 6
    });
  });

  it("computes service alert level and aligned refresh timestamps", () => {
    expect(getServiceAlertLevel(items[0]!)).toBe("danger");
    expect(haveAlignedRefreshTimes(items)).toBe(true);
    expect(getPanelHealthSummary([])).toMatchObject({ tone: "empty" });
  });

  it("derives tray visual state for the selected service only", () => {
    const state = getTrayVisualState("window-week", "codex", items);

    expect(state.serviceName).toBe("Codex");
    expect(state.summaryText).toBe("6%");
    expect(state.tooltipText).toBe("AIUsage · Codex · 6%");
    expect(state.severity).toBe("danger");
  });

  it("keeps auto visible in the menubar scope even when Claude Code is disabled", () => {
    expect(
      getVisibleServiceScope({
        serviceOrder: ["codex", "claude-code"],
        providerEnabled: { codex: true, "claude-code": false }
      })
    ).toMatchObject({
      visiblePanelServiceOrder: ["codex"],
      visibleMenubarServices: ["codex", "auto"],
      hasVisibleClaudeCode: false
    });
  });

  it("makes claude-code visible when providerEnabled has it enabled", () => {
    expect(
      getVisibleServiceScope({
        serviceOrder: ["codex", "claude-code"],
        providerEnabled: { codex: true, "claude-code": true }
      })
    ).toMatchObject({
      visiblePanelServiceOrder: ["codex", "claude-code"],
      visibleMenubarServices: ["codex", "claude-code", "auto"],
      hasVisibleClaudeCode: true
    });
  });

  it("normalizes explicit empty service status cards without unrelated fallback copy", () => {
    expect(
      getServiceStatusCard("claude-code", "Claude Code", {
        status: { kind: "NoCredentials" },
        items: []
      })
    ).toMatchObject({
      serviceId: "claude-code",
      serviceName: "Claude Code",
      connectionState: "empty"
    });
  });
});

describe("getBurnRateDisplay", () => {
  const nowMs = Date.parse("2026-04-02T12:00:00Z");
  const oneHourMs = 60 * 60 * 1000;

  const samples = [
    { capturedAt: "2026-04-02T10:00:00Z", remainingPercent: 80 },
    { capturedAt: "2026-04-02T11:00:00Z", remainingPercent: 60 }
  ] as const;

  it("returns on-track when projected depletion lasts until reset", () => {
    expect(
      getBurnRateDisplay({
        remainingPercent: 60,
        resetsAt: "2026-04-02T15:00:00Z",
        samples,
        nowMs
      })
    ).toMatchObject({
      pace: "on-track",
      willLastUntilReset: true
    });
  });

  it("returns behind when coverage stays between half and full reset coverage", () => {
    const result = getBurnRateDisplay({
      remainingPercent: 60,
      resetsAt: "2026-04-02T16:00:00Z",
      samples,
      nowMs
    });

    expect(result).toMatchObject({
      pace: "behind",
      willLastUntilReset: false
    });
    expect(result?.depletionEtaMs).toBe(3 * oneHourMs);
  });

  it("returns far-behind when coverage drops below half the remaining reset time", () => {
    const result = getBurnRateDisplay({
      remainingPercent: 20,
      resetsAt: "2026-04-02T20:00:00Z",
      samples,
      nowMs
    });

    expect(result).toMatchObject({
      pace: "far-behind",
      willLastUntilReset: false
    });
    expect(result?.depletionEtaMs).toBe(oneHourMs);
  });

  it("treats zero or negative consumption as on-track with no depletion eta", () => {
    expect(
      getBurnRateDisplay({
        remainingPercent: 70,
        resetsAt: "2026-04-02T16:00:00Z",
        samples: [
          { capturedAt: "2026-04-02T10:00:00Z", remainingPercent: 60 },
          { capturedAt: "2026-04-02T11:00:00Z", remainingPercent: 60 }
        ],
        nowMs
      })
    ).toEqual({
      pace: "on-track",
      depletionEtaMs: null,
      willLastUntilReset: true
    });
  });

  it("returns undefined when remainingPercent is missing or not finite", () => {
    expect(
      getBurnRateDisplay({
        resetsAt: "2026-04-02T16:00:00Z",
        samples,
        nowMs
      })
    ).toBeUndefined();
    expect(
      getBurnRateDisplay({
        remainingPercent: Number.NaN,
        resetsAt: "2026-04-02T16:00:00Z",
        samples,
        nowMs
      })
    ).toBeUndefined();
  });

  it("returns undefined with fewer than two valid samples", () => {
    expect(
      getBurnRateDisplay({
        remainingPercent: 60,
        resetsAt: "2026-04-02T16:00:00Z",
        samples: [{ capturedAt: "2026-04-02T10:00:00Z", remainingPercent: 80 }],
        nowMs
      })
    ).toBeUndefined();
  });

  it("returns undefined for invalid or past resetsAt values", () => {
    expect(
      getBurnRateDisplay({
        remainingPercent: 60,
        resetsAt: "not-a-date",
        samples,
        nowMs
      })
    ).toBeUndefined();
    expect(
      getBurnRateDisplay({
        remainingPercent: 60,
        resetsAt: "2026-04-02T11:00:00Z",
        samples,
        nowMs
      })
    ).toBeUndefined();
  });

  it("ignores invalid sample timestamps and returns undefined when too few valid samples remain", () => {
    expect(
      getBurnRateDisplay({
        remainingPercent: 60,
        resetsAt: "2026-04-02T16:00:00Z",
        samples: [
          { capturedAt: "invalid", remainingPercent: 80 },
          { capturedAt: "2026-04-02T11:00:00Z", remainingPercent: 60 }
        ],
        nowMs
      })
    ).toBeUndefined();
  });

  it("does not change status or progressTone from existing summary logic", () => {
    const dimension = decorateQuotaDimension({
      label: "codex / 5h",
      remainingPercent: 30,
      remainingAbsolute: "30% remaining",
      resetsAt: "2026-04-02T15:00:00Z",
      burnRateHistory: [...samples]
    });

    expect(dimension.status).toBe("warning");
    expect(dimension.progressTone).toBe("warning");
    expect(getQuotaBurnRateDisplay(dimension, nowMs)).toMatchObject({
      pace: "behind"
    });
  });
});
