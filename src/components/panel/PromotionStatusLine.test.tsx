import { createRef } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { getCopy } from "../../app/shared/i18n";
import type { PromotionDisplayDecision } from "../../features/promotions/types";
import { PromotionStatusLine } from "./PromotionStatusLine";

const promotionDecision: PromotionDisplayDecision = {
  inlineServices: [
    {
      serviceId: "codex",
      serviceName: "Codex",
      status: "active-window",
      benefitLabel: "2x",
      matchedCampaignId: "codex-limited-time-promotion",
      messageKey: "promotionStatusActiveWindow",
      detailTiming: {
        mode: "continuous"
      },
      isInlineVisible: true
    }
  ],
  allServices: [
    {
      serviceId: "codex",
      serviceName: "Codex",
      status: "active-window",
      benefitLabel: "2x",
      matchedCampaignId: "codex-limited-time-promotion",
      messageKey: "promotionStatusActiveWindow",
      detailTiming: {
        mode: "continuous"
      },
      isInlineVisible: true
    },
    {
      serviceId: "claude-code",
      serviceName: "Claude Code",
      status: "inactive-window",
      benefitLabel: "2x",
      matchedCampaignId: "claude-march-2026-usage-promotion",
      messageKey: "promotionStatusInactiveWindow",
      detailTiming: {
        mode: "local-window",
        dateRangeLabel: "2026.03.13-2026.03.28",
        localWindowRangeLabel: "20:00-02:00",
        localTimeZoneLabel: "UTC+08:00"
      },
      isInlineVisible: false
    }
  ],
  hiddenServiceCount: 1,
  fallbackState: null
};

describe("PromotionStatusLine", () => {
  it("renders compact capsules with icons and short labels in the inline header area", () => {
    render(
      <PromotionStatusLine
        copy={getCopy("zh-CN")}
        overlayState="closed"
        promotionDecision={promotionDecision}
        rootRef={createRef<HTMLDivElement>()}
      />
    );

    expect(screen.getByTestId("promotion-pill-row")).toBeInTheDocument();
    expect(screen.getByTestId("promotion-pill-codex")).toHaveTextContent("2x");
    expect(screen.getByTestId("promotion-pill-icon-codex")).toBeInTheDocument();
    expect(screen.getByTestId("promotion-pill-icon-codex")).toHaveClass("promotion-pill-icon-codex");
    expect(screen.queryByText("...")).not.toBeInTheDocument();
  });

  it("renders richer all-state popover rows inside the same component surface", () => {
    render(
      <PromotionStatusLine
        copy={getCopy("en-US")}
        overlayState="preview"
        promotionDecision={promotionDecision}
        rootRef={createRef<HTMLDivElement>()}
      />
    );

    const popover = screen.getByTestId("promotion-status-popover");
    expect(screen.getByTestId("promotion-popover-item-codex")).toHaveTextContent(
      "Codexpromotion active2x"
    );
    expect(screen.getByTestId("promotion-popover-item-claude-code")).toHaveTextContent(
      "Claude Codeoutside promotion window2x"
    );
    expect(screen.getByTestId("promotion-popover-status-codex")).toHaveTextContent(
      "promotion active"
    );
    expect(screen.getByTestId("promotion-popover-benefit-codex")).toHaveTextContent("2x");
    expect(screen.getByTestId("promotion-popover-status-claude-code")).toHaveTextContent(
      "outside promotion window"
    );
    expect(screen.getByTestId("promotion-popover-benefit-claude-code")).toHaveTextContent("2x");
    expect(screen.getByTestId("promotion-popover-detail-codex")).toHaveTextContent(
      "All-day promotion"
    );
    expect(screen.getByTestId("promotion-popover-detail-claude-code")).toHaveTextContent(
      "2026.03.13-2026.03.28 · outside weekdays 20:00-02:00 (UTC+08:00)"
    );
    expect(screen.getByRole("dialog", { name: "All promotion states" })).toBe(popover);
  });

  it("falls back to the unified no-promotion message while remaining triggerable", async () => {
    const user = userEvent.setup();
    const onPin = vi.fn();
    render(
      <PromotionStatusLine
        copy={getCopy("zh-CN")}
        onPin={onPin}
        overlayState="closed"
        promotionDecision={{
          inlineServices: [],
          allServices: [
            {
              serviceId: "codex",
              serviceName: "Codex",
              status: "none",
              messageKey: "promotionStatusNone",
              detailTiming: {
                mode: "none"
              },
              isInlineVisible: false
            }
          ],
          hiddenServiceCount: 1,
          fallbackState: "none"
        }}
        rootRef={createRef<HTMLDivElement>()}
      />
    );

    expect(screen.getByTestId("promotion-status-fallback")).toHaveTextContent("当前无优惠活动");
    await user.click(screen.getByTestId("promotion-status-trigger"));
    expect(onPin).toHaveBeenCalledTimes(1);
  });

  it("routes hover/focus preview and click pin interactions through callbacks", async () => {
    const user = userEvent.setup();
    const onPreviewStart = vi.fn();
    const onPreviewEnd = vi.fn();
    const onPin = vi.fn();

    render(
      <PromotionStatusLine
        copy={getCopy("en-US")}
        onPin={onPin}
        onPreviewEnd={onPreviewEnd}
        onPreviewStart={onPreviewStart}
        overlayState="closed"
        promotionDecision={promotionDecision}
        rootRef={createRef<HTMLDivElement>()}
      />
    );

    const trigger = screen.getByTestId("promotion-status-trigger");
    await user.hover(trigger);
    expect(onPreviewStart).toHaveBeenCalled();

    await user.unhover(trigger);
    expect(onPreviewEnd).toHaveBeenCalled();

    trigger.focus();
    expect(onPreviewStart).toHaveBeenCalledTimes(2);

    await user.click(trigger);
    expect(onPin).toHaveBeenCalledTimes(1);
  });

  it("still allows click-to-pin when all services are already visible inline", async () => {
    const user = userEvent.setup();
    const onPin = vi.fn();

    render(
      <PromotionStatusLine
        copy={getCopy("zh-CN")}
        onPin={onPin}
        overlayState="closed"
        promotionDecision={{
          ...promotionDecision,
          inlineServices: promotionDecision.allServices,
          hiddenServiceCount: 0
        }}
        rootRef={createRef<HTMLDivElement>()}
      />
    );

    await user.click(screen.getByTestId("promotion-status-trigger"));
    expect(onPin).toHaveBeenCalledTimes(1);
  });
});
