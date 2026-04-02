import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AppStateContext, type AppStateValue } from "../shared/appState";
import { PanelView } from "./PanelView";
import { createDemoPanelState } from "../../features/demo-services/demoData";
import { defaultPreferences } from "../../features/preferences/defaultPreferences";
import type { CodexPanelState } from "../../lib/tauri/contracts";

const createState = (panelState: CodexPanelState = createDemoPanelState()): AppStateValue & { claudeCodePanelState?: CodexPanelState | null } => ({
  providerStates: { codex: panelState },
  refreshingProviders: new Set(),
  preferences: {
    ...defaultPreferences,
    claudeCodeUsageEnabled: true,
    providerEnabled: { codex: true, "claude-code": true },
    onboardingDismissedAt: new Date().toISOString()
  },
  notificationResult: null,
  currentView: "panel",
  displayNowMs: Date.now(),
  isLoading: false,
  isE2EMode: false,
  error: null,
  refreshPanel: vi.fn(async () => {}),
  savePreferences: vi.fn(async () => null),
  sendTestNotification: vi.fn(async () => null),
  setAutostart: vi.fn(async () => null),
  openSettings: vi.fn(),
  closeSettings: vi.fn(),
  openAbout: vi.fn(),
  closeAbout: vi.fn()
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
      status: { kind: "NoData" },
      items: []
    });

    render(
      <AppStateContext.Provider value={state}>
        <PanelView />
      </AppStateContext.Provider>
    );

    expect(screen.queryByText("等待同步")).not.toBeInTheDocument();
    expect(screen.getByText("暂无数据")).toBeInTheDocument();
  });

  it("shows a distinct paused message for claude code access denial", () => {
    const state = createState();
    state.providerStates["claude-code"] = {
      ...createDemoPanelState(),
      status: { kind: "AccessDenied" },
      items: []
    };

    render(
      <AppStateContext.Provider value={state}>
        <PanelView />
      </AppStateContext.Provider>
    );

    expect(screen.getByText("前往设置")).toBeInTheDocument();
  });

  it("shows a distinct rate limited message for claude code", () => {
    const state = createState();
    state.providerStates["claude-code"] = {
      ...createDemoPanelState(),
      status: { kind: "RateLimited", retry_after_minutes: 30 },
      items: []
    };

    render(
      <AppStateContext.Provider value={state}>
        <PanelView />
      </AppStateContext.Provider>
    );

    expect(screen.getByText("请求限流")).toBeInTheDocument();
    expect(screen.getByText(/已暂停自动刷新，请稍后手动重试/)).toBeInTheDocument();
  });

  it("shows refresh time inside each service card even when timestamps are aligned", () => {
    const now = new Date().toISOString();
    const state = createState({
      ...createDemoPanelState(),
      items: createDemoPanelState().items.map((item) => ({ ...item, lastSuccessfulRefreshAt: now }))
    });
    state.providerStates["claude-code"] = {
      ...createDemoPanelState(),
      items: [
        {
          ...createDemoPanelState().items[0]!,
          serviceId: "claude-code",
          serviceName: "Claude Code",
          lastSuccessfulRefreshAt: now
        }
      ]
    };
    state.preferences = {
      ...defaultPreferences,
      claudeCodeUsageEnabled: true,
      providerEnabled: { codex: true, "claude-code": true },
      serviceOrder: ["codex", "claude-code"]
    };

    render(
      <AppStateContext.Provider value={state}>
        <PanelView />
      </AppStateContext.Provider>
    );

    const codexCard = screen.getByRole("heading", { name: "Codex" }).closest("article");
    const claudeCard = screen.getByRole("heading", { name: "Claude Code" }).closest("article");

    expect(within(codexCard!).getByText(/上次刷新:/)).toBeInTheDocument();
    expect(within(claudeCard!).getByText(/上次刷新:/)).toBeInTheDocument();
    expect(screen.getAllByText(/上次刷新:/)).toHaveLength(2);
  });

  it("shows onboarding before empty service placeholders on first run", () => {
    const state = createState({
      ...createDemoPanelState(),
      items: [],
      status: { kind: "CliNotFound" }
    });
    state.preferences = {
      ...defaultPreferences,
      claudeCodeUsageEnabled: false,
      onboardingDismissedAt: undefined
    };
    state.providerStates["claude-code"] = {
      ...createDemoPanelState(),
      items: [],
      status: { kind: "NoCredentials" }
    };

    render(
      <AppStateContext.Provider value={state}>
        <PanelView />
      </AppStateContext.Provider>
    );

    expect(screen.getByText("先连接第一个 AI 服务")).toBeInTheDocument();
    expect(screen.getByText("Claude Code 查询")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "前往设置" }).length).toBeGreaterThan(0);
  });

  it("dismisses the Claude disclosure card independently from the generic onboarding card", async () => {
    const savePreferences = vi.fn(async () => ({
      ...defaultPreferences,
      onboardingDismissedAt: undefined,
      claudeCodeDisclosureDismissedAt: new Date().toISOString()
    }));
    const state = createState({
      ...createDemoPanelState(),
      items: [],
      status: { kind: "CliNotFound" }
    });
    state.preferences = {
      ...defaultPreferences,
      claudeCodeUsageEnabled: false,
      onboardingDismissedAt: undefined,
      claudeCodeDisclosureDismissedAt: undefined
    };
    state.providerStates["claude-code"] = {
      ...createDemoPanelState(),
      items: [],
      status: { kind: "NoCredentials" }
    };
    state.savePreferences = savePreferences;

    render(
      <AppStateContext.Provider value={state}>
        <PanelView />
      </AppStateContext.Provider>
    );

    await userEvent.click(screen.getByRole("button", { name: "我知道了" }));

    expect(savePreferences).toHaveBeenCalledWith(
      expect.objectContaining({ claudeCodeDisclosureDismissedAt: expect.any(String) })
    );
    expect(screen.getByText("先连接第一个 AI 服务")).toBeInTheDocument();
  });

  it("renders the Claude disclosure card with English copy when the shell language is English", () => {
    const state = createState({
      ...createDemoPanelState(),
      items: [],
      status: { kind: "CliNotFound" }
    });
    state.preferences = {
      ...defaultPreferences,
      language: "en-US",
      claudeCodeUsageEnabled: false,
      onboardingDismissedAt: undefined,
      claudeCodeDisclosureDismissedAt: undefined
    };
    state.providerStates["claude-code"] = {
      ...createDemoPanelState(),
      items: [],
      status: { kind: "NoCredentials" }
    };

    render(
      <AppStateContext.Provider value={state}>
        <PanelView />
      </AppStateContext.Provider>
    );

    expect(screen.getByText("Claude Code query")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "I understand" })).toBeInTheDocument();
  });

  it("shows a dedicated Claude refreshing placeholder when enabled without visible quota yet", () => {
    const state = createState({
      ...createDemoPanelState(),
      items: [],
      status: { kind: "CliNotFound" }
    });
    state.preferences = {
      ...defaultPreferences,
      onboardingDismissedAt: new Date().toISOString(),
      claudeCodeUsageEnabled: true,
      providerEnabled: { codex: true, "claude-code": true }
    };
    state.providerStates["claude-code"] = {
      ...createDemoPanelState(),
      items: [],
      status: { kind: "NoCredentials" }
    };
    state.refreshingProviders = new Set(["claude-code"]);

    render(
      <AppStateContext.Provider value={state}>
        <PanelView />
      </AppStateContext.Provider>
    );

    expect(screen.getByText("正在查询 Claude Code 额度")).toBeInTheDocument();
  });

  it("keeps cached Claude Code cards hidden after the usage query is disabled", () => {
    const now = new Date().toISOString();
    const state = createState({
      ...createDemoPanelState(),
      items: [
        {
          ...createDemoPanelState().items[0]!,
          serviceId: "codex",
          serviceName: "Codex",
          lastSuccessfulRefreshAt: now
        }
      ]
    });
    state.preferences = {
      ...defaultPreferences,
      claudeCodeUsageEnabled: false,
      onboardingDismissedAt: new Date().toISOString()
    };
    state.providerStates["claude-code"] = {
      ...createDemoPanelState(),
      status: { kind: "SessionRecovery" },
      items: [
        {
          ...createDemoPanelState().items[0]!,
          serviceId: "claude-code",
          serviceName: "Claude Code",
          iconKey: "claude-code",
          lastSuccessfulRefreshAt: now
        }
      ]
    };

    render(
      <AppStateContext.Provider value={state}>
        <PanelView />
      </AppStateContext.Provider>
    );

    expect(screen.getByRole("heading", { name: "Codex" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Claude Code" })).not.toBeInTheDocument();
  });

  it("keeps panel order and visible content unchanged when menubar service is auto", () => {
    const codexState = {
      ...createDemoPanelState(),
      items: [
        {
          ...createDemoPanelState().items[0]!,
          serviceId: "codex",
          serviceName: "Codex"
        }
      ]
    };
    const state = createState(codexState);
    state.preferences = {
      ...defaultPreferences,
      menubarService: "auto",
      claudeCodeUsageEnabled: true,
      providerEnabled: { codex: true, "claude-code": true },
      serviceOrder: ["claude-code", "codex"],
      onboardingDismissedAt: new Date().toISOString()
    };
    state.providerStates["claude-code"] = {
      ...createDemoPanelState(),
      items: [
        {
          ...createDemoPanelState().items[0]!,
          serviceId: "claude-code",
          serviceName: "Claude Code",
          iconKey: "claude-code"
        }
      ]
    };

    render(
      <AppStateContext.Provider value={state}>
        <PanelView />
      </AppStateContext.Provider>
    );

    const headings = screen.getAllByRole("heading", { level: 3 }).map((heading) => heading.textContent);
    expect(headings).toEqual(["Claude Code", "Codex"]);
    expect(screen.getAllByText(/上次刷新/)).toHaveLength(2);
  });

  it("renders full-height accent strips only for warning and danger cards", () => {
    const now = new Date().toISOString();
    const state = createState({
      ...createDemoPanelState(),
      items: [
        {
          ...createDemoPanelState().items[0]!,
          serviceId: "codex",
          serviceName: "Codex",
          lastSuccessfulRefreshAt: now,
          quotaDimensions: [
            {
              label: "CODEX / 5H",
              remainingPercent: 18,
              remainingAbsolute: "18% remaining",
              resetHint: "Resets in 2h",
              status: "exhausted",
              progressTone: "danger"
            }
          ]
        },
        {
          ...createDemoPanelState().items[0]!,
          serviceId: "claude-code",
          serviceName: "Claude Code",
          lastSuccessfulRefreshAt: now,
          quotaDimensions: [
            {
              label: "CLAUDE CODE / WEEK",
              remainingPercent: 82,
              remainingAbsolute: "82% remaining",
              resetHint: "Resets in 4d",
              status: "healthy",
              progressTone: "success"
            }
          ]
        }
      ]
    });

    render(
      <AppStateContext.Provider value={state}>
        <PanelView />
      </AppStateContext.Provider>
    );

    const dangerCard = screen.getByRole("heading", { name: "Codex" }).closest("article");
    const healthyCard = screen.getByRole("heading", { name: "Claude Code" }).closest("article");

    expect(dangerCard?.className).toContain("relative overflow-hidden");
    expect(dangerCard?.querySelector("[aria-hidden='true']")?.className).toContain("absolute inset-y-0 left-0 w-1.5");
    expect(healthyCard?.querySelector("[aria-hidden='true']")).toBeNull();
  });

  it("opens settings from proxy-invalid placeholder after onboarding is dismissed", async () => {
    const state = createState({
      ...createDemoPanelState(),
      items: [],
      status: { kind: "NotLoggedIn" }
    });
    state.preferences = {
      ...defaultPreferences,
      claudeCodeUsageEnabled: true,
      providerEnabled: { codex: true, "claude-code": true },
      onboardingDismissedAt: new Date().toISOString()
    };
    state.providerStates["claude-code"] = {
      ...createDemoPanelState(),
      items: [],
      status: { kind: "ProxyInvalid" }
    };

    render(
      <AppStateContext.Provider value={state}>
        <PanelView />
      </AppStateContext.Provider>
    );

    expect(screen.queryByText("先连接第一个 AI 服务")).not.toBeInTheDocument();
    expect(screen.getByText("代理无效")).toBeInTheDocument();
    expect(screen.getByText("需要先登录")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "前往设置" }));

    expect(state.openSettings).toHaveBeenCalled();
  });

  it("shows non-color warning labels for low and critical quotas", () => {
    const now = new Date().toISOString();
    const state = createState({
      ...createDemoPanelState(),
      items: [
        {
          ...createDemoPanelState().items[0]!,
          serviceId: "codex",
          serviceName: "Codex",
          lastSuccessfulRefreshAt: now,
          quotaDimensions: [
            {
              label: "CODEX / 5H",
              remainingPercent: 42,
              remainingAbsolute: "42% remaining",
              resetHint: "Resets in 2h",
              status: "warning",
              progressTone: "warning"
            }
          ]
        },
        {
          ...createDemoPanelState().items[0]!,
          serviceId: "claude-code",
          serviceName: "Claude Code",
          lastSuccessfulRefreshAt: now,
          quotaDimensions: [
            {
              label: "CLAUDE CODE / WEEK",
              remainingPercent: 9,
              remainingAbsolute: "9% remaining",
              resetHint: "Resets in 4d",
              status: "exhausted",
              progressTone: "danger"
            }
          ]
        }
      ]
    });

    render(
      <AppStateContext.Provider value={state}>
        <PanelView />
      </AppStateContext.Provider>
    );

    const warningCard = screen.getByRole("heading", { name: "Codex" }).closest("article");
    const dangerCard = screen.getByRole("heading", { name: "Claude Code" }).closest("article");

    expect(within(warningCard!).getAllByText("偏低").length).toBeGreaterThan(0);
    expect(within(dangerCard!).getAllByText("紧张").length).toBeGreaterThan(0);
  });

  it("renders both burn-rate outcomes in one card without losing the last refreshed line", () => {
    const state = createState(createDemoPanelState());
    state.preferences = {
      ...state.preferences!,
      language: "en-US"
    };

    render(
      <AppStateContext.Provider value={state}>
        <PanelView />
      </AppStateContext.Provider>
    );

    const codexCard = screen.getByRole("heading", { name: "Codex" }).closest("article");
    expect(codexCard).not.toBeNull();
    expect(within(codexCard!).queryByText("On track")).not.toBeInTheDocument();
    expect(within(codexCard!).getAllByText("Behind")).toHaveLength(2);
    expect(within(codexCard!).queryByText(/Runs out in ~/)).not.toBeInTheDocument();
    expect(within(codexCard!).queryByText(/约 .* 后用尽/)).not.toBeInTheDocument();
    expect(within(codexCard!).getAllByText(/Resets in/).length).toBeGreaterThan(0);
    expect(within(codexCard!).getByText(/Last refreshed:/)).toBeInTheDocument();
  });

  it("renders the english health summary without truncating the service-focused message", async () => {
    vi.resetModules();
    const lowQuotaState = {
      ...createDemoPanelState(),
      items: [
        {
          ...createDemoPanelState().items[0]!,
          serviceId: "codex",
          serviceName: "Codex",
          quotaDimensions: [
            {
              label: "CODEX / 5H",
              remainingPercent: 28,
              remainingAbsolute: "28% remaining",
              resetHint: "Resets in 2h",
              status: "warning",
              progressTone: "warning"
            }
          ]
        }
      ]
    };

    vi.doMock("../../features/demo-services/panelController", () => ({
      loadProviderState: vi.fn(async () => lowQuotaState),
      refreshProviderState: vi.fn(async () => lowQuotaState)
    }));
    vi.doMock("../../features/preferences/preferencesController", () => ({
      getPreferences: vi.fn(async () => ({
        ...defaultPreferences,
        language: "en-US",
        serviceOrder: ["codex"]
      })),
      persistPreferences: vi.fn(async (patch) => ({
        ...defaultPreferences,
        language: "en-US",
        serviceOrder: ["codex"],
        ...patch
      })),
      applyAutostart: vi.fn(async (enabled: boolean) => ({ ...defaultPreferences, language: "en-US", autostartEnabled: enabled })),
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

    expect(await screen.findByText("Codex 5h limits running low")).toBeInTheDocument();
    expect(screen.queryByText("...")).not.toBeInTheDocument();

    vi.resetModules();
    vi.unmock("../../features/demo-services/panelController");
    vi.unmock("../../features/preferences/preferencesController");
    vi.unmock("../../features/notifications/notificationController");
  });
});
