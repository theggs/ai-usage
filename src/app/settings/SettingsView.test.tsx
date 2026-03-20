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
  isRefreshing: false,
  error: null,
  refreshPanel: vi.fn(async () => {}),
  savePreferences: vi.fn(async (patch) => ({ ...defaultPreferences, ...patch, lastSavedAt: new Date().toISOString() })),
  sendTestNotification: vi.fn(async () => ({
    notificationId: "notification",
    triggeredAt: new Date().toISOString(),
    result: "sent",
    messagePreview: "preview"
  })),
  setAutostart: vi.fn(async (enabled) => ({ ...defaultPreferences, autostartEnabled: enabled, lastSavedAt: new Date().toISOString() })),
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
    await userEvent.click(screen.getByRole("button", { name: "保存偏好" }));
    expect(state.savePreferences).toHaveBeenCalled();
    expect(state.savePreferences).toHaveBeenCalledWith(expect.objectContaining({ traySummaryMode: "window-week" }));
    expect(screen.getByText("设置已保存")).toBeInTheDocument();
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

  it("uses localized settings labels in Chinese mode", () => {
    render(
      <AppStateContext.Provider value={state}>
        <SettingsView />
      </AppStateContext.Provider>
    );

    expect(screen.getByText("偏好设置")).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "语言" })).toBeInTheDocument();
    expect(screen.getByRole("switch", { name: "开机自启" })).toBeInTheDocument();
    expect(screen.getByText("通知测试")).toBeInTheDocument();
  });

  it("shows local notification feedback near the action area", async () => {
    render(
      <AppStateContext.Provider value={state}>
        <SettingsView />
      </AppStateContext.Provider>
    );

    await userEvent.click(screen.getByRole("button", { name: "发送测试通知" }));
    expect(screen.getByText("测试通知已发送")).toBeInTheDocument();
  });
});
