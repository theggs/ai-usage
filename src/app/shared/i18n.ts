import type { CodexSnapshotState, UserPreferences } from "../../lib/tauri/contracts";

export type CopyTree = {
  title: string;
  subtitle: string;
  allServicesHealthy: string;
  noServicesConnected: string;
  panelWarningSummary: string;
  panelDangerSummary: string;
  settings: string;
  preferences: string;
  notifications: string;
  refresh: string;
  refreshing: string;
  lastRefresh: string;
  lastRefreshedAt: string;
  demoTag: string;
  noData: string;
  save: string;
  saving: string;
  savedInline: string;
  notificationTest: string;
  sent: string;
  blocked: string;
  failed: string;
  back: string;
  loading: string;
  demoConfiguration: string;
  saved: string;
  trayPreview: string;
  traySummaryMode: string;
  summaryHidden: string;
  traySummaryLowest: string;
  traySummary5h: string;
  traySummaryWeek: string;
  traySummaryMulti: string;
  traySummaryIconOnly: string;
  codexCli: string;
  codexCliHint: string;
  syncStatus: string;
  dataSource: string;
  localCodexCli: string;
  setupHintTitle: string;
  setupHintBody: string;
  activeSession: string;
  noActiveSession: string;
  pendingSync: string;
  staleState: string;
  liveState: string;
  failedState: string;
  justNow: string;
  minutesAgoFormat: string;
  hoursAgoFormat: string;
  daysAgoFormat: string;
  snapshotFresh: string;
  snapshotPending: string;
  snapshotStale: string;
  snapshotEmpty: string;
  snapshotFailed: string;
  enabled: string;
  language: string;
  refreshInterval: string;
  refreshIntervalHint: string;
  autostart: string;
  actions: string;
  savePreferences: string;
  notificationActions: string;
  quotaStatusRefreshing: string;
  quotaStatusLive: string;
  noPercent: string;
  remainingFormat: string;
  resetsInFormat: string;
  resetDue: string;
  minuteShort: string;
  hourShort: string;
  dayShort: string;
  weekShort: string;
  weeklyQuotaLabel: string;
  dailyQuotaLabel: string;
  monthlyQuotaLabel: string;
  menubarService: string;
  serviceOrder: string;
  claudeCodeLabel: string;
  codexLabel: string;
  claudeCodeNotConnected: string;
  networkProxy: string;
  networkProxyMode: string;
  networkProxyModeSystem: string;
  networkProxyModeManual: string;
  networkProxyModeOff: string;
  networkProxyUrl: string;
  networkProxyUrlHint: string;
  networkProxyUrlInvalid: string;
  claudeCodeAccessPaused: string;
  claudeCodeProxyInvalid: string;
  claudeCodeRateLimited: string;
  claudeCodeSessionRecovery: string;
  claudeCodeSessionRecoveryEmpty: string;
  settingsAutoSaveHint: string;
  onboardingTitle: string;
  onboardingStepConnect: string;
  onboardingStepChoose: string;
  onboardingStepRefresh: string;
  goToSettings: string;
  skipGuide: string;
  serviceNotInstalledTitle: string;
  serviceNotInstalledBody: string;
  serviceSignedOutTitle: string;
  serviceSignedOutBody: string;
  serviceDisconnectedTitle: string;
  serviceDisconnectedBody: string;
  statusLow: string;
  statusCritical: string;
  reorderHandle: string;
};

const baseCopy: CopyTree = {
  title: "AIUsage",
  subtitle: "Usage Panel",
  allServicesHealthy: "All services look healthy",
  noServicesConnected: "No services connected yet",
  panelWarningSummary: "{service} {dimension} is running low",
  panelDangerSummary: "{service} {dimension} is critical",
  settings: "Settings",
  preferences: "Preferences",
  notifications: "Notifications",
  refresh: "Refresh",
  refreshing: "Refreshing...",
  lastRefresh: "Last refresh",
  lastRefreshedAt: "Last refreshed",
  demoTag: "Demo data",
  noData: "No services available",
  save: "Save settings",
  saving: "Saving...",
  savedInline: "Saved",
  notificationTest: "Send test notification",
  sent: "Test notification sent",
  blocked: "Notification blocked, check system permissions",
  failed: "Notification failed",
  back: "Back",
  loading: "Loading shell...",
  demoConfiguration: "Manage local Codex CLI sync and desktop preferences.",
  saved: "Settings saved",
  trayPreview: "Tray preview",
  traySummaryMode: "Tray summary",
  summaryHidden: "Hidden",
  traySummaryLowest: "Lowest remaining",
  traySummary5h: "5h window",
  traySummaryWeek: "7d / week window",
  traySummaryMulti: "Multiple dimensions",
  traySummaryIconOnly: "Icon only",
  codexCli: "Codex CLI",
  codexCliHint: "This iteration reads real usage only from the local Codex CLI session. No manual account or credential entry is required.",
  syncStatus: "Sync status",
  dataSource: "Data source",
  localCodexCli: "Local Codex CLI",
  setupHintTitle: "How to sync",
  setupHintBody: "Install Codex CLI, complete `codex login`, and keep the local session readable. The panel will refresh from the local CLI when the app runs.",
  activeSession: "Active session",
  noActiveSession: "No active local Codex session",
  pendingSync: "Open a readable local Codex CLI session to sync live limits.",
  staleState: "The local Codex CLI is installed, but no readable logged-in session is available.",
  liveState: "Live Codex limits available.",
  failedState: "Failed to read live Codex CLI limits.",
  justNow: "Just now",
  minutesAgoFormat: "{value} minutes ago",
  hoursAgoFormat: "{value} hours ago",
  daysAgoFormat: "{value} days ago",
  snapshotFresh: "Live",
  snapshotPending: "Pending",
  snapshotStale: "Disconnected",
  snapshotEmpty: "Not setup",
  snapshotFailed: "Read failed",
  enabled: "Enabled",
  language: "Language",
  refreshInterval: "Refresh interval",
  refreshIntervalHint: "Choose 5, 10, 15, or 30 minutes",
  autostart: "Autostart",
  actions: "Actions",
  savePreferences: "Save preferences",
  notificationActions: "Notification",
  quotaStatusRefreshing: "Refreshing",
  quotaStatusLive: "Live",
  noPercent: "--",
  remainingFormat: "{percent}% remaining",
  resetsInFormat: "Resets in {value}",
  resetDue: "Reset due",
  minuteShort: "m",
  hourShort: "h",
  dayShort: "d",
  weekShort: "week",
  weeklyQuotaLabel: "Weekly quota",
  dailyQuotaLabel: "Daily quota",
  monthlyQuotaLabel: "Monthly quota",
  menubarService: "Menubar service",
  serviceOrder: "Panel order",
  claudeCodeLabel: "Claude Code",
  codexLabel: "Codex",
  claudeCodeNotConnected: "Claude Code not connected. Install Claude Code CLI and log in.",
  networkProxy: "Network proxy",
  networkProxyMode: "Proxy mode",
  networkProxyModeSystem: "Use system proxy",
  networkProxyModeManual: "Manual proxy",
  networkProxyModeOff: "No proxy",
  networkProxyUrl: "Proxy URL",
  networkProxyUrlHint: "Use a full URL such as http://127.0.0.1:7890 or socks5://127.0.0.1:1080",
  networkProxyUrlInvalid: "Enter a full proxy URL before saving.",
  claudeCodeAccessPaused: "Claude Code access was denied. Automatic refresh is paused until you retry manually or update proxy settings.",
  claudeCodeProxyInvalid: "Proxy configuration is invalid. Use a full proxy URL or switch back to system proxy detection.",
  claudeCodeRateLimited: "Claude Code rate limited the request. Automatic refresh is paused for now; try a manual refresh later.",
  claudeCodeSessionRecovery: "Claude Code session is being restored. It usually recovers after you open Claude Code.",
  claudeCodeSessionRecoveryEmpty: "Claude Code session is being restored. Open Claude Code to restore the session.",
  settingsAutoSaveHint: "Changes save automatically",
  onboardingTitle: "Connect your first AI service",
  onboardingStepConnect: "1. Open Settings",
  onboardingStepChoose: "2. Choose your tray service and order",
  onboardingStepRefresh: "3. Refresh to confirm live usage",
  goToSettings: "Go to settings",
  skipGuide: "Skip for now",
  serviceNotInstalledTitle: "CLI not installed",
  serviceNotInstalledBody: "Install the CLI first, then come back here to connect it.",
  serviceSignedOutTitle: "Sign in required",
  serviceSignedOutBody: "The CLI is installed, but there is no readable signed-in session yet.",
  serviceDisconnectedTitle: "Connection unavailable",
  serviceDisconnectedBody: "The app could not read a live session yet. Open settings to check the integration.",
  statusLow: "Low",
  statusCritical: "Critical",
  reorderHandle: "Reorder"
};

const localeCopy: Record<UserPreferences["language"], Partial<CopyTree>> = {
  "zh-CN": {
    title: "AIUsage",
    subtitle: "额度面板",
    allServicesHealthy: "所有服务正常",
    noServicesConnected: "尚未连接任何服务",
    panelWarningSummary: "{service}{dimension}偏低",
    panelDangerSummary: "{service}{dimension}紧张",
    settings: "设置",
    preferences: "偏好设置",
    notifications: "通知",
    refresh: "手动刷新",
    refreshing: "刷新中...",
    lastRefresh: "上次刷新",
    lastRefreshedAt: "上次刷新",
    demoTag: "演示数据",
    noData: "暂无服务数据",
    save: "保存设置",
    saving: "保存中...",
    savedInline: "已保存",
    notificationTest: "发送测试通知",
    sent: "测试通知已发送",
    blocked: "通知被系统拦截，请检查权限",
    failed: "通知发送失败",
    back: "返回",
    loading: "正在加载桌面壳…",
    demoConfiguration: "管理本地 Codex CLI 同步与桌面偏好设置。",
    saved: "设置已保存",
    trayPreview: "托盘摘要预览",
    traySummaryMode: "托盘摘要规则",
    summaryHidden: "隐藏",
    traySummaryLowest: "最低余量",
    traySummary5h: "5 小时窗口",
    traySummaryWeek: "7 天 / 周窗口",
    traySummaryMulti: "多维摘要",
    traySummaryIconOnly: "仅图标",
    codexCli: "Codex CLI",
    codexCliHint: "本迭代只从本地 Codex CLI 会话读取真实额度，不需要手动录入账户或凭证。",
    syncStatus: "同步状态",
    dataSource: "数据来源",
    localCodexCli: "本地 Codex CLI",
    setupHintTitle: "如何同步",
    setupHintBody: "请先安装 Codex CLI 并完成 `codex login`。应用运行时会优先从本地 CLI 会话读取真实额度。",
    activeSession: "活跃会话",
    noActiveSession: "当前没有本地活跃 Codex 会话",
    pendingSync: "请确保本地 Codex CLI 会话可读取，以便同步真实额度。",
    staleState: "本地 Codex CLI 已安装，但当前没有可读取的已登录会话。",
    liveState: "已读取到 Codex 实时额度。",
    failedState: "读取 Codex CLI 实时额度失败。",
    justNow: "刚刚",
    minutesAgoFormat: "{value} 分钟前",
    hoursAgoFormat: "{value} 小时前",
    daysAgoFormat: "{value} 天前",
    snapshotFresh: "实时",
    snapshotPending: "等待同步",
    snapshotStale: "连接中断",
    snapshotEmpty: "未配置",
    snapshotFailed: "读取失败",
    enabled: "启用",
    language: "语言",
    refreshInterval: "刷新间隔",
    refreshIntervalHint: "可选 5 / 10 / 15 / 30 分钟",
    autostart: "开机自启",
    actions: "操作",
    savePreferences: "保存偏好",
    notificationActions: "通知测试",
    quotaStatusRefreshing: "刷新中",
    quotaStatusLive: "实时",
    noPercent: "--",
    remainingFormat: "剩余 {percent}%",
    resetsInFormat: "{value}后重置",
    resetDue: "即将重置",
    minuteShort: " 分钟",
    hourShort: " 小时",
    dayShort: " 天",
    weekShort: "周",
    weeklyQuotaLabel: "每周额度",
    dailyQuotaLabel: "每日额度",
    monthlyQuotaLabel: "每月额度",
    menubarService: "菜单栏服务",
    serviceOrder: "面板顺序",
    claudeCodeLabel: "Claude Code",
    codexLabel: "Codex",
    claudeCodeNotConnected: "Claude Code 未连接。请安装 Claude Code CLI 并登录。",
    networkProxy: "网络代理",
    networkProxyMode: "代理模式",
    networkProxyModeSystem: "使用系统代理",
    networkProxyModeManual: "手动输入",
    networkProxyModeOff: "不使用代理",
    networkProxyUrl: "代理地址",
    networkProxyUrlHint: "请输入完整 URL，例如 http://127.0.0.1:7890 或 socks5://127.0.0.1:1080",
    networkProxyUrlInvalid: "请先填写完整代理 URL 再保存。",
    claudeCodeAccessPaused: "Claude Code 访问被拒绝，已暂停自动刷新。请手动重试或更新代理设置后再继续。",
    claudeCodeProxyInvalid: "代理配置无效。请填写完整代理 URL，或切回系统代理检测。",
    claudeCodeRateLimited: "Claude Code 请求已被限流，当前已暂停自动刷新；请稍后再手动重试。",
    claudeCodeSessionRecovery: "Claude Code 会话恢复中，打开 Claude Code 后通常会自动恢复",
    claudeCodeSessionRecoveryEmpty: "Claude Code 会话恢复中，请打开 Claude Code 以恢复会话",
    settingsAutoSaveHint: "更改会自动保存",
    onboardingTitle: "先连接第一个 AI 服务",
    onboardingStepConnect: "1. 前往设置页",
    onboardingStepChoose: "2. 选择菜单栏服务并调整展示顺序",
    onboardingStepRefresh: "3. 返回面板并刷新，确认额度已同步",
    goToSettings: "前往设置",
    skipGuide: "暂时跳过",
    serviceNotInstalledTitle: "CLI 未安装",
    serviceNotInstalledBody: "请先安装对应 CLI，安装后再回到这里完成连接。",
    serviceSignedOutTitle: "需要先登录",
    serviceSignedOutBody: "CLI 已安装，但当前没有可读取的登录会话。",
    serviceDisconnectedTitle: "暂时无法连接",
    serviceDisconnectedBody: "应用还无法读取到实时会话，请前往设置检查连接状态。",
    statusLow: "偏低",
    statusCritical: "紧张",
    reorderHandle: "拖动排序"
  }
  ,
  "en-US": baseCopy
};

export const resolveCopyTree = (overrides?: Partial<CopyTree>): CopyTree => ({
  ...baseCopy,
  ...(overrides ?? {})
});

const normalizeSnapshotState = (value?: string | null): CodexSnapshotState | undefined => {
  if (!value) return undefined;

  switch (value.toLowerCase()) {
    case "live":
    case "fresh":
      return "fresh";
    case "pending":
      return "pending";
    case "stale":
      return "stale";
    case "empty":
      return "empty";
    case "failed":
      return "failed";
    default:
      return undefined;
  }
};

export const getSnapshotTag = (copy: CopyTree, snapshotState?: string | null) => {
  switch (normalizeSnapshotState(snapshotState)) {
    case "fresh":
      return copy.snapshotFresh;
    case "pending":
      return copy.snapshotPending;
    case "stale":
      return copy.snapshotStale;
    case "empty":
      return copy.snapshotEmpty;
    case "failed":
      return copy.snapshotFailed;
    default:
      return copy.demoTag;
  }
};

export const getSnapshotMessage = (
  copy: CopyTree,
  snapshotState?: string | null,
  hasEnabledAccounts = false
) => {
  switch (normalizeSnapshotState(snapshotState)) {
    case "fresh":
      return copy.liveState;
    case "pending":
      return copy.pendingSync;
    case "stale":
      return copy.staleState;
    case "failed":
      return copy.failedState;
    case "empty":
      return copy.noData;
    default:
      return hasEnabledAccounts ? copy.noData : copy.pendingSync;
  }
};

export const getCopy = (language: UserPreferences["language"]) =>
  resolveCopyTree(localeCopy[language] ?? localeCopy["en-US"]);

export const getClaudeCodePlaceholderMessage = (
  copy: CopyTree,
  snapshotState?: string | null,
  statusMessage?: string | null
) => {
  const normalized = normalizeSnapshotState(snapshotState);
  const message = statusMessage?.trim() ?? "";

  if (message.includes("access was denied")) {
    return copy.claudeCodeAccessPaused;
  }

  if (message.includes("Proxy configuration is invalid")) {
    return copy.claudeCodeProxyInvalid;
  }

  if (message.includes("rate limited")) {
    return copy.claudeCodeRateLimited;
  }

  if (message.includes("session is being restored")) {
    if (message.includes("Open Claude Code to restore")) {
      return copy.claudeCodeSessionRecoveryEmpty;
    }
    return copy.claudeCodeSessionRecovery;
  }

  if (normalized === "empty" || message.includes("No Claude Code credentials")) {
    return copy.claudeCodeNotConnected;
  }

  return message || copy.claudeCodeNotConnected;
};

export const getServicePlaceholderCopy = (
  copy: CopyTree,
  serviceId: string,
  snapshotState?: string | null,
  statusMessage?: string | null
) => {
  const message = statusMessage?.trim() ?? "";
  const normalized = normalizeSnapshotState(snapshotState);

  if (serviceId === "claude-code") {
    if (normalized === "empty" || message.includes("No Claude Code credentials")) {
      return {
        title: copy.serviceNotInstalledTitle,
        body: copy.serviceNotInstalledBody
      };
    }
    if (message.includes("session") || normalized === "stale") {
      return {
        title: copy.serviceSignedOutTitle,
        body: copy.serviceSignedOutBody
      };
    }
  }

  if (normalized === "empty") {
    return {
      title: copy.serviceNotInstalledTitle,
      body: copy.serviceNotInstalledBody
    };
  }

  if (normalized === "stale" || message.includes("logged-in session")) {
    return {
      title: copy.serviceSignedOutTitle,
      body: copy.serviceSignedOutBody
    };
  }

  return {
    title: copy.serviceDisconnectedTitle,
    body: copy.serviceDisconnectedBody
  };
};

/**
 * Localize a backend-generated "remaining" string.
 * Backend sends "100% remaining"; we reformat using the copy tree.
 */
export const localizeRemaining = (copy: CopyTree, remainingPercent?: number, backendValue?: string): string => {
  if (remainingPercent === undefined) return backendValue ?? "--";
  return copy.remainingFormat.replace("{percent}", String(remainingPercent));
};

/**
 * Localize a backend-generated reset hint like "Resets in 5h" or "Reset due".
 */
export const localizeResetHint = (copy: CopyTree, backendValue?: string | null): string | undefined => {
  if (!backendValue) return undefined;

  if (backendValue === "Reset due") return copy.resetDue;

  const match = backendValue.match(/^Resets in (\d+)(m|h|d)$/);
  if (!match) return backendValue;

  const [, num, unit] = match;
  const unitMap: Record<string, string> = {
    m: copy.minuteShort,
    h: copy.hourShort,
    d: copy.dayShort,
  };
  return copy.resetsInFormat.replace("{value}", `${num}${unitMap[unit] ?? unit}`);
};

/**
 * Localize a backend badge label (e.g. "Live" → "实时").
 */
export const localizeBadgeLabel = (copy: CopyTree, backendValue?: string | null): string => {
  if (!backendValue) return copy.quotaStatusLive;

  if (backendValue === "Refreshing" || backendValue === "refreshing") {
    return copy.quotaStatusRefreshing;
  }

  const normalizedSnapshotState = normalizeSnapshotState(backendValue);
  if (normalizedSnapshotState) {
    return getSnapshotTag(copy, normalizedSnapshotState);
  }

  return backendValue;
};

export const localizeDimensionLabel = (copy: CopyTree, backendValue: string) => {
  const match = backendValue.match(/^(.+?)\s*\/\s*(.+)$/);
  const raw = (match?.[2] ?? backendValue).trim();
  const normalized = raw.toLowerCase();

  if (normalized === "5h" || normalized.includes("5h")) {
    return copy.traySummary5h;
  }

  if (normalized === "week" || normalized.includes("week") || normalized.includes("7d")) {
    const suffix = raw.match(/\((.+)\)/)?.[0] ?? "";
    return `${copy.weeklyQuotaLabel}${suffix ? ` ${suffix}` : ""}`;
  }

  if (normalized === "day" || normalized.includes("day")) {
    return copy.dailyQuotaLabel;
  }

  if (normalized === "month" || normalized.includes("month")) {
    return copy.monthlyQuotaLabel;
  }

  return raw;
};

export const localizeStatusLabel = (copy: CopyTree, level?: "warning" | "danger") => {
  if (level === "danger") {
    return copy.statusCritical;
  }
  if (level === "warning") {
    return copy.statusLow;
  }
  return undefined;
};

const parseTimestamp = (value: string) => {
  const timestamp = /^\d+$/.test(value) ? Number(value) * 1000 : Date.parse(value);
  return Number.isNaN(timestamp) ? undefined : timestamp;
};

export const formatAbsoluteTime = (value: string) => {
  const timestamp = parseTimestamp(value);
  if (timestamp === undefined) return "--";
  return new Date(timestamp).toLocaleString();
};

export const formatRelativeTime = (
  copy: CopyTree,
  value: string,
  nowTimestamp = Date.now()
) => {
  const timestamp = parseTimestamp(value);
  if (timestamp === undefined) {
    return "--";
  }

  const diffMs = Math.max(0, nowTimestamp - timestamp);
  const diffMinutes = Math.floor(diffMs / 60000);
  if (diffMinutes < 1) {
    return copy.justNow;
  }

  if (diffMinutes < 60) {
    return copy.minutesAgoFormat.replace("{value}", String(diffMinutes));
  }

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    return copy.hoursAgoFormat.replace("{value}", String(diffHours));
  }

  const diffDays = Math.floor(diffHours / 24);
  return copy.daysAgoFormat.replace("{value}", String(diffDays));
};
