import { render, screen } from "@testing-library/react";
import { AppStateContext, type AppStateValue } from "../shared/appState";
import { PanelView } from "./PanelView";
import { createDemoPanelState } from "../../features/demo-services/demoData";
import { defaultPreferences } from "../../features/preferences/defaultPreferences";
import type { CodexPanelState } from "../../lib/tauri/contracts";

const createState = (panelState: CodexPanelState = createDemoPanelState()): AppStateValue => ({
  panelState,
  claudeCodePanelState: null,
  preferences: defaultPreferences,
  notificationResult: null,
  currentView: "panel",
  isLoading: false,
  isRefreshing: false,
  error: null,
  refreshPanel: vi.fn(async () => {}),
  savePreferences: vi.fn(async () => null),
  sendTestNotification: vi.fn(async () => null),
  setAutostart: vi.fn(async () => null),
  openSettings: vi.fn(),
  closeSettings: vi.fn()
});

describe("PanelView", () => {
  it("renders codex service cards", () => {
    const state = createState();
    const { container } = render(
      <AppStateContext.Provider value={state}>
        <PanelView />
      </AppStateContext.Provider>
    );

    expect(screen.queryByText(/托盘摘要预览:/)).not.toBeInTheDocument();
    expect(screen.queryByText(/同步状态:/)).not.toBeInTheDocument();
    expect(screen.queryByText(/数据来源:/)).not.toBeInTheDocument();
    expect(screen.queryByText("上次刷新:")).not.toBeInTheDocument();
    expect(container.querySelector("section")?.className).toContain("gap-4");
  });

  it("renders pending sync messaging explicitly", () => {
    const state = createState({
      ...createDemoPanelState(),
      snapshotState: "pending",
      statusMessage: "Connect a local Codex session to sync live limits.",
      items: []
    });

    render(
      <AppStateContext.Provider value={state}>
        <PanelView />
      </AppStateContext.Provider>
    );

    expect(screen.queryByText("等待同步")).not.toBeInTheDocument();
    expect(screen.getByText("请确保本地 Codex CLI 会话可读取，以便同步真实额度。")).toBeInTheDocument();
  });

  it("shows a distinct paused message for claude code access denial", () => {
    const state = createState();
    state.claudeCodePanelState = {
      ...createDemoPanelState(),
      snapshotState: "failed",
      statusMessage:
        "Claude Code access was denied. Automatic refresh is paused until you retry manually or update proxy settings.",
      items: []
    };

    render(
      <AppStateContext.Provider value={state}>
        <PanelView />
      </AppStateContext.Provider>
    );

    expect(
      screen.getByText("Claude Code 访问被拒绝，已暂停自动刷新。请手动重试或更新代理设置后再继续。")
    ).toBeInTheDocument();
  });

  it("shows a distinct rate limited message for claude code", () => {
    const state = createState();
    state.claudeCodePanelState = {
      ...createDemoPanelState(),
      snapshotState: "stale",
      statusMessage:
        "Claude Code rate limited the request. Automatic refresh is paused for about 30 minutes; no cached quota is available yet.",
      items: []
    };

    render(
      <AppStateContext.Provider value={state}>
        <PanelView />
      </AppStateContext.Provider>
    );

    expect(
      screen.getByText("Claude Code 请求已被限流，当前已暂停自动刷新；请稍后再手动重试。")
    ).toBeInTheDocument();
  });

  it("shows one global refresh label when service timestamps are aligned", () => {
    const now = new Date().toISOString();
    const state = createState({
      ...createDemoPanelState(),
      items: createDemoPanelState().items.map((item) => ({ ...item, lastRefreshedAt: now }))
    });
    state.claudeCodePanelState = {
      ...createDemoPanelState(),
      items: [
        {
          ...createDemoPanelState().items[0]!,
          serviceId: "claude-code",
          serviceName: "Claude Code",
          lastRefreshedAt: now
        }
      ]
    };
    state.preferences = {
      ...defaultPreferences,
      serviceOrder: ["codex", "claude-code"]
    };

    render(
      <AppStateContext.Provider value={state}>
        <PanelView />
      </AppStateContext.Provider>
    );

    expect(screen.getByText(/上次刷新:/)).toBeInTheDocument();
  });
});
