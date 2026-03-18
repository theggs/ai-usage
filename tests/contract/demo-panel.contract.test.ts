import { describe, expect, it } from "vitest";
import { tauriClient } from "../../src/lib/tauri/client";

describe("demo panel contract", () => {
  it("returns demo panel state with visible quota dimensions", async () => {
    const state = await tauriClient.getDemoPanelState();
    expect(state.items.length).toBeGreaterThan(0);
    expect(state.items[0].quotaDimensions.length).toBeGreaterThan(0);
  });
});
