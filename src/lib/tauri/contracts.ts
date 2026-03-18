export type PlatformTarget = "macos" | "windows";
export type SummaryMode = "icon-only" | "single-dimension" | "multi-dimension";
export type DisplayMode = "icon-only" | "icon-plus-percent" | "multi-dimension";
export type IconState = "idle" | "attention" | "offline-demo";
export type PlaceholderStatus = "demo" | "refreshing" | "action-needed";
export type NotificationResultState = "sent" | "blocked" | "failed";

export interface QuotaDimension {
  label: string;
  remainingPercent: number;
  remainingAbsolute: string;
  resetHint?: string;
}

export interface PanelPlaceholderItem {
  serviceId: string;
  serviceName: string;
  accountLabel?: string;
  iconKey: string;
  quotaDimensions: QuotaDimension[];
  statusLabel: PlaceholderStatus;
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

export interface DemoPanelState {
  desktopSurface: DesktopSurfaceState;
  items: PanelPlaceholderItem[];
  updatedAt: string;
}

export interface UserPreferences {
  language: "zh-CN" | "en-US";
  refreshIntervalMinutes: number;
  displayMode: DisplayMode;
  autostartEnabled: boolean;
  notificationTestEnabled: boolean;
  lastSavedAt: string;
}

export interface PreferencePatch {
  language?: UserPreferences["language"];
  refreshIntervalMinutes?: number;
  displayMode?: UserPreferences["displayMode"];
  autostartEnabled?: boolean;
  notificationTestEnabled?: boolean;
}

export interface NotificationCheckResult {
  notificationId: string;
  triggeredAt: string;
  result: NotificationResultState;
  messagePreview: string;
}
