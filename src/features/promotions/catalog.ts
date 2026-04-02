import type { PromotionCatalog } from "./types";

export const promotionCatalog: PromotionCatalog = {
  lastReviewedAt: "2026-04-02T00:00:00Z",
  campaigns: [
    {
      id: "claude-march-2026-usage-promotion",
      serviceId: "claude-code",
      title: "Claude March 2026 usage promotion",
      promotionType: "time-window",
      benefitLabel: "2x",
      surfaces: ["claude-code"],
      startsAt: "2026-03-13T00:00:00-07:00",
      endsAt: "2026-03-28T23:59:59-07:00",
      lifecycle: "active",
      sourceLabel: "Anthropic Help Center",
      sourceUrl: "https://support.claude.com/en/articles/14063676-claude-march-2026-usage-promotion",
      eligibility: {
        knownEligiblePlans: ["free", "pro", "max", "team"],
        knownIneligiblePlans: [],
        unknownPolicy: "pending"
      },
      windows: [
        {
          kind: "recurring-off-peak",
          timeZone: "America/New_York",
          weekdays: [1, 2, 3, 4, 5],
          blockedRanges: [{ start: "08:00", end: "14:00" }]
        }
      ],
      lastReviewedAt: "2026-03-24T00:00:00Z"
    },
    {
      id: "codex-limited-time-promotion",
      serviceId: "codex",
      title: "Codex limited-time promotion",
      promotionType: "limited-time",
      benefitLabel: "2x",
      surfaces: ["codex"],
      startsAt: "2026-03-24T00:00:00Z",
      endsAt: "2026-04-02T00:00:00Z",
      lifecycle: "ended",
      sourceLabel: "OpenAI Help Center",
      sourceUrl: "https://help.openai.com/en/articles/11369540-using-codex-with-your-chatgpt-plan",
      eligibility: {
        knownEligiblePlans: ["free", "go", "plus", "pro", "business", "enterprise", "edu"],
        knownIneligiblePlans: [],
        unknownPolicy: "pending"
      },
      windows: [
        {
          kind: "continuous",
          timeZone: "UTC"
        }
      ],
      historyNote: "Codex limited-time 2x promotion ended as confirmed by user on 2026-04-02.",
      lastReviewedAt: "2026-04-02T00:00:00Z"
    },
    {
      id: "claude-march-2026-usage-promotion-review-snapshot",
      serviceId: "claude-code",
      title: "Claude March 2026 usage promotion (archived review snapshot)",
      promotionType: "time-window",
      benefitLabel: "2x",
      surfaces: ["claude-code"],
      startsAt: "2026-03-13T00:00:00-07:00",
      endsAt: "2026-03-28T23:59:59-07:00",
      lifecycle: "archived",
      sourceLabel: "Anthropic Help Center",
      sourceUrl: "https://support.claude.com/en/articles/14063676-claude-march-2026-usage-promotion",
      eligibility: {
        knownEligiblePlans: ["free", "pro", "max", "team"],
        knownIneligiblePlans: [],
        unknownPolicy: "pending"
      },
      windows: [
        {
          kind: "recurring-off-peak",
          timeZone: "America/New_York",
          weekdays: [1, 2, 3, 4, 5],
          blockedRanges: [{ start: "08:00", end: "14:00" }]
        }
      ],
      historyNote: "Archived review snapshot retained to preserve rule history in git.",
      lastReviewedAt: "2026-03-20T00:00:00Z"
    },
    {
      id: "codex-limited-time-promotion-review-snapshot",
      serviceId: "codex",
      title: "Codex limited-time promotion (archived review snapshot)",
      promotionType: "limited-time",
      benefitLabel: "2x",
      surfaces: ["codex"],
      startsAt: "2026-03-21T00:00:00Z",
      lifecycle: "archived",
      sourceLabel: "OpenAI Help Center",
      sourceUrl: "https://help.openai.com/en/articles/11369540-using-codex-with-your-chatgpt-plan",
      eligibility: {
        knownEligiblePlans: ["free", "go", "plus", "pro", "business", "enterprise", "edu"],
        knownIneligiblePlans: [],
        unknownPolicy: "pending"
      },
      windows: [
        {
          kind: "continuous",
          timeZone: "UTC"
        }
      ],
      historyNote: "Archived review snapshot retained to preserve rule history in git.",
      lastReviewedAt: "2026-03-21T00:00:00Z"
    }
  ]
};
