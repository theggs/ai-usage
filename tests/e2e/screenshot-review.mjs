#!/usr/bin/env node
/**
 * Automated UI screenshot review for the real Tauri app.
 *
 * Feature coverage targets for 010-ui-ux-completion:
 * - panel health summary layout
 * - settings grouping and top-of-page hierarchy
 * - panel return flow after settings navigation
 * - panel bottom padding and settings grouping rhythm
 * - first-run onboarding, warning/danger label states, and English header summary
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

import { setTimeout as sleep } from "node:timers/promises";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  launchApp,
  screenshot,
  clickAnyButton,
  clickWindowPoint,
  hoverAnyButton,
  moveWindowPoint,
  pressKey,
  shutdown
} from "./tauri-driver.mjs";

const nowSeconds = () => String(Math.floor(Date.now() / 1000));
const PROMOTION_TRIGGER_POINT = { x: 78, y: 90 };
const PROMOTION_CLOSE_POINT = { x: 342, y: 160 };

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
        menubarService: "codex",
        serviceOrder: ["codex", "claude-code"],
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
    env: {
      AI_USAGE_PREFERENCES_FILE: preferencesFile,
      AI_USAGE_SNAPSHOT_CACHE_FILE: snapshotFile
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

async function run() {
  let ctx;
  let scenario;
  try {
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
          await sleep(500);
          await screenshot(ctx, "panel-promotion-closed-escape.png");
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
