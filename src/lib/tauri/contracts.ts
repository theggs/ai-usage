export type PlatformTarget = "macos" | "windows";
export type MenubarService = string;
export type SummaryMode =
  | "icon-only"
  | "lowest-remaining"
  | "window-5h"
  | "window-week"
  | "multi-dimension";
export type TraySummaryMode = SummaryMode;
export type IconState = "idle" | "attention" | "offline-demo";
export type PlaceholderStatus = "demo" | "refreshing" | "action-needed";
export type NotificationResultState = "sent" | "blocked" | "failed";
export type CodexAccountStatus = "reserved" | "ready";
export type CodexConnectionState = "connected" | "disconnected" | "unavailable" | "failed";
export type CodexSnapshotState = "fresh" | "stale" | "empty" | "failed" | "pending";

export type SnapshotStatus =
  | { kind: "Fresh" }
  | { kind: "CliNotFound" }
  | { kind: "NotLoggedIn" }
  | { kind: "NoCredentials" }
  | { kind: "SessionRecovery" }
  | { kind: "RateLimited"; retry_after_minutes: number }
  | { kind: "AccessDenied" }
  | { kind: "ProxyInvalid" }
  | { kind: "TemporarilyUnavailable"; detail: string }
  | { kind: "NoData" }
  | { kind: "Disabled" };
export type CodexWindowKind = "rolling-hours" | "weekly" | "other";
export type CodexLimitStatus = "healthy" | "warning" | "exhausted" | "unknown";
export type QuotaProgressTone = "success" | "warning" | "danger" | "muted";
export type ServiceConnectionState = "connected" | "disconnected" | "empty" | "failed" | "stale";

export interface QuotaDimension {
  label: string;
  remainingPercent?: number;
  remainingAbsolute: string;
  resetHint?: string;
  status: CodexLimitStatus;
  progressTone: QuotaProgressTone;
}

export interface PanelPlaceholderItem {
  serviceId: string;
  serviceName: string;
  accountLabel?: string;
  iconKey: string;
  quotaDimensions: QuotaDimension[];
  statusLabel: PlaceholderStatus;
  badgeLabel?: string;
  lastSuccessfulRefreshAt: string;
}

export interface DesktopSurfaceState {
  platform: PlatformTarget;
  iconState: IconState;
  summaryMode: SummaryMode;
  summaryText?: string;
  panelVisible: boolean;
  lastOpenedAt?: string;
}

export interface CodexPanelState {
  desktopSurface: DesktopSurfaceState;
  items: PanelPlaceholderItem[];
  configuredAccountCount: number;
  enabledAccountCount: number;
  status: SnapshotStatus;
  activeSession?: ActiveCodexSession;
  lastSuccessfulRefreshAt: string;
}

export interface UserPreferences {
  language: "zh-CN" | "en-US";
  refreshIntervalMinutes: number;
  traySummaryMode: TraySummaryMode;
  autostartEnabled: boolean;
  notificationTestEnabled: boolean;
  lastSavedAt: string;
  menubarService: MenubarService;
  serviceOrder: string[];
  networkProxyMode: "system" | "manual" | "off";
  networkProxyUrl: string;
  onboardingDismissedAt?: string;
  claudeCodeUsageEnabled: boolean;
  claudeCodeDisclosureDismissedAt?: string;
  providerEnabled: Record<string, boolean>;
}

export interface PreferencePatch {
  language?: UserPreferences["language"];
  refreshIntervalMinutes?: number;
  traySummaryMode?: UserPreferences["traySummaryMode"];
  autostartEnabled?: boolean;
  notificationTestEnabled?: boolean;
  menubarService?: UserPreferences["menubarService"];
  serviceOrder?: string[];
  networkProxyMode?: UserPreferences["networkProxyMode"];
  networkProxyUrl?: string;
  onboardingDismissedAt?: string;
  claudeCodeUsageEnabled?: boolean;
  claudeCodeDisclosureDismissedAt?: string;
  providerEnabled?: Record<string, boolean>;
}

export interface ServiceStatusCard {
  serviceId: string;
  serviceName: string;
  connectionState: ServiceConnectionState;
  dataSource: string;
  primaryMessage: string;
  secondaryMessage?: string;
  sessionLabel?: string;
}

export interface NotificationCheckResult {
  notificationId: string;
  triggeredAt: string;
  result: NotificationResultState;
  messagePreview: string;
}

export interface RuntimeFlags {
  isE2E: boolean;
}

export interface CodexAccount {
  id: string;
  alias: string;
  credentialLabel: string;
  organizationLabel?: string;
  enabled: boolean;
  status: CodexAccountStatus;
  createdAt: string;
  updatedAt: string;
}

export interface CodexAccountDraft {
  alias: string;
  credentialLabel: string;
  organizationLabel?: string;
}

export interface ActiveCodexSession {
  sessionId: string;
  accountId?: string;
  sessionLabel: string;
  connectionState: CodexConnectionState;
  lastCheckedAt: string;
  source: string;
}

export interface CodexLimitDimension extends QuotaDimension {
  windowKind: CodexWindowKind;
  status: CodexLimitStatus;
}
