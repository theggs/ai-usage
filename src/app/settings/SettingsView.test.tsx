import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AppStateContext, type AppStateValue } from "../shared/appState";
import { SettingsView } from "./SettingsView";
import { createDemoPanelState } from "../../features/demo-services/demoData";
import { defaultPreferences } from "../../features/preferences/defaultPreferences";

const state: AppStateValue = {
  panelState: createDemoPanelState(),
  claudeCodePanelState: null,
  preferences: defaultPreferences,
  notificationResult: null,
  currentView: "settings",
  isLoading: false,
  isRefreshing: false,
  isE2EMode: false,
  error: null,
  refreshPanel: vi.fn(async () => {}),
  savePreferences: vi.fn(async (patch) => ({ ...defaultPreferences, ...patch, lastSavedAt: new Date().toISOString() })),
  sendTestNotification: vi.fn(async () => ({
    notificationId: "notification",
    triggeredAt: new Date().toISOString(),
    result: "sent" as const,
    messagePreview: "preview"
  })),
  setAutostart: vi.fn(async (enabled) => ({ ...defaultPreferences, autostartEnabled: enabled, lastSavedAt: new Date().toISOString() })),
  openSettings: vi.fn(),
  closeSettings: vi.fn()
};

describe("SettingsView", () => {
  it("applies non-proxy preferences immediately", async () => {
    render(
      <AppStateContext.Provider value={state}>
        <SettingsView />
      </AppStateContext.Provider>
    );

    await userEvent.selectOptions(screen.getByRole("combobox", { name: "托盘摘要规则" }), "window-week");
    expect(state.savePreferences).toHaveBeenCalled();
    expect(state.savePreferences).toHaveBeenCalledWith(expect.objectContaining({ traySummaryMode: "window-week" }));
    expect(screen.getByText("设置已保存")).toBeInTheDocument();
  });

  it("does not show account fields", async () => {
    render(
      <AppStateContext.Provider value={state}>
        <SettingsView />
      </AppStateContext.Provider>
    );

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

  it("uses grouped localized settings labels in Chinese mode", () => {
    render(
      <AppStateContext.Provider value={state}>
        <SettingsView />
      </AppStateContext.Provider>
    );

    expect(screen.getByText("通用")).toBeInTheDocument();
    expect(screen.getByText("显示")).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "托盘摘要规则" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "菜单栏服务" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "语言" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "代理模式" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "发送测试通知" })).not.toBeInTheDocument();
  });

  it("shows all service status cards instead of codex-only state", async () => {
    render(
      <AppStateContext.Provider
        value={{
          ...state,
          claudeCodePanelState: {
            ...createDemoPanelState(),
            items: [],
            snapshotState: "stale",
            statusMessage: "Claude Code session is being restored. Open Claude Code to restore the session."
          }
        }}
      >
        <SettingsView />
      </AppStateContext.Provider>
    );

    expect(screen.getAllByText("Codex").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Claude Code").length).toBeGreaterThan(0);
  });

  it("keeps high-frequency display controls ahead of general settings", () => {
    render(
      <AppStateContext.Provider value={state}>
        <SettingsView />
      </AppStateContext.Provider>
    );

    const traySummary = screen.getByRole("combobox", { name: "托盘摘要规则" });
    const menubarService = screen.getByRole("combobox", { name: "菜单栏服务" });
    const language = screen.getByRole("combobox", { name: "语言" });

    expect(
      traySummary.compareDocumentPosition(language) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
    expect(
      menubarService.compareDocumentPosition(language) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
    expect(screen.queryByRole("button", { name: "发送测试通知" })).not.toBeInTheDocument();
  });

  it("shows manual proxy url input and blocks invalid saves", async () => {
    render(
      <AppStateContext.Provider value={state}>
        <SettingsView />
      </AppStateContext.Provider>
    );

    await userEvent.selectOptions(screen.getByRole("combobox", { name: "代理模式" }), "manual");
    expect(screen.getByRole("textbox", { name: "代理地址" })).toBeInTheDocument();

    await userEvent.type(screen.getByRole("textbox", { name: "代理地址" }), "127.0.0.1:7890");
    await userEvent.click(screen.getByRole("button", { name: "应用" }));

    expect(screen.getByText("请先填写完整代理 URL 再保存。")).toBeInTheDocument();
  });

  it("shows neutral apply button copy", () => {
    render(
      <AppStateContext.Provider value={state}>
        <SettingsView />
      </AppStateContext.Provider>
    );

    expect(screen.getByRole("button", { name: "应用" })).toBeInTheDocument();
  });

  it("uses stronger section spacing rhythm and only highlights apply when proxy draft is dirty", async () => {
    render(
      <AppStateContext.Provider value={state}>
        <SettingsView />
      </AppStateContext.Provider>
    );

    const displaySection = screen.getByText("显示").closest("section");
    expect(displaySection?.className).toContain("preference-section");
    expect(displaySection?.className).toContain("gap-2");
    expect(displaySection?.className).toContain("pt-4");

    const applyButton = screen.getByRole("button", { name: "应用" });
    expect(applyButton.className).toContain("border-slate-200 bg-slate-50");

    await userEvent.selectOptions(screen.getByRole("combobox", { name: "代理模式" }), "manual");
    await userEvent.type(screen.getByRole("textbox", { name: "代理地址" }), "http://127.0.0.1:7890");

    expect(screen.getByRole("button", { name: "应用" }).className).toContain("border-emerald-200 bg-emerald-50");
  });

  it("disables drag affordance when only one service is available", () => {
    render(
      <AppStateContext.Provider
        value={{
          ...state,
          preferences: {
            ...defaultPreferences,
            serviceOrder: ["codex"]
          }
        }}
      >
        <SettingsView />
      </AppStateContext.Provider>
    );

    const serviceRow = screen.getByLabelText("Codex");
    expect(serviceRow).toBeInTheDocument();
  });

  it("persists pointer reordering immediately and previews the new order", async () => {
    const savePreferences = vi.fn(async (patch) => ({
      ...defaultPreferences,
      ...patch,
      lastSavedAt: new Date().toISOString()
    }));
    render(
      <AppStateContext.Provider
        value={{
          ...state,
          savePreferences,
          preferences: {
            ...defaultPreferences,
            serviceOrder: ["codex", "claude-code"]
          }
        }}
      >
        <SettingsView />
      </AppStateContext.Provider>
    );

    const handles = screen.getAllByText("⋮⋮");
    fireEvent.pointerDown(handles[1]!);
    fireEvent.pointerEnter(screen.getByLabelText("Codex"));
    fireEvent.pointerUp(screen.getByLabelText("Codex"));

    await waitFor(() =>
      expect(savePreferences).toHaveBeenCalledWith(expect.objectContaining({ serviceOrder: ["claude-code", "codex"] }))
    );
    expect(screen.getAllByLabelText(/Codex|Claude Code/).map((node) => node.getAttribute("aria-label"))).toContain(
      "Claude Code"
    );
    expect(screen.getAllByLabelText(/Codex|Claude Code/).map((node) => node.getAttribute("aria-label"))).toContain(
      "Codex"
    );
    expect(screen.getByLabelText("Claude Code").compareDocumentPosition(screen.getByLabelText("Codex")) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("rolls back pointer reordering when persistence fails", async () => {
    const savePreferences = vi.fn(async () => null);
    render(
      <AppStateContext.Provider
        value={{
          ...state,
          savePreferences,
          preferences: {
            ...defaultPreferences,
            serviceOrder: ["codex", "claude-code"]
          }
        }}
      >
        <SettingsView />
      </AppStateContext.Provider>
    );

    const handles = screen.getAllByText("⋮⋮");
    fireEvent.pointerDown(handles[1]!);
    fireEvent.pointerEnter(screen.getByLabelText("Codex"));
    fireEvent.pointerUp(screen.getByLabelText("Codex"));

    await waitFor(() => expect(savePreferences).toHaveBeenCalled());
    expect(screen.getByLabelText("Codex").compareDocumentPosition(screen.getByLabelText("Claude Code")) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("renders an icon-only back button and header save status in the shell", async () => {
    vi.resetModules();

    let resolveSave!: (value: typeof defaultPreferences) => void;
    const savePromise = new Promise<typeof defaultPreferences>((resolve) => {
      resolveSave = resolve;
    });
    const persistPreferences = vi.fn(() => savePromise);

    vi.doMock("../../features/demo-services/panelController", () => ({
      loadPanelState: vi.fn(async () => createDemoPanelState()),
      refreshPanelState: vi.fn(async () => createDemoPanelState()),
      loadClaudeCodePanelState: vi.fn(async () => null),
      refreshClaudeCodePanelState: vi.fn(async () => null)
    }));
    vi.doMock("../../features/preferences/preferencesController", () => ({
      getPreferences: vi.fn(async () => defaultPreferences),
      persistPreferences,
      applyAutostart: vi.fn(async (enabled: boolean) => ({ ...defaultPreferences, autostartEnabled: enabled })),
      getCodexAccounts: vi.fn(async () => []),
      persistCodexAccount: vi.fn(),
      deleteCodexAccount: vi.fn(),
      applyCodexAccountEnabled: vi.fn()
    }));
    vi.doMock("../../features/notifications/notificationController", () => ({
      sendDemoNotification: vi.fn(async () => null)
    }));

    const { AppShell } = await import("../shell/AppShell");
    render(<AppShell />);

    await userEvent.click(await screen.findByRole("button", { name: "设置" }));
    expect(screen.getByRole("button", { name: "返回" })).toBeInTheDocument();
    expect(screen.queryByText(/^返回$/)).not.toBeInTheDocument();

    await userEvent.selectOptions(screen.getByRole("combobox", { name: "托盘摘要规则" }), "window-week");
    expect(screen.getByText("保存中...")).toBeInTheDocument();

    await act(async () => {
      resolveSave({
        ...defaultPreferences,
        traySummaryMode: "window-week",
        lastSavedAt: new Date().toISOString()
      });
      await savePromise;
    });

    expect(screen.getAllByText("已保存").length).toBeGreaterThan(0);

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 1300));
    });

    vi.resetModules();
    vi.unmock("../../features/demo-services/panelController");
    vi.unmock("../../features/preferences/preferencesController");
    vi.unmock("../../features/notifications/notificationController");
  });
});
