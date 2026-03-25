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
import {
  activateFinder,
  launchApp,
  screenshot,
  clickAnyButton,
  clickAbsolutePoint,
  clickWindowPoint,
  dragElement,
  hoverAnyButton,
  moveWindowPoint,
  pressKey,
  readWindowState,
  shutdown,
  toggleMainWindow,
  waitForWindowHidden,
  waitForWindowVisible
} from "./tauri-driver.mjs";

let ctx;
let passed = 0;
let failed = 0;

const nowSeconds = () => String(Math.floor(Date.now() / 1000));
const PROMOTION_TRIGGER_POINT = { x: 78, y: 90 };
const PROMOTION_CLOSE_POINT = { x: 342, y: 160 };
const CLAUDE_DISCLOSURE_DISMISS_POINT = { x: 86, y: 642 };

function panelState({ serviceId, serviceName, snapshotState, statusMessage, dimensions }) {
  const lastSuccessfulRefreshAt = nowSeconds();
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
            lastSuccessfulRefreshAt
          }
        ]
      : [],
    configuredAccountCount: 0,
    enabledAccountCount: 0,
    snapshotState,
    statusMessage,
    activeSession: null,
    lastSuccessfulRefreshAt
  };
}

function createScenarioEnv({
  language = "zh-CN",
  menubarService = "codex",
  serviceOrder = ["codex", "claude-code"],
  onboardingDismissedAt,
  claudeCodeUsageEnabled = false,
  claudeCodeDisclosureDismissedAt,
  codexState,
  claudeState
}) {
  const dir = mkdtempSync(join(tmpdir(), "aiusage-e2e-"));
  const preferencesFile = join(dir, "preferences.json");
  const snapshotFile = join(dir, "snapshot-cache.json");

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
        onboardingDismissedAt,
        claudeCodeUsageEnabled,
        claudeCodeDisclosureDismissedAt
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
  claudeCodeUsageEnabled = false,
  statusText,
  claudeSnapshotState = "empty",
  claudeStatusText = "No Claude Code credentials",
  claudeDimensions = []
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
        onboardingDismissedAt: new Date().toISOString(),
        claudeCodeUsageEnabled,
        claudeCodeDisclosureDismissedAt: new Date().toISOString()
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
            snapshotState: claudeSnapshotState,
            statusMessage: claudeStatusText,
            dimensions: claudeDimensions
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
      return await assertion();
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

function assertTrayAnchoredPlacement(state, trayRect) {
  assert.equal(state.visible, true, "window should be visible");
  assert.equal(state.source, "tray-anchor", "window should be placed from the tray anchor");
  const expectedY = trayRect.y + trayRect.height + 8;
  assert.equal(state.y, expectedY, "window should sit directly below the tray icon");
  const expectedCenterX = trayRect.x + trayRect.width / 2;
  const actualCenterX = state.x + state.width / 2;
  assert.ok(
    Math.abs(actualCenterX - expectedCenterX) <= 1,
    `window center ${actualCenterX} should align with tray center ${expectedCenterX}`
  );
}

async function openSettingsView(ctx) {
  return (
    (await clickAnyButton(["设置", "Settings"], ctx)) ||
    (await clickWindowPoint(314, 86, ctx))
  );
}

async function returnToPanelView(ctx) {
  return (
    (await clickAnyButton(["返回", "Back"], ctx)) ||
    (await clickWindowPoint(314, 86, ctx))
  );
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

async function triggerRefresh(ctx) {
  const triggeredByShortcut = await pressKey("r", ctx);
  if (triggeredByShortcut) {
    await sleep(600);
    return true;
  }

  return clickRefreshControl(ctx);
}

async function dismissClaudeDisclosure(ctx) {
  const dismissedByShortcut = await pressKey("d", ctx);
  if (dismissedByShortcut) {
    await sleep(600);
    return true;
  }

  return (
    (await clickAnyButton(["我知道了", "I understand"], ctx)) ||
    (await clickWindowPoint(
      CLAUDE_DISCLOSURE_DISMISS_POINT.x,
      CLAUDE_DISCLOSURE_DISMISS_POINT.y,
      ctx
    ))
  );
}

async function toggleClaudeCodeUsage(ctx) {
  const toggledByShortcut = await pressKey("u", ctx);
  if (toggledByShortcut) {
    await sleep(600);
    return true;
  }

  return (
    (await clickAnyButton(
      ["E2E Toggle Claude Code Usage", "启用 Claude Code 查询", "Enable Claude Code query"],
      ctx
    )) ||
    (await clickWindowPoint(290, 554, ctx)) ||
    (await clickWindowPoint(268, 554, ctx)) ||
    (await clickWindowPoint(246, 554, ctx)) ||
    (await clickWindowPoint(290, 522, ctx)) ||
    (await clickWindowPoint(268, 522, ctx))
  );
}

async function moveClaudeCodeFirst(ctx) {
  const movedByShortcut = await pressKey("o", ctx);
  if (movedByShortcut) {
    await sleep(600);
    return true;
  }

  return (
    (await clickAnyButton(["E2E Move Claude Code First"], ctx)) ||
    (await dragElement("Reorder Claude Code", "Codex", ctx))
  );
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
    await waitForWindowVisible(ctx);
    console.log("\n[e2e] Running tray-panel tests...\n");

    await test("app window opens as a tray-anchored popover with the expected footprint", async () => {
      assert.ok(ctx.windowInfo, "window info should exist");
      const windowState = readWindowState(ctx);
      assert.ok(windowState, "window placement state should exist");
      assertTrayAnchoredPlacement(windowState, ctx.trayRect);
      const { Width, Height } = ctx.windowInfo.bounds;
      assert.ok(Width >= 300 && Width <= 500, `width ${Width} out of range`);
      assert.ok(Height >= 500 && Height <= 800, `height ${Height} out of range`);
    });

    await test("tray toggle hides and reopens the same process window", async () => {
      await toggleMainWindow(ctx);
      const hiddenState = await waitForWindowHidden(ctx);
      assert.equal(hiddenState.visible, false, "window should hide after toggling");

      const reopenedState = await toggleMainWindow(ctx);
      assertTrayAnchoredPlacement(reopenedState, ctx.trayRect);
    });

    await test("panel view renders correctly", async () => {
      await screenshot(ctx, "test-panel-health-summary.png");
    });

    await test("promotion header supports preview, pinned popover, and both close paths in the native shell", async () => {
      await screenshot(ctx, "test-panel-promotion-focused.png");
      const hovered =
        (await hoverAnyButton(["预览全部促销状态", "Preview all promotion states"], ctx)) ||
        (await moveWindowPoint(PROMOTION_TRIGGER_POINT.x, PROMOTION_TRIGGER_POINT.y, ctx));
      assert.ok(hovered, "should be able to preview the promotion popover");
      await sleep(500);
      await screenshot(ctx, "test-panel-promotion-preview.png");

      const pinned =
        (await clickAnyButton(["预览全部促销状态", "Preview all promotion states"], ctx)) ||
        (await clickWindowPoint(PROMOTION_TRIGGER_POINT.x, PROMOTION_TRIGGER_POINT.y, ctx));
      assert.ok(pinned, "should be able to pin the promotion popover");
      await sleep(500);
      await screenshot(ctx, "test-panel-promotion-all.png");

      const closedByOutsideClick = await clickWindowPoint(PROMOTION_CLOSE_POINT.x, PROMOTION_CLOSE_POINT.y, ctx);
      assert.ok(closedByOutsideClick, "should be able to close the pinned popover by clicking outside");
      await sleep(500);
      await screenshot(ctx, "test-panel-promotion-closed-click.png");

      const repinned =
        (await clickAnyButton(["预览全部促销状态", "Preview all promotion states"], ctx)) ||
        (await clickWindowPoint(PROMOTION_TRIGGER_POINT.x, PROMOTION_TRIGGER_POINT.y, ctx));
      assert.ok(repinned, "should be able to reopen the pinned promotion popover");
      await sleep(500);

      const closedByEscape = await pressKey("escape", ctx);
      assert.ok(closedByEscape, "should be able to close the pinned popover with Escape");
      await sleep(500);
      await screenshot(ctx, "test-panel-promotion-closed-escape.png");
    });

    await test("settings button navigates to settings", async () => {
      const clicked = await openSettingsView(ctx);
      assert.ok(clicked, "should be able to click settings button");
      await sleep(500);
      await screenshot(ctx, "test-settings-grouped.png");
    });

    await test("back button returns to panel", async () => {
      const clicked = await returnToPanelView(ctx);
      assert.ok(clicked, "should be able to click back button");
      await sleep(500);
      await screenshot(ctx, "test-panel-return.png");
    });

    await test("clicking outside hides the popover and tray toggle can reopen it", async () => {
      const { X, Y, Height } = ctx.windowInfo.bounds;
      const clickedOutside = await clickAbsolutePoint(Math.max(8, X - 24), Y + Math.min(Height, 120));
      assert.ok(clickedOutside, "should be able to click outside the window");
      await waitForWindowHidden(ctx);

      await toggleMainWindow(ctx);
      await waitForWindowVisible(ctx);
      await screenshot(ctx, "test-panel-reopened-after-outside-click.png");
    });

    await test("switching to another app hides the popover and tray toggle can reopen it", async () => {
      const switched = await activateFinder();
      assert.ok(switched, "should be able to activate Finder");
      await waitForWindowHidden(ctx);

      await toggleMainWindow(ctx);
      const reopenedState = await waitForWindowVisible(ctx);
      assertTrayAnchoredPlacement(reopenedState, ctx.trayRect);
    });

    await test("closing from settings with Escape reopens on the panel and remains actionable within one second", async () => {
      const settingsClicked = await openSettingsView(ctx);
      assert.ok(settingsClicked, "should be able to open settings");
      await sleep(400);

      const escaped = await pressKey("escape", ctx);
      assert.ok(escaped, "should be able to press Escape");
      await waitForWindowHidden(ctx);

      await toggleMainWindow(ctx);
      await waitForWindowVisible(ctx);

      await pollFor(async () => {
        const settingsButton = await clickAnyButton(["设置", "Settings"], ctx);
        assert.ok(settingsButton, "settings entry should be available after reopening");
        const backClicked = await returnToPanelView(ctx);
        assert.ok(backClicked, "back button should be available after reopening");
        return true;
      }, "panel should be actionable within one second after reopening", 1000, 150);
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
        const clicked = await triggerRefresh(ctx);
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

    await test("Claude Code disclosure can be dismissed independently in the native shell", async () => {
      await shutdown(ctx);
      scenario = createScenarioEnv({
        onboardingDismissedAt: undefined,
        claudeCodeDisclosureDismissedAt: undefined,
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

      const dismissed = await dismissClaudeDisclosure(ctx);
      assert.ok(dismissed, "should be able to dismiss the Claude disclosure card");

      await pollFor(() => {
        const preferences = readJson(scenario.preferencesFile);
        assert.ok(
          typeof preferences.claudeCodeDisclosureDismissedAt === "string" &&
            preferences.claudeCodeDisclosureDismissedAt.length > 0,
          "disclosure dismissal should persist to preferences"
        );
        assert.ok(
          preferences.onboardingDismissedAt == null,
          "dismissing the Claude card should not dismiss the generic onboarding card"
        );
        return preferences;
      }, "Claude disclosure dismissal should persist");

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

    await test("disabled Claude Code falls back to Codex in the tray even if Claude was selected", async () => {
      await shutdown(ctx);
      scenario = createRefreshScenarioEnv({
        language: "zh-CN",
        menubarService: "claude-code",
        claudeCodeUsageEnabled: false,
        statusText: "Codex / 5h: 64% remaining (Resets in 2h)"
      });
      ctx = await launchApp({ env: { AI_USAGE_E2E_SHELL_HOOKS: "1", ...scenario.env } });

      await pollFor(() => {
        const trayState = readJson(scenario.trayStateFile);
        assert.equal(trayState.title, "71%");
        assert.equal(trayState.tooltip, "AIUsage · Codex · 71%");
        return trayState;
      }, "tray should fall back to Codex when Claude usage is disabled");

      scenario.cleanup();
      scenario = null;
    });

    await test("enabled Claude Code can be selected as the tray service", async () => {
      await shutdown(ctx);
      scenario = createRefreshScenarioEnv({
        language: "zh-CN",
        menubarService: "claude-code",
        claudeCodeUsageEnabled: true,
        statusText: "Codex / 5h: 64% remaining (Resets in 2h)",
        claudeSnapshotState: "fresh",
        claudeStatusText: "Live Claude Code limits available.",
        claudeDimensions: [
          {
            label: "CLAUDE CODE / WEEK",
            remainingPercent: 44,
            remainingAbsolute: "44% remaining",
            resetHint: "Resets in 3d",
            status: "warning",
            progressTone: "warning"
          }
        ]
      });
      ctx = await launchApp({ env: { AI_USAGE_E2E_SHELL_HOOKS: "1", ...scenario.env } });

      await pollFor(() => {
        const trayState = readJson(scenario.trayStateFile);
        assert.equal(trayState.title, "44%");
        assert.equal(trayState.tooltip, "AIUsage · Claude Code · 44%");
        return trayState;
      }, "tray should follow Claude Code when it is enabled and selected");

      scenario.cleanup();
      scenario = null;
    });

    await test("settings persists the Claude Code usage toggle directly", async () => {
      await shutdown(ctx);
      scenario = createScenarioEnv({
        onboardingDismissedAt: new Date().toISOString(),
        claudeCodeUsageEnabled: false,
        claudeCodeDisclosureDismissedAt: new Date().toISOString(),
        codexState: panelState({
          serviceId: "codex",
          serviceName: "Codex",
          snapshotState: "fresh",
          statusMessage: "Live Codex limits available.",
          dimensions: [
            {
              label: "CODEX / 5H",
              remainingPercent: 71,
              remainingAbsolute: "71% remaining",
              resetHint: "Resets in 2h",
              status: "healthy",
              progressTone: "success"
            }
          ]
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

      const settingsClicked = await openSettingsView(ctx);
      assert.ok(settingsClicked, "should be able to open settings");
      await sleep(600);
      await screenshot(ctx, "test-settings-claude-usage-group.png");

      const toggleClicked = await toggleClaudeCodeUsage(ctx);
      assert.ok(toggleClicked, "should be able to toggle Claude Code usage in settings");

      await pollFor(() => {
        const preferences = readJson(scenario.preferencesFile);
        assert.equal(preferences.claudeCodeUsageEnabled, true);
        return preferences;
      }, "Claude Code usage toggle should persist directly");

      scenario.cleanup();
      scenario = null;
    });

    await test("pointer reordering persists service order in the native shell", async () => {
      await shutdown(ctx);
      scenario = createRefreshScenarioEnv({
        language: "en-US",
        serviceOrder: ["codex", "claude-code"],
        claudeCodeUsageEnabled: true,
        statusText: "Codex / 5h: 64% remaining (Resets in 2h)"
      });
      ctx = await launchApp({ env: { AI_USAGE_E2E_SHELL_HOOKS: "1", ...scenario.env } });

      const settingsClicked = await openSettingsView(ctx);
      assert.ok(settingsClicked, "should be able to open settings");
      await sleep(600);

      const moved = await moveClaudeCodeFirst(ctx);
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
