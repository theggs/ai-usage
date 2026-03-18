import { performance } from "node:perf_hooks";
import { describe, expect, it } from "vitest";
import { loadPanelState, refreshPanelState } from "../../src/features/demo-services/panelController";
import { getPreferences } from "../../src/features/preferences/preferencesController";

describe("performance thresholds", () => {
  it("loads the shell bootstrap state within 2 seconds", async () => {
    const startedAt = performance.now();
    await Promise.all([loadPanelState(), getPreferences()]);
    const elapsed = performance.now() - startedAt;
    expect(elapsed).toBeLessThan(2000);
  });

  it("refreshes panel state within 1 second", async () => {
    const startedAt = performance.now();
    await refreshPanelState();
    const elapsed = performance.now() - startedAt;
    expect(elapsed).toBeLessThan(1000);
  });
});
