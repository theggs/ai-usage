import type { CodexAccount, CodexAccountDraft } from "../tauri/contracts";

const STORAGE_KEY = "ai-usage.codex-accounts";

const now = () => new Date().toISOString();

const createId = () =>
  `codex-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const normalizeAccount = (account: CodexAccount): CodexAccount => ({
  ...account,
  alias: account.alias.trim(),
  credentialLabel: account.credentialLabel.trim(),
  organizationLabel: account.organizationLabel?.trim() || undefined
});

export const loadCodexAccounts = (): CodexAccount[] => {
  if (typeof localStorage === "undefined") {
    return [];
  }

  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as CodexAccount[];
    return parsed
      .filter((account) => account?.id && account?.alias && account?.credentialLabel)
      .map(normalizeAccount);
  } catch {
    return [];
  }
};

const saveCodexAccounts = (accounts: CodexAccount[]) => {
  if (typeof localStorage !== "undefined") {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(accounts));
  }
};

export const createCodexAccount = (draft: CodexAccountDraft): CodexAccount => {
  const timestamp = now();
  const alias = draft.alias.trim();
  const credentialLabel = draft.credentialLabel.trim();

  if (!alias) {
    throw new Error("Account alias is required");
  }

  if (!credentialLabel) {
    throw new Error("Credential label is required");
  }

  return {
    id: createId(),
    alias,
    credentialLabel,
    organizationLabel: draft.organizationLabel?.trim() || undefined,
    enabled: true,
    status: "reserved",
    createdAt: timestamp,
    updatedAt: timestamp
  };
};

export const saveCodexAccount = (draft: CodexAccountDraft): CodexAccount[] => {
  const next = [...loadCodexAccounts(), createCodexAccount(draft)];
  saveCodexAccounts(next);
  return next;
};

export const removeCodexAccount = (accountId: string): CodexAccount[] => {
  const next = loadCodexAccounts().filter((account) => account.id !== accountId);
  saveCodexAccounts(next);
  return next;
};

export const setCodexAccountEnabled = (accountId: string, enabled: boolean): CodexAccount[] => {
  const timestamp = now();
  const next = loadCodexAccounts().map((account) =>
    account.id === accountId
      ? {
          ...account,
          enabled,
          updatedAt: timestamp
        }
      : account
  );
  saveCodexAccounts(next);
  return next;
};
