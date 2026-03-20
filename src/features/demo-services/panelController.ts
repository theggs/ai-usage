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
