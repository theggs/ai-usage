import { tauriClient } from "../../lib/tauri/client";
import type { CodexPanelState } from "../../lib/tauri/contracts";

const pendingRefreshes = new Map<string, Promise<CodexPanelState>>();

export const loadProviderState = (providerId: string): Promise<CodexPanelState> =>
  tauriClient.getProviderPanelState(providerId);

export const refreshProviderState = (providerId: string): Promise<CodexPanelState> => {
  const existing = pendingRefreshes.get(providerId);
  if (existing) return existing;

  const promise = tauriClient.refreshProviderPanelState(providerId).finally(() => {
    pendingRefreshes.delete(providerId);
  });
  pendingRefreshes.set(providerId, promise);
  return promise;
};
