#!/usr/bin/env node

import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { spawn } from "node:child_process";

const tempDir = mkdtempSync(join(tmpdir(), "aiusage-onboarding-"));
const preferencesFile = join(tempDir, "preferences.json");
const snapshotFile = join(tempDir, "snapshot-cache.json");
const nowSeconds = String(Math.floor(Date.now() / 1000));

const panelState = ({ serviceId, serviceName, statusMessage }) => ({
  desktopSurface: {
    platform: "macos",
    iconState: "attention",
    summaryMode: "lowest-remaining",
    panelVisible: false,
    lastOpenedAt: null
  },
  items: [],
  configuredAccountCount: 0,
  enabledAccountCount: 0,
  snapshotState: "empty",
  statusMessage,
  activeSession: null,
  lastSuccessfulRefreshAt: nowSeconds
});

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
      claudeCodeUsageEnabled: false,
      claudeCodeDisclosureDismissedAt: undefined
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
          statusMessage: "No Codex session"
        }),
        "claude-code": panelState({
          serviceId: "claude-code",
          serviceName: "Claude Code",
          statusMessage: "No Claude Code credentials"
        })
      }
    },
    null,
    2
  )
);

let cleanedUp = false;

const cleanup = () => {
  if (cleanedUp) return;
  cleanedUp = true;
  rmSync(tempDir, { recursive: true, force: true });
};

console.log("[onboarding] Launching AIUsage in first-run onboarding mode");
console.log(`[onboarding] Temporary scenario dir: ${tempDir}`);
console.log("[onboarding] Your real preferences and snapshot cache will not be touched");

const child = spawn(
  process.platform === "win32" ? "npm.cmd" : "npm",
  ["run", "tauri:dev"],
  {
    stdio: "inherit",
    env: {
      ...process.env,
      AI_USAGE_PREFERENCES_FILE: preferencesFile,
      AI_USAGE_SNAPSHOT_CACHE_FILE: snapshotFile
    }
  }
);

const forwardSignal = (signal) => {
  if (!child.killed) {
    child.kill(signal);
  }
};

process.on("SIGINT", () => forwardSignal("SIGINT"));
process.on("SIGTERM", () => forwardSignal("SIGTERM"));

child.on("exit", (code, signal) => {
  cleanup();
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});

child.on("error", (error) => {
  cleanup();
  console.error(`[onboarding] Failed to launch tauri dev: ${error.message}`);
  process.exit(1);
});
