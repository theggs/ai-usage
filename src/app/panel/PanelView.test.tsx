import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AppStateContext, type AppStateValue } from "../shared/appState";
import { PanelView } from "./PanelView";
import { createDemoPanelState } from "../../features/demo-services/demoData";
import { defaultPreferences } from "../../features/preferences/defaultPreferences";
import type { CodexPanelState } from "../../lib/tauri/contracts";

const createState = (panelState: CodexPanelState = createDemoPanelState()): AppStateValue => ({
  panelState,
  preferences: defaultPreferences,
  notificationResult: null,
  currentView: "panel",
  isLoading: false,
  error: null,
  refreshPanel: vi.fn(async () => {}),
  savePreferences: vi.fn(async () => {}),
  sendTestNotification: vi.fn(async () => {}),
  setAutostart: vi.fn(async () => {}),
  openSettings: vi.fn(),
  closeSettings: vi.fn()
});

describe("PanelView", () => {
  it("renders codex summary and allows refresh", async () => {
    const state = createState();
    render(
      <AppStateContext.Provider value={state}>
        <PanelView />
      </AppStateContext.Provider>
    );

    expect(screen.getByText("AIUsage")).toBeInTheDocument();
    expect(screen.getByText("同步状态: 实时")).toBeInTheDocument();
    expect(screen.getByText("数据来源: fallback-client")).toBeInTheDocument();

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

    expect(screen.getAllByText("请确保本地 Codex CLI 会话可读取，以便同步真实额度。")).toHaveLength(2);
  });
});
