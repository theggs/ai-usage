import type { UserPreferences } from "../../lib/tauri/contracts";

export type CopyTree = {
  title: string;
  subtitle: string;
  settings: string;
  refresh: string;
  lastRefresh: string;
  demoTag: string;
  noData: string;
  save: string;
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
  snapshotFresh: string;
  snapshotPending: string;
  snapshotStale: string;
  snapshotEmpty: string;
  snapshotFailed: string;
  enabled: string;
};

const baseCopy: CopyTree = {
  title: "AIUsage",
  subtitle: "Codex usage limits",
  settings: "Settings",
  refresh: "Refresh",
  lastRefresh: "Last refresh",
  demoTag: "Demo data",
  noData: "No services available",
  save: "Save settings",
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
  snapshotFresh: "Live",
  snapshotPending: "Pending",
  snapshotStale: "Disconnected",
  snapshotEmpty: "Not setup",
  snapshotFailed: "Read failed",
  enabled: "Enabled"
};

const localeCopy: Record<UserPreferences["language"], Partial<CopyTree>> = {
  "zh-CN": {
    title: "AIUsage",
    subtitle: "Codex 额度面板",
    settings: "设置",
    refresh: "手动刷新",
    lastRefresh: "上次刷新",
    demoTag: "演示数据",
    noData: "暂无服务数据",
    save: "保存设置",
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
    snapshotFresh: "实时",
    snapshotPending: "等待同步",
    snapshotStale: "连接中断",
    snapshotEmpty: "未配置",
    snapshotFailed: "读取失败",
    enabled: "启用"
  }
  ,
  "en-US": baseCopy
};

export const resolveCopyTree = (overrides?: Partial<CopyTree>): CopyTree => ({
  ...baseCopy,
  ...(overrides ?? {})
});

export const getSnapshotTag = (copy: CopyTree, snapshotState?: string | null) => {
  switch (snapshotState) {
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
  switch (snapshotState) {
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
