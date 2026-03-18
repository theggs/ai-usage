import { tauriClient } from "../../lib/tauri/client";

export const sendDemoNotification = () => tauriClient.sendTestNotification();
