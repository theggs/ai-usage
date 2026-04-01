import type { CodexPanelState } from "../../lib/tauri/contracts";
import type { VisibleServiceScope } from "../../lib/tauri/summary";

export type PromotionType = "time-window" | "limited-time";
export type PromotionCapacityEffect = "promotion" | "restriction";
export type PromotionLifecycle = "scheduled" | "active" | "ended" | "archived";
export type PromotionPresentationMode = "focused" | "all";
export type PromotionOverlayState = "closed" | "preview" | "pinned";
export type PromotionEligibilityState = "eligible" | "ineligible" | "unknown";
export type PromotionServiceStatus =
  | "active-window"
  | "active-general"
  | "restricted-window"
  | "inactive-window"
  | "eligibility-unknown"
  | "none";

export interface PromotionEligibilityRule {
  knownEligiblePlans: string[];
  knownIneligiblePlans: string[];
  unknownPolicy: "pending";
}

export interface PromotionRange {
  start: string;
  end: string;
}

export interface PromotionWindow {
  kind: "continuous" | "recurring-off-peak";
  timeZone: string;
  weekdays?: number[];
  blockedRanges?: PromotionRange[];
  activeRanges?: PromotionRange[];
}

export interface PromotionCampaign {
  id: string;
  serviceId: string;
  title: string;
  promotionType: PromotionType;
  capacityEffect?: PromotionCapacityEffect;
  benefitLabel?: string;
  surfaces: string[];
  startsAt: string;
  endsAt?: string;
  lifecycle: PromotionLifecycle;
  sourceLabel: string;
  sourceUrl: string;
  eligibility: PromotionEligibilityRule;
  windows: PromotionWindow[];
  historyNote?: string;
  lastReviewedAt: string;
}

export interface PromotionCatalog {
  campaigns: PromotionCampaign[];
  lastReviewedAt: string;
}

export type PromotionDetailTiming =
  | {
      mode: "local-window";
      dateRangeLabel: string;
      localWindowRangeLabel: string;
      localTimeZoneLabel: string;
    }
  | {
      mode: "local-active-window";
      dateRangeLabel: string;
      localWindowRangeLabel: string;
      localTimeZoneLabel: string;
    }
  | {
      mode: "continuous";
    }
  | {
      mode: "none";
    };

export interface PromotionServiceDecision {
  serviceId: string;
  serviceName: string;
  status: PromotionServiceStatus;
  benefitLabel?: string;
  matchedCampaignId?: string;
  messageKey: string;
  detailTiming: PromotionDetailTiming;
  isInlineVisible: boolean;
}

export interface PromotionDisplayDecision {
  inlineServices: PromotionServiceDecision[];
  allServices: PromotionServiceDecision[];
  hiddenServiceCount: number;
  fallbackState: "none" | null;
}

export interface PromotionResolverInput {
  now?: Date;
  catalog?: PromotionCatalog;
  visibleServiceScope: VisibleServiceScope;
  panelStates?: Partial<Record<string, CodexPanelState | null>>;
  eligibilityByServiceId?: Partial<Record<string, PromotionEligibilityState>>;
}
