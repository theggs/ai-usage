import { describe, expect, it } from "vitest";
import { formatTraySummary } from "./summary";
import type { PanelPlaceholderItem } from "./contracts";

const items: PanelPlaceholderItem[] = [
  {
    serviceId: "codex",
    serviceName: "Codex",
    iconKey: "codex",
    statusLabel: "refreshing",
    lastRefreshedAt: "1742321579",
    quotaDimensions: [
      {
        label: "codex / 5h",
        remainingPercent: 52,
        remainingAbsolute: "52% remaining",
        resetHint: "Resets in 2h"
      },
      {
        label: "codex / week",
        remainingPercent: 6,
        remainingAbsolute: "6% remaining",
        resetHint: "Resets in 34h"
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
});
