import { invoke } from "@tauri-apps/api/core";

const hasTauriWindowRuntime = () =>
  typeof window !== "undefined" && !!window.__TAURI_INTERNALS__;

export const hideMainWindow = async () => {
  if (!hasTauriWindowRuntime()) {
    return false;
  }

  return invoke<boolean>("hide_main_window");
};
