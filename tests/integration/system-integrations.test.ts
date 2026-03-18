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
});
