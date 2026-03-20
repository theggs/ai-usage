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

  it("shows the service name once and trims repeated service prefixes from quota labels", () => {
    render(
      <ServiceCard
        copy={getCopy("en-US")}
        service={{
          serviceId: "claude-code",
          serviceName: "Claude Code",
          iconKey: "claude-code",
          statusLabel: "demo",
          badgeLabel: "Live",
          lastRefreshedAt: "1742321579",
          quotaDimensions: [
            {
              label: "CLAUDE CODE / 5H",
              remainingPercent: 40,
              remainingAbsolute: "40% remaining",
              resetHint: "Resets in 2h",
              status: "warning",
              progressTone: "warning"
            },
            {
              label: "WEEK",
              remainingPercent: 63,
              remainingAbsolute: "63% remaining",
              resetHint: "Resets in 6d",
              status: "healthy",
              progressTone: "success"
            }
          ]
        }}
      />
    );

    expect(screen.getByRole("heading", { name: "Claude Code" })).toBeInTheDocument();
    expect(screen.getByText("5H")).toBeInTheDocument();
    expect(screen.getByText("WEEK")).toBeInTheDocument();
    expect(screen.queryByText("CLAUDE CODE / 5H")).not.toBeInTheDocument();
  });

  it("keeps unmatched quota labels unchanged", () => {
    render(
      <ServiceCard
        copy={getCopy("en-US")}
        service={{
          serviceId: "codex",
          serviceName: "Codex",
          iconKey: "codex",
          statusLabel: "demo",
          badgeLabel: "Live",
          lastRefreshedAt: "1742321579",
          quotaDimensions: [
            {
              label: "Custom Window",
              remainingPercent: 80,
              remainingAbsolute: "80% remaining",
              resetHint: "Resets in 4d",
              status: "healthy",
              progressTone: "success"
            }
          ]
        }}
      />
    );

    expect(screen.getByText("Custom Window")).toBeInTheDocument();
  });

  it("shows only the badge state while hiding the duplicated top-left status line", () => {
    render(
      <ServiceCard
        copy={getCopy("zh-CN")}
        service={{
          serviceId: "codex",
          serviceName: "Codex",
          iconKey: "codex",
          statusLabel: "refreshing",
          badgeLabel: "Live",
          lastRefreshedAt: "1742321579",
          quotaDimensions: [
            {
              label: "CODEX / 5H",
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

    expect(screen.queryByText("刷新中")).not.toBeInTheDocument();
    expect(screen.getByText("实时")).toBeInTheDocument();
  });

  it("localizes snapshot-state badge labels consistently", () => {
    const { rerender } = render(
      <ServiceCard
        copy={getCopy("zh-CN")}
        service={{
          serviceId: "claude-code",
          serviceName: "Claude Code",
          iconKey: "claude-code",
          statusLabel: "refreshing",
          badgeLabel: "stale",
          lastRefreshedAt: "1742321579",
          quotaDimensions: [
            {
              label: "CLAUDE CODE / 5H",
              remainingPercent: 40,
              remainingAbsolute: "40% remaining",
              resetHint: "Resets in 2h",
              status: "warning",
              progressTone: "warning"
            }
          ]
        }}
      />
    );

    expect(screen.getByText("连接中断")).toBeInTheDocument();

    rerender(
      <ServiceCard
        copy={getCopy("zh-CN")}
        service={{
          serviceId: "codex",
          serviceName: "Codex",
          iconKey: "codex",
          statusLabel: "refreshing",
          badgeLabel: "failed",
          lastRefreshedAt: "1742321579",
          quotaDimensions: [
            {
              label: "CODEX / 5H",
              remainingPercent: 40,
              remainingAbsolute: "40% remaining",
              resetHint: "Resets in 2h",
              status: "warning",
              progressTone: "warning"
            }
          ]
        }}
      />
    );

    expect(screen.getByText("读取失败")).toBeInTheDocument();
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
