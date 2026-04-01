import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AppShell } from "./AppShell";
import { formatPromotionDetailTiming, getCopy } from "../shared/i18n";
import { createDemoPanelState } from "../../features/demo-services/demoData";
import { defaultPreferences } from "../../features/preferences/defaultPreferences";
import type { CodexPanelState, UserPreferences } from "../../lib/tauri/contracts";
import { resolvePromotionDisplayDecision } from "../../features/promotions/resolver";

const {
  loadProviderState,
  refreshProviderState,
  getPreferences,
  persistPreferences,
  applyAutostart,
  sendDemoNotification,
  getRuntimeFlags,
  hideMainWindow
} = vi.hoisted(() => ({
  loadProviderState: vi.fn(),
  refreshProviderState: vi.fn(),
  getPreferences: vi.fn(),
  persistPreferences: vi.fn(),
  applyAutostart: vi.fn(),
  sendDemoNotification: vi.fn(),
  getRuntimeFlags: vi.fn(),
  hideMainWindow: vi.fn()
}));

vi.mock("../../features/demo-services/panelController", () => ({
  loadProviderState,
  refreshProviderState
}));

vi.mock("../../features/preferences/preferencesController", () => ({
  getPreferences,
  persistPreferences,
  applyAutostart
}));

vi.mock("../../features/notifications/notificationController", () => ({
  sendDemoNotification
}));

vi.mock("../../lib/tauri/client", () => ({
  tauriClient: {
    getRuntimeFlags
  }
}));

vi.mock("../../lib/tauri/windowShell", () => ({
  hideMainWindow
}));

const makePreferences = (overrides: Partial<UserPreferences> = {}): UserPreferences => {
  const claudeEnabled = overrides.claudeCodeUsageEnabled ?? false;
  return {
    ...defaultPreferences,
    claudeCodeUsageEnabled: claudeEnabled,
    providerEnabled: { codex: true, "claude-code": claudeEnabled, ...overrides.providerEnabled },
    ...overrides
  };
};

const makeClaudePanelState = (overrides: Partial<CodexPanelState> = {}): CodexPanelState => {
  const base = createDemoPanelState();
  return {
    ...base,
    ...overrides,
    items:
      overrides.items ??
      base.items.map((item) => ({
        ...item,
        serviceId: "claude-code",
        serviceName: "Claude Code",
        iconKey: "claude-code"
      }))
  };
};

const createDeferred = <T,>() => {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((innerResolve, innerReject) => {
    resolve = innerResolve;
    reject = innerReject;
  });
  return { promise, resolve, reject };
};

const getExpectedClaudePromotionDetail = () => {
  const decision = resolvePromotionDisplayDecision({
    now: new Date("2026-04-01T16:00:00Z"),
    visibleServiceScope: {
      visiblePanelServiceOrder: ["codex", "claude-code"],
      visibleMenubarServices: ["codex", "claude-code"],
      hasVisibleClaudeCode: true
    },
    eligibilityByServiceId: {
      codex: "eligible",
      "claude-code": "eligible"
    }
  });
  const claudeDecision = decision.allServices.find((service) => service.serviceId === "claude-code");

  return formatPromotionDetailTiming(getCopy("zh-CN"), claudeDecision?.detailTiming ?? { mode: "none" });
};

describe("AppShell", () => {
  beforeEach(() => {
    vi.useRealTimers();
    loadProviderState.mockReset().mockImplementation((providerId: string) => {
      if (providerId === "claude-code") return Promise.resolve(makeClaudePanelState());
      return Promise.resolve(createDemoPanelState());
    });
    refreshProviderState.mockReset().mockImplementation((providerId: string) => {
      if (providerId === "claude-code") return Promise.resolve(makeClaudePanelState());
      return Promise.resolve(createDemoPanelState());
    });
    getPreferences.mockReset().mockResolvedValue(makePreferences());
    persistPreferences.mockReset().mockResolvedValue(makePreferences());
    applyAutostart.mockReset().mockResolvedValue(makePreferences());
    sendDemoNotification.mockReset().mockResolvedValue(null);
    getRuntimeFlags.mockReset().mockResolvedValue({ isE2E: false });
    hideMainWindow.mockReset().mockResolvedValue(true);
  });

  it("skips Claude Code loading during initialization when usage is disabled", async () => {
    getPreferences.mockResolvedValue(makePreferences({ claudeCodeUsageEnabled: false }));

    render(<AppShell />);

    await screen.findByRole("button", { name: "设置" });

    expect(loadProviderState).toHaveBeenCalledWith("codex");
    expect(loadProviderState).not.toHaveBeenCalledWith("claude-code");
  });

  it("does not refresh Claude Code manually when usage is disabled", async () => {
    getPreferences.mockResolvedValue(makePreferences({ claudeCodeUsageEnabled: false }));

    render(<AppShell />);
    await screen.findByRole("button", { name: "手动刷新" });

    await userEvent.click(screen.getByRole("button", { name: "手动刷新" }));

    await waitFor(() => expect(refreshProviderState).toHaveBeenCalledWith("codex"));
    expect(refreshProviderState).not.toHaveBeenCalledWith("claude-code");
  });

  it("keeps Claude Code out of the auto-refresh loop when usage is disabled", async () => {
    getPreferences.mockResolvedValue(
      makePreferences({ claudeCodeUsageEnabled: false, refreshIntervalMinutes: 5 })
    );
    const setIntervalSpy = vi
      .spyOn(window, "setInterval")
      .mockImplementation(((() => 1) as unknown) as typeof window.setInterval);

    render(<AppShell />);
    await screen.findByRole("button", { name: "设置" });
    await waitFor(() => expect(setIntervalSpy).toHaveBeenCalled());
    const intervalCallback = setIntervalSpy.mock.calls[0]?.[0] as (() => void) | undefined;

    // Reset call counts from initial load
    loadProviderState.mockClear();
    refreshProviderState.mockClear();

    await act(async () => {
      intervalCallback?.();
      await Promise.resolve();
      await Promise.resolve();
    });

    // Only codex should be refreshed, not claude-code
    const refreshCalls = refreshProviderState.mock.calls.map((c: string[]) => c[0]);
    const loadCalls = loadProviderState.mock.calls.map((c: string[]) => c[0]);
    expect(refreshCalls).not.toContain("claude-code");
    expect(loadCalls).not.toContain("claude-code");
    setIntervalSpy.mockRestore();
  });

  it("loads cached Claude state and then triggers a refresh when the usage toggle is enabled", async () => {
    const refreshDeferred = createDeferred<CodexPanelState>();
    const nextPreferences = makePreferences({ claudeCodeUsageEnabled: true });
    getPreferences.mockResolvedValue(makePreferences({ claudeCodeUsageEnabled: false }));
    persistPreferences.mockResolvedValue(nextPreferences);
    loadProviderState.mockImplementation((id: string) => {
      if (id === "claude-code") return Promise.resolve(makeClaudePanelState({ status: { kind: "SessionRecovery" } }));
      return Promise.resolve(createDemoPanelState());
    });
    refreshProviderState.mockImplementation((id: string) => {
      if (id === "claude-code") return refreshDeferred.promise;
      return Promise.resolve(createDemoPanelState());
    });

    render(<AppShell />);
    await screen.findByRole("button", { name: "设置" });
    await userEvent.click(screen.getByRole("button", { name: "设置" }));

    await userEvent.click(screen.getByRole("switch", { name: "启用 Claude Code 查询" }));

    await waitFor(() =>
      expect(persistPreferences).toHaveBeenCalledWith(
        expect.objectContaining({ providerEnabled: expect.objectContaining({ "claude-code": true }) })
      )
    );
    // After enabling, the provider should be loaded and refreshed
    await waitFor(() => expect(loadProviderState).toHaveBeenCalledWith("claude-code"));
    await waitFor(() => expect(refreshProviderState).toHaveBeenCalledWith("claude-code"));

    await act(async () => {
      refreshDeferred.resolve(makeClaudePanelState());
      await refreshDeferred.promise;
    });
  });

  it("renders promotion capsules and supports preview plus pinned popover in the same header area", async () => {
    const expectedClaudePromotionDetail = getExpectedClaudePromotionDetail();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-01T16:00:00Z"));
    getPreferences.mockResolvedValue(makePreferences({ claudeCodeUsageEnabled: true }));

    render(<AppShell />);

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.getByRole("button", { name: "设置" })).toBeInTheDocument();
    expect(screen.getByTestId("promotion-pill-codex")).toHaveTextContent("2x");
    expect(screen.getByTestId("promotion-pill-claude-code")).toHaveTextContent("高峰");
    expect(screen.queryByTestId("promotion-status-popover")).not.toBeInTheDocument();

    act(() => {
      fireEvent.mouseEnter(screen.getByTestId("promotion-status-trigger"));
    });
    expect(screen.getByTestId("promotion-popover-item-codex")).toHaveTextContent(
      "Codex正在优惠时段2x"
    );
    expect(screen.getByTestId("promotion-popover-item-claude-code")).toHaveTextContent(
      "Claude Code高峰时段受限"
    );
    expect(screen.getByTestId("promotion-popover-status-codex")).toHaveTextContent(
      "正在优惠时段"
    );
    expect(screen.getByTestId("promotion-popover-benefit-codex")).toHaveTextContent("2x");
    expect(screen.getByTestId("promotion-popover-status-claude-code")).toHaveTextContent(
      "高峰时段受限"
    );
    expect(screen.queryByTestId("promotion-popover-benefit-claude-code")).toBeNull();
    expect(screen.getByTestId("promotion-popover-detail-codex")).toHaveTextContent(
      "全天优惠"
    );
    expect(screen.getByTestId("promotion-popover-detail-claude-code")).toHaveTextContent(
      expectedClaudePromotionDetail
    );

    act(() => {
      fireEvent.mouseLeave(screen.getByTestId("promotion-status-trigger"));
    });
    expect(screen.queryByTestId("promotion-status-popover")).not.toBeInTheDocument();

    act(() => {
      fireEvent.click(screen.getByTestId("promotion-status-trigger"));
    });
    expect(screen.getByTestId("promotion-popover-item-codex")).toHaveTextContent(
      "Codex正在优惠时段2x"
    );

    act(() => {
      fireEvent.mouseDown(document.body);
    });
    expect(screen.queryByTestId("promotion-status-popover")).not.toBeInTheDocument();
  });

  it("resets the pinned promotion popover when the panel shell is reopened", async () => {
    const expectedClaudePromotionDetail = getExpectedClaudePromotionDetail();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-01T16:00:00Z"));
    getPreferences.mockResolvedValue(makePreferences({ claudeCodeUsageEnabled: true }));

    const firstRender = render(<AppShell />);
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.getByRole("button", { name: "设置" })).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("promotion-status-trigger"));
    expect(screen.getByTestId("promotion-popover-item-claude-code")).toHaveTextContent(
      "Claude Code高峰时段受限"
    );
    expect(screen.getByTestId("promotion-popover-detail-claude-code")).toHaveTextContent(
      expectedClaudePromotionDetail
    );

    firstRender.unmount();

    render(<AppShell />);
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.getByRole("button", { name: "设置" })).toBeInTheDocument();
    expect(screen.getByTestId("promotion-pill-codex")).toHaveTextContent("2x");
    expect(screen.getByTestId("promotion-pill-claude-code")).toHaveTextContent("高峰");
    expect(screen.queryByTestId("promotion-status-popover")).not.toBeInTheDocument();
  });

  it("keeps the shell as a single visible surface without an outer framed container", async () => {
    const { container } = render(<AppShell />);

    await screen.findByRole("button", { name: "设置" });

    expect(screen.getByTestId("app-shell-surface")).toBeInTheDocument();
    expect(container.firstElementChild).toHaveClass("h-screen");
    expect(container.querySelector(".transition-shadow")).toBeInTheDocument();
  });

  it("resets to the panel view when the shell regains focus", async () => {
    render(<AppShell />);

    await screen.findByRole("button", { name: "设置" });
    await userEvent.click(screen.getByRole("button", { name: "设置" }));
    expect(screen.getByRole("button", { name: "返回" })).toBeInTheDocument();
    const viewportBeforeFocus = screen.getByTestId("app-shell-viewport");

    act(() => {
      window.dispatchEvent(new Event("focus"));
    });

    expect(screen.getByRole("button", { name: "设置" })).toBeInTheDocument();
    expect(screen.getByTestId("app-shell-viewport")).not.toBe(viewportBeforeFocus);
  });

  it("updates countdowns only while the window is visible", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-01T12:00:00.000Z"));
    getPreferences.mockResolvedValue(
      makePreferences({ language: "en-US", serviceOrder: ["codex"], providerEnabled: { codex: true } })
    );

    render(<AppShell />);

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.getByRole("button", { name: "Settings" })).toBeInTheDocument();
    expect(screen.getByText("Resets in 2h 00m")).toBeInTheDocument();

    await act(async () => {
      vi.advanceTimersByTime(60_000);
      await Promise.resolve();
    });
    expect(screen.getByText("Resets in 1h 59m")).toBeInTheDocument();

    act(() => {
      window.dispatchEvent(new Event("blur"));
    });
    await act(async () => {
      vi.advanceTimersByTime(60_000);
      await Promise.resolve();
    });
    expect(screen.getByText("Resets in 1h 59m")).toBeInTheDocument();

    act(() => {
      window.dispatchEvent(new Event("focus"));
    });
    expect(screen.getByText("Resets in 1h 58m")).toBeInTheDocument();

    vi.useRealTimers();
  });

  it("refreshes all enabled providers when savePreferences receives a providerTokens patch", async () => {
    // Setup: kimi-code enabled with a token field visible
    const prefs = makePreferences({
      claudeCodeUsageEnabled: true,
      providerEnabled: { codex: true, "claude-code": true, "kimi-code": true },
      serviceOrder: ["codex", "claude-code", "kimi-code"],
      providerTokens: {}
    });
    getPreferences.mockResolvedValue(prefs);
    persistPreferences.mockResolvedValue({
      ...prefs,
      providerTokens: { "kimi-code": "new-token-value" }
    });

    render(<AppShell />);
    await screen.findByRole("button", { name: "设置" });
    await userEvent.click(screen.getByRole("button", { name: "设置" }));

    // Clear calls from initial load
    refreshProviderState.mockClear();

    // The kimi-code section should be visible because providerEnabled includes kimi-code.
    // Trigger a token save by typing into the token input and blurring.
    // The token input has aria-label="API Token" — use getAllByLabelText and pick the first one
    // since kimi-code section renders before glm-coding section.
    const tokenInputs = screen.getAllByLabelText("API Token");
    const kimiTokenInput = tokenInputs[0]!;
    await userEvent.clear(kimiTokenInput);
    await userEvent.type(kimiTokenInput, "new-token-value");
    fireEvent.blur(kimiTokenInput);

    // The providerTokens patch should trigger refreshProviderState for all enabled providers
    await waitFor(() =>
      expect(persistPreferences).toHaveBeenCalledWith(
        expect.objectContaining({ providerTokens: expect.any(Object) })
      )
    );
    await waitFor(() => expect(refreshProviderState).toHaveBeenCalled());

    const refreshedProviders = refreshProviderState.mock.calls.map((c: string[]) => c[0]);
    expect(refreshedProviders).toContain("codex");
    expect(refreshedProviders).toContain("claude-code");
    expect(refreshedProviders).toContain("kimi-code");
  });

  it("refreshes providers when a token is cleared (empty string)", async () => {
    const prefs = makePreferences({
      claudeCodeUsageEnabled: true,
      providerEnabled: { codex: true, "claude-code": true, "kimi-code": true },
      serviceOrder: ["codex", "claude-code", "kimi-code"],
      providerTokens: { "kimi-code": "existing-token" }
    });
    getPreferences.mockResolvedValue(prefs);
    persistPreferences.mockResolvedValue({
      ...prefs,
      providerTokens: { "kimi-code": "" }
    });

    render(<AppShell />);
    await screen.findByRole("button", { name: "设置" });
    await userEvent.click(screen.getByRole("button", { name: "设置" }));

    // Clear calls from initial load
    refreshProviderState.mockClear();

    // Clear the token field and blur to trigger save
    const tokenInputs = screen.getAllByLabelText("API Token");
    const kimiTokenInput = tokenInputs[0]!;
    await userEvent.clear(kimiTokenInput);
    fireEvent.blur(kimiTokenInput);

    // Token removal should also trigger refresh for all enabled providers
    await waitFor(() =>
      expect(persistPreferences).toHaveBeenCalledWith(
        expect.objectContaining({ providerTokens: expect.any(Object) })
      )
    );
    await waitFor(() => expect(refreshProviderState).toHaveBeenCalled());
  });

  it("does not trigger extra refresh when patch has no providerTokens", async () => {
    const prefs = makePreferences({ claudeCodeUsageEnabled: false });
    getPreferences.mockResolvedValue(prefs);
    persistPreferences.mockResolvedValue({ ...prefs, language: "en-US" });

    render(<AppShell />);
    await screen.findByRole("button", { name: "设置" });
    await userEvent.click(screen.getByRole("button", { name: "设置" }));

    // Clear calls from initial load
    refreshProviderState.mockClear();

    // Change language — this does not include providerTokens in the patch
    const langSelect = screen.getByRole("combobox", { name: "语言" });
    await userEvent.selectOptions(langSelect, "en-US");

    await waitFor(() =>
      expect(persistPreferences).toHaveBeenCalledWith(
        expect.objectContaining({ language: "en-US" })
      )
    );

    // No refresh should be triggered for a non-token, non-proxy, non-enable change
    expect(refreshProviderState).not.toHaveBeenCalled();
  });

  it("hides the whole main window when Escape is pressed", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-01T16:00:00Z"));
    getPreferences.mockResolvedValue(makePreferences({ claudeCodeUsageEnabled: true }));

    render(<AppShell />);

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    act(() => {
      fireEvent.click(screen.getByTestId("promotion-status-trigger"));
    });
    expect(screen.getByTestId("promotion-status-popover")).toBeInTheDocument();

    await act(async () => {
      fireEvent.keyDown(window, { key: "Escape" });
      await Promise.resolve();
    });

    expect(hideMainWindow).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId("promotion-status-popover")).not.toBeInTheDocument();
  });
});
