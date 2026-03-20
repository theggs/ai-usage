import { describe, expect, it } from "vitest";
import { tauriClient } from "../../src/lib/tauri/client";

describe("system integrations", () => {
  it("can toggle autostart in the fallback client", async () => {
    const updated = await tauriClient.setAutostart(false);
    expect(updated.autostartEnabled).toBe(false);
  });

  it("returns a notification result", async () => {
    const result = await tauriClient.sendTestNotification();
    expect(["sent", "blocked", "failed"]).toContain(result.result);
  });

  it("returns a disconnected-style fallback when no live Codex session is available", async () => {
    localStorage.clear();
    localStorage.setItem("ai-usage.codex-session-mode", "disconnected");

    const state = await tauriClient.getCodexPanelState();

    expect(state.snapshotState).toBe("stale");
    expect(state.statusMessage).toContain("Codex CLI");
    expect(state.activeSession).toBeUndefined();
  });

  it("preserves the latest known snapshot shape when a refresh is requested", async () => {
    localStorage.clear();
    localStorage.setItem("ai-usage.codex-session-mode", "connected");

    const initial = await tauriClient.getCodexPanelState();
    const refreshed = await tauriClient.refreshCodexPanelState();

    expect(initial.items.length).toBeGreaterThan(0);
    expect(refreshed.items.length).toBeGreaterThan(0);
    expect(refreshed.items[0]?.quotaDimensions[0]?.progressTone).toBeDefined();
  });
});
