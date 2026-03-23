/**
 * Tauri E2E helper — launches the real Tauri app and provides
 * screenshot and interaction capabilities via macOS native APIs.
 *
 * Uses:
 * - CoreGraphics (Swift) to find the app window
 * - screencapture to capture window screenshots
 * - Accessibility API (Swift) to click buttons by label
 *
 * Usage:
 *   import { launchApp, screenshot, clickButton, shutdown } from "./tauri-driver.mjs";
 *   const ctx = await launchApp();
 *   await screenshot(ctx, "panel.png");
 *   await clickButton("设置", ctx);
 *   await shutdown(ctx);
 */

import { spawn, execSync } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync, mkdirSync, statSync } from "node:fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, "../..");
const SCREENSHOT_DIR = resolve(__dirname, "screenshots");

// --- Compile Swift helpers on first use ----------------------------------------

function compileIfNeeded(swiftFile, outputBin) {
  if (!existsSync(outputBin) || statSync(outputBin).mtimeMs < statSync(swiftFile).mtimeMs) {
    execSync(`swiftc -O -o "${outputBin}" "${swiftFile}"`, {
      stdio: "pipe",
      timeout: 60000,
    });
  }
}

function ensureHelpers() {
  compileIfNeeded(
    resolve(__dirname, "find-window.swift"),
    resolve(__dirname, ".find-window")
  );
  compileIfNeeded(
    resolve(__dirname, "click-button.swift"),
    resolve(__dirname, ".click-button")
  );
}

// --- Locate the debug binary ---------------------------------------------------

function findBinary() {
  const candidates = [
    resolve(PROJECT_ROOT, "target/debug/ai_usage"),
    resolve(PROJECT_ROOT, "src-tauri/target/debug/ai_usage"),
    resolve(PROJECT_ROOT, "target/debug/bundle/macos/AIUsage.app/Contents/MacOS/AIUsage"),
  ];
  for (const path of candidates) {
    if (existsSync(path)) return path;
  }
  throw new Error("No debug binary found. Run:\n  npm run test:e2e:build");
}

// --- macOS window helpers ------------------------------------------------------

function findWindowId(retries = 10, delayMs = 500) {
  const finderBin = resolve(__dirname, ".find-window");
  for (let i = 0; i < retries; i++) {
    try {
      const result = execSync(`"${finderBin}"`, {
        encoding: "utf8",
        timeout: 5000,
        stdio: ["ignore", "pipe", "pipe"],
      }).trim();
      if (result) {
        return JSON.parse(result);
      }
    } catch {
      // Window not found yet, retry
    }
    if (i < retries - 1) {
      execSync(`sleep ${delayMs / 1000}`);
    }
  }
  return null;
}

function captureWindow(windowId, outputPath) {
  execSync(`screencapture -l ${windowId} -o "${outputPath}"`, { timeout: 10000 });
}

// --- Public API ----------------------------------------------------------------

/**
 * Launch the Tauri app in test mode and wait for the window to appear.
 * @returns {Promise<{proc: ChildProcess, windowInfo: object}>}
 */
export async function launchApp() {
  const binary = findBinary();
  console.log(`[e2e] Binary: ${binary}`);

  mkdirSync(SCREENSHOT_DIR, { recursive: true });
  ensureHelpers();

  console.log("[e2e] Launching app...");
  const proc = spawn(binary, [], {
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, AIUSAGE_E2E: "1" },
    detached: false,
  });

  let stderrLog = "";
  proc.stderr?.on("data", (chunk) => { stderrLog += chunk.toString(); });
  proc.stdout?.on("data", () => {});
  proc.on("error", (err) => { console.error(`[e2e] App launch error: ${err.message}`); });

  console.log("[e2e] Waiting for window...");
  await sleep(3000);

  const windowInfo = findWindowId();
  if (!windowInfo) {
    proc.kill("SIGTERM");
    throw new Error(
      "Could not find AIUsage window. The app may have failed to start.\n" +
        `stderr: ${stderrLog.slice(0, 500)}`
    );
  }
  console.log(`[e2e] Window found: id=${windowInfo.id}, owner=${windowInfo.owner}`);

  return { proc, windowInfo };
}

/**
 * Take a screenshot of the app window.
 */
export async function screenshot(ctx, name) {
  const outputPath = resolve(SCREENSHOT_DIR, name);
  try {
    captureWindow(ctx.windowInfo.id, outputPath);
    console.log(`  ✓ ${name}`);
  } catch (err) {
    console.log(`  ✗ ${name}: ${err.message}`);
  }
}

/**
 * Click a button in the app by its accessibility label.
 * Uses macOS Accessibility API — requires the terminal app to have
 * accessibility permission in System Settings.
 *
 * @param {string} label - the button's aria-label or text content
 * @param {object} [ctx] - optional context from launchApp(); when provided, targets the exact PID
 * @returns {Promise<boolean>} true if clicked successfully
 */
export async function clickButton(label, ctx) {
  const clickBin = resolve(__dirname, ".click-button");
  try {
    const pidArg = ctx?.proc?.pid != null ? ` ${ctx.proc.pid}` : "";
    const result = execSync(`"${clickBin}" "${label}"${pidArg}`, {
      encoding: "utf8",
      timeout: 5000,
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
    await sleep(300);
    return result === "clicked";
  } catch (err) {
    const stderr = err.stderr?.toString() ?? "";
    console.log(`  ⚠ clickButton("${label}") failed: ${stderr.trim()}`);
    return false;
  }
}

/**
 * Shut down the app and clean up.
 */
export async function shutdown(ctx) {
  if (ctx?.proc) {
    ctx.proc.kill("SIGTERM");
    await sleep(500);
    try { ctx.proc.kill("SIGKILL"); } catch {}
  }
}
