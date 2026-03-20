import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ServiceCard } from "./ServiceCard";
import { getCopy } from "../../app/shared/i18n";

describe("ServiceCard", () => {
  it("formats second-based timestamps without showing Invalid Date", () => {
    render(
      <ServiceCard
        copy={getCopy("en-US")}
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
              resetHint: "Resets in 2h",
              status: "healthy",
              progressTone: "success"
            }
          ]
        }}
      />
    );

    expect(screen.getByText(/Last refreshed:/).textContent).not.toContain("Invalid Date");
  });

  it("renders the expected progress tones for threshold and unknown cases", () => {
    const { container } = render(
      <ServiceCard
        copy={getCopy("en-US")}
        service={{
          serviceId: "codex",
          serviceName: "Codex",
          iconKey: "codex",
          statusLabel: "refreshing",
          badgeLabel: "Live",
          lastRefreshedAt: "1742321579",
          quotaDimensions: [
            {
              label: "danger",
              remainingPercent: 0,
              remainingAbsolute: "0% remaining",
              status: "exhausted",
              progressTone: "danger"
            },
            {
              label: "warning",
              remainingPercent: 20,
              remainingAbsolute: "20% remaining",
              status: "warning",
              progressTone: "warning"
            },
            {
              label: "healthy",
              remainingPercent: 80,
              remainingAbsolute: "80% remaining",
              status: "healthy",
              progressTone: "success"
            },
            {
              label: "unknown",
              remainingAbsolute: "--",
              status: "unknown",
              progressTone: "muted"
            }
          ]
        }}
      />
    );

    expect(screen.getByTestId("progress-fill-danger")).toHaveStyle({ width: "0%" });
    expect(screen.getByTestId("progress-fill-warning").className).toContain("bg-amber-400");
    expect(screen.getByTestId("progress-fill-healthy").className).toContain("bg-emerald-500");
    expect(screen.getByTestId("progress-fill-unknown").className).toContain("bg-slate-300");
    expect(container.querySelector("article")?.className).toContain("rounded-2xl");
    expect(container.querySelector("[data-testid='progress-track-danger']")?.className).toContain("rounded-full");
  });
});
