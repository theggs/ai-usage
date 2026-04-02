import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AppShell } from "./AppShell";
import { formatPromotionDetailTiming, getCopy } from "../shared/i18n";
import { createDemoPanelState } from "../../features/demo-services/demoData";
import { defaultPreferences } from "../../features/preferences/defaultPreferences";
import type { CodexPanelState, UserPreferences } from "../../lib/tauri/contracts";
import { resolvePromotionDisplayDecision } from "../../features/promotions/resolver";

const {
  loadPanelState,
  refreshPanelState,
  loadClaudeCodePanelState,
  refreshClaudeCodePanelState,
  getPreferences,
  persistPreferences,
  applyAutostart,
  sendDemoNotification,
  getRuntimeFlags,
  hideMainWindow
} = vi.hoisted(() => ({
  loadPanelState: vi.fn(),
  refreshPanelState: vi.fn(),
  loadClaudeCodePanelState: vi.fn(),
  refreshClaudeCodePanelState: vi.fn(),
  getPreferences: vi.fn(),
  persistPreferences: vi.fn(),
  applyAutostart: vi.fn(),
  sendDemoNotification: vi.fn(),
  getRuntimeFlags: vi.fn(),
  hideMainWindow: vi.fn()
}));

vi.mock("../../features/demo-services/panelController", () => ({
  loadPanelState,
  refreshPanelState,
  loadClaudeCodePanelState,
  refreshClaudeCodePanelState
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

const makePreferences = (overrides: Partial<UserPreferences> = {}): UserPreferences => ({
  ...defaultPreferences,
  claudeCodeUsageEnabled: false,
  ...overrides
});

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
    now: new Date("2026-03-24T01:00:00Z"),
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
    loadPanelState.mockReset().mockResolvedValue(createDemoPanelState());
    refreshPanelState.mockReset().mockResolvedValue(createDemoPanelState());
    loadClaudeCodePanelState.mockReset().mockResolvedValue(makeClaudePanelState());
    refreshClaudeCodePanelState.mockReset().mockResolvedValue(makeClaudePanelState());
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

    expect(loadPanelState).toHaveBeenCalledTimes(1);
    expect(loadClaudeCodePanelState).not.toHaveBeenCalled();
  });

  it("does not refresh Claude Code manually when usage is disabled", async () => {
    getPreferences.mockResolvedValue(makePreferences({ claudeCodeUsageEnabled: false }));

    render(<AppShell />);
    await screen.findByRole("button", { name: "手动刷新" });

    await userEvent.click(screen.getByRole("button", { name: "手动刷新" }));

    await waitFor(() => expect(refreshPanelState).toHaveBeenCalledTimes(1));
    expect(refreshClaudeCodePanelState).not.toHaveBeenCalled();
    expect(loadClaudeCodePanelState).not.toHaveBeenCalled();
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

    await act(async () => {
      intervalCallback?.();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(loadClaudeCodePanelState).not.toHaveBeenCalled();
    expect(refreshClaudeCodePanelState).not.toHaveBeenCalled();
    setIntervalSpy.mockRestore();
  });

  it("loads cached Claude state and then triggers a refresh when the usage toggle is enabled", async () => {
    const refreshDeferred = createDeferred<CodexPanelState>();
    const nextPreferences = makePreferences({ claudeCodeUsageEnabled: true });
    getPreferences.mockResolvedValue(makePreferences({ claudeCodeUsageEnabled: false }));
    persistPreferences.mockResolvedValue(nextPreferences);
    loadClaudeCodePanelState.mockResolvedValue(
      makeClaudePanelState({
        status: { kind: "SessionRecovery" }
      })
    );
    refreshClaudeCodePanelState.mockReturnValue(refreshDeferred.promise);

    render(<AppShell />);
    await screen.findByRole("button", { name: "设置" });
    await userEvent.click(screen.getByRole("button", { name: "设置" }));

    await userEvent.click(screen.getByRole("switch", { name: "启用 Claude Code 查询" }));

    await waitFor(() =>
      expect(persistPreferences).toHaveBeenCalledWith(
        expect.objectContaining({ claudeCodeUsageEnabled: true })
      )
    );
    await waitFor(() => expect(loadClaudeCodePanelState).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(refreshClaudeCodePanelState).toHaveBeenCalledTimes(1));
    expect(screen.getByText("刷新中...")).toBeInTheDocument();

    await act(async () => {
      refreshDeferred.resolve(makeClaudePanelState());
      await refreshDeferred.promise;
    });

    await waitFor(() => expect(screen.queryByText("刷新中...")).not.toBeInTheDocument());
  });

  it("renders promotion capsules and supports preview plus pinned popover in the same header area", async () => {
    const expectedClaudePromotionDetail = getExpectedClaudePromotionDetail();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-24T01:00:00Z"));
    getPreferences.mockResolvedValue(makePreferences({ claudeCodeUsageEnabled: true }));

    render(<AppShell />);

    await act(async () => {
      vi.runAllTimers();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.getByRole("button", { name: "设置" })).toBeInTheDocument();
    expect(screen.getByTestId("promotion-pill-claude-code")).toHaveTextContent("2x");
    expect(screen.queryByTestId("promotion-status-popover")).not.toBeInTheDocument();

    act(() => {
      fireEvent.mouseEnter(screen.getByTestId("promotion-status-trigger"));
    });
    expect(screen.getByTestId("promotion-popover-item-claude-code")).toHaveTextContent(
      "Claude Code正在优惠时段2x"
    );
    expect(screen.getByTestId("promotion-popover-item-codex")).toHaveTextContent(
      "Codex无优惠活动"
    );
    expect(screen.getByTestId("promotion-popover-status-claude-code")).toHaveTextContent(
      "正在优惠时段"
    );
    expect(screen.getByTestId("promotion-popover-benefit-claude-code")).toHaveTextContent("2x");
    expect(screen.getByTestId("promotion-popover-status-codex")).toHaveTextContent(
      "无优惠活动"
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
    expect(screen.getByTestId("promotion-popover-item-claude-code")).toHaveTextContent(
      "Claude Code正在优惠时段2x"
    );

    act(() => {
      fireEvent.mouseDown(document.body);
    });
    expect(screen.queryByTestId("promotion-status-popover")).not.toBeInTheDocument();
  });

  it("resets the pinned promotion popover when the panel shell is reopened", async () => {
    const expectedClaudePromotionDetail = getExpectedClaudePromotionDetail();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-24T01:00:00Z"));
    getPreferences.mockResolvedValue(makePreferences({ claudeCodeUsageEnabled: true }));

    const firstRender = render(<AppShell />);
    await act(async () => {
      vi.runAllTimers();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.getByRole("button", { name: "设置" })).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("promotion-status-trigger"));
    expect(screen.getByTestId("promotion-popover-item-claude-code")).toHaveTextContent(
      "Claude Code正在优惠时段2x"
    );
    expect(screen.getByTestId("promotion-popover-detail-claude-code")).toHaveTextContent(
      expectedClaudePromotionDetail
    );

    firstRender.unmount();

    render(<AppShell />);
    await act(async () => {
      vi.runAllTimers();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.getByRole("button", { name: "设置" })).toBeInTheDocument();
    expect(screen.getByTestId("promotion-pill-claude-code")).toHaveTextContent("2x");
    expect(screen.queryByTestId("promotion-status-popover")).not.toBeInTheDocument();
  });

  it("keeps the shell as a single visible surface without an outer framed container", async () => {
    const { container } = render(<AppShell />);

    await screen.findByRole("button", { name: "设置" });

    expect(screen.getByTestId("app-shell-surface")).toBeInTheDocument();
    expect(container.firstElementChild).toHaveClass("h-screen");
    expect(container.querySelector(".shadow-sm")).toBeInTheDocument();
  });

  it("resets to the panel view when the shell regains focus", async () => {
    render(<AppShell />);

    await screen.findByRole("button", { name: "设置" });
    await userEvent.click(screen.getByRole("button", { name: "设置" }));
    expect(screen.getByRole("button", { name: "返回" })).toBeInTheDocument();

    act(() => {
      window.dispatchEvent(new Event("focus"));
    });

    expect(screen.getByRole("button", { name: "设置" })).toBeInTheDocument();
  });

  it("hides the whole main window when Escape is pressed", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-24T01:00:00Z"));
    getPreferences.mockResolvedValue(makePreferences({ claudeCodeUsageEnabled: true }));

    render(<AppShell />);

    await act(async () => {
      vi.runAllTimers();
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
