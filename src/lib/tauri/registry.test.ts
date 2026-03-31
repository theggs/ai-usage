import { describe, expect, it } from "vitest";
import { PROVIDERS, getProvider, providerIds, menubarServiceIds } from "./registry";

describe("registry", () => {
  it("PROVIDERS array contains exactly codex and claude-code IDs", () => {
    const ids = PROVIDERS.map((p) => p.id);
    expect(ids).toEqual(["codex", "claude-code"]);
  });

  it("getProvider codex returns descriptor with displayName Codex and defaultEnabled true", () => {
    const p = getProvider("codex");
    expect(p).toBeDefined();
    expect(p!.displayName).toBe("Codex");
    expect(p!.defaultEnabled).toBe(true);
  });

  it("getProvider claude-code returns descriptor with displayName Claude Code and defaultEnabled false", () => {
    const p = getProvider("claude-code");
    expect(p).toBeDefined();
    expect(p!.displayName).toBe("Claude Code");
    expect(p!.defaultEnabled).toBe(false);
  });

  it("getProvider unknown returns undefined", () => {
    expect(getProvider("unknown")).toBeUndefined();
  });

  it("providerIds returns codex and claude-code", () => {
    expect(providerIds()).toEqual(["codex", "claude-code"]);
  });

  it("menubarServiceIds returns codex, claude-code, and auto", () => {
    expect(menubarServiceIds()).toEqual(["codex", "claude-code", "auto"]);
  });
});
