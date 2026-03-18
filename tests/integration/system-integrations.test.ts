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
});
