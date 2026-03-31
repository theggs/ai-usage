export interface ProviderDescriptor {
  readonly id: string;
  readonly displayName: string;
  readonly defaultEnabled: boolean;
  readonly dashboardUrl?: string;
}

export const PROVIDERS: readonly ProviderDescriptor[] = Object.freeze([
  { id: "codex", displayName: "Codex", defaultEnabled: true, dashboardUrl: "https://chatgpt.com/admin/usage" },
  { id: "claude-code", displayName: "Claude Code", defaultEnabled: false, dashboardUrl: "https://console.anthropic.com/settings/usage" },
]);

export const getProvider = (id: string): ProviderDescriptor | undefined =>
  PROVIDERS.find((p) => p.id === id);

export const providerIds = (): string[] => PROVIDERS.map((p) => p.id);

export const menubarServiceIds = (): string[] => [...providerIds(), "auto"];
