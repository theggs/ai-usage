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
    await userEvent.click(screen.getByRole("button", { name: "保存设置" }));
    expect(state.savePreferences).toHaveBeenCalled();
  });
});
