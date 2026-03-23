/**
 * Legacy Playwright stubs — replaced by WebDriver-based tests.
 *
 * Tauri 2 on macOS uses WKWebView, which requires WebDriver protocol
 * (not Playwright's CDP). Real e2e tests now live in:
 *
 *   tests/e2e/tray-panel.spec.mjs   — functional tests
 *   tests/e2e/screenshot-review.mjs — UI screenshot capture
 *
 * Run with:
 *   npm run test:e2e:tauri          — functional tests
 *   npm run test:e2e:screenshots    — screenshot capture
 */

import { test } from "@playwright/test";

test.describe("tray panel shell", () => {
  test("see tray-panel.spec.mjs for real WebDriver-based e2e tests", async () => {
    test.skip(true, "Replaced by WebDriver tests in tray-panel.spec.mjs. Run: npm run test:e2e:tauri");
  });
});
