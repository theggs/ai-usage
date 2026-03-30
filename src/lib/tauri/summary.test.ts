import { describe, expect, it } from "vitest";
import {
  decorateQuotaDimension,
  formatTraySummary,
  getPanelHealthSummary,
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
        claudeCodeUsageEnabled: false
      })
    ).toMatchObject({
      visiblePanelServiceOrder: ["codex"],
      visibleMenubarServices: ["codex", "auto"],
      hasVisibleClaudeCode: false
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
