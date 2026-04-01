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
      menubarService: "auto",
      onboardingDismissedAt: "2026-03-23T00:00:00.000Z",
      claudeCodeUsageEnabled: true,
      claudeCodeDisclosureDismissedAt: "2026-03-22T00:00:00.000Z"
    });
    const loaded = loadPreferences();

    expect(saved.refreshIntervalMinutes).toBe(25);
    expect(loaded.language).toBe("en-US");
    expect(loaded.traySummaryMode).toBe("window-week");
    expect(loaded.menubarService).toBe("auto");
    expect(loaded.serviceOrder).toEqual(["claude-code", "codex", "kimi-code", "glm-coding"]);
    expect(loaded.networkProxyMode).toBe("manual");
    expect(loaded.networkProxyUrl).toBe("http://127.0.0.1:7890");
    expect(loaded.onboardingDismissedAt).toBe("2026-03-23T00:00:00.000Z");
    expect(saved.claudeCodeUsageEnabled).toBe(true);
    expect(loaded.claudeCodeUsageEnabled).toBe(true);
    expect(loaded.claudeCodeDisclosureDismissedAt).toBe("2026-03-22T00:00:00.000Z");
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
    expect(loaded.claudeCodeUsageEnabled).toBe(false);
    expect(loaded.claudeCodeDisclosureDismissedAt).toBeUndefined();
    expect(loaded.serviceOrder).toEqual(["codex", "claude-code", "kimi-code", "glm-coding"]);
  });

  it("keeps auto valid even when Claude Code usage is disabled", () => {
    const saved = savePreferences({
      menubarService: "auto",
      claudeCodeUsageEnabled: false
    });

    expect(saved.menubarService).toBe("auto");
    expect(loadPreferences().menubarService).toBe("auto");
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
