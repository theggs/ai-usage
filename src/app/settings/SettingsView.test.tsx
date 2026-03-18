import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AppStateContext, type AppStateValue } from "../shared/appState";
import { SettingsView } from "./SettingsView";
import { createDemoPanelState } from "../../features/demo-services/demoData";
import { defaultPreferences } from "../../features/preferences/defaultPreferences";

const state: AppStateValue = {
  panelState: createDemoPanelState(),
  preferences: defaultPreferences,
  notificationResult: null,
  currentView: "settings",
  isLoading: false,
  error: null,
  refreshPanel: vi.fn(async () => {}),
  savePreferences: vi.fn(async () => {}),
  sendTestNotification: vi.fn(async () => {}),
  setAutostart: vi.fn(async () => {}),
  openSettings: vi.fn(),
  closeSettings: vi.fn()
};

describe("SettingsView", () => {
  it("submits updated preferences", async () => {
    render(
      <AppStateContext.Provider value={state}>
        <SettingsView />
      </AppStateContext.Provider>
    );

    await userEvent.clear(screen.getByRole("spinbutton"));
    await userEvent.type(screen.getByRole("spinbutton"), "30");
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "托盘摘要规则" }), "window-week");
    await userEvent.click(screen.getByRole("button", { name: "保存设置" }));
    expect(state.savePreferences).toHaveBeenCalled();
    expect(state.savePreferences).toHaveBeenCalledWith(expect.objectContaining({ traySummaryMode: "window-week" }));
  });

  it("shows local Codex CLI guidance instead of account fields", async () => {
    render(
      <AppStateContext.Provider value={state}>
        <SettingsView />
      </AppStateContext.Provider>
    );

    expect(screen.getByText("本迭代只从本地 Codex CLI 会话读取真实额度，不需要手动录入账户或凭证。")).toBeInTheDocument();
    expect(screen.queryByText("新增账户")).not.toBeInTheDocument();
  });

  it("shows the active local Codex session hint", () => {
    render(
      <AppStateContext.Provider
        value={{
          ...state,
          panelState: {
            ...createDemoPanelState(),
            activeSession: {
              sessionId: "session",
              sessionLabel: "Local Codex CLI",
              connectionState: "connected",
              lastCheckedAt: new Date().toISOString(),
              source: "fallback-client"
            }
          }
        }}
      >
        <SettingsView />
      </AppStateContext.Provider>
    );

    expect(screen.getByText("Local Codex CLI")).toBeInTheDocument();
  });
});
