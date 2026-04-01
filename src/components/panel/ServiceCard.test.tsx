import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ServiceCard } from "./ServiceCard";
import { getCopy } from "../../app/shared/i18n";
import type { PanelPlaceholderItem } from "../../lib/tauri/contracts";

const createService = (
  quotaDimensions: PanelPlaceholderItem["quotaDimensions"],
  overrides: Partial<PanelPlaceholderItem> = {}
): PanelPlaceholderItem => ({
  serviceId: "codex",
  serviceName: "Codex",
  iconKey: "codex",
  statusLabel: "refreshing",
  badgeLabel: "Live",
  lastSuccessfulRefreshAt: "1742321579",
  quotaDimensions,
  ...overrides
});

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
          lastSuccessfulRefreshAt: "1742321579",
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
          lastSuccessfulRefreshAt: "1742321579",
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
    expect(screen.getByText("5h limits")).toBeInTheDocument();
    expect(screen.getByText("Weekly limits")).toBeInTheDocument();
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
          lastSuccessfulRefreshAt: "1742321579",
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

  it("formats raw reset timestamps in the UI without leaking ISO strings", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-01T12:00:00.000Z"));

    render(
      <ServiceCard
        copy={getCopy("en-US")}
        nowMs={Date.now()}
        service={{
          serviceId: "codex",
          serviceName: "Codex",
          iconKey: "codex",
          statusLabel: "demo",
          badgeLabel: "Live",
          lastSuccessfulRefreshAt: "1742321579",
          quotaDimensions: [
            {
              label: "Custom Window",
              remainingPercent: 80,
              remainingAbsolute: "80% remaining",
              resetsAt: "2026-04-01T14:00:00.000Z",
              status: "healthy",
              progressTone: "success"
            }
          ]
        }}
      />
    );

    expect(screen.getByText("Resets in 2h 00m")).toBeInTheDocument();
    expect(screen.queryByText("2026-04-01T14:00:00.000Z")).not.toBeInTheDocument();

    vi.useRealTimers();
  });

  it("hides redundant live badges on healthy connected cards", () => {
    render(
      <ServiceCard
        copy={getCopy("zh-CN")}
        service={{
          serviceId: "codex",
          serviceName: "Codex",
          iconKey: "codex",
          statusLabel: "refreshing",
          badgeLabel: "Live",
          lastSuccessfulRefreshAt: "1742321579",
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
    expect(screen.queryByText("实时")).not.toBeInTheDocument();
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
          lastSuccessfulRefreshAt: "1742321579",
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
          lastSuccessfulRefreshAt: "1742321579",
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
          lastSuccessfulRefreshAt: "1742321579",
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

  it("shows only one remaining label inside each progress track", () => {
    render(
      <ServiceCard
        copy={getCopy("zh-CN")}
        service={{
          serviceId: "codex",
          serviceName: "Codex",
          iconKey: "codex",
          statusLabel: "refreshing",
          badgeLabel: "Live",
          lastSuccessfulRefreshAt: "1742321579",
          quotaDimensions: [
            {
              label: "CODEX / 5H",
              remainingPercent: 10,
              remainingAbsolute: "10% remaining",
              status: "exhausted",
              progressTone: "danger"
            }
          ]
        }}
      />
    );

    expect(screen.getAllByText("剩余 10%")).toHaveLength(1);
    expect(screen.getAllByText("紧张").length).toBeGreaterThan(0);
  });

  it("orders shorter quota windows before weekly windows even if backend data is reversed", () => {
    render(
      <ServiceCard
        copy={getCopy("en-US")}
        service={{
          serviceId: "kimi-code",
          serviceName: "Kimi Code",
          iconKey: "kimi-code",
          statusLabel: "demo",
          badgeLabel: "Live",
          lastSuccessfulRefreshAt: "1742321579",
          quotaDimensions: [
            {
              label: "Kimi Code / week",
              remainingPercent: 100,
              remainingAbsolute: "100% remaining",
              resetHint: "Resets in 3d",
              status: "healthy",
              progressTone: "success"
            },
            {
              label: "Kimi Code / 5h",
              remainingPercent: 100,
              remainingAbsolute: "100% remaining",
              resetHint: "Resets in 4h",
              status: "healthy",
              progressTone: "success"
            }
          ]
        }}
      />
    );

    const card = screen.getByRole("heading", { name: "Kimi Code" }).closest("article");
    expect(card).not.toBeNull();
    expect(within(card as HTMLElement).getAllByText(/limits$/).map((element) => element.textContent)).toEqual([
      "5h limits",
      "Weekly limits"
    ]);
  });

  it("renders risk-only burn-rate copy from whole-window math with reset hint on the secondary line", () => {
    const nowMs = Date.parse("2026-04-02T12:00:00Z");

    render(
      <ServiceCard
        copy={getCopy("en-US")}
        nowMs={nowMs}
        service={{
          serviceId: "codex",
          serviceName: "Codex",
          iconKey: "codex",
          statusLabel: "refreshing",
          badgeLabel: "Live",
          lastSuccessfulRefreshAt: "1742321579",
          quotaDimensions: [
            {
              label: "codex / 5h",
              remainingPercent: 60,
              remainingAbsolute: "60% remaining",
              resetsAt: "2026-04-02T16:00:00Z",
              status: "warning",
              progressTone: "warning"
            },
            {
              label: "codex / week",
              remainingPercent: 90,
              remainingAbsolute: "90% remaining",
              resetsAt: "2026-04-06T12:00:00Z",
              status: "healthy",
              progressTone: "success"
            },
            {
              label: "codex / day",
              remainingPercent: 50,
              remainingAbsolute: "50% remaining",
              resetsAt: "invalid",
              status: "warning",
              progressTone: "warning"
            }
          ]
        }}
      />
    );

    expect(screen.getAllByText("Far behind")).toHaveLength(2);
    expect(screen.queryByText("Runs out in ~1h 30m")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Far behind. Runs out in ~1h 30m")).toBeInTheDocument();

    const visibleBurnRateBlock = screen.getByTestId("progress-track-codex / 5h").parentElement;
    expect(visibleBurnRateBlock?.textContent).toContain("Far behind");
    expect(visibleBurnRateBlock?.textContent).not.toContain("Runs out in ~1h 30m");
    expect(visibleBurnRateBlock?.textContent).toContain("Resets in 4h 00m");

    const onTrackBlock = screen.getByTestId("progress-track-codex / week").parentElement;
    expect(onTrackBlock?.textContent).not.toContain("On track");
    expect(onTrackBlock?.textContent).not.toContain("Runs out in ~");

    const invalidResetBlock = screen.getByTestId("progress-track-codex / day").parentElement;
    expect(invalidResetBlock?.textContent).not.toContain("Far behind");
    expect(invalidResetBlock?.textContent).not.toContain("Runs out in ~");
  });

  it("makes a pace-danger row drive the card accent and header badge", () => {
    const nowMs = Date.parse("2026-04-02T12:00:00Z");

    render(
      <ServiceCard
        copy={getCopy("en-US")}
        nowMs={nowMs}
        service={createService([
          {
            label: "codex / 5h",
            remainingPercent: 50,
            remainingAbsolute: "50% remaining",
            resetsAt: "2026-04-02T16:00:00Z",
            status: "warning",
            progressTone: "warning"
          }
        ])}
      />
    );

    const card = screen.getByRole("heading", { name: "Codex" }).closest("article");
    expect(card?.className).toContain("border-rose-200");
    expect(card?.querySelector("[aria-hidden='true']")?.className).toContain("bg-rose-500");
    expect(within(card as HTMLElement).getAllByText("Far behind")).toHaveLength(2);
  });

  it("keeps the old static warning label for fallback-warning rows", () => {
    const nowMs = Date.parse("2026-04-02T12:00:00Z");

    render(
      <ServiceCard
        copy={getCopy("en-US")}
        nowMs={nowMs}
        service={createService([
          {
            label: "codex / 5h",
            remainingPercent: 45,
            remainingAbsolute: "45% remaining",
            status: "warning",
            progressTone: "warning"
          }
        ])}
      />
    );

    const card = screen.getByRole("heading", { name: "Codex" }).closest("article");
    expect(card?.className).toContain("border-amber-200");
    expect(within(card as HTMLElement).getAllByText("Low")).toHaveLength(2);
  });

  it("keeps on-track rows visually quiet with no pace badge", () => {
    const nowMs = Date.parse("2026-04-02T12:00:00Z");

    render(
      <ServiceCard
        copy={getCopy("en-US")}
        nowMs={nowMs}
        service={createService([
          {
            label: "codex / 5h",
            remainingPercent: 60,
            remainingAbsolute: "60% remaining",
            resetsAt: "2026-04-02T15:00:00Z",
            status: "warning",
            progressTone: "warning"
          }
        ])}
      />
    );

    const card = screen.getByRole("heading", { name: "Codex" }).closest("article");
    expect(card?.querySelector("[aria-hidden='true']")).toBeNull();
    expect(within(card as HTMLElement).queryByText("On track")).not.toBeInTheDocument();
  });
});
