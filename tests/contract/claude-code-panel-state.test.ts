import { describe, expect, it } from "vitest";
import { tauriClient } from "../../src/lib/tauri/client";

describe("claude-code panel state contract", () => {
  it("returns a CodexPanelState-shaped response for Claude Code service", async () => {
    localStorage.clear();

    const state = await tauriClient.getClaudeCodePanelState();

    // Required fields must be present.
    expect(typeof state.snapshotState).toBe("string");
    expect(["fresh", "stale", "empty", "failed", "pending"]).toContain(state.snapshotState);
    expect(typeof state.statusMessage).toBe("string");
    expect(Array.isArray(state.items)).toBe(true);
    expect(state.desktopSurface).toBeDefined();
    expect(typeof state.lastSuccessfulRefreshAt).toBe("string");
  });

  it("refreshClaudeCodePanelState returns a valid CodexPanelState", async () => {
    localStorage.clear();

    const state = await tauriClient.refreshClaudeCodePanelState();

    expect(Array.isArray(state.items)).toBe(true);
    expect(["fresh", "stale", "empty", "failed", "pending"]).toContain(state.snapshotState);
    expect(state.desktopSurface).toBeDefined();
  });

  it("items array entries have the claude-code serviceId when present", async () => {
    localStorage.clear();

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
});
