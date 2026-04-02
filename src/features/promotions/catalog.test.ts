import { describe, expect, it } from "vitest";
import { promotionCatalog } from "./catalog";

describe("promotionCatalog", () => {
  it("keeps campaign ids unique", () => {
    const ids = promotionCatalog.campaigns.map((campaign) => campaign.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("retains historical campaign snapshots alongside current entries", () => {
    const active = promotionCatalog.campaigns.filter((campaign) => campaign.lifecycle === "active");
    const historical = promotionCatalog.campaigns.filter(
      (campaign) => campaign.lifecycle === "ended" || campaign.lifecycle === "archived"
    );

    expect(active.map((campaign) => campaign.serviceId).sort()).toEqual(["claude-code"]);
    expect(historical.map((campaign) => campaign.serviceId).sort()).toEqual([
      "claude-code",
      "codex",
      "codex"
    ]);
  });

  it("keeps source and review metadata on every catalog entry", () => {
    for (const campaign of promotionCatalog.campaigns) {
      expect(campaign.sourceLabel.length).toBeGreaterThan(0);
      expect(campaign.sourceUrl.startsWith("https://")).toBe(true);
      expect(campaign.lastReviewedAt.length).toBeGreaterThan(0);
    }
  });

  it("retains explicit benefit labels for the current Claude promotion", () => {
    const activeBenefits = Object.fromEntries(
      promotionCatalog.campaigns
        .filter((campaign) => campaign.lifecycle === "active")
        .map((campaign) => [campaign.serviceId, campaign.benefitLabel])
    );

    expect(activeBenefits).toMatchObject({
      "claude-code": "2x"
    });
  });
});
