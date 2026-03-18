import { tauriClient } from "../../lib/tauri/client";
import type { PreferencePatch } from "../../lib/tauri/contracts";

export const getPreferences = () => tauriClient.getPreferences();

export const persistPreferences = (patch: PreferencePatch) =>
  tauriClient.savePreferences(patch);

export const applyAutostart = (enabled: boolean) => tauriClient.setAutostart(enabled);
