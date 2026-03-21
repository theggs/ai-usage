import { beforeEach, describe, expect, it } from "vitest";
import {
  loadCodexAccounts,
  saveCodexAccount,
  setCodexAccountEnabled
} from "../../src/lib/persistence/codexAccountStore";
import { loadPreferences, savePreferences } from "../../src/lib/persistence/preferencesStore";

describe("preferences persistence", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("saves and restores preferences", () => {
    const saved = savePreferences({
      refreshIntervalMinutes: 25,
      language: "en-US",
      traySummaryMode: "window-week",
      networkProxyMode: "manual",
      networkProxyUrl: "http://127.0.0.1:7890"
    });
    const loaded = loadPreferences();

    expect(saved.refreshIntervalMinutes).toBe(25);
    expect(loaded.language).toBe("en-US");
    expect(loaded.traySummaryMode).toBe("window-week");
    expect(loaded.networkProxyMode).toBe("manual");
    expect(loaded.networkProxyUrl).toBe("http://127.0.0.1:7890");
  });

  it("restores saved Codex accounts and enabled state", () => {
    const saved = saveCodexAccount({
      alias: "Primary",
      credentialLabel: "codex-primary",
      organizationLabel: "Sandbox"
    });
    const primaryId = saved[0]?.id ?? "";
    setCodexAccountEnabled(primaryId, false);

    const loaded = loadCodexAccounts();

    expect(loaded).toHaveLength(1);
    expect(loaded[0]?.alias).toBe("Primary");
    expect(loaded[0]?.enabled).toBe(false);
  });
});
