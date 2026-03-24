import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AppShell } from "./AppShell";
import { createDemoPanelState } from "../../features/demo-services/demoData";
import { defaultPreferences } from "../../features/preferences/defaultPreferences";
import type { CodexPanelState, UserPreferences } from "../../lib/tauri/contracts";

const {
  loadPanelState,
  refreshPanelState,
  loadClaudeCodePanelState,
  refreshClaudeCodePanelState,
  getPreferences,
  persistPreferences,
  applyAutostart,
  sendDemoNotification,
  getRuntimeFlags
} = vi.hoisted(() => ({
  loadPanelState: vi.fn(),
  refreshPanelState: vi.fn(),
  loadClaudeCodePanelState: vi.fn(),
  refreshClaudeCodePanelState: vi.fn(),
  getPreferences: vi.fn(),
  persistPreferences: vi.fn(),
  applyAutostart: vi.fn(),
  sendDemoNotification: vi.fn(),
  getRuntimeFlags: vi.fn()
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
      .mockImplementation((() => 1 as unknown as ReturnType<typeof setInterval>) as typeof setInterval);

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
        snapshotState: "stale",
        statusMessage: "Cached Claude Code quota."
      })
    );
    refreshClaudeCodePanelState.mockReturnValue(refreshDeferred.promise);

    render(<AppShell />);
    await screen.findByRole("button", { name: "设置" });
    await userEvent.click(screen.getByRole("button", { name: "设置" }));

    await userEvent.click(screen.getByRole("switch", { name: "启用 Claude Code 用度查询" }));

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
});
