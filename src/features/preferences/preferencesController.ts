import { tauriClient } from "../../lib/tauri/client";
import type { CodexAccountDraft, PreferencePatch } from "../../lib/tauri/contracts";

export const getPreferences = () => tauriClient.getPreferences();

export const persistPreferences = (patch: PreferencePatch) =>
  tauriClient.savePreferences(patch);

export const applyAutostart = (enabled: boolean) => tauriClient.setAutostart(enabled);

export const getCodexAccounts = () => tauriClient.getCodexAccounts();

export const persistCodexAccount = (draft: CodexAccountDraft) =>
  tauriClient.saveCodexAccount(draft);

export const deleteCodexAccount = (accountId: string) =>
  tauriClient.removeCodexAccount(accountId);

export const applyCodexAccountEnabled = (accountId: string, enabled: boolean) =>
  tauriClient.setCodexAccountEnabled(accountId, enabled);
