import { describe, expect, it } from "vitest";
import { PROVIDERS, getProvider, providerIds, menubarServiceIds } from "./registry";

describe("registry", () => {
  it("PROVIDERS array contains all four provider IDs", () => {
    const ids = PROVIDERS.map((p) => p.id);
    expect(ids).toEqual(["codex", "claude-code", "kimi-code", "glm-coding"]);
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

  it("providerIds returns all four providers", () => {
    expect(providerIds()).toEqual(["codex", "claude-code", "kimi-code", "glm-coding"]);
  });

  it("menubarServiceIds returns all providers plus auto", () => {
    expect(menubarServiceIds()).toEqual(["codex", "claude-code", "kimi-code", "glm-coding", "auto"]);
  });
});
