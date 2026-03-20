import { test } from "@playwright/test";

test.describe("tray panel shell", () => {
  test("hides the panel on native close without terminating the tray app", async () => {
    test.skip(true, "Requires a bundled Tauri desktop runtime to click the tray icon and native close control.");
  });

  test("hides the panel when focus moves outside the popover", async () => {
    test.skip(true, "Requires a bundled Tauri desktop runtime with tray-focus handoff.");
  });

  test("keeps the popover shell within the menubar size envelope", async () => {
    test.skip(true, "Requires a bundled Tauri desktop runtime to measure the native window.");
  });
});
