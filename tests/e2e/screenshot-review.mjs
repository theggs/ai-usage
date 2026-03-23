#!/usr/bin/env node
/**
 * Automated UI screenshot review for the real Tauri app.
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
import { launchApp, screenshot, clickButton, shutdown } from "./tauri-driver.mjs";

async function run() {
  let ctx;
  try {
    ctx = await launchApp();

    // --- Panel view ---
    console.log("\n[screenshots] Panel view...");
    await sleep(2000); // Wait for real data fetch
    await screenshot(ctx, "panel-health-summary.png");

    // --- Settings view ---
    console.log("[screenshots] Navigating to settings...");
    const clicked = await clickButton("设置", ctx);
    if (!clicked) {
      // Try English label
      await clickButton("Settings", ctx);
    }
    await sleep(800);
    await screenshot(ctx, "settings-grouped-top.png");

    // --- Back to panel ---
    console.log("[screenshots] Going back to panel...");
    const backClicked = await clickButton("返回", ctx);
    if (!backClicked) {
      await clickButton("Back", ctx);
    }
    await sleep(500);
    await screenshot(ctx, "panel-returned.png");

    console.log("\n[screenshots] Done! View with: open tests/e2e/screenshots/");
  } catch (error) {
    console.error("\n[screenshots] Error:", error.message);
    process.exitCode = 1;
  } finally {
    await shutdown(ctx);
  }
}

run();
