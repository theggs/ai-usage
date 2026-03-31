import type { CodexPanelState } from "../../lib/tauri/contracts";
import { getProvider } from "../../lib/tauri/registry";
import type { VisibleServiceScope } from "../../lib/tauri/summary";
import { promotionCatalog } from "./catalog";
import type {
  PromotionCampaign,
  PromotionDetailTiming,
  PromotionDisplayDecision,
  PromotionEligibilityState,
  PromotionResolverInput,
  PromotionServiceDecision,
  PromotionServiceStatus,
  PromotionWindow
} from "./types";

const LOCAL_TIME_ZONE = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

const ZONED_PARTS_FORMATTERS = new Map<string, Intl.DateTimeFormat>();
const STATUS_PRIORITY: Record<PromotionServiceStatus, number> = {
  "active-window": 4,
  "active-general": 3,
  "inactive-window": 2,
  "eligibility-unknown": 1,
  none: 0
};

const INLINE_VISIBLE_STATUSES = new Set<PromotionServiceStatus>([
  "active-window",
  "active-general",
  "eligibility-unknown"
]);

const getZonedFormatter = (timeZone: string) => {
  const key = `${timeZone}-weekday-hour-minute`;
  const cached = ZONED_PARTS_FORMATTERS.get(key);
  if (cached) {
    return cached;
  }

  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    hourCycle: "h23"
  });
  ZONED_PARTS_FORMATTERS.set(key, formatter);
  return formatter;
};

const getZonedWeekdayAndMinutes = (date: Date, timeZone: string) => {
  const parts = getZonedFormatter(timeZone).formatToParts(date);
  const lookup = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const weekdayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6
  };
  const weekday = weekdayMap[lookup.weekday ?? "Sun"] ?? 0;
  const hour = Number.parseInt(lookup.hour ?? "0", 10);
  const minute = Number.parseInt(lookup.minute ?? "0", 10);

  return {
    weekday,
    minutes: hour * 60 + minute
  };
};

const getFullZonedFormatter = (timeZone: string) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    hourCycle: "h23"
  });

const getZonedDateTimeParts = (date: Date, timeZone: string) => {
  const formatter = getFullZonedFormatter(timeZone);
  const parts = formatter.formatToParts(date);
  const lookup = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return {
    year: Number.parseInt(lookup.year ?? "1970", 10),
    month: Number.parseInt(lookup.month ?? "1", 10),
    day: Number.parseInt(lookup.day ?? "1", 10),
    hour: Number.parseInt(lookup.hour ?? "0", 10),
    minute: Number.parseInt(lookup.minute ?? "0", 10)
  };
};

const getInstantForZonedDateTime = ({
  timeZone,
  year,
  month,
  day,
  hour,
  minute
}: {
  timeZone: string;
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
}) => {
  let utcGuess = Date.UTC(year, month - 1, day, hour, minute);

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const parts = getZonedDateTimeParts(new Date(utcGuess), timeZone);
    const guessedUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute);
    const targetUtc = Date.UTC(year, month - 1, day, hour, minute);
    const diff = targetUtc - guessedUtc;
    utcGuess += diff;
    if (diff === 0) {
      break;
    }
  }

  return new Date(utcGuess);
};

const formatLocalRangeTime = (date: Date) =>
  new Intl.DateTimeFormat("en-GB", {
    timeZone: LOCAL_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    hourCycle: "h23"
  }).format(date);

const formatLocalTimeZoneLabel = (date: Date) => {
  const timeZoneName = new Intl.DateTimeFormat("en-US", {
    timeZone: LOCAL_TIME_ZONE,
    timeZoneName: "shortOffset"
  })
    .formatToParts(date)
    .find((part) => part.type === "timeZoneName")?.value;

  if (!timeZoneName || timeZoneName === "GMT") {
    return "UTC+00:00";
  }

  const match = timeZoneName.match(/^GMT([+-])(\d{1,2})(?::?(\d{2}))?$/);
  if (!match) {
    return timeZoneName.replace(/^GMT/, "UTC");
  }

  const [, sign, hours, minutes = "00"] = match;
  return `UTC${sign}${hours.padStart(2, "0")}:${minutes.padStart(2, "0")}`;
};

const formatDateLabel = (value?: string) => {
  if (!value) {
    return "";
  }
  const datePart = value.split("T")[0] ?? value;
  return datePart.replace(/-/g, ".");
};

const parseMinutes = (value: string) => {
  const [hour, minute] = value.split(":").map((part) => Number.parseInt(part, 10));
  return hour * 60 + minute;
};

const isWithinRange = (minutes: number, start: string, end: string) => {
  const startMinutes = parseMinutes(start);
  const endMinutes = parseMinutes(end);
  return minutes >= startMinutes && minutes < endMinutes;
};

const isCampaignCurrentlyActive = (campaign: PromotionCampaign, now: Date) => {
  if (campaign.lifecycle === "ended" || campaign.lifecycle === "archived") {
    return false;
  }

  const startsAt = Date.parse(campaign.startsAt);
  const endsAt = campaign.endsAt ? Date.parse(campaign.endsAt) : undefined;
  const timestamp = now.getTime();

  if (!Number.isNaN(startsAt) && timestamp < startsAt) {
    return false;
  }

  if (endsAt !== undefined && !Number.isNaN(endsAt) && timestamp > endsAt) {
    return false;
  }

  return true;
};

const resolveTimeWindowStatus = (window: PromotionWindow, now: Date): PromotionServiceStatus => {
  if (window.kind === "continuous") {
    return "active-window";
  }

  const { weekday, minutes } = getZonedWeekdayAndMinutes(now, window.timeZone);
  const matchesWeekday = !window.weekdays?.length || window.weekdays.includes(weekday);

  if (window.activeRanges?.length) {
    if (!matchesWeekday) {
      return "inactive-window";
    }
    return window.activeRanges.some((range) => isWithinRange(minutes, range.start, range.end))
      ? "active-window"
      : "inactive-window";
  }

  if (window.blockedRanges?.length) {
    if (!matchesWeekday) {
      return "active-window";
    }
    return window.blockedRanges.some((range) => isWithinRange(minutes, range.start, range.end))
      ? "inactive-window"
      : "active-window";
  }

  return matchesWeekday ? "active-window" : "inactive-window";
};

const getServiceName = (
  serviceId: string,
  panelState?: CodexPanelState | null
) => panelState?.items[0]?.serviceName ?? getProvider(serviceId)?.displayName ?? serviceId;

const getMessageKey = (status: PromotionServiceStatus) => {
  switch (status) {
    case "active-window":
      return "promotionStatusActiveWindow";
    case "active-general":
      return "promotionStatusActiveGeneral";
    case "inactive-window":
      return "promotionStatusInactiveWindow";
    case "eligibility-unknown":
      return "promotionStatusEligibilityUnknown";
    default:
      return "promotionStatusNone";
  }
};

const getLocalWindowRangeLabel = (campaign: PromotionCampaign) => {
  const recurringWindow = campaign.windows.find(
    (window) => window.kind === "recurring-off-peak" && window.blockedRanges?.length
  );
  const blockedRange = recurringWindow?.blockedRanges?.[0];

  if (!recurringWindow || !blockedRange) {
    return "";
  }

  const referenceDate = {
    year: 2026,
    month: 3,
    day: 16
  };
  const start = getInstantForZonedDateTime({
    timeZone: recurringWindow.timeZone,
    ...referenceDate,
    hour: Number.parseInt(blockedRange.start.slice(0, 2), 10),
    minute: Number.parseInt(blockedRange.start.slice(3, 5), 10)
  });
  const end = getInstantForZonedDateTime({
    timeZone: recurringWindow.timeZone,
    ...referenceDate,
    hour: Number.parseInt(blockedRange.end.slice(0, 2), 10),
    minute: Number.parseInt(blockedRange.end.slice(3, 5), 10)
  });

  return `${formatLocalRangeTime(start)}-${formatLocalRangeTime(end)}`;
};

const getDetailTiming = (
  campaign: PromotionCampaign | undefined,
  status: PromotionServiceStatus
): PromotionDetailTiming => {
  if (!campaign) {
    return { mode: "none" };
  }

  if (campaign.serviceId === "codex" && status === "active-window") {
    return { mode: "continuous" };
  }

  if (campaign.serviceId === "claude-code") {
    const localWindowReference = getInstantForZonedDateTime({
      timeZone: campaign.windows[0]?.timeZone ?? "America/New_York",
      year: 2026,
      month: 3,
      day: 16,
      hour: 8,
      minute: 0
    });

    return {
      mode: "local-window",
      dateRangeLabel: `${formatDateLabel(campaign.startsAt)}-${formatDateLabel(campaign.endsAt)}`,
      localWindowRangeLabel: getLocalWindowRangeLabel(campaign),
      localTimeZoneLabel: formatLocalTimeZoneLabel(localWindowReference)
    };
  }

  return { mode: "none" };
};

const pickBestDecision = (candidate: PromotionServiceDecision, next: PromotionServiceDecision) =>
  STATUS_PRIORITY[next.status] > STATUS_PRIORITY[candidate.status] ? next : candidate;

const resolveCampaignStatus = (campaign: PromotionCampaign, now: Date): PromotionServiceStatus => {
  if (campaign.promotionType === "limited-time" && campaign.windows.length === 0) {
    return "active-general";
  }

  let best: PromotionServiceStatus = "inactive-window";
  for (const window of campaign.windows) {
    const next = resolveTimeWindowStatus(window, now);
    if (STATUS_PRIORITY[next] > STATUS_PRIORITY[best]) {
      best = next;
    }
  }
  return best;
};

const resolveServiceDecision = ({
  serviceId,
  now,
  panelStates,
  visibleServiceScope,
  eligibilityByServiceId,
  campaigns
}: {
  serviceId: string;
  now: Date;
  panelStates?: Partial<Record<string, CodexPanelState | null>>;
  visibleServiceScope: VisibleServiceScope;
  eligibilityByServiceId: Partial<Record<string, PromotionEligibilityState>>;
  campaigns: PromotionCampaign[];
}): PromotionServiceDecision => {
  const serviceName = getServiceName(serviceId, panelStates?.[serviceId]);
  const activeCampaigns = campaigns.filter(
    (campaign) => campaign.serviceId === serviceId && isCampaignCurrentlyActive(campaign, now)
  );
  const eligibility = eligibilityByServiceId[serviceId] ?? "unknown";

  if (!activeCampaigns.length || !visibleServiceScope.visiblePanelServiceOrder.includes(serviceId)) {
    return {
      serviceId,
      serviceName,
      status: "none",
      benefitLabel: undefined,
      messageKey: getMessageKey("none"),
      detailTiming: { mode: "none" },
      isInlineVisible: false
    };
  }

  if (eligibility === "ineligible") {
    return {
      serviceId,
      serviceName,
      status: "none",
      benefitLabel: undefined,
      messageKey: getMessageKey("none"),
      detailTiming: { mode: "none" },
      isInlineVisible: false
    };
  }

  if (eligibility === "unknown") {
    const matched = activeCampaigns[0];
    return {
      serviceId,
      serviceName,
      status: "eligibility-unknown",
      benefitLabel: matched?.benefitLabel,
      matchedCampaignId: matched?.id,
      messageKey: getMessageKey("eligibility-unknown"),
      detailTiming: getDetailTiming(matched, "eligibility-unknown"),
      isInlineVisible: true
    };
  }

  let decision: PromotionServiceDecision = {
    serviceId,
    serviceName,
    status: "none",
    benefitLabel: undefined,
    messageKey: getMessageKey("none"),
    detailTiming: { mode: "none" },
    isInlineVisible: false
  };

  for (const campaign of activeCampaigns) {
    const status = resolveCampaignStatus(campaign, now);
    decision = pickBestDecision(decision, {
      serviceId,
      serviceName,
      status,
      benefitLabel: campaign.benefitLabel,
      matchedCampaignId: campaign.id,
      messageKey: getMessageKey(status),
      detailTiming: getDetailTiming(campaign, status),
      isInlineVisible: INLINE_VISIBLE_STATUSES.has(status)
    });
  }

  return decision;
};

export const derivePromotionEligibilityByService = ({
  visibleServiceScope
}: {
  visibleServiceScope: VisibleServiceScope;
}): Partial<Record<string, PromotionEligibilityState>> => {
  const eligibilityByServiceId: Partial<Record<string, PromotionEligibilityState>> = {};

  for (const serviceId of visibleServiceScope.visiblePanelServiceOrder) {
    if (serviceId === "claude-code") {
      // Claude Code is only visible when the user has explicitly enabled that surface,
      // so we treat the current promotion as eligible for the visible Claude surface.
      eligibilityByServiceId[serviceId] = "eligible";
    } else {
      // Current product policy treats the published Codex promotion as applicable
      // to the visible Codex surface and expresses it as a continuous discount window.
      eligibilityByServiceId[serviceId] = "eligible";
    }
  }

  return eligibilityByServiceId;
};

export const resolvePromotionDisplayDecision = ({
  now = new Date(),
  catalog = promotionCatalog,
  visibleServiceScope,
  panelStates,
  eligibilityByServiceId = derivePromotionEligibilityByService({ visibleServiceScope })
}: PromotionResolverInput): PromotionDisplayDecision => {
  const allServices = visibleServiceScope.visiblePanelServiceOrder.map((serviceId) =>
    resolveServiceDecision({
      serviceId,
      now,
      panelStates,
      visibleServiceScope,
      eligibilityByServiceId,
      campaigns: catalog.campaigns
    })
  );

  const inlineServices = allServices.filter((decision) => INLINE_VISIBLE_STATUSES.has(decision.status));
  const hiddenServiceCount = allServices.length - inlineServices.length;

  return {
    inlineServices,
    allServices,
    hiddenServiceCount,
    fallbackState: inlineServices.length === 0 ? "none" : null
  };
};
