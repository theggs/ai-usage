#!/usr/bin/env node
/**
 * Automated UI screenshot review for the real Tauri app.
 *
 * Feature coverage targets for 015-agent-auto-menubar:
 * - tray icon ownership is visually reviewable for Codex / Claude / neutral states
 * - panel/settings layout remains stable while auto mode is enabled
 * - panel non-regressions still hold in the real Tauri shell
 *
 * Launches the actual Tauri binary in test mode, finds the native window,
 * and captures screenshots using macOS screencapture + Accessibility API.
 * All data comes from the real Rust backend.
 *
 * Build (before first run or after code changes):
 *   npm run test:e2e:build
 *
 * Run:
 *   npm run test:e2e:screenshots
 */

import { execFileSync } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";
import { mkdtempSync, writeFileSync, rmSync, mkdirSync, utimesSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import {
  launchApp,
  screenshot,
  clickAnyButton,
  clickWindowPoint,
  hoverAnyButton,
  moveWindowPoint,
  pressKey,
  toggleMainWindow,
  shutdown,
  waitForWindowHidden,
  waitForWindowVisible
} from "./tauri-driver.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCREENSHOT_DIR = resolve(__dirname, "screenshots");
const DEFAULT_TRAY_RECT = { x: 720, y: 0, width: 24, height: 24 };

const nowSeconds = () => String(Math.floor(Date.now() / 1000));
const PROMOTION_TRIGGER_POINT = { x: 78, y: 90 };
const PROMOTION_CLOSE_POINT = { x: 342, y: 160 };

function writeJson(path, value) {
  writeFileSync(path, JSON.stringify(value, null, 2));
}

function ensureDir(path) {
  mkdirSync(path, { recursive: true });
}

function setPathTimestamp(path, seconds) {
  utimesSync(path, seconds, seconds);
}

function createScenarioFiles({
  language = "zh-CN",
  onboardingDismissedAt,
  claudeCodeUsageEnabled = false,
  claudeCodeDisclosureDismissedAt,
  codexState,
  claudeState
}) {
  const dir = mkdtempSync(join(tmpdir(), "aiusage-e2e-"));
  const preferencesFile = join(dir, "preferences.json");
  const snapshotFile = join(dir, "snapshot-cache.json");
  const codexHome = join(dir, "codex-home");
  const claudeHome = join(dir, "claude-config");

  ensureDir(codexHome);
  ensureDir(claudeHome);

  writeJson(preferencesFile, {
    language,
    refreshIntervalMinutes: 15,
    traySummaryMode: "lowest-remaining",
    autostartEnabled: false,
    notificationTestEnabled: true,
    lastSavedAt: new Date(0).toISOString(),
    menubarService: "codex",
    serviceOrder: ["codex", "claude-code"],
    networkProxyMode: "system",
    networkProxyUrl: "",
    onboardingDismissedAt,
    claudeCodeUsageEnabled,
    claudeCodeDisclosureDismissedAt
  });

  writeJson(snapshotFile, {
    services: {
      codex: codexState,
      "claude-code": claudeState
    }
  });

  return {
    env: {
      AI_USAGE_PREFERENCES_FILE: preferencesFile,
      AI_USAGE_SNAPSHOT_CACHE_FILE: snapshotFile,
      AI_USAGE_CODEX_HOME: codexHome,
      CLAUDE_CONFIG_DIR: claudeHome,
      USER: "aiusage-e2e"
    },
    cleanup: () => rmSync(dir, { recursive: true, force: true })
  };
}

function createAutoScenarioFiles({
  codexRecentAt,
  claudeRecentAt,
  codexDimensions = [
    {
      label: "CODEX / 5H",
      remainingPercent: 71,
      remainingAbsolute: "71% remaining",
      resetHint: "Resets in 2h",
      status: "healthy",
      progressTone: "success"
    }
  ],
  claudeDimensions = [
    {
      label: "CLAUDE CODE / WEEK",
      remainingPercent: 44,
      remainingAbsolute: "44% remaining",
      resetHint: "Resets in 3d",
      status: "warning",
      progressTone: "warning"
    }
  ]
}) {
  const dir = mkdtempSync(join(tmpdir(), "aiusage-e2e-auto-shot-"));
  const preferencesFile = join(dir, "preferences.json");
  const snapshotFile = join(dir, "snapshot-cache.json");
  const codexHome = join(dir, "codex-home");
  const claudeHome = join(dir, "claude-home");

  writeJson(preferencesFile, {
    language: "en-US",
    refreshIntervalMinutes: 15,
    traySummaryMode: "lowest-remaining",
    autostartEnabled: false,
    notificationTestEnabled: true,
    lastSavedAt: new Date(0).toISOString(),
    menubarService: "auto",
    serviceOrder: ["codex", "claude-code"],
    networkProxyMode: "system",
    networkProxyUrl: "",
    onboardingDismissedAt: new Date().toISOString(),
    claudeCodeUsageEnabled: true,
    claudeCodeDisclosureDismissedAt: new Date().toISOString()
  });

  writeJson(snapshotFile, {
    services: {
      codex: panelState({
        serviceId: "codex",
        serviceName: "Codex",
        snapshotState: "fresh",
        statusMessage: "Live Codex limits available.",
        dimensions: codexDimensions
      }),
      "claude-code": panelState({
        serviceId: "claude-code",
        serviceName: "Claude Code",
        snapshotState: "fresh",
        statusMessage: "Live Claude Code limits available.",
        dimensions: claudeDimensions
      })
    }
  });

  ensureDir(codexHome);
  ensureDir(claudeHome);

  if (codexRecentAt != null) {
    const sessionIndexPath = join(codexHome, "session_index.jsonl");
    writeFileSync(
      sessionIndexPath,
      `${JSON.stringify({ id: "codex-thread", updated_at: new Date(codexRecentAt * 1000).toISOString() })}\n`
    );
    setPathTimestamp(sessionIndexPath, codexRecentAt);
  }

  if (claudeRecentAt != null) {
    const historyPath = join(claudeHome, "history.jsonl");
    writeFileSync(
      historyPath,
      `${JSON.stringify({ sessionId: "claude-session", timestamp: new Date(claudeRecentAt * 1000).toISOString() })}\n`
    );
    setPathTimestamp(historyPath, claudeRecentAt);
  }

  return {
    env: {
      AI_USAGE_PREFERENCES_FILE: preferencesFile,
      AI_USAGE_SNAPSHOT_CACHE_FILE: snapshotFile,
      AI_USAGE_CODEX_HOME: codexHome,
      CLAUDE_CONFIG_DIR: claudeHome,
      USER: "aiusage-e2e"
    },
    cleanup: () => rmSync(dir, { recursive: true, force: true })
  };
}

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

function captureTraySlice(name, trayRect = DEFAULT_TRAY_RECT) {
  ensureDir(SCREENSHOT_DIR);
  const outputPath = resolve(SCREENSHOT_DIR, name);
  const crop = `${Math.max(trayRect.x - 36, 0)},0,96,32`;
  execFileSync("screencapture", ["-x", `-R${crop}`, outputPath], { stdio: "ignore" });
}

async function run() {
  let ctx;
  let scenario;
  try {
    console.log("\n[screenshots] Tray icon states...");
    const now = Math.floor(Date.now() / 1000);

    scenario = createAutoScenarioFiles({
      codexRecentAt: now,
      claudeRecentAt: now - 900
    });
    ctx = await launchApp({ env: scenario.env });
    await sleep(1400);
    captureTraySlice("tray-auto-codex.png");
    await shutdown(ctx);
    scenario.cleanup();
    scenario = null;

    scenario = createAutoScenarioFiles({
      codexRecentAt: now - 900,
      claudeRecentAt: now
    });
    ctx = await launchApp({ env: scenario.env });
    await sleep(1400);
    captureTraySlice("tray-auto-claude-code.png");
    await shutdown(ctx);
    scenario.cleanup();
    scenario = null;

    scenario = createAutoScenarioFiles({
      codexRecentAt: undefined,
      claudeRecentAt: undefined
    });
    ctx = await launchApp({ env: scenario.env });
    await sleep(1400);
    captureTraySlice("tray-auto-neutral.png");
    await shutdown(ctx);
    scenario.cleanup();
    scenario = null;

    scenario = createScenarioFiles({
      onboardingDismissedAt: new Date().toISOString(),
      claudeCodeUsageEnabled: true,
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
        snapshotState: "fresh",
        statusMessage: "Live Claude Code limits available.",
        dimensions: [
          {
            label: "CLAUDE CODE / WEEK",
            remainingPercent: 44,
            remainingAbsolute: "44% remaining",
            resetHint: "Resets in 3d",
            status: "warning",
            progressTone: "warning"
          }
        ]
      })
    });
    ctx = await launchApp({ env: scenario.env });
    await waitForWindowVisible(ctx);

    // --- Panel view ---
    console.log("\n[screenshots] Panel view...");
    await sleep(1400);
    await screenshot(ctx, "panel-health-summary.png");
    await screenshot(ctx, "panel-promotion-focused.png");

    const hoveredPromotion =
      (await hoverAnyButton(["预览全部促销状态", "Preview all promotion states"], ctx)) ||
      (await moveWindowPoint(PROMOTION_TRIGGER_POINT.x, PROMOTION_TRIGGER_POINT.y, ctx));
    if (hoveredPromotion) {
      await sleep(500);
      await screenshot(ctx, "panel-promotion-preview.png");
    }

    const pinnedPromotion =
      (await clickAnyButton(["预览全部促销状态", "Preview all promotion states"], ctx)) ||
      (await clickWindowPoint(PROMOTION_TRIGGER_POINT.x, PROMOTION_TRIGGER_POINT.y, ctx));
    if (pinnedPromotion) {
      await sleep(600);
      await screenshot(ctx, "panel-promotion-all.png");

      const closedByOutsideClick = await clickWindowPoint(PROMOTION_CLOSE_POINT.x, PROMOTION_CLOSE_POINT.y, ctx);
      if (closedByOutsideClick) {
        await sleep(500);
        await screenshot(ctx, "panel-promotion-closed-click.png");
      }

      const repinnedPromotion =
        (await clickAnyButton(["预览全部促销状态", "Preview all promotion states"], ctx)) ||
        (await clickWindowPoint(PROMOTION_TRIGGER_POINT.x, PROMOTION_TRIGGER_POINT.y, ctx));
      if (repinnedPromotion) {
        await sleep(500);
        const closedByEscape = await pressKey("escape", ctx);
        if (closedByEscape) {
          try {
            await waitForWindowHidden(ctx, 1500);
            await toggleMainWindow(ctx);
            await waitForWindowVisible(ctx);
            await screenshot(ctx, "panel-reopened-after-escape.png");
          } catch {
            await screenshot(ctx, "panel-promotion-closed-escape-fallback.png");
          }
        }
      }
    }

    // --- Settings view ---
    console.log("[screenshots] Navigating to settings...");
    const clicked =
      (await clickAnyButton(["设置", "Settings"], ctx)) ||
      (await clickWindowPoint(314, 86, ctx));
    if (!clicked) {
      throw new Error("Could not click settings button");
    }
    await sleep(1400);
    await screenshot(ctx, "settings-grouped-top.png");
    await screenshot(ctx, "settings-grouped-rhythm.png");
    await screenshot(ctx, "settings-claude-usage-group.png");

    // --- Back to panel ---
    console.log("[screenshots] Going back to panel...");
    const backClicked =
      (await clickAnyButton(["返回", "Back"], ctx)) ||
      (await clickWindowPoint(314, 86, ctx));
    if (!backClicked) {
      throw new Error("Could not click back button");
    }
    await sleep(900);
    await screenshot(ctx, "panel-returned.png");
    await shutdown(ctx);
    scenario.cleanup();
    scenario = null;

    console.log("\n[screenshots] Done! View with: open tests/e2e/screenshots/");

    console.log("\n[screenshots] Warning and danger labels...");
    scenario = createScenarioFiles({
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
    ctx = await launchApp({ env: scenario.env });
    await sleep(1200);
    await screenshot(ctx, "panel-accessibility-states.png");
    await shutdown(ctx);
    scenario.cleanup();
    scenario = null;

    console.log("[screenshots] First-run onboarding...");
    scenario = createScenarioFiles({
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
    ctx = await launchApp({ env: scenario.env });
    await sleep(1200);
    await screenshot(ctx, "panel-onboarding.png");
    await shutdown(ctx);
    scenario.cleanup();
    scenario = null;

    console.log("[screenshots] English header summary...");
    scenario = createScenarioFiles({
      language: "en-US",
      onboardingDismissedAt: new Date().toISOString(),
      codexState: panelState({
        serviceId: "codex",
        serviceName: "Codex",
        snapshotState: "fresh",
        statusMessage: "Live Codex limits available.",
        dimensions: [
          {
            label: "CODEX / 5H",
            remainingPercent: 28,
            remainingAbsolute: "28% remaining",
            resetHint: "Resets in 2h",
            status: "warning",
            progressTone: "warning"
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
    ctx = await launchApp({ env: scenario.env });
    await sleep(1200);
    await screenshot(ctx, "panel-english-summary.png");
    await shutdown(ctx);
    scenario.cleanup();
    scenario = null;

    console.log("[screenshots] Panel bottom padding...");
    scenario = createScenarioFiles({
      onboardingDismissedAt: new Date().toISOString(),
      codexState: panelState({
        serviceId: "codex",
        serviceName: "Codex",
        snapshotState: "fresh",
        statusMessage: "Live Codex limits available.",
        dimensions: [
          {
            label: "CODEX / 5H",
            remainingPercent: 84,
            remainingAbsolute: "84% remaining",
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
    ctx = await launchApp({ env: scenario.env });
    await sleep(1200);
    await screenshot(ctx, "panel-bottom-spacing.png");
    await shutdown(ctx);
    scenario.cleanup();
    scenario = null;
  } catch (error) {
    console.error("\n[screenshots] Error:", error.message);
    process.exitCode = 1;
  } finally {
    await shutdown(ctx);
    scenario?.cleanup?.();
  }
}

run()
  .then(() => process.exit(process.exitCode ?? 0))
  .catch(() => process.exit(process.exitCode ?? 1));
