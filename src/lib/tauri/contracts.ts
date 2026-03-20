export type PlatformTarget = "macos" | "windows";
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
export type CodexWindowKind = "rolling-hours" | "weekly" | "other";
export type CodexLimitStatus = "healthy" | "warning" | "exhausted" | "unknown";
export type QuotaProgressTone = "success" | "warning" | "danger" | "muted";

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
  lastRefreshedAt: string;
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
  snapshotState: CodexSnapshotState;
  statusMessage: string;
  activeSession?: ActiveCodexSession;
  updatedAt: string;
}

export interface UserPreferences {
  language: "zh-CN" | "en-US";
  refreshIntervalMinutes: number;
  traySummaryMode: TraySummaryMode;
  autostartEnabled: boolean;
  notificationTestEnabled: boolean;
  lastSavedAt: string;
  menubarService: string;
  serviceOrder: string[];
}

export interface PreferencePatch {
  language?: UserPreferences["language"];
  refreshIntervalMinutes?: number;
  traySummaryMode?: UserPreferences["traySummaryMode"];
  autostartEnabled?: boolean;
  notificationTestEnabled?: boolean;
  menubarService?: string;
  serviceOrder?: string[];
}

export interface NotificationCheckResult {
  notificationId: string;
  triggeredAt: string;
  result: NotificationResultState;
  messagePreview: string;
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
