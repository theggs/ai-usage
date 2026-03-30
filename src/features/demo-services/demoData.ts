import type { ActiveCodexSession, CodexPanelState } from "../../lib/tauri/contracts";
import { decorateQuotaDimension, formatTraySummary } from "../../lib/tauri/summary";

const now = () => new Date().toISOString();

type FallbackSessionMode = "connected" | "disconnected" | "pending" | "failed";

const sessionMode = (): FallbackSessionMode => {
  if (typeof localStorage === "undefined") {
    return "pending";
  }

  const value = localStorage.getItem("ai-usage.codex-session-mode");
  if (value === "connected" || value === "disconnected" || value === "pending" || value === "failed") {
    return value;
  }
  return "connected";
};

const buildItems = (mode: FallbackSessionMode): CodexPanelState["items"] => {
  if (mode !== "connected") {
    return [];
  }
  return [
    {
      serviceId: "codex",
      serviceName: "Codex",
      iconKey: "codex",
      statusLabel: "refreshing",
      badgeLabel: "Live",
      lastSuccessfulRefreshAt: now(),
      quotaDimensions: [
        {
          label: "Local Messages / 5h",
          remainingPercent: 64,
          remainingAbsolute: "64% remaining",
          resetHint: "Resets in 2h"
        },
        {
          label: "Code Reviews / week",
          remainingPercent: 82,
          remainingAbsolute: "82% remaining",
          resetHint: "Resets in 4d"
        },
        {
          label: "Bug Bash / day",
          remainingPercent: 20,
          remainingAbsolute: "20% remaining",
          resetHint: "Resets in 12h"
        },
        {
          label: "Spec Reviews / month",
          remainingAbsolute: "--",
          resetHint: "Waiting for snapshot"
        }
      ].map(decorateQuotaDimension)
    }
  ];
};

export const createDemoPanelState = (
  summaryMode: "icon-only" | "lowest-remaining" | "window-5h" | "window-week" | "multi-dimension" = "multi-dimension"
): CodexPanelState => {
  const mode = sessionMode();
  const items = buildItems(mode);
  const activeSession: ActiveCodexSession | undefined =
    mode === "connected"
      ? {
          sessionId: "fallback-codex-session",
          sessionLabel: "Local Codex CLI",
          connectionState: "connected",
          lastCheckedAt: now(),
          source: "fallback-client"
        }
      : undefined;

  const status =
    mode === "pending" ? { kind: "NoData" as const } :
    mode === "failed" ? { kind: "TemporarilyUnavailable" as const, detail: "demo failure" } :
    mode === "disconnected" ? { kind: "NotLoggedIn" as const } :
    { kind: "Fresh" as const };

  return {
    desktopSurface: {
      platform: "macos",
      iconState: items.length ? "idle" : "attention",
      summaryMode,
      summaryText: formatTraySummary(summaryMode, items),
      panelVisible: false
    },
    configuredAccountCount: 0,
    enabledAccountCount: 0,
    status,
    activeSession,
    lastSuccessfulRefreshAt: now(),
    items
  };
};
