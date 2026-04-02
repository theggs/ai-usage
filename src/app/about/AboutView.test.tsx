import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AppStateContext, type AppStateValue } from "../shared/appState";
import { AboutView } from "./AboutView";
import { defaultPreferences } from "../../features/preferences/defaultPreferences";

const { getVersion, open } = vi.hoisted(() => ({
  getVersion: vi.fn(),
  open: vi.fn()
}));

vi.mock("@tauri-apps/api/app", () => ({
  getVersion
}));

vi.mock("@tauri-apps/plugin-shell", () => ({
  open
}));

const createState = (overrides: Partial<AppStateValue> = {}): AppStateValue => ({
  providerStates: {},
  refreshingProviders: new Set(),
  preferences: defaultPreferences,
  notificationResult: null,
  currentView: "about",
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
  closeAbout: vi.fn(),
  ...overrides
});

const renderAbout = (overrides: Partial<AppStateValue> = {}) => {
  const state = createState(overrides);
  render(
    <AppStateContext.Provider value={state}>
      <AboutView />
    </AppStateContext.Provider>
  );
  return state;
};

describe("AboutView", () => {
  beforeEach(() => {
    getVersion.mockReset().mockResolvedValue("0.1.0");
    open.mockReset().mockResolvedValue(undefined);
  });

  it("renders the packaged version once loaded", async () => {
    renderAbout();

    expect(screen.queryByText("v0.1.0")).not.toBeInTheDocument();

    await screen.findByText("v0.1.0");
  });

  it("opens the canonical GitHub URL in the default browser", async () => {
    renderAbout();

    const githubLink = await screen.findByRole("button", {
      name: "https://github.com/theggs/ai-usage"
    });

    await userEvent.click(githubLink);

    expect(open).toHaveBeenCalledWith("https://github.com/theggs/ai-usage");
  });

  it("shows the localized version fallback when runtime version lookup fails", async () => {
    getVersion.mockRejectedValueOnce(new Error("version unavailable"));
    renderAbout({
      preferences: {
        ...defaultPreferences,
        language: "zh-CN"
      }
    });

    await waitFor(() => {
      expect(screen.getByText("版本不可用")).toBeInTheDocument();
    });
  });
});
