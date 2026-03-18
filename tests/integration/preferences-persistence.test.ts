import { beforeEach, describe, expect, it } from "vitest";
import { loadPreferences, savePreferences } from "../../src/lib/persistence/preferencesStore";

describe("preferences persistence", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("saves and restores preferences", () => {
    const saved = savePreferences({ refreshIntervalMinutes: 25, language: "en-US" });
    const loaded = loadPreferences();

    expect(saved.refreshIntervalMinutes).toBe(25);
    expect(loaded.language).toBe("en-US");
  });
});
