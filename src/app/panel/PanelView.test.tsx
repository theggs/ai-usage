import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AppStateContext, type AppStateValue } from "../shared/appState";
import { PanelView } from "./PanelView";
import { createDemoPanelState } from "../../features/demo-services/demoData";
import { defaultPreferences } from "../../features/preferences/defaultPreferences";

const createState = (): AppStateValue => ({
  panelState: createDemoPanelState(),
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
  it("renders demo services and allows refresh", async () => {
    const state = createState();
    render(
      <AppStateContext.Provider value={state}>
        <PanelView />
      </AppStateContext.Provider>
    );

    expect(screen.getByText("AIUsage")).toBeInTheDocument();
    expect(screen.getByText("OpenAI")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "手动刷新" }));
    expect(state.refreshPanel).toHaveBeenCalled();
  });
});
