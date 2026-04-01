import { describe, expect, it } from "vitest";
import {
  decorateQuotaDimension,
  formatTraySummary,
  getBurnRateDisplay,
  getMostUrgentQuotaDimension,
  getPanelHealthSummary,
  getQuotaBurnRateDisplay,
  getQuotaHealthSignal,
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

  it("returns on-track when projected depletion lasts until reset", () => {
    expect(
      getBurnRateDisplay({
        label: "codex / 5h",
        remainingPercent: 60,
        resetsAt: "2026-04-02T15:00:00Z",
        nowMs
      })
    ).toMatchObject({
      pace: "on-track",
      willLastUntilReset: true
    });
  });

  it("returns behind when coverage stays between half and full reset coverage", () => {
    const result = getBurnRateDisplay({
      label: "codex / 5h",
      remainingPercent: 60,
      resetsAt: "2026-04-02T15:30:00Z",
      nowMs
    });

    expect(result).toMatchObject({
      pace: "behind",
      willLastUntilReset: false
    });
    expect(result?.depletionEtaMs).toBeCloseTo(2.25 * oneHourMs);
  });

  it("returns far-behind when coverage drops below half the remaining reset time", () => {
    const result = getBurnRateDisplay({
      label: "codex / 5h",
      remainingPercent: 50,
      resetsAt: "2026-04-02T16:00:00Z",
      nowMs
    });

    expect(result).toMatchObject({
      pace: "far-behind",
      willLastUntilReset: false
    });
    expect(result?.depletionEtaMs).toBeCloseTo(oneHourMs);
  });

  it("treats zero usage so far as on-track with no depletion eta", () => {
    expect(
      getBurnRateDisplay({
        label: "codex / 5h",
        remainingPercent: 100,
        resetsAt: "2026-04-02T16:00:00Z",
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
        label: "codex / 5h",
        resetsAt: "2026-04-02T16:00:00Z",
        nowMs
      })
    ).toBeUndefined();
    expect(
      getBurnRateDisplay({
        label: "codex / 5h",
        remainingPercent: Number.NaN,
        resetsAt: "2026-04-02T16:00:00Z",
        nowMs
      })
    ).toBeUndefined();
  });

  it("returns undefined when the label does not identify a supported window", () => {
    expect(
      getBurnRateDisplay({
        label: "codex / month",
        remainingPercent: 60,
        resetsAt: "2026-04-02T16:00:00Z",
        nowMs
      })
    ).toBeUndefined();
  });

  it("returns undefined for invalid or past resetsAt values", () => {
    expect(
      getBurnRateDisplay({
        label: "codex / 5h",
        remainingPercent: 60,
        resetsAt: "not-a-date",
        nowMs
      })
    ).toBeUndefined();
    expect(
      getBurnRateDisplay({
        label: "codex / 5h",
        remainingPercent: 60,
        resetsAt: "2026-04-02T11:00:00Z",
        nowMs
      })
    ).toBeUndefined();
  });

  it("returns undefined when remainingPercent is too low to show pace", () => {
    expect(
      getBurnRateDisplay({
        label: "codex / 5h",
        remainingPercent: 10,
        resetsAt: "2026-04-02T16:00:00Z",
        nowMs
      })
    ).toBeUndefined();
  });

  it("returns undefined when resetsAt exceeds the inferred window length", () => {
    expect(
      getBurnRateDisplay({
        label: "codex / 5h",
        remainingPercent: 60,
        resetsAt: "2026-04-02T18:30:00Z",
        nowMs
      })
    ).toBeUndefined();
  });

  it("does not change status or progressTone from existing summary logic", () => {
    const dimension = decorateQuotaDimension({
      label: "codex / 5h",
      remainingPercent: 30,
      remainingAbsolute: "30% remaining",
      resetsAt: "2026-04-02T15:00:00Z"
    });

    expect(dimension.status).toBe("warning");
    expect(dimension.progressTone).toBe("warning");
    expect(getQuotaBurnRateDisplay(dimension, nowMs)).toMatchObject({
      pace: "far-behind"
    });
  });

  it("uses the same full-window math for weekly windows", () => {
    expect(
      getBurnRateDisplay({
        label: "codex / week",
        remainingPercent: 63,
        resetsAt: "2026-04-07T12:00:00Z",
        nowMs
      })
    ).toMatchObject({
      pace: "behind",
      willLastUntilReset: false
    });
  });
});

describe("time-aware quota health", () => {
  const nowMs = Date.parse("2026-04-02T12:00:00Z");

  const createDimension = (overrides: Partial<PanelPlaceholderItem["quotaDimensions"][number]> = {}) =>
    decorateQuotaDimension({
      label: "codex / 5h",
      remainingPercent: 45,
      remainingAbsolute: "45% remaining",
      ...overrides
    });

  const createItem = (
    serviceId: string,
    serviceName: string,
    quotaDimensions: PanelPlaceholderItem["quotaDimensions"]
  ): PanelPlaceholderItem => ({
    serviceId,
    serviceName,
    iconKey: serviceId,
    statusLabel: "refreshing",
    lastSuccessfulRefreshAt: "1742321579",
    quotaDimensions
  });

  it("maps a far-behind 5h window to pace danger", () => {
    expect(
      getQuotaHealthSignal(
        createDimension({
          remainingPercent: 50,
          resetsAt: "2026-04-02T16:00:00Z"
        }),
        nowMs
      )
    ).toMatchObject({
      source: "pace",
      pace: "far-behind",
      level: "danger",
      progressTone: "danger"
    });
  });

  it("maps an on-track weekly row back to normal severity", () => {
    expect(
      getQuotaHealthSignal(
        createDimension({
          label: "codex / week",
          remainingPercent: 20,
          resetsAt: "2026-04-02T18:00:00Z"
        }),
        nowMs
      )
    ).toMatchObject({
      source: "pace",
      pace: "on-track",
      level: "normal"
    });
  });

  it("falls back to static warning when resetsAt is unavailable", () => {
    expect(
      getQuotaHealthSignal(
        createDimension({
          remainingPercent: 45,
          resetsAt: undefined
        }),
        nowMs
      )
    ).toMatchObject({
      source: "fallback",
      level: "warning"
    });
  });

  it("falls back to static normal when resetsAt is outside the supported window", () => {
    expect(
      getQuotaHealthSignal(
        createDimension({
          remainingPercent: 80,
          resetsAt: "2026-04-02T18:30:00Z"
        }),
        nowMs
      )
    ).toMatchObject({
      source: "fallback",
      level: "normal"
    });
  });

  it("returns a muted none source when remainingPercent is unavailable", () => {
    expect(
      getQuotaHealthSignal(
        createDimension({
          remainingPercent: undefined,
          remainingAbsolute: "unknown",
          resetsAt: undefined
        }),
        nowMs
      )
    ).toMatchObject({
      source: "none",
      progressTone: "muted"
    });
  });

  it("prefers a pace danger row over a fallback warning row", () => {
    const codex = createItem("codex", "Codex", [
      createDimension({
        label: "codex / 5h",
        remainingPercent: 50,
        resetsAt: "2026-04-02T16:00:00Z"
      })
    ]);
    const claude = createItem("claude-code", "Claude Code", [
      createDimension({
        label: "claude / week",
        remainingPercent: 45,
        resetsAt: undefined
      })
    ]);

    expect(getMostUrgentQuotaDimension([claude, codex], nowMs)).toMatchObject({
      item: { serviceId: "codex" },
      health: { source: "pace", level: "danger" }
    });
  });

  it("does not let source outrank severity when fallback danger is worse", () => {
    const codex = createItem("codex", "Codex", [
      createDimension({
        label: "codex / week",
        remainingPercent: 63,
        resetsAt: "2026-04-07T12:00:00Z"
      })
    ]);
    const claude = createItem("claude-code", "Claude Code", [
      createDimension({
        label: "claude / 5h",
        remainingPercent: 19,
        resetsAt: undefined
      })
    ]);

    expect(getMostUrgentQuotaDimension([codex, claude], nowMs)).toMatchObject({
      item: { serviceId: "claude-code" },
      health: { source: "fallback", level: "danger" }
    });
  });

  it("breaks severity and source ties by shorter window first", () => {
    const codex = createItem("codex", "Codex", [
      createDimension({
        label: "codex / week",
        remainingPercent: 45,
        resetsAt: undefined
      })
    ]);
    const kimi = createItem("kimi", "Kimi", [
      createDimension({
        label: "kimi / 5h",
        remainingPercent: 45,
        resetsAt: undefined
      })
    ]);

    expect(getMostUrgentQuotaDimension([codex, kimi], nowMs)).toMatchObject({
      item: { serviceId: "kimi" },
      dimension: { label: "kimi / 5h" }
    });
  });

  it("exposes the selected row metadata in the panel health summary", () => {
    const panelItems = [
      createItem("codex", "Codex", [
        createDimension({
          label: "codex / week",
          remainingPercent: 20,
          resetsAt: "2026-04-02T18:00:00Z"
        })
      ])
    ];

    expect(getPanelHealthSummary(panelItems, nowMs)).toMatchObject({
      tone: "healthy",
      serviceName: "Codex",
      dimensionLabel: "codex / week",
      remainingPercent: 20,
      source: "pace",
      pace: "on-track"
    });
  });

  it("keeps tray severity aligned with the selected row", () => {
    const panelItems = [
      createItem("codex", "Codex", [
        createDimension({
          label: "codex / 5h",
          remainingPercent: 50,
          resetsAt: "2026-04-02T16:00:00Z"
        })
      ]),
      createItem("claude-code", "Claude Code", [
        createDimension({
          label: "claude / week",
          remainingPercent: 80,
          resetsAt: undefined
        })
      ])
    ];

    expect(getTrayVisualState("window-5h", "codex", panelItems, nowMs)).toMatchObject({
      serviceName: "Codex",
      severity: "danger"
    });
  });
});
