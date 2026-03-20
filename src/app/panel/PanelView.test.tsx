import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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
  it("renders codex summary and allows refresh", async () => {
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
    expect(screen.getByRole("button", { name: "手动刷新" }).className).toContain("h-8");
    expect(screen.getByRole("button", { name: "设置" }).className).toContain("w-8");

    await userEvent.click(screen.getByRole("button", { name: "手动刷新" }));
    expect(state.refreshPanel).toHaveBeenCalled();
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

  it("disables refresh while a refresh is in progress", () => {
    const state = createState();
    state.isRefreshing = true;

    render(
      <AppStateContext.Provider value={state}>
        <PanelView />
      </AppStateContext.Provider>
    );

    expect(screen.getByRole("button", { name: "刷新中..." })).toBeDisabled();
  });
});
