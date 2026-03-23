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
      serviceOrder: ["claude-code", "codex", "claude-code", "unknown-service"],
      networkProxyMode: "manual",
      networkProxyUrl: "http://127.0.0.1:7890",
      onboardingDismissedAt: "2026-03-23T00:00:00.000Z"
    });
    const loaded = loadPreferences();

    expect(saved.refreshIntervalMinutes).toBe(25);
    expect(loaded.language).toBe("en-US");
    expect(loaded.traySummaryMode).toBe("window-week");
    expect(loaded.serviceOrder).toEqual(["claude-code", "codex"]);
    expect(loaded.networkProxyMode).toBe("manual");
    expect(loaded.networkProxyUrl).toBe("http://127.0.0.1:7890");
    expect(loaded.onboardingDismissedAt).toBe("2026-03-23T00:00:00.000Z");
  });

  it("defaults onboardingDismissedAt when loading a legacy preference payload", () => {
    localStorage.setItem(
      "ai-usage.preferences",
      JSON.stringify({
        refreshIntervalMinutes: 20,
        language: "zh-CN",
        traySummaryMode: "lowest-remaining",
        serviceOrder: ["unknown-service", "codex"]
      })
    );

    const loaded = loadPreferences();

    expect(loaded.onboardingDismissedAt).toBeUndefined();
    expect(loaded.serviceOrder).toEqual(["codex", "claude-code"]);
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
