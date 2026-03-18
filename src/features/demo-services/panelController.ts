import { tauriClient } from "../../lib/tauri/client";

export const loadPanelState = () => tauriClient.getDemoPanelState();

export const refreshPanelState = () => tauriClient.refreshDemoPanelState();
