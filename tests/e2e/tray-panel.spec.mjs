#!/usr/bin/env node
/**
 * E2E smoke tests for the real Tauri tray-panel app.
 *
 * Feature coverage targets for 010-ui-ux-completion:
 * - panel/settings navigation remains stable in the native shell
 * - panel refresh updates the real tray surface state
 * - Pointer sorting persists in the native shell
 * - onboarding and non-color alert labels render in the native shell
 *
 * Run:
 *   npm run test:e2e:tauri
 */

import { strict as assert } from "node:assert";
import { setTimeout as sleep } from "node:timers/promises";
import { mkdtempSync, writeFileSync, rmSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { launchApp, screenshot, clickAnyButton, clickWindowPoint, dragElement, shutdown } from "./tauri-driver.mjs";

let ctx;
let passed = 0;
let failed = 0;

const nowSeconds = () => String(Math.floor(Date.now() / 1000));

function panelState({ serviceId, serviceName, snapshotState, statusMessage, dimensions }) {
  const updatedAt = nowSeconds();
  return {
    desktopSurface: {
      platform: "macos",
      iconState: snapshotState === "fresh" ? "idle" : "attention",
      summaryMode: "lowest-remaining",
      summaryText: undefined,
      panelVisible: false,
      lastOpenedAt: null
    },
    items: dimensions.length
      ? [
          {
            serviceId,
            serviceName,
            accountLabel: null,
            iconKey: serviceId,
            quotaDimensions: dimensions,
            statusLabel: "refreshing",
            badgeLabel: snapshotState === "fresh" ? "Live" : snapshotState,
            lastRefreshedAt: updatedAt
          }
        ]
      : [],
    configuredAccountCount: 0,
    enabledAccountCount: 0,
    snapshotState,
    statusMessage,
    activeSession: null,
    updatedAt
  };
}

function createScenarioEnv({ onboardingDismissedAt, codexState, claudeState }) {
  const dir = mkdtempSync(join(tmpdir(), "aiusage-e2e-"));
  const preferencesFile = join(dir, "preferences.json");
  const snapshotFile = join(dir, "snapshot-cache.json");

  writeFileSync(
    preferencesFile,
    JSON.stringify(
      {
        language: "zh-CN",
        refreshIntervalMinutes: 15,
        traySummaryMode: "lowest-remaining",
        autostartEnabled: false,
        notificationTestEnabled: true,
        lastSavedAt: new Date(0).toISOString(),
        menubarService: "codex",
        serviceOrder: ["codex", "claude-code"],
        networkProxyMode: "system",
        networkProxyUrl: "",
        onboardingDismissedAt
      },
      null,
      2
    )
  );

  writeFileSync(
    snapshotFile,
    JSON.stringify(
      {
        services: {
          codex: codexState,
          "claude-code": claudeState
        }
      },
      null,
      2
    )
  );

  return {
    dir,
    preferencesFile,
    snapshotFile,
    env: {
      AI_USAGE_PREFERENCES_FILE: preferencesFile,
      AI_USAGE_SNAPSHOT_CACHE_FILE: snapshotFile
    },
    cleanup: () => rmSync(dir, { recursive: true, force: true })
  };
}

function createRefreshScenarioEnv({
  language = "en-US",
  menubarService = "codex",
  serviceOrder = ["codex", "claude-code"],
  statusText
}) {
  const dir = mkdtempSync(join(tmpdir(), "aiusage-e2e-refresh-"));
  const preferencesFile = join(dir, "preferences.json");
  const snapshotFile = join(dir, "snapshot-cache.json");
  const codexStatusFile = join(dir, "codex-status.txt");
  const trayStateFile = join(dir, "tray-state.json");

  writeFileSync(
    preferencesFile,
    JSON.stringify(
      {
        language,
        refreshIntervalMinutes: 15,
        traySummaryMode: "lowest-remaining",
        autostartEnabled: false,
        notificationTestEnabled: true,
        lastSavedAt: new Date(0).toISOString(),
        menubarService,
        serviceOrder,
        networkProxyMode: "system",
        networkProxyUrl: "",
        onboardingDismissedAt: new Date().toISOString()
      },
      null,
      2
    )
  );

  writeFileSync(
    snapshotFile,
    JSON.stringify(
      {
        services: {
          codex: panelState({
            serviceId: "codex",
            serviceName: "Codex",
            snapshotState: "fresh",
            statusMessage: "Live Codex limits available.",
            dimensions: [
              {
                label: "Codex / 5h",
                remainingPercent: 71,
                remainingAbsolute: "71% remaining",
                resetHint: "Resets in 2h",
                status: "healthy",
                progressTone: "success"
              }
            ]
          }),
          "claude-code": panelState({
            serviceId: "claude-code",
            serviceName: "Claude Code",
            snapshotState: "empty",
            statusMessage: "No Claude Code credentials",
            dimensions: []
          })
        }
      },
      null,
      2
    )
  );

  writeFileSync(codexStatusFile, statusText);

  return {
    dir,
    preferencesFile,
    trayStateFile,
    codexStatusFile,
    env: {
      AI_USAGE_PREFERENCES_FILE: preferencesFile,
      AI_USAGE_SNAPSHOT_CACHE_FILE: snapshotFile,
      AI_USAGE_CODEX_STATUS_FILE: codexStatusFile,
      AI_USAGE_CODEX_BIN: "/definitely/missing/codex",
      AI_USAGE_E2E_TRAY_STATE_FILE: trayStateFile,
      CLAUDE_CONFIG_DIR: join(dir, "claude-config"),
      USER: "aiusage-e2e"
    },
    cleanup: () => rmSync(dir, { recursive: true, force: true })
  };
}

async function pollFor(assertion, label, timeoutMs = 6000, intervalMs = 250) {
  const startedAt = Date.now();
  let lastError;
  while (Date.now() - startedAt < timeoutMs) {
    try {
      return assertion();
    } catch (error) {
      lastError = error;
      await sleep(intervalMs);
    }
  }
  throw new Error(`${label}: ${lastError?.message ?? "timed out"}`);
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

async function clickRefreshControl(ctx) {
  const labeledClick = await clickAnyButton(
    ["E2E Refresh", "手动刷新", "Refresh", "刷新中...", "Refreshing..."],
    ctx
  );
  if (labeledClick) {
    return true;
  }

  for (const offsetX of [260, 248, 236, 272, 224]) {
    if (await clickWindowPoint(offsetX, 86, ctx)) {
      return true;
    }
  }

  return false;
}

async function test(name, fn) {
  try {
    await fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (error) {
    console.log(`  ✗ ${name}`);
    console.log(`    ${error.message}`);
    failed++;
  }
}

async function run() {
  let scenario;
  try {
    ctx = await launchApp({ env: { AI_USAGE_E2E_SHELL_HOOKS: "1" } });
    console.log("\n[e2e] Running tray-panel tests...\n");

    await test("app window is visible with correct size", async () => {
      assert.ok(ctx.windowInfo, "window info should exist");
      const { Width, Height } = ctx.windowInfo.bounds;
      assert.ok(Width >= 300 && Width <= 500, `width ${Width} out of range`);
      assert.ok(Height >= 500 && Height <= 800, `height ${Height} out of range`);
    });

    await test("panel view renders correctly", async () => {
      await screenshot(ctx, "test-panel-health-summary.png");
    });

    await test("settings button navigates to settings", async () => {
      const clicked =
        (await clickAnyButton(["设置", "Settings"], ctx)) ||
        (await clickWindowPoint(314, 86, ctx));
      assert.ok(clicked, "should be able to click settings button");
      await sleep(500);
      await screenshot(ctx, "test-settings-grouped.png");
    });

    await test("back button returns to panel", async () => {
      const clicked =
        (await clickAnyButton(["返回", "Back"], ctx)) ||
        (await clickWindowPoint(314, 86, ctx));
      assert.ok(clicked, "should be able to click back button");
      await sleep(500);
      await screenshot(ctx, "test-panel-return.png");
    });

    await test("refresh button is clickable", async () => {
      const clicked = await clickRefreshControl(ctx);
      assert.ok(clicked, "should be able to click refresh button");
      await sleep(1000);
      await screenshot(ctx, "test-after-refresh.png");
    });

    await test("manual refresh keeps tray title and tooltip in sync with the selected service", async () => {
      await shutdown(ctx);
      scenario = createRefreshScenarioEnv({
        statusText: "Codex / 5h: 71% remaining (Resets in 2h)"
      });
      ctx = await launchApp({ env: { AI_USAGE_E2E_SHELL_HOOKS: "1", ...scenario.env } });

      await pollFor(() => {
        const trayState = readJson(scenario.trayStateFile);
        assert.equal(trayState.title, "71%");
        assert.equal(trayState.tooltip, "AIUsage · Codex · 71%");
        return trayState;
      }, "initial tray surface should match the startup snapshot");

      writeFileSync(scenario.codexStatusFile, "Codex / 5h: 28% remaining (Resets in 1h)");
      let synced = false;
      for (let attempt = 0; attempt < 3 && !synced; attempt++) {
        const clicked = await clickRefreshControl(ctx);
        assert.ok(clicked, "should be able to click refresh button");

        try {
          await pollFor(() => {
            const trayState = readJson(scenario.trayStateFile);
            assert.equal(trayState.title, "28%");
            assert.equal(trayState.tooltip, "AIUsage · Codex · 28%");
            assert.equal(trayState.severity, "warning");
            return trayState;
          }, "tray surface should update after a manual refresh", 4000);
          synced = true;
        } catch (error) {
          if (attempt === 2) {
            throw error;
          }
        }
      }

      scenario.cleanup();
      scenario = null;
    });

    await test("first-run onboarding renders in the native shell", async () => {
      await shutdown(ctx);
      scenario = createScenarioEnv({
        onboardingDismissedAt: undefined,
        codexState: panelState({
          serviceId: "codex",
          serviceName: "Codex",
          snapshotState: "empty",
          statusMessage: "No Codex session",
          dimensions: []
        }),
        claudeState: panelState({
          serviceId: "claude-code",
          serviceName: "Claude Code",
          snapshotState: "empty",
          statusMessage: "No Claude Code credentials",
          dimensions: []
        })
      });
      ctx = await launchApp({ env: { AI_USAGE_E2E_SHELL_HOOKS: "1", ...scenario.env } });
      await sleep(1200);
      await screenshot(ctx, "test-panel-onboarding.png");
      scenario.cleanup();
      scenario = null;
    });

    await test("warning and danger text labels render in the native shell", async () => {
      await shutdown(ctx);
      scenario = createScenarioEnv({
        onboardingDismissedAt: new Date().toISOString(),
        codexState: panelState({
          serviceId: "codex",
          serviceName: "Codex",
          snapshotState: "fresh",
          statusMessage: "Live Codex limits available.",
          dimensions: [
            {
              label: "CODEX / 5H",
              remainingPercent: 38,
              remainingAbsolute: "38% remaining",
              resetHint: "Resets in 2h",
              status: "warning",
              progressTone: "warning"
            }
          ]
        }),
        claudeState: panelState({
          serviceId: "claude-code",
          serviceName: "Claude Code",
          snapshotState: "fresh",
          statusMessage: "Live Claude Code limits available.",
          dimensions: [
            {
              label: "CLAUDE CODE / WEEK",
              remainingPercent: 12,
              remainingAbsolute: "12% remaining",
              resetHint: "Resets in 4d",
              status: "exhausted",
              progressTone: "danger"
            }
          ]
        })
      });
      ctx = await launchApp({ env: { AI_USAGE_E2E_SHELL_HOOKS: "1", ...scenario.env } });
      await sleep(1200);
      await screenshot(ctx, "test-panel-accessibility-states.png");
      scenario.cleanup();
      scenario = null;
    });

    await test("pointer reordering persists service order in the native shell", async () => {
      await shutdown(ctx);
      scenario = createRefreshScenarioEnv({
        language: "en-US",
        serviceOrder: ["codex", "claude-code"],
        statusText: "Codex / 5h: 64% remaining (Resets in 2h)"
      });
      ctx = await launchApp({ env: { AI_USAGE_E2E_SHELL_HOOKS: "1", ...scenario.env } });

      const settingsClicked =
        (await clickAnyButton(["Settings", "设置"], ctx)) ||
        (await clickWindowPoint(314, 86, ctx));
      assert.ok(settingsClicked, "should be able to open settings");
      await sleep(600);

      const moved =
        (await clickAnyButton(["E2E Move Claude Code First"], ctx)) ||
        (await dragElement("Reorder Claude Code", "Codex", ctx));
      assert.ok(moved, "should be able to reorder Claude Code above Codex");

      await pollFor(() => {
        const preferences = readJson(scenario.preferencesFile);
        assert.deepEqual(preferences.serviceOrder, ["claude-code", "codex"]);
        return preferences;
      }, "serviceOrder should persist after pointer reordering");

      scenario.cleanup();
      scenario = null;
    });

    console.log(`\n[e2e] ${passed} passed, ${failed} failed\n`);
    process.exitCode = failed > 0 ? 1 : 0;
  } catch (error) {
    console.error("\n[e2e] Fatal error:", error.message);
    process.exitCode = 1;
  } finally {
    await shutdown(ctx);
    scenario?.cleanup?.();
  }
}

run();
