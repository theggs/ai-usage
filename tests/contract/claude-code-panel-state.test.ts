import { beforeEach, describe, expect, it, vi } from "vitest";
import { defaultPreferences } from "../../src/features/preferences/defaultPreferences";

const loadClient = async () => (await import("../../src/lib/tauri/client")).tauriClient;

beforeEach(() => {
  localStorage.clear();
  vi.resetModules();
});

describe("claude-code panel state contract", () => {
  it("returns a CodexPanelState-shaped response for Claude Code service", async () => {
    const tauriClient = await loadClient();

    const state = await tauriClient.getClaudeCodePanelState();

    // Required fields must be present.
    expect(state.status).toBeDefined();
    expect(typeof state.status.kind).toBe("string");
    expect(Array.isArray(state.items)).toBe(true);
    expect(state.desktopSurface).toBeDefined();
    expect(typeof state.lastSuccessfulRefreshAt).toBe("string");
  });

  it("refreshClaudeCodePanelState returns a valid CodexPanelState", async () => {
    localStorage.setItem(
      "ai-usage.preferences",
      JSON.stringify({ ...defaultPreferences, claudeCodeUsageEnabled: true })
    );
    const tauriClient = await loadClient();

    const state = await tauriClient.refreshClaudeCodePanelState();

    expect(Array.isArray(state.items)).toBe(true);
    expect(state.status).toBeDefined();
    expect(state.desktopSurface).toBeDefined();
  });

  it("items array entries have the claude-code serviceId when present", async () => {
    localStorage.setItem(
      "ai-usage.preferences",
      JSON.stringify({ ...defaultPreferences, claudeCodeUsageEnabled: true })
    );
    const tauriClient = await loadClient();

    const state = await tauriClient.getClaudeCodePanelState();

    for (const item of state.items) {
      expect(typeof item.serviceId).toBe("string");
      expect(typeof item.serviceName).toBe("string");
      expect(typeof item.iconKey).toBe("string");
      expect(Array.isArray(item.quotaDimensions)).toBe(true);
      for (const dim of item.quotaDimensions) {
        expect(typeof dim.label).toBe("string");
        expect(typeof dim.remainingAbsolute).toBe("string");
        expect(typeof dim.status).toBe("string");
        expect(typeof dim.progressTone).toBe("string");
      }
    }
  });

  it("returns a safe empty state when Claude Code usage is disabled", async () => {
    localStorage.setItem(
      "ai-usage.preferences",
      JSON.stringify({ ...defaultPreferences, claudeCodeUsageEnabled: false })
    );
    const tauriClient = await loadClient();

    const state = await tauriClient.getClaudeCodePanelState();

    expect(state.items).toEqual([]);
    expect(state.status.kind).toBe("Disabled");
  });

  it("reuses the current Claude Code result when refresh hits the cooldown window", async () => {
    localStorage.setItem(
      "ai-usage.preferences",
      JSON.stringify({ ...defaultPreferences, claudeCodeUsageEnabled: true })
    );
    const tauriClient = await loadClient();

    const first = await tauriClient.refreshClaudeCodePanelState();
    const second = await tauriClient.refreshClaudeCodePanelState();

    expect(second.lastSuccessfulRefreshAt).toBe(first.lastSuccessfulRefreshAt);
    expect(second.status.kind).toBe(first.status.kind);
  });
});
