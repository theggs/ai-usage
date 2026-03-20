import { tauriClient } from "../../lib/tauri/client";

export const loadPanelState = () => tauriClient.getCodexPanelState();

let pendingRefresh: Promise<Awaited<ReturnType<typeof tauriClient.refreshCodexPanelState>>> | null = null;

export const refreshPanelState = () => {
  if (!pendingRefresh) {
    pendingRefresh = tauriClient.refreshCodexPanelState().finally(() => {
      pendingRefresh = null;
    });
  }

  return pendingRefresh;
};

export const loadClaudeCodePanelState = () => tauriClient.getClaudeCodePanelState();

let pendingClaudeCodeRefresh: Promise<Awaited<ReturnType<typeof tauriClient.refreshClaudeCodePanelState>>> | null = null;

export const refreshClaudeCodePanelState = () => {
  if (!pendingClaudeCodeRefresh) {
    pendingClaudeCodeRefresh = tauriClient.refreshClaudeCodePanelState().finally(() => {
      pendingClaudeCodeRefresh = null;
    });
  }

  return pendingClaudeCodeRefresh;
};
