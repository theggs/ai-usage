import { describe, expect, it } from "vitest";
import type { VisibleServiceScope } from "../../lib/tauri/summary";
import { promotionCatalog } from "./catalog";
import { derivePromotionEligibilityByService, resolvePromotionDisplayDecision } from "./resolver";

const visibleServiceScope = (services: string[]): VisibleServiceScope => ({
  visiblePanelServiceOrder: services,
  visibleMenubarServices: services,
  hasVisibleClaudeCode: services.includes("claude-code")
});

describe("promotions resolver", () => {
  it("does not surface the expired Claude March 2026 2x promotion on 2026-04-01", () => {
    const decision = resolvePromotionDisplayDecision({
      now: new Date("2026-04-01T01:00:00Z"),
      visibleServiceScope: visibleServiceScope(["claude-code"]),
      eligibilityByServiceId: { "claude-code": "eligible" }
    });

    expect(decision.inlineServices).toEqual([]);
    expect(decision.allServices[0]?.status).toBe("none");
    expect(decision.allServices[0]?.benefitLabel).toBeUndefined();
    expect(decision.fallbackState).toBe("none");
  });

  it("treats Claude Code as restricted-window inside the weekday PT peak-hours window", () => {
    const decision = resolvePromotionDisplayDecision({
      now: new Date("2026-04-01T16:00:00Z"),
      visibleServiceScope: visibleServiceScope(["claude-code"]),
      eligibilityByServiceId: { "claude-code": "eligible" }
    });

    expect(decision.inlineServices[0]?.status).toBe("restricted-window");
    expect(decision.inlineServices[0]?.benefitLabel).toBeUndefined();
    expect(decision.allServices[0]?.status).toBe("restricted-window");
    expect(decision.allServices[0]?.matchedCampaignId).toBe("claude-peak-hours-restriction");
    expect(decision.allServices[0]?.detailTiming).toMatchObject({
      mode: "local-active-window",
      dateRangeLabel: ""
    });
    expect(decision.allServices[0]?.detailTiming).toEqual(
      expect.objectContaining({
        localWindowRangeLabel: expect.stringMatching(/^\d{2}:\d{2}-\d{2}:\d{2}$/),
        localTimeZoneLabel: expect.stringMatching(/^UTC[+-]\d{2}:\d{2}$/)
      })
    );
    expect(decision.fallbackState).toBeNull();
  });

  it("falls back to none outside the Claude restriction window when no positive campaign is active", () => {
    const decision = resolvePromotionDisplayDecision({
      now: new Date("2026-04-01T02:00:00Z"),
      visibleServiceScope: visibleServiceScope(["claude-code"]),
      eligibilityByServiceId: { "claude-code": "eligible" }
    });

    expect(decision.inlineServices).toEqual([]);
    expect(decision.allServices[0]?.status).toBe("none");
    expect(decision.fallbackState).toBe("none");
  });

  it("keeps the current Codex promotion as a continuous active window", () => {
    const decision = resolvePromotionDisplayDecision({
      now: new Date("2026-04-01T16:00:00Z"),
      visibleServiceScope: visibleServiceScope(["codex"])
    });

    expect(decision.inlineServices[0]?.status).toBe("active-window");
    expect(decision.inlineServices[0]?.benefitLabel).toBe("2x");
    expect(decision.allServices[0]?.status).toBe("active-window");
    expect(decision.allServices[0]?.detailTiming).toEqual({
      mode: "continuous"
    });
  });

  it("filters historical campaigns out of current UI decisions", () => {
    const onlyHistory = {
      ...promotionCatalog,
      campaigns: promotionCatalog.campaigns.filter((campaign) => campaign.lifecycle !== "active")
    };
    const decision = resolvePromotionDisplayDecision({
      now: new Date("2026-04-01T16:00:00Z"),
      visibleServiceScope: visibleServiceScope(["codex", "claude-code"]),
      catalog: onlyHistory
    });

    expect(decision.inlineServices).toEqual([]);
    expect(decision.allServices.map((service) => service.status)).toEqual(["none", "none"]);
    expect(decision.allServices.map((service) => service.detailTiming.mode)).toEqual(["none", "none"]);
    expect(decision.hiddenServiceCount).toBe(2);
    expect(decision.fallbackState).toBe("none");
  });

  it("keeps hidden services out of inline pills but exposes them in all-services data", () => {
    const decision = resolvePromotionDisplayDecision({
      now: new Date("2026-04-01T16:00:00Z"),
      visibleServiceScope: visibleServiceScope(["codex", "claude-code"]),
      eligibilityByServiceId: {
        codex: "eligible",
        "claude-code": "eligible"
      }
    });

    expect(decision.inlineServices.map((service) => service.serviceId)).toEqual([
      "codex",
      "claude-code"
    ]);
    expect(decision.allServices.map((service) => service.serviceId)).toEqual([
      "codex",
      "claude-code"
    ]);
    expect(decision.hiddenServiceCount).toBe(0);
  });

  it("returns the default service eligibility model for the current product surfaces", () => {
    expect(
      derivePromotionEligibilityByService({
        visibleServiceScope: visibleServiceScope(["codex", "claude-code"])
      })
    ).toEqual({
      codex: "eligible",
      "claude-code": "eligible"
    });
  });
});
