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
  summaryHidden: string;
};

const baseCopy: CopyTree = {
  title: "AIUsage",
  subtitle: "Desktop demo panel",
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
  demoConfiguration: "Demo configuration only. No real credentials required.",
  saved: "Demo settings saved",
  trayPreview: "Tray preview",
  summaryHidden: "Hidden"
};

const localeCopy: Record<UserPreferences["language"], Partial<CopyTree>> = {
  "zh-CN": {
    title: "AIUsage",
    subtitle: "桌面演示面板",
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
    demoConfiguration: "当前为演示配置，无需真实凭证。",
    saved: "已保存演示设置",
    trayPreview: "托盘摘要预览",
    summaryHidden: "隐藏"
  }
  ,
  "en-US": baseCopy
};

export const resolveCopyTree = (overrides?: Partial<CopyTree>): CopyTree => ({
  ...baseCopy,
  ...(overrides ?? {})
});

export const getCopy = (language: UserPreferences["language"]) =>
  resolveCopyTree(localeCopy[language] ?? localeCopy["en-US"]);
