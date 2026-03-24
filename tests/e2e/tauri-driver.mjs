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
    const moduleCachePath = resolve("/tmp", "aiusage-swift-module-cache");
    mkdirSync(moduleCachePath, { recursive: true });
    const macTarget = `${process.arch === "arm64" ? "arm64" : "x86_64"}-apple-macos14.0`;
    execSync(`swiftc -target "${macTarget}" -module-cache-path "${moduleCachePath}" -O -o "${outputBin}" "${swiftFile}"`, {
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
  compileIfNeeded(
    resolve(__dirname, "hover-button.swift"),
    resolve(__dirname, ".hover-button")
  );
  compileIfNeeded(
    resolve(__dirname, "drag-element.swift"),
    resolve(__dirname, ".drag-element")
  );
  compileIfNeeded(
    resolve(__dirname, "capture-window.swift"),
    resolve(__dirname, ".capture-window")
  );
  compileIfNeeded(
    resolve(__dirname, "click-point.swift"),
    resolve(__dirname, ".click-point")
  );
  compileIfNeeded(
    resolve(__dirname, "move-point.swift"),
    resolve(__dirname, ".move-point")
  );
  compileIfNeeded(
    resolve(__dirname, "press-key.swift"),
    resolve(__dirname, ".press-key")
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
  const captureBin = resolve(__dirname, ".capture-window");
  execSync(`"${captureBin}" ${windowId} "${outputPath}"`, { timeout: 60000 });
}

function refreshWindowInfo(ctx) {
  const nextWindowInfo = findWindowId(6, 300);
  if (!nextWindowInfo) {
    throw new Error("Could not find AIUsage window while refreshing window handle");
  }
  ctx.windowInfo = nextWindowInfo;
  return nextWindowInfo;
}

// --- Public API ----------------------------------------------------------------

/**
 * Launch the Tauri app in test mode and wait for the window to appear.
 * @returns {Promise<{proc: ChildProcess, windowInfo: object}>}
 */
export async function launchApp(options = {}) {
  const binary = findBinary();
  console.log(`[e2e] Binary: ${binary}`);

  mkdirSync(SCREENSHOT_DIR, { recursive: true });
  ensureHelpers();

  console.log("[e2e] Launching app...");
  const proc = spawn(binary, [], {
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, AIUSAGE_E2E: "1", ...(options.env ?? {}) },
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
  let lastError;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      refreshWindowInfo(ctx);
      captureWindow(ctx.windowInfo.id, outputPath);
      console.log(`  ✓ ${name}`);
      return;
    } catch (err) {
      lastError = err;
      await sleep(500);
    }
  }
  throw new Error(`${name}: ${lastError?.message ?? "capture failed"}`);
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
 * Click the first matching label from a candidate list.
 *
 * @param {string[]} labels
 * @param {object} ctx
 * @returns {Promise<string|null>} clicked label
 */
export async function clickAnyButton(labels, ctx) {
  for (const label of labels) {
    const clicked = await clickButton(label, ctx);
    if (clicked) {
      return label;
    }
  }
  return null;
}

export async function hoverButton(label, ctx) {
  const hoverBin = resolve(__dirname, ".hover-button");
  try {
    const pidArg = ctx?.proc?.pid != null ? ` ${ctx.proc.pid}` : "";
    const result = execSync(`"${hoverBin}" "${label}"${pidArg}`, {
      encoding: "utf8",
      timeout: 5000,
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
    await sleep(300);
    return result === "hovered";
  } catch (err) {
    const stderr = err.stderr?.toString() ?? "";
    console.log(`  ⚠ hoverButton("${label}") failed: ${stderr.trim()}`);
    return false;
  }
}

export async function hoverAnyButton(labels, ctx) {
  for (const label of labels) {
    const hovered = await hoverButton(label, ctx);
    if (hovered) {
      return label;
    }
  }
  return null;
}

export async function clickWindowPoint(offsetX, offsetY, ctx) {
  const clickBin = resolve(__dirname, ".click-point");
  const { X, Y } = refreshWindowInfo(ctx).bounds;
  const targetX = X + offsetX;
  const targetY = Y + offsetY;
  try {
    const result = execSync(`"${clickBin}" ${targetX} ${targetY}`, {
      encoding: "utf8",
      timeout: 5000,
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
    await sleep(400);
    return result === "clicked";
  } catch (err) {
    const stderr = err.stderr?.toString() ?? "";
    console.log(`  ⚠ clickWindowPoint(${offsetX}, ${offsetY}) failed: ${stderr.trim()}`);
    return false;
  }
}

export async function moveWindowPoint(offsetX, offsetY, ctx) {
  const moveBin = resolve(__dirname, ".move-point");
  const { X, Y } = refreshWindowInfo(ctx).bounds;
  const targetX = X + offsetX;
  const targetY = Y + offsetY;
  try {
    const result = execSync(`"${moveBin}" ${targetX} ${targetY}`, {
      encoding: "utf8",
      timeout: 5000,
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
    await sleep(300);
    return result === "moved";
  } catch (err) {
    const stderr = err.stderr?.toString() ?? "";
    console.log(`  ⚠ moveWindowPoint(${offsetX}, ${offsetY}) failed: ${stderr.trim()}`);
    return false;
  }
}

/**
 * Drag from one labeled element to another inside the app window.
 *
 * @param {string} sourceLabel
 * @param {string} targetLabel
 * @param {object} [ctx]
 * @returns {Promise<boolean>}
 */
export async function dragElement(sourceLabel, targetLabel, ctx) {
  const dragBin = resolve(__dirname, ".drag-element");
  try {
    const pidArg = ctx?.proc?.pid != null ? ` ${ctx.proc.pid}` : "";
    const result = execSync(`"${dragBin}" "${sourceLabel}" "${targetLabel}"${pidArg}`, {
      encoding: "utf8",
      timeout: 5000,
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
    await sleep(500);
    return result === "dragged";
  } catch (err) {
    const stderr = err.stderr?.toString() ?? "";
    console.log(`  ⚠ dragElement("${sourceLabel}" -> "${targetLabel}") failed: ${stderr.trim()}`);
    return false;
  }
}

export async function pressKey(key, ctx) {
  const pressBin = resolve(__dirname, ".press-key");
  try {
    const pidArg = ctx?.proc?.pid != null ? ` ${ctx.proc.pid}` : "";
    const result = execSync(`"${pressBin}" "${key}"${pidArg}`, {
      encoding: "utf8",
      timeout: 5000,
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
    await sleep(300);
    return result === "pressed";
  } catch (err) {
    const stderr = err.stderr?.toString() ?? "";
    console.log(`  ⚠ pressKey("${key}") failed: ${stderr.trim()}`);
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
