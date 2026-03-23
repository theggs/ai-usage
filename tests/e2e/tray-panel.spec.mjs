#!/usr/bin/env node
/**
 * E2E smoke tests for the real Tauri tray-panel app.
 *
 * Run:
 *   npm run test:e2e:tauri
 */

import { strict as assert } from "node:assert";
import { setTimeout as sleep } from "node:timers/promises";
import { launchApp, screenshot, clickButton, shutdown } from "./tauri-driver.mjs";

let ctx;
let passed = 0;
let failed = 0;

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
  try {
    ctx = await launchApp();
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
      const clicked = await clickButton("设置", ctx) || await clickButton("Settings", ctx);
      assert.ok(clicked, "should be able to click settings button");
      await sleep(500);
      await screenshot(ctx, "test-settings-grouped.png");
    });

    await test("back button returns to panel", async () => {
      const clicked = await clickButton("返回", ctx) || await clickButton("Back", ctx);
      assert.ok(clicked, "should be able to click back button");
      await sleep(500);
      await screenshot(ctx, "test-panel-return.png");
    });

    await test("refresh button is clickable", async () => {
      const clicked = await clickButton("手动刷新", ctx) || await clickButton("Refresh", ctx);
      assert.ok(clicked, "should be able to click refresh button");
      await sleep(1000);
      await screenshot(ctx, "test-after-refresh.png");
    });

    console.log(`\n[e2e] ${passed} passed, ${failed} failed\n`);
    process.exitCode = failed > 0 ? 1 : 0;
  } catch (error) {
    console.error("\n[e2e] Fatal error:", error.message);
    process.exitCode = 1;
  } finally {
    await shutdown(ctx);
  }
}

run();
