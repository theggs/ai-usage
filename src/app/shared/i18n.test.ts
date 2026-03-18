import { describe, expect, it } from "vitest";
import { resolveCopyTree } from "./i18n";

describe("i18n fallback", () => {
  it("falls back to the base copy when locale keys are missing", () => {
    const copy = resolveCopyTree({ title: "自定义标题" });
    expect(copy.title).toBe("自定义标题");
    expect(copy.trayPreview).toBe("Tray preview");
  });
});
