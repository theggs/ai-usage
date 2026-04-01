import { describe, expect, it, vi } from "vitest";
import {
  formatPromotionDetailTiming,
  formatPromotionPopoverLine,
  formatPromotionServiceDecision,
  getCopy,
  getPlaceholderCopy,
  getPromotionPopoverLabel,
  getPromotionTriggerLabel,
  localizeResetHint,
  localizeDimensionLabel,
  resolveCopyTree
} from "./i18n";

describe("i18n fallback", () => {
  it("falls back to the base copy when locale keys are missing", () => {
    const copy = resolveCopyTree({ title: "自定义标题" });
    expect(copy.title).toBe("自定义标题");
    expect(copy.trayPreview).toBe("Tray preview");
  });

  it("provides localized labels for settings and panel copy", () => {
    const zh = getCopy("zh-CN");
    const en = getCopy("en-US");

    expect(zh.preferences).toBe("偏好设置");
    expect(zh.lastRefreshedAt).toBe("上次刷新");
    expect(en.autostart).toBe("Start on boot");
    expect(en.summaryHidden).toBe("hidden");
    expect(en.traySummaryIconOnly).toBe("icon only");
    expect(en.notificationActions).toBe("Notification");
  });

  it("keeps the english health-summary building blocks compact for the 360px header", () => {
    const en = getCopy("en-US");
    const dimension = localizeDimensionLabel(en, "codex / 5h");
    const warning = en.panelWarningSummary
      .replace("{service}", "Codex")
      .replace("{dimension}", ` ${dimension}`)
      .replace(/\s+/g, " ")
      .trim();

    expect(dimension).toBe("5h limits");
    expect(warning).toBe("Codex 5h limits running low");
    expect(warning.length).toBeLessThanOrEqual(32);
  });

  it("formats promotion service decisions and all-state popover copy without expanding into long-form text", () => {
    const zh = getCopy("zh-CN");
    const en = getCopy("en-US");

    expect(
      formatPromotionServiceDecision(zh, {
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
      })
    ).toBe("Codex 正在优惠时段 2x");

    expect(
      formatPromotionPopoverLine(en, {
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
            status: "restricted-window",
            matchedCampaignId: "claude-peak-hours-restriction",
            messageKey: "promotionStatusRestrictedWindow",
            detailTiming: {
              mode: "local-active-window",
              dateRangeLabel: "2026.04.01",
              localWindowRangeLabel: "20:00-02:00",
              localTimeZoneLabel: "UTC+08:00"
            },
            isInlineVisible: false
          }
        ],
        hiddenServiceCount: 1,
        fallbackState: null
      })
    ).toBe("Codex promotion active 2x · Claude Code lower quota during peak hours");
  });

  it("returns localized labels for the promotion trigger and popover", () => {
    expect(getPromotionTriggerLabel(getCopy("zh-CN"), "closed")).toBe("预览全部促销状态");
    expect(getPromotionTriggerLabel(getCopy("en-US"), "pinned")).toBe(
      "Preview all promotion states (All promotion states)"
    );
    expect(getPromotionPopoverLabel(getCopy("zh-CN"))).toBe("全部促销状态");
  });

  it("formats localized second-line timing copy for popover detail blocks", () => {
    expect(
      formatPromotionDetailTiming(getCopy("zh-CN"), {
        mode: "local-window",
        dateRangeLabel: "2026.03.13-2026.03.28",
        localWindowRangeLabel: "20:00-02:00",
        localTimeZoneLabel: "UTC+08:00"
      })
    ).toBe("2026.03.13-2026.03.28 · 工作日 20:00-02:00 (UTC+08:00) 之外");

    expect(
      formatPromotionDetailTiming(getCopy("en-US"), {
        mode: "local-active-window",
        dateRangeLabel: "",
        localWindowRangeLabel: "20:00-02:00",
        localTimeZoneLabel: "UTC+08:00"
      })
    ).toBe("weekdays 20:00-02:00 (UTC+08:00)");

    expect(
      formatPromotionDetailTiming(getCopy("en-US"), {
        mode: "continuous"
      })
    ).toBe("All-day promotion");
  });
});

describe("getPlaceholderCopy provider routing", () => {
  const enCopy = getCopy("en-US");
  const zhCopy = getCopy("zh-CN");

  it("returns tokenNotConfiguredTitle/Body for kimi-code with NoCredentials", () => {
    const result = getPlaceholderCopy(enCopy, { kind: "NoCredentials" }, "kimi-code");
    expect(result.title).toBe(enCopy.tokenNotConfiguredTitle);
    expect(result.body).toBe(enCopy.tokenNotConfiguredBody);
    expect(result.title).not.toBe(enCopy.claudeCodeNotConnectedTitle);
  });

  it("returns tokenNotConfiguredTitle/Body for glm-coding with NoCredentials", () => {
    const result = getPlaceholderCopy(enCopy, { kind: "NoCredentials" }, "glm-coding");
    expect(result.title).toBe(enCopy.tokenNotConfiguredTitle);
    expect(result.body).toBe(enCopy.tokenNotConfiguredBody);
  });

  it("returns claudeCodeNotConnectedTitle/Body for claude-code with NoCredentials (backward compatible)", () => {
    const result = getPlaceholderCopy(enCopy, { kind: "NoCredentials" }, "claude-code");
    expect(result.title).toBe(enCopy.claudeCodeNotConnectedTitle);
    expect(result.body).toBe(enCopy.claudeCodeNotConnectedBody);
  });

  it("returns existing copy for codex with CliNotFound (no regression)", () => {
    const result = getPlaceholderCopy(enCopy, { kind: "CliNotFound" }, "codex");
    expect(result.title).toBe(enCopy.serviceNotInstalledTitle);
    expect(result.body).toBe(enCopy.serviceNotInstalledBody);
  });

  it("returns statusAccessDeniedTitle/Body for kimi-code with AccessDenied (non-NoCredentials statuses unchanged)", () => {
    const result = getPlaceholderCopy(enCopy, { kind: "AccessDenied" }, "kimi-code");
    expect(result.title).toBe(enCopy.statusAccessDeniedTitle);
    expect(result.body).toBe(enCopy.statusAccessDeniedBody);
  });

  it("en-US tokenNotConfiguredTitle/Body text does NOT mention Claude Code", () => {
    expect(enCopy.tokenNotConfiguredTitle).not.toMatch(/Claude Code/i);
    expect(enCopy.tokenNotConfiguredBody).not.toMatch(/Claude Code/i);
  });

  it("zh-CN tokenNotConfiguredTitle/Body text does NOT mention Claude Code", () => {
    expect(zhCopy.tokenNotConfiguredTitle).not.toMatch(/Claude Code/i);
    expect(zhCopy.tokenNotConfiguredBody).not.toMatch(/Claude Code/i);
  });
});

describe("localizeResetHint", () => {
  it("formats raw ISO reset timestamps into precise localized relative hints", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-01T12:00:00.000Z"));

    const zhCopy = getCopy("zh-CN");
    const enCopy = getCopy("en-US");

    expect(localizeResetHint(zhCopy, "2026-04-01T13:08:52.858850Z")).toBe("1 小时 09 分钟后重置");
    expect(localizeResetHint(enCopy, "2026-04-01T13:08:52.858850Z")).toBe("Resets in 1h 09m");
    expect(localizeResetHint(enCopy, "2026-04-03T14:08:52.858850Z")).toBe("Resets in 2d 03h");
    expect(localizeResetHint(enCopy, "2026-04-01T12:04:00.000Z")).toBe("Resets in 4m");

    vi.useRealTimers();
  });

  it("keeps legacy backend reset hints and due states readable during migration", () => {
    const enCopy = getCopy("en-US");

    expect(localizeResetHint(enCopy, "Resets in 2h")).toBe("Resets in 2h");
    expect(localizeResetHint(enCopy, "Reset due")).toBe("Reset due");
    expect(localizeResetHint(enCopy, "Waiting for snapshot")).toBe("Waiting for snapshot");

    vi.useRealTimers();
  });
});
