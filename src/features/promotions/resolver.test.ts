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
  it("treats Claude Code as active-window outside the blocked ET workday window", () => {
    const decision = resolvePromotionDisplayDecision({
      now: new Date("2026-03-24T01:00:00Z"),
      visibleServiceScope: visibleServiceScope(["claude-code"]),
      eligibilityByServiceId: { "claude-code": "eligible" }
    });

    expect(decision.inlineServices[0]?.status).toBe("active-window");
    expect(decision.inlineServices[0]?.benefitLabel).toBe("2x");
    expect(decision.allServices[0]?.status).toBe("active-window");
    expect(decision.allServices[0]?.benefitLabel).toBe("2x");
    expect(decision.allServices[0]?.detailTiming).toEqual({
      mode: "local-window",
      dateRangeLabel: "2026.03.13-2026.03.28",
      localWindowRangeLabel: "20:00-02:00",
      localTimeZoneLabel: "UTC+08:00"
    });
    expect(decision.fallbackState).toBeNull();
  });

  it("treats Claude Code as inactive-window inside the blocked ET workday window", () => {
    const decision = resolvePromotionDisplayDecision({
      now: new Date("2026-03-24T16:00:00Z"),
      visibleServiceScope: visibleServiceScope(["claude-code"]),
      eligibilityByServiceId: { "claude-code": "eligible" }
    });

    expect(decision.inlineServices).toEqual([]);
    expect(decision.allServices[0]?.status).toBe("inactive-window");
    expect(decision.allServices[0]?.benefitLabel).toBe("2x");
    expect(decision.allServices[0]?.detailTiming).toEqual({
      mode: "local-window",
      dateRangeLabel: "2026.03.13-2026.03.28",
      localWindowRangeLabel: "20:00-02:00",
      localTimeZoneLabel: "UTC+08:00"
    });
    expect(decision.fallbackState).toBe("none");
  });

  it("treats the current Codex promotion as a continuous active window", () => {
    const decision = resolvePromotionDisplayDecision({
      now: new Date("2026-03-24T16:00:00Z"),
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
      now: new Date("2026-03-24T16:00:00Z"),
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
      now: new Date("2026-03-24T16:00:00Z"),
      visibleServiceScope: visibleServiceScope(["codex", "claude-code"]),
      eligibilityByServiceId: {
        codex: "eligible",
        "claude-code": "eligible"
      }
    });

    expect(decision.inlineServices.map((service) => service.serviceId)).toEqual(["codex"]);
    expect(decision.allServices.map((service) => service.serviceId)).toEqual([
      "codex",
      "claude-code"
    ]);
    expect(decision.hiddenServiceCount).toBe(1);
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
