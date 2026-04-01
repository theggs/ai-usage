import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AppStateContext, type AppStateValue } from "../shared/appState";
import { SettingsView } from "./SettingsView";
import { createDemoPanelState } from "../../features/demo-services/demoData";
import { defaultPreferences } from "../../features/preferences/defaultPreferences";

const createState = (overrides: Partial<AppStateValue> = {}): AppStateValue => ({
  providerStates: { codex: createDemoPanelState() },
  refreshingProviders: new Set(),
  preferences: {
    ...defaultPreferences,
    claudeCodeUsageEnabled: true,
    providerEnabled: { codex: true, "claude-code": true }
  },
  notificationResult: null,
  currentView: "settings",
  isLoading: false,
  isE2EMode: false,
  error: null,
  refreshPanel: vi.fn(async () => {}),
  savePreferences: vi.fn(async (patch) => ({
    ...defaultPreferences,
    claudeCodeUsageEnabled: true,
    providerEnabled: { codex: true, "claude-code": true },
    ...patch,
    lastSavedAt: new Date().toISOString()
  })),
  sendTestNotification: vi.fn(async () => ({
    notificationId: "notification",
    triggeredAt: new Date().toISOString(),
    result: "sent" as const,
    messagePreview: "preview"
  })),
  setAutostart: vi.fn(async (enabled) => ({
    ...defaultPreferences,
    claudeCodeUsageEnabled: true,
    providerEnabled: { codex: true, "claude-code": true },
    autostartEnabled: enabled,
    lastSavedAt: new Date().toISOString()
  })),
  openSettings: vi.fn(),
  closeSettings: vi.fn(),
  ...overrides
});

const renderSettings = (overrides: Partial<AppStateValue> = {}) => {
  const state = createState(overrides);
  render(
    <AppStateContext.Provider value={state}>
      <SettingsView />
    </AppStateContext.Provider>
  );
  return state;
};

describe("SettingsView", () => {
  it("renders the main settings card and a separate Claude Code query card", () => {
    renderSettings();

    expect(screen.queryByText("显示")).not.toBeInTheDocument();
    expect(screen.queryByText("通用")).not.toBeInTheDocument();
    expect(screen.queryByText("连接")).not.toBeInTheDocument();
    expect(screen.queryByText("状态")).not.toBeInTheDocument();

    expect(screen.getByRole("combobox", { name: "菜单栏数值" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "菜单栏服务" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "自动" })).toBeInTheDocument();
    expect(screen.getByLabelText("Codex")).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "语言" })).toBeInTheDocument();
    expect(screen.getByRole("switch", { name: "开机自启" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "刷新间隔" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "代理模式" })).toBeInTheDocument();
    expect(screen.getByText("Claude Code 查询")).toBeInTheDocument();
    expect(screen.getByRole("switch", { name: "启用 Claude Code 查询" })).toBeInTheDocument();

    const surfaces = document.querySelectorAll(".settings-surface");
    expect(surfaces).toHaveLength(4);
    expect(screen.getByRole("combobox", { name: "菜单栏数值" }).closest(".settings-surface")).toBe(
      surfaces[0]
    );
    expect(screen.getByText("Claude Code 查询").closest(".settings-surface")).toBe(surfaces[1]);
  });

  it("keeps standard settings rows in an inline two-column layout at shell width", () => {
    renderSettings();

    const traySummaryRow = screen.getByRole("combobox", { name: "菜单栏数值" }).closest("label");
    expect(traySummaryRow).toBeInTheDocument();
    expect(traySummaryRow?.className).toContain("grid-cols-[112px_minmax(0,1fr)]");
    expect(traySummaryRow?.className).not.toContain("md:grid-cols");

    const controlWrapper = screen.getByRole("combobox", { name: "菜单栏数值" }).parentElement;
    expect(controlWrapper?.className).toContain("justify-self-end");
    expect(controlWrapper?.className).toContain("max-w-[212px]");
  });

  it("keeps panel order and default proxy mode inline in the shared row layout", () => {
    renderSettings();

    const orderRow = screen.getByLabelText("Claude Code").closest("label");
    expect(orderRow?.className).toContain("grid-cols-[112px_minmax(0,1fr)]");

    const orderControl = orderRow?.lastElementChild as HTMLElement | null;
    expect(orderControl?.className).toContain("max-w-none");
    expect(orderControl?.className).toContain("w-full");

    const proxyRow = screen.getByRole("combobox", { name: "代理模式" }).closest("label");
    expect(proxyRow?.className).toContain("grid-cols-[112px_minmax(0,1fr)]");

    expect(screen.queryByText("可选 5 / 10 / 15 / 30 分钟")).not.toBeInTheDocument();
  });

  it("uses lighter control chrome and more compact service-order pills", () => {
    renderSettings();

    const traySummary = screen.getByRole("combobox", { name: "菜单栏数值" });
    expect(traySummary.className).toContain("rounded-xl");
    expect(traySummary.className).toContain("bg-slate-50/70");
    expect(traySummary.className).toContain("text-[15px]");

    const claudePill = screen.getByRole("button", { name: "Claude Code" });
    expect(claudePill.className).toContain("min-h-7");
    expect(claudePill.className).toContain("px-2");
    expect(claudePill.className).toContain("py-1");
    expect(claudePill.className).toContain("text-[13px]");
    expect(claudePill).toHaveAttribute("title", "Claude Code");
    expect(claudePill.querySelector("span:last-child")?.className).toContain("whitespace-nowrap");
    expect(claudePill).toHaveTextContent("Claude");
  });

  it("applies non-proxy preferences immediately and rolls back when persistence fails", async () => {
    const savePreferences = vi
      .fn()
      .mockResolvedValueOnce({
        ...defaultPreferences,
        traySummaryMode: "window-week",
        lastSavedAt: new Date().toISOString()
      })
      .mockResolvedValueOnce(null);

    renderSettings({ savePreferences });

    const traySummary = screen.getByRole("combobox", { name: "菜单栏数值" });
    await userEvent.selectOptions(traySummary, "window-week");
    await waitFor(() =>
      expect(savePreferences).toHaveBeenCalledWith(expect.objectContaining({ traySummaryMode: "window-week" }))
    );
    expect((traySummary as HTMLSelectElement).value).toBe("window-week");

    const language = screen.getByRole("combobox", { name: "语言" });
    await userEvent.selectOptions(language, "en-US");
    await waitFor(() => expect(savePreferences).toHaveBeenCalledTimes(2));
    expect((language as HTMLSelectElement).value).toBe("zh-CN");
  });

  it("toggles autostart immediately and rolls back when persistence fails", async () => {
    const setAutostart = vi.fn().mockResolvedValueOnce(null);
    renderSettings({ setAutostart });

    const toggle = screen.getByRole("switch", { name: "开机自启" });
    expect(toggle).toHaveAttribute("aria-checked", "true");

    await userEvent.click(toggle);

    await waitFor(() => expect(setAutostart).toHaveBeenCalledWith(false));
    expect(toggle).toHaveAttribute("aria-checked", "true");
  });

  it("renders panel order as wrapping pills and keeps drag disabled when only one service exists", () => {
    renderSettings({
      preferences: {
        ...defaultPreferences,
        claudeCodeUsageEnabled: false,
        providerEnabled: { codex: true, "claude-code": false },
        serviceOrder: ["codex"]
      }
    });

    const codexPill = screen.getByLabelText("Codex");
    expect(codexPill).toBeInTheDocument();
    expect(codexPill.className).toContain("cursor-default");

    const wrapContainer = codexPill.parentElement?.parentElement;
    expect(wrapContainer?.className).toContain("flex-nowrap");
  });

  it("hides Claude Code from menubar and panel order settings when usage is disabled", () => {
    renderSettings({
      preferences: {
        ...defaultPreferences,
        claudeCodeUsageEnabled: false,
        providerEnabled: { codex: true, "claude-code": false }
      }
    });

    expect(screen.queryByRole("option", { name: "Claude Code" })).not.toBeInTheDocument();
    expect(screen.getByRole("option", { name: "自动" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Claude Code")).not.toBeInTheDocument();
  });

  it("shows Claude Code options again when usage is enabled", () => {
    renderSettings({
      preferences: {
        ...defaultPreferences,
        claudeCodeUsageEnabled: true,
        providerEnabled: { codex: true, "claude-code": true }
      }
    });

    expect(screen.getByRole("option", { name: "Claude Code" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "自动" })).toBeInTheDocument();
    expect(screen.getByLabelText("Claude Code")).toBeInTheDocument();
  });

  it("persists auto as a valid menubar service selection", async () => {
    const savePreferences = vi.fn(async (patch) => ({
      ...defaultPreferences,
      claudeCodeUsageEnabled: true,
      menubarService: "auto",
      ...patch,
      lastSavedAt: new Date().toISOString()
    }));

    renderSettings({ savePreferences });

    await userEvent.selectOptions(screen.getByRole("combobox", { name: "菜单栏服务" }), "auto");

    await waitFor(() =>
      expect(savePreferences).toHaveBeenCalledWith(expect.objectContaining({ menubarService: "auto" }))
    );
    expect((screen.getByRole("combobox", { name: "菜单栏服务" }) as HTMLSelectElement).value).toBe("auto");
  });

  it("saves the Claude Code usage toggle directly without a confirm step", async () => {
    const savePreferences = vi.fn(async (patch) => ({
      ...defaultPreferences,
      ...patch,
      lastSavedAt: new Date().toISOString()
    }));
    renderSettings({
      savePreferences,
      preferences: {
        ...defaultPreferences,
        claudeCodeUsageEnabled: false,
        providerEnabled: { codex: true, "claude-code": false }
      }
    });

    await userEvent.click(screen.getByRole("switch", { name: "启用 Claude Code 查询" }));

    await waitFor(() =>
      expect(savePreferences).toHaveBeenCalledWith(
        expect.objectContaining({ providerEnabled: expect.objectContaining({ "claude-code": true }) })
      )
    );
  });

  it("renders the Claude Code disclosure row and toggle in English", () => {
    renderSettings({
      preferences: {
        ...defaultPreferences,
        language: "en-US",
        claudeCodeUsageEnabled: false,
        providerEnabled: { codex: true, "claude-code": false }
      }
    });

    expect(screen.getByText("Claude Code query")).toBeInTheDocument();
    expect(screen.getByRole("switch", { name: "Enable Claude Code query" })).toBeInTheDocument();
  });

  it("persists pointer reordering immediately", async () => {
    const savePreferences = vi.fn().mockResolvedValue({
      ...defaultPreferences,
      claudeCodeUsageEnabled: true,
      providerEnabled: { codex: true, "claude-code": true },
      serviceOrder: ["claude-code", "codex"],
      lastSavedAt: new Date().toISOString()
    });

    renderSettings({
      savePreferences,
      preferences: {
        ...defaultPreferences,
        claudeCodeUsageEnabled: true,
        providerEnabled: { codex: true, "claude-code": true },
        serviceOrder: ["codex", "claude-code"]
      }
    });

    const getPills = () => screen.getAllByRole("button").filter((node) => node.getAttribute("aria-label") === "Codex" || node.getAttribute("aria-label") === "Claude Code");

    const dragged = screen.getByLabelText("Claude Code");
    fireEvent.mouseDown(dragged, { clientX: 240, clientY: 200 });
    fireEvent.mouseEnter(screen.getByLabelText("Codex"));
    fireEvent.mouseUp(dragged);

    await waitFor(() =>
      expect(savePreferences).toHaveBeenCalledWith(expect.objectContaining({ serviceOrder: ["claude-code", "codex"] }))
    );
    expect(getPills()[0]).toHaveAttribute("aria-label", "Claude Code");
  });

  it("shows a floating drag pill until pointer release", () => {
    renderSettings({
      preferences: {
        ...defaultPreferences,
        claudeCodeUsageEnabled: true,
        providerEnabled: { codex: true, "claude-code": true },
        serviceOrder: ["codex", "claude-code"]
      }
    });

    const dragged = screen.getByLabelText("Claude Code");
    fireEvent.mouseDown(dragged, { clientX: 240, clientY: 200 });

    const dragGhost = screen.getByTestId("service-order-drag-overlay");
    expect(dragGhost).toHaveAttribute("aria-hidden", "true");
    expect(dragGhost).toHaveStyle({ position: "fixed" });

    fireEvent.mouseUp(dragged);
    expect(screen.queryByTestId("service-order-drag-overlay")).not.toBeInTheDocument();
  });

  it("ends an active drag when mouseup is received on the window", () => {
    renderSettings({
      preferences: {
        ...defaultPreferences,
        claudeCodeUsageEnabled: true,
        providerEnabled: { codex: true, "claude-code": true },
        serviceOrder: ["codex", "claude-code"]
      }
    });

    const dragged = screen.getByLabelText("Claude Code");
    fireEvent.mouseDown(dragged, { clientX: 240, clientY: 200, buttons: 1 });
    expect(screen.getByTestId("service-order-drag-overlay")).toBeInTheDocument();

    fireEvent.mouseUp(window, { buttons: 0 });
    expect(screen.queryByTestId("service-order-drag-overlay")).not.toBeInTheDocument();
  });

  it("cleans up a drag overlay if mouseup is missed but buttons are no longer pressed", async () => {
    renderSettings({
      preferences: {
        ...defaultPreferences,
        claudeCodeUsageEnabled: true,
        providerEnabled: { codex: true, "claude-code": true },
        serviceOrder: ["codex", "claude-code"]
      }
    });

    const dragged = screen.getByLabelText("Claude Code");
    fireEvent.mouseDown(dragged, { clientX: 240, clientY: 200, buttons: 1 });
    expect(screen.getByTestId("service-order-drag-overlay")).toBeInTheDocument();

    fireEvent.mouseMove(window, { clientX: 245, clientY: 205, buttons: 0 });
    await waitFor(() =>
      expect(screen.queryByTestId("service-order-drag-overlay")).not.toBeInTheDocument()
    );
  });

  it("rolls back pointer reordering when persistence fails", async () => {
    const savePreferences = vi.fn().mockResolvedValue(null);
    renderSettings({
      savePreferences,
      preferences: {
        ...defaultPreferences,
        claudeCodeUsageEnabled: true,
        providerEnabled: { codex: true, "claude-code": true },
        serviceOrder: ["codex", "claude-code"]
      }
    });

    const getPills = () => screen.getAllByRole("button").filter((node) => node.getAttribute("aria-label") === "Codex" || node.getAttribute("aria-label") === "Claude Code");

    const dragged = screen.getByLabelText("Claude Code");
    fireEvent.mouseDown(dragged, { clientX: 240, clientY: 200 });
    fireEvent.mouseEnter(screen.getByLabelText("Codex"));
    fireEvent.mouseUp(dragged);

    await waitFor(() => expect(savePreferences).toHaveBeenCalledTimes(1));
    expect(getPills()[0]).toHaveAttribute("aria-label", "Codex");
  });

  it("shows preset refresh interval options and persists numeric values", async () => {
    const savePreferences = vi.fn(async (patch) => ({
      ...defaultPreferences,
      ...patch,
      lastSavedAt: new Date().toISOString()
    }));
    renderSettings({ savePreferences });

    const refresh = screen.getByRole("combobox", { name: "刷新间隔" });
    expect(screen.getByRole("option", { name: "5 分钟" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "10 分钟" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "15 分钟" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "30 分钟" })).toBeInTheDocument();

    await userEvent.selectOptions(refresh, "30");
    await waitFor(() =>
      expect(savePreferences).toHaveBeenCalledWith(expect.objectContaining({ refreshIntervalMinutes: 30 }))
    );
  });

  it("auto-saves proxy mode changes, expands manual input, and keeps inline validation errors", async () => {
    const savePreferences = vi
      .fn()
      .mockResolvedValueOnce({
        ...defaultPreferences,
        networkProxyMode: "off",
        lastSavedAt: new Date().toISOString()
      })
      .mockResolvedValueOnce({
        ...defaultPreferences,
        networkProxyMode: "manual",
        lastSavedAt: new Date().toISOString()
      })
      .mockResolvedValueOnce({
        ...defaultPreferences,
        networkProxyMode: "manual",
        networkProxyUrl: "http://127.0.0.1:7890",
        lastSavedAt: new Date().toISOString()
      });

    renderSettings({ savePreferences });

    await userEvent.selectOptions(screen.getByRole("combobox", { name: "代理模式" }), "off");
    await waitFor(() =>
      expect(savePreferences).toHaveBeenCalledWith(expect.objectContaining({ networkProxyMode: "off" }))
    );

    await userEvent.selectOptions(screen.getByRole("combobox", { name: "代理模式" }), "manual");
    await waitFor(() =>
      expect(savePreferences).toHaveBeenCalledWith(expect.objectContaining({ networkProxyMode: "manual" }))
    );

    const manualProxyRow = screen.getByRole("textbox", { name: "代理地址" }).closest("label");
    expect(manualProxyRow?.className).not.toContain("grid-cols-[minmax(0,1fr)_minmax(168px,auto)]");

    const input = screen.getByRole("textbox", { name: "代理地址" });
    await userEvent.clear(input);
    await userEvent.type(input, "127.0.0.1:7890");
    fireEvent.blur(input);
    expect(screen.getByText("请先填写完整代理 URL 再保存。")).toBeInTheDocument();

    await userEvent.clear(input);
    await userEvent.type(input, "http://127.0.0.1:7890");
    fireEvent.blur(input);

    await waitFor(() =>
      expect(savePreferences).toHaveBeenCalledWith(expect.objectContaining({ networkProxyUrl: "http://127.0.0.1:7890" }))
    );
    expect(screen.queryByText("请先填写完整代理 URL 再保存。")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "应用" })).not.toBeInTheDocument();
  });

  it("removes the status section and debug information from the formal settings surface", () => {
    renderSettings({
      providerStates: {
        codex: createDemoPanelState(),
        "claude-code": {
          ...createDemoPanelState(),
          status: { kind: "SessionRecovery" },
          items: []
        }
      }
    });

    expect(screen.queryByText("数据来源")).not.toBeInTheDocument();
    expect(screen.queryByText("活跃会话")).not.toBeInTheDocument();
    expect(screen.queryByText("Local Codex CLI")).not.toBeInTheDocument();
  });

  it("renders an icon-only back button and header save status in the shell", async () => {
    vi.resetModules();

    let resolveSave!: (value: typeof defaultPreferences) => void;
    const savePromise = new Promise<typeof defaultPreferences>((resolve) => {
      resolveSave = resolve;
    });
    const persistPreferences = vi.fn(() => savePromise);

    vi.doMock("../../features/demo-services/panelController", () => ({
      loadProviderState: vi.fn(async () => createDemoPanelState()),
      refreshProviderState: vi.fn(async () => createDemoPanelState())
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

    await userEvent.selectOptions(screen.getByRole("combobox", { name: "菜单栏数值" }), "window-week");
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
