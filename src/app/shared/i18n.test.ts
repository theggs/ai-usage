import { describe, expect, it } from "vitest";
import { getCopy, localizeDimensionLabel, resolveCopyTree } from "./i18n";

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
    expect(en.autostart).toBe("Autostart");
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

    expect(dimension).toBe("5h window");
    expect(warning).toBe("Codex 5h window is running low");
    expect(warning.length).toBeLessThanOrEqual(32);
  });
});
