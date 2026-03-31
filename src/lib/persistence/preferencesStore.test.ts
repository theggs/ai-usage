import { describe, expect, it } from "vitest";
import { normalizePreferences } from "./preferencesStore";

describe("preferencesStore", () => {
  it("normalizePreferences seeds providerEnabled from registry defaults", () => {
    const prefs = normalizePreferences({});
    expect(prefs.providerEnabled).toEqual({
      codex: true,
      "claude-code": false,
    });
  });

  it("normalizePreferences migrates legacy claudeCodeUsageEnabled to providerEnabled", () => {
    const prefs = normalizePreferences({ claudeCodeUsageEnabled: true });
    expect(prefs.providerEnabled["claude-code"]).toBe(true);
    expect(prefs.providerEnabled["codex"]).toBe(true);
  });

  it("normalizeServiceOrder uses registry provider IDs and filters unknown", () => {
    const prefs = normalizePreferences({ serviceOrder: ["unknown", "claude-code"] });
    // "unknown" should be filtered out, "codex" appended
    expect(prefs.serviceOrder).toEqual(["claude-code", "codex"]);
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
});
