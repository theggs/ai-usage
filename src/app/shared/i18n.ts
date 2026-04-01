import type { CodexSnapshotState, SnapshotStatus, UserPreferences } from "../../lib/tauri/contracts";
import type {
  PromotionDetailTiming,
  PromotionDisplayDecision,
  PromotionOverlayState,
  PromotionServiceDecision,
  PromotionServiceStatus
} from "../../features/promotions/types";

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
  burnRateOnTrack: string;
  burnRateBehind: string;
  burnRateFarBehind: string;
  burnRateRunsOutInFormat: string;
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
  menubarServiceAuto: string;
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
  claudeCodeUsageInfoTitle: string;
  claudeCodeUsageInfoBody: string;
  claudeCodeUsageEyebrow: string;
  claudeCodeUsageEnabledLabel: string;
  claudeCodeUsageEnabledAriaLabel: string;
  claudeCodeUsageEnabledHint: string;
  claudeCodeUsageDisclosureTitle: string;
  claudeCodeUsageDisclosureBody: string;
  claudeCodeUsageDisclosureButton: string;
  claudeCodeUsageRefreshingTitle: string;
  claudeCodeUsageRefreshingBody: string;
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
  claudeCodeNotConnectedTitle: string;
  claudeCodeNotConnectedBody: string;
  tokenNotConfiguredTitle: string;
  tokenNotConfiguredBody: string;
  refreshingGenericTitle: string;
  refreshingGenericBody: string;
  serviceSignedOutTitle: string;
  serviceSignedOutBody: string;
  serviceDisconnectedTitle: string;
  serviceDisconnectedBody: string;
  statusSessionRecoveryTitle: string;
  statusSessionRecoveryBody: string;
  statusRateLimitedTitle: string;
  statusRateLimitedBody: string;
  statusAccessDeniedTitle: string;
  statusAccessDeniedBody: string;
  statusProxyInvalidTitle: string;
  statusProxyInvalidBody: string;
  statusTemporarilyUnavailableTitle: string;
  statusTemporarilyUnavailableBody: string;
  statusNoDataTitle: string;
  statusNoDataBody: string;
  statusLow: string;
  statusCritical: string;
  reorderHandle: string;
  codexCompactLabel: string;
  claudeCodeCompactLabel: string;
  promotionNoneKnown: string;
  promotionCompactStatusActiveWindow: string;
  promotionCompactStatusActiveGeneral: string;
  promotionCompactStatusRestrictedWindow: string;
  promotionCompactStatusInactiveWindow: string;
  promotionCompactStatusEligibilityUnknown: string;
  promotionCompactStatusNone: string;
  promotionStatusActiveWindow: string;
  promotionStatusActiveGeneral: string;
  promotionStatusRestrictedWindow: string;
  promotionStatusInactiveWindow: string;
  promotionStatusEligibilityUnknown: string;
  promotionStatusNone: string;
  promotionDetailContinuous: string;
  promotionDetailLocalWindowTemplate: string;
  promotionDetailLocalActiveWindowTemplate: string;
  promotionTriggerAria: string;
  promotionPopoverLabel: string;
  kimiCodeSectionTitle: string;
  kimiCodeSectionBody: string;
  kimiCodeToggleAriaLabel: string;
  kimiCodeTokenLabel: string;
  kimiCodeTokenHint: string;
  kimiCodeTokenPlaceholder: string;
  glmSectionTitle: string;
  glmSectionBody: string;
  glmToggleAriaLabel: string;
  glmTokenLabel: string;
  glmTokenHint: string;
  glmTokenPlaceholder: string;
  glmRegionLabel: string;
  glmRegionGlobal: string;
  glmRegionChina: string;
};

const baseCopy: CopyTree = {
  title: "AIUsage",
  subtitle: "Usage Panel",
  allServicesHealthy: "All services look healthy",
  noServicesConnected: "No services connected yet",
  panelWarningSummary: "{service} {dimension} running low",
  panelDangerSummary: "{service} {dimension} critical",
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
  traySummaryMode: "Menubar summary",
  summaryHidden: "hidden",
  traySummaryLowest: "lowest remain",
  traySummary5h: "5h limits",
  traySummaryWeek: "weekly limits",
  traySummaryMulti: "multiple",
  traySummaryIconOnly: "icon only",
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
  autostart: "Start on boot",
  actions: "Actions",
  savePreferences: "Save preferences",
  notificationActions: "Notification",
  quotaStatusRefreshing: "Refreshing",
  quotaStatusLive: "Live",
  noPercent: "--",
  remainingFormat: "{percent}% remaining",
  burnRateOnTrack: "On track",
  burnRateBehind: "Behind",
  burnRateFarBehind: "Far behind",
  burnRateRunsOutInFormat: "Runs out in ~{value}",
  resetsInFormat: "Resets in {value}",
  resetDue: "Reset due",
  minuteShort: "m",
  hourShort: "h",
  dayShort: "d",
  weekShort: "week",
  weeklyQuotaLabel: "Weekly limits",
  dailyQuotaLabel: "Daily limits",
  monthlyQuotaLabel: "Monthly limits",
  menubarService: "Menubar service",
  menubarServiceAuto: "Automatic",
  serviceOrder: "Panel order",
  claudeCodeLabel: "Claude Code",
  codexLabel: "Codex",
  claudeCodeNotConnected: "Claude Code not connected. Install Claude Code CLI and log in.",
  networkProxy: "Network proxy",
  networkProxyMode: "Proxy mode",
  networkProxyModeSystem: "system",
  networkProxyModeManual: "manual",
  networkProxyModeOff: "none",
  networkProxyUrl: "Proxy URL",
  networkProxyUrlHint: "Use a full URL such as http://127.0.0.1:7890 or socks5://127.0.0.1:1080",
  networkProxyUrlInvalid: "Enter a full proxy URL before saving.",
  claudeCodeUsageInfoTitle: "Claude Code query",
  claudeCodeUsageInfoBody:
    "The app uses the Claude Code credential already available on this device.\nThat credential is only used to query quota status from Claude official APIs.\nThe app will not store or modify that credential, or proactively send it to AIUsage or other non-official endpoints.",
  claudeCodeUsageEyebrow: "Claude Code query",
  claudeCodeUsageEnabledLabel: "Enable",
  claudeCodeUsageEnabledAriaLabel: "Enable Claude Code query",
  claudeCodeUsageEnabledHint: "",
  claudeCodeUsageDisclosureTitle: "Claude Code query",
  claudeCodeUsageDisclosureBody:
    "The app uses the Claude Code credential already available on this device.\nThat credential is only used to query quota status from Claude official APIs.\nThe app will not store or modify that credential, or proactively send it to AIUsage or other non-official endpoints.",
  claudeCodeUsageDisclosureButton: "I understand",
  claudeCodeUsageRefreshingTitle: "Querying Claude Code quota",
  claudeCodeUsageRefreshingBody: "AIUsage is using your local Claude Code credential to refresh quota status.",
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
  claudeCodeNotConnectedTitle: "Not connected",
  claudeCodeNotConnectedBody: "Install Claude Code CLI and log in, then come back here to connect it.",
  tokenNotConfiguredTitle: "Token not configured",
  tokenNotConfiguredBody: "Enter your API token in Settings to connect this service.",
  refreshingGenericTitle: "Refreshing quota",
  refreshingGenericBody: "Checking your usage status...",
  serviceSignedOutTitle: "Sign in required",
  serviceSignedOutBody: "The CLI is installed, but there is no readable signed-in session yet.",
  serviceDisconnectedTitle: "Connection unavailable",
  serviceDisconnectedBody: "The app could not read a live session yet. Open settings to check the integration.",
  statusSessionRecoveryTitle: "Recovering session",
  statusSessionRecoveryBody: "Session is being restored. It usually recovers after you open the CLI.",
  statusRateLimitedTitle: "Rate limited",
  statusRateLimitedBody: "Automatic refresh is paused; try a manual refresh later.",
  statusAccessDeniedTitle: "Access denied",
  statusAccessDeniedBody: "Automatic refresh is paused. Try a manual refresh. If the problem persists, check your proxy or account settings.",
  statusProxyInvalidTitle: "Proxy invalid",
  statusProxyInvalidBody: "Use a full proxy URL or switch back to system proxy detection.",
  statusTemporarilyUnavailableTitle: "Temporarily unavailable",
  statusTemporarilyUnavailableBody: "The service is temporarily unavailable. It may recover on the next refresh.",
  statusNoDataTitle: "No data yet",
  statusNoDataBody: "The service is connected but no quota data is available yet.",
  statusLow: "Low",
  statusCritical: "Critical",
  reorderHandle: "Reorder",
  codexCompactLabel: "Codex",
  claudeCodeCompactLabel: "Claude",
  promotionNoneKnown: "No promotion right now",
  promotionCompactStatusActiveWindow: "promo active",
  promotionCompactStatusActiveGeneral: "promo active",
  promotionCompactStatusRestrictedWindow: "lower quota",
  promotionCompactStatusInactiveWindow: "off",
  promotionCompactStatusEligibilityUnknown: "pending",
  promotionCompactStatusNone: "none",
  promotionStatusActiveWindow: "promotion active",
  promotionStatusActiveGeneral: "promotion active",
  promotionStatusRestrictedWindow: "lower quota during peak hours",
  promotionStatusInactiveWindow: "outside promotion window",
  promotionStatusEligibilityUnknown: "promotion eligibility pending",
  promotionStatusNone: "no promotion",
  promotionDetailContinuous: "All-day promotion",
  promotionDetailLocalWindowTemplate: "outside weekdays {range} ({timeZone})",
  promotionDetailLocalActiveWindowTemplate: "weekdays {range} ({timeZone})",
  promotionTriggerAria: "Preview all promotion states",
  promotionPopoverLabel: "All promotion states",
  kimiCodeSectionTitle: "Kimi Code Usage",
  kimiCodeSectionBody: "Display your Kimi Code usage quota. Requires an API token from your Kimi Code console.",
  kimiCodeToggleAriaLabel: "Enable Kimi Code usage display",
  kimiCodeTokenLabel: "API Token",
  kimiCodeTokenHint: "From kimi.com/code/console or ~/.kimi/config.toml",
  kimiCodeTokenPlaceholder: "sk-...",
  glmSectionTitle: "GLM Coding Plan Usage",
  glmSectionBody: "Display your GLM Coding Plan usage quota. Requires an API token from your developer console.",
  glmToggleAriaLabel: "Enable GLM Coding Plan usage display",
  glmTokenLabel: "API Token",
  glmTokenHint: "From z.ai developer console",
  glmTokenPlaceholder: "(token)",
  glmRegionLabel: "Region",
  glmRegionGlobal: "Global (z.ai)",
  glmRegionChina: "China (bigmodel.cn)"
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
    traySummaryMode: "菜单栏数值",
    summaryHidden: "隐藏",
    traySummaryLowest: "最低余量",
    traySummary5h: "5 小时限额",
    traySummaryWeek: "每周限额",
    traySummaryMulti: "多维度",
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
    burnRateOnTrack: "进度正常",
    burnRateBehind: "消耗偏快",
    burnRateFarBehind: "消耗过快",
    burnRateRunsOutInFormat: "约 {value} 后用尽",
    resetsInFormat: "{value}后重置",
    resetDue: "即将重置",
    minuteShort: " 分钟",
    hourShort: " 小时",
    dayShort: " 天",
    weekShort: "周",
    weeklyQuotaLabel: "每周限额",
    dailyQuotaLabel: "每日限额",
    monthlyQuotaLabel: "每月限额",
    menubarService: "菜单栏服务",
    menubarServiceAuto: "自动",
    serviceOrder: "面板顺序",
    claudeCodeLabel: "Claude Code",
    codexLabel: "Codex",
    claudeCodeNotConnected: "Claude Code 未连接。请安装 Claude Code CLI 并登录。",
    networkProxy: "网络代理",
    networkProxyMode: "代理模式",
    networkProxyModeSystem: "系统代理",
    networkProxyModeManual: "手动输入",
    networkProxyModeOff: "不使用代理",
    networkProxyUrl: "代理地址",
    networkProxyUrlHint: "请输入完整 URL，例如 http://127.0.0.1:7890 或 socks5://127.0.0.1:1080",
    networkProxyUrlInvalid: "请先填写完整代理 URL 再保存。",
    claudeCodeUsageInfoTitle: "Claude Code 查询",
    claudeCodeUsageInfoBody:
      "程序会使用本机现有的 Claude Code 登录凭证。\nClaude Code 登录凭证仅用于向 Claude 官方接口查询额度状态。\n程序不会存储或修改该凭证，也不会主动将其发送到 AIUsage 或其他非官方接口。",
    claudeCodeUsageEyebrow: "Claude Code 查询",
    claudeCodeUsageEnabledLabel: "启用",
    claudeCodeUsageEnabledAriaLabel: "启用 Claude Code 查询",
    claudeCodeUsageEnabledHint: "",
    claudeCodeUsageDisclosureTitle: "Claude Code 查询",
    claudeCodeUsageDisclosureBody:
      "程序会使用本机现有的 Claude Code 登录凭证。\nClaude Code 登录凭证仅用于向 Claude 官方接口查询额度状态。\n程序不会存储或修改该凭证，也不会主动将其发送到 AIUsage 或其他非官方接口。",
    claudeCodeUsageDisclosureButton: "我知道了",
    claudeCodeUsageRefreshingTitle: "正在查询 Claude Code 额度",
    claudeCodeUsageRefreshingBody: "AIUsage 正在使用你本机现有的 Claude Code 登录凭证刷新额度状态。",
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
    claudeCodeNotConnectedTitle: "未连接",
    claudeCodeNotConnectedBody: "请先安装 Claude Code CLI 并登录，安装后再回到这里完成连接。",
    tokenNotConfiguredTitle: "未配置 Token",
    tokenNotConfiguredBody: "请在设置中输入 API Token 以连接此服务。",
    refreshingGenericTitle: "正在刷新额度",
    refreshingGenericBody: "正在检查用量状态...",
    serviceSignedOutTitle: "需要先登录",
    serviceSignedOutBody: "CLI 已安装，但当前没有可读取的登录会话。",
    serviceDisconnectedTitle: "暂时无法连接",
    serviceDisconnectedBody: "应用还无法读取到实时会话，请前往设置检查连接状态。",
    statusSessionRecoveryTitle: "会话恢复中",
    statusSessionRecoveryBody: "会话恢复中，打开对应 CLI 后通常会自动恢复。",
    statusRateLimitedTitle: "请求限流",
    statusRateLimitedBody: "已暂停自动刷新，请稍后手动重试。",
    statusAccessDeniedTitle: "访问被拒绝",
    statusAccessDeniedBody: "已暂停自动刷新，请手动重试。如果问题持续，请检查代理或账户设置。",
    statusProxyInvalidTitle: "代理无效",
    statusProxyInvalidBody: "请填写完整代理 URL，或切回系统代理检测。",
    statusTemporarilyUnavailableTitle: "暂时不可用",
    statusTemporarilyUnavailableBody: "服务暂时不可用，下次刷新时可能恢复。",
    statusNoDataTitle: "暂无数据",
    statusNoDataBody: "服务已连接，但尚无可用的额度数据。",
    statusLow: "偏低",
    statusCritical: "紧张",
    reorderHandle: "拖动排序",
    codexCompactLabel: "Codex",
    claudeCodeCompactLabel: "Claude",
    promotionNoneKnown: "当前无优惠活动",
    promotionCompactStatusActiveWindow: "优惠中",
    promotionCompactStatusActiveGeneral: "优惠中",
    promotionCompactStatusRestrictedWindow: "更少额度",
    promotionCompactStatusInactiveWindow: "未命中",
    promotionCompactStatusEligibilityUnknown: "待确认",
    promotionCompactStatusNone: "无优惠",
    promotionStatusActiveWindow: "正在优惠时段",
    promotionStatusActiveGeneral: "正在优惠时段",
    promotionStatusRestrictedWindow: "高峰时段更少额度",
    promotionStatusInactiveWindow: "不在优惠时段",
    promotionStatusEligibilityUnknown: "优惠资格待确认",
    promotionStatusNone: "无优惠活动",
    promotionDetailContinuous: "全天优惠",
    promotionDetailLocalWindowTemplate: "工作日 {range} ({timeZone}) 之外",
    promotionDetailLocalActiveWindowTemplate: "工作日 {range} ({timeZone})",
    promotionTriggerAria: "预览全部促销状态",
    promotionPopoverLabel: "全部促销状态",
    kimiCodeSectionTitle: "Kimi Code 用量",
    kimiCodeSectionBody: "显示 Kimi Code 用量配额。需要从 Kimi Code 控制台获取 API Token。",
    kimiCodeToggleAriaLabel: "启用 Kimi Code 用量显示",
    kimiCodeTokenLabel: "API Token",
    kimiCodeTokenHint: "来自 kimi.com/code/console 或 ~/.kimi/config.toml",
    kimiCodeTokenPlaceholder: "sk-...",
    glmSectionTitle: "GLM 编程套餐用量",
    glmSectionBody: "显示 GLM 编程套餐用量配额。需要从开发者控制台获取 API Token。",
    glmToggleAriaLabel: "启用 GLM 编程套餐用量显示",
    glmTokenLabel: "API Token",
    glmTokenHint: "来自 z.ai 开发者控制台",
    glmTokenPlaceholder: "(token)",
    glmRegionLabel: "区域",
    glmRegionGlobal: "国际 (z.ai)",
    glmRegionChina: "国内 (bigmodel.cn)"
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

export const getPlaceholderCopy = (
  copy: CopyTree,
  status: SnapshotStatus,
  serviceId?: string
) => {
  switch (status.kind) {
    case "CliNotFound":
      return { title: copy.serviceNotInstalledTitle, body: copy.serviceNotInstalledBody };
    case "NotLoggedIn":
      return { title: copy.serviceSignedOutTitle, body: copy.serviceSignedOutBody };
    case "NoCredentials": {
      if (serviceId === "kimi-code" || serviceId === "glm-coding") {
        return { title: copy.tokenNotConfiguredTitle, body: copy.tokenNotConfiguredBody };
      }
      return { title: copy.claudeCodeNotConnectedTitle, body: copy.claudeCodeNotConnectedBody };
    }
    case "SessionRecovery":
      return { title: copy.statusSessionRecoveryTitle, body: copy.statusSessionRecoveryBody };
    case "RateLimited":
      return { title: copy.statusRateLimitedTitle, body: copy.statusRateLimitedBody };
    case "AccessDenied":
      return { title: copy.statusAccessDeniedTitle, body: copy.statusAccessDeniedBody };
    case "ProxyInvalid":
      return { title: copy.statusProxyInvalidTitle, body: copy.statusProxyInvalidBody };
    case "TemporarilyUnavailable":
      return { title: copy.statusTemporarilyUnavailableTitle, body: copy.statusTemporarilyUnavailableBody };
    case "NoData":
      return { title: copy.statusNoDataTitle, body: copy.statusNoDataBody };
    case "Disabled":
      return { title: copy.statusNoDataTitle, body: copy.statusNoDataBody };
    case "Fresh":
    default:
      return { title: copy.serviceDisconnectedTitle, body: copy.serviceDisconnectedBody };
  }
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
 * Localize a raw reset timestamp or legacy backend-generated reset hint.
 */
const formatResetValuePart = (value: number | string, unit: string) => `${value}${unit}`;

const formatPreciseResetValue = (copy: CopyTree, totalMinutes: number) => {
  if (totalMinutes < 60) {
    return formatResetValuePart(totalMinutes, copy.minuteShort);
  }

  if (totalMinutes < 1_440) {
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${formatResetValuePart(hours, copy.hourShort)} ${formatResetValuePart(String(minutes).padStart(2, "0"), copy.minuteShort)}`;
  }

  const totalHours = Math.ceil(totalMinutes / 60);
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;
  return `${formatResetValuePart(days, copy.dayShort)} ${formatResetValuePart(String(hours).padStart(2, "0"), copy.hourShort)}`;
};

const formatCompactDurationValue = (copy: CopyTree, totalMinutes: number) => {
  if (totalMinutes < 60) {
    return formatResetValuePart(totalMinutes, copy.minuteShort);
  }

  if (totalMinutes < 1_440) {
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${formatResetValuePart(hours, copy.hourShort)} ${formatResetValuePart(String(minutes).padStart(2, "0"), copy.minuteShort)}`;
  }

  const totalHours = Math.ceil(totalMinutes / 60);
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;
  return `${formatResetValuePart(days, copy.dayShort)} ${formatResetValuePart(String(hours).padStart(2, "0"), copy.hourShort)}`;
};

export const localizeResetHint = (
  copy: CopyTree,
  backendValue?: string | null,
  nowMs = Date.now()
): string | undefined => {
  if (!backendValue) return undefined;

  if (backendValue === "Reset due") return copy.resetDue;

  const parsed = /^\d{4}-\d{2}-\d{2}T/.test(backendValue) ? Date.parse(backendValue) : Number.NaN;
  if (!Number.isNaN(parsed)) {
    const diffMs = parsed - nowMs;
    if (diffMs <= 0) return copy.resetDue;

    const totalMinutes = Math.max(1, Math.ceil(diffMs / 60_000));
    return copy.resetsInFormat.replace("{value}", formatPreciseResetValue(copy, totalMinutes));
  }

  const match = backendValue.match(/^Resets in (\d+)(m|h|d)$/);
  if (!match) {
    return backendValue;
  }

  const [, num, unit] = match;
  const unitMap: Record<string, string> = {
    m: copy.minuteShort,
    h: copy.hourShort,
    d: copy.dayShort,
  };
  return copy.resetsInFormat.replace("{value}", `${num}${unitMap[unit] ?? unit}`);
};

export const localizeBurnRatePace = (
  copy: CopyTree,
  pace: "on-track" | "behind" | "far-behind"
) => {
  switch (pace) {
    case "on-track":
      return copy.burnRateOnTrack;
    case "behind":
      return copy.burnRateBehind;
    case "far-behind":
      return copy.burnRateFarBehind;
  }
};

export const localizeBurnRateSecondaryLine = (
  copy: CopyTree,
  burnRate: { willLastUntilReset: boolean; depletionEtaMs: number | null }
) => {
  if (burnRate.willLastUntilReset) {
    return undefined;
  }

  const totalMinutes = Math.max(1, Math.ceil((burnRate.depletionEtaMs ?? 0) / 60_000));
  return copy.burnRateRunsOutInFormat.replace(
    "{value}",
    formatCompactDurationValue(copy, totalMinutes)
  );
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

export const getCompactServiceLabel = (copy: CopyTree, serviceId: string) => {
  if (serviceId === "claude-code") {
    return copy.claudeCodeCompactLabel;
  }
  if (serviceId === "codex") {
    return copy.codexCompactLabel;
  }
  return serviceId;
};

export const getPromotionStatusLabel = (copy: CopyTree, status: PromotionServiceStatus) => {
  switch (status) {
    case "restricted-window":
      return copy.promotionStatusRestrictedWindow;
    case "active-window":
      return copy.promotionStatusActiveWindow;
    case "active-general":
      return copy.promotionStatusActiveGeneral;
    case "inactive-window":
      return copy.promotionStatusInactiveWindow;
    case "eligibility-unknown":
      return copy.promotionStatusEligibilityUnknown;
    default:
      return copy.promotionStatusNone;
  }
};

export const getPromotionCompactStatusLabel = (copy: CopyTree, status: PromotionServiceStatus) => {
  switch (status) {
    case "restricted-window":
      return copy.promotionCompactStatusRestrictedWindow;
    case "active-window":
      return copy.promotionCompactStatusActiveWindow;
    case "active-general":
      return copy.promotionCompactStatusActiveGeneral;
    case "inactive-window":
      return copy.promotionCompactStatusInactiveWindow;
    case "eligibility-unknown":
      return copy.promotionCompactStatusEligibilityUnknown;
    default:
      return copy.promotionCompactStatusNone;
  }
};

export const formatPromotionServiceDecision = (
  copy: CopyTree,
  serviceDecision: PromotionServiceDecision
) =>
  `${serviceDecision.serviceName} ${getPromotionStatusLabel(copy, serviceDecision.status)}${
    serviceDecision.benefitLabel ? ` ${serviceDecision.benefitLabel}` : ""
  }`;

export const formatPromotionDetailTiming = (
  copy: CopyTree,
  detailTiming: PromotionDetailTiming
) => {
  if (detailTiming.mode === "continuous") {
    return copy.promotionDetailContinuous;
  }

  if (detailTiming.mode === "local-window") {
    const detailLine = copy.promotionDetailLocalWindowTemplate
      .replace("{range}", detailTiming.localWindowRangeLabel)
      .replace("{timeZone}", detailTiming.localTimeZoneLabel);
    return [detailTiming.dateRangeLabel, detailLine].filter(Boolean).join(" · ").replace(/\s+/g, " ").trim();
  }

  if (detailTiming.mode === "local-active-window") {
    const detailLine = copy.promotionDetailLocalActiveWindowTemplate
      .replace("{range}", detailTiming.localWindowRangeLabel)
      .replace("{timeZone}", detailTiming.localTimeZoneLabel);
    return [detailTiming.dateRangeLabel, detailLine].filter(Boolean).join(" · ").replace(/\s+/g, " ").trim();
  }

  return "";
};

export const formatPromotionPopoverLine = (
  copy: CopyTree,
  promotionDecision: PromotionDisplayDecision
) => {
  if (promotionDecision.fallbackState === "none" || promotionDecision.allServices.length === 0) {
    return copy.promotionNoneKnown;
  }

  return promotionDecision.allServices
    .map((serviceDecision) => formatPromotionServiceDecision(copy, serviceDecision))
    .join(" · ");
};

export const getPromotionTriggerLabel = (
  copy: CopyTree,
  overlayState: PromotionOverlayState
) => (overlayState === "pinned" ? `${copy.promotionTriggerAria} (${copy.promotionPopoverLabel})` : copy.promotionTriggerAria);

export const getPromotionPopoverLabel = (copy: CopyTree) => copy.promotionPopoverLabel;

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
