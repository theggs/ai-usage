import { describe, expect, it } from "vitest";
import { tauriClient } from "../../src/lib/tauri/client";

describe("codex panel contract", () => {
  it("returns codex session state without requiring manual account setup", async () => {
    localStorage.clear();

    const state = await tauriClient.getCodexPanelState();

    expect(["fresh", "pending", "stale", "failed"]).toContain(state.snapshotState);
    expect(state.statusMessage.length).toBeGreaterThan(0);
    expect(state.enabledAccountCount).toBe(0);
  });

  it("returns a single active Codex session payload when fallback state is connected", async () => {
    localStorage.clear();
    localStorage.setItem("ai-usage.codex-session-mode", "connected");

    const state = await tauriClient.getCodexPanelState();

    expect(state.activeSession?.sessionLabel).toBe("Local Codex CLI");
    expect(state.items[0]?.quotaDimensions.length).toBeGreaterThan(0);
    expect(state.items[0]?.serviceName).toBe("Codex");
    expect(state.items[0]?.quotaDimensions[0]).toEqual(
      expect.objectContaining({
        status: expect.any(String),
        progressTone: expect.any(String)
      })
    );
  });
});
