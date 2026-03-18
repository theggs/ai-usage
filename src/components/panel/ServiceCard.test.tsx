import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ServiceCard } from "./ServiceCard";

describe("ServiceCard", () => {
  it("formats second-based timestamps without showing Invalid Date", () => {
    render(
      <ServiceCard
        service={{
          serviceId: "codex",
          serviceName: "Codex",
          iconKey: "codex",
          statusLabel: "refreshing",
          badgeLabel: "Live",
          lastRefreshedAt: "1742321579",
          quotaDimensions: [
            {
              label: "codex / 5h",
              remainingPercent: 52,
              remainingAbsolute: "52% remaining",
              resetHint: "Resets in 2h"
            }
          ]
        }}
      />
    );

    expect(screen.getByText(/Last refreshed:/).textContent).not.toContain("Invalid Date");
  });
});
