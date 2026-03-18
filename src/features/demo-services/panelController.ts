import { tauriClient } from "../../lib/tauri/client";

export const loadPanelState = () => tauriClient.getCodexPanelState();

export const refreshPanelState = () => tauriClient.refreshCodexPanelState();
