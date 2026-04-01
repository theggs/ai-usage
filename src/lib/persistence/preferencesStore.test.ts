import { describe, expect, it } from "vitest";
import { normalizePreferences } from "./preferencesStore";

describe("preferencesStore", () => {
  it("normalizePreferences seeds providerEnabled from registry defaults", () => {
    const prefs = normalizePreferences({});
    expect(prefs.providerEnabled).toEqual({
      codex: true,
      "claude-code": false,
      "kimi-code": false,
      "glm-coding": false,
    });
  });

  it("normalizePreferences migrates legacy claudeCodeUsageEnabled to providerEnabled", () => {
    const prefs = normalizePreferences({ claudeCodeUsageEnabled: true });
    expect(prefs.providerEnabled["claude-code"]).toBe(true);
    expect(prefs.providerEnabled["codex"]).toBe(true);
  });

  it("normalizeServiceOrder uses registry provider IDs and filters unknown", () => {
    const prefs = normalizePreferences({ serviceOrder: ["unknown", "claude-code"] });
    // "unknown" should be filtered out, remaining providers appended
    expect(prefs.serviceOrder).toEqual(["claude-code", "codex", "kimi-code", "glm-coding"]);
  });

  it("normalizeMenubarService falls back when disabled provider selected", () => {
    const prefs = normalizePreferences({
      menubarService: "claude-code",
      providerEnabled: { codex: true, "claude-code": false },
    });
    // claude-code is disabled, should fall back
    expect(prefs.menubarService).not.toBe("claude-code");
  });

  it("preserves existing providerEnabled map and fills missing providers", () => {
    const prefs = normalizePreferences({
      providerEnabled: { codex: false },
    });
    // codex should keep the explicit false
    expect(prefs.providerEnabled["codex"]).toBe(false);
    // claude-code should be seeded from registry default
    expect(prefs.providerEnabled["claude-code"]).toBe(false);
  });

  it("keeps auto menubar selection regardless of provider enabled state", () => {
    const prefs = normalizePreferences({
      menubarService: "auto",
      providerEnabled: { codex: true, "claude-code": false },
    });
    expect(prefs.menubarService).toBe("auto");
  });

  it("normalizePreferences trims provider token whitespace", () => {
    const prefs = normalizePreferences({
      providerTokens: { "kimi-code": "  sk-abc  " },
    });
    expect(prefs.providerTokens["kimi-code"]).toBe("sk-abc");
  });

  it("normalizePreferences removes blank provider tokens", () => {
    const prefs = normalizePreferences({
      providerTokens: { "kimi-code": "  " },
    });
    expect(prefs.providerTokens["kimi-code"]).toBeUndefined();
  });

  it("normalizePreferences defaults glmPlatform to global", () => {
    const prefs = normalizePreferences({});
    expect(prefs.glmPlatform).toBe("global");
  });

  it("normalizePreferences validates glmPlatform values", () => {
    const prefs = normalizePreferences({
      glmPlatform: "invalid" as "global",
    });
    expect(prefs.glmPlatform).toBe("global");
  });

  it("normalizePreferences preserves china glmPlatform", () => {
    const prefs = normalizePreferences({ glmPlatform: "china" });
    expect(prefs.glmPlatform).toBe("china");
  });
});
