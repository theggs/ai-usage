pub mod autostart;
pub mod claude_code;
pub mod codex;
pub mod commands;
pub mod notifications;
pub mod state;
pub mod tray;

use state::AppState;
use tauri::{Manager, WindowEvent};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            None,
        ))
        .manage(AppState::default())
        .setup(|app| {
            // Hide from Dock and Cmd+Tab on macOS (menu-bar-only agent).
            // Info.plist LSUIElement alone is insufficient because Tauri's
            // internal init may override the activation policy.
            #[cfg(target_os = "macos")]
            {
                use objc2_app_kit::{NSApplication, NSApplicationActivationPolicy};
                let mtm = objc2::MainThreadMarker::new()
                    .expect("setup runs on main thread");
                let ns_app = NSApplication::sharedApplication(mtm);
                ns_app.setActivationPolicy(NSApplicationActivationPolicy::Accessory);
            }
            let loaded_accounts = codex::load_accounts();
            let loaded_preferences = codex::load_preferences();
            let app_state = app.state::<AppState>();
            {
                let mut accounts = app_state.codex_accounts.lock().unwrap();
                *accounts = loaded_accounts;
            }
            {
                let mut preferences = app_state.preferences.lock().unwrap();
                *preferences = loaded_preferences;
            }
            let preferences = app_state.preferences.lock().unwrap().clone();
            let accounts = app_state.codex_accounts.lock().unwrap().clone();
            let tray_items = commands::build_tray_items(&preferences, &accounts, "startup");
            tray::initialize_tray(app.handle(), &preferences, &tray_items);
            if let Some(window) = app.get_webview_window("main") {
                let window_handle = window.clone();
                window.on_window_event(move |event| match event {
                    WindowEvent::CloseRequested { api, .. } => {
                        api.prevent_close();
                        let _ = window_handle.hide();
                    }
                    WindowEvent::Focused(is_focused)
                        if tray::should_hide_on_focus_change(*is_focused) =>
                    {
                        let _ = window_handle.hide();
                    }
                    _ => {}
                });
                let _ = window.hide();
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_codex_panel_state,
            commands::refresh_codex_panel_state,
            commands::get_claude_code_panel_state,
            commands::refresh_claude_code_panel_state,
            commands::get_codex_accounts,
            commands::save_codex_account,
            commands::remove_codex_account,
            commands::set_codex_account_enabled,
            commands::get_preferences,
            commands::save_preferences,
            commands::set_autostart,
            commands::send_test_notification
        ])
        .run(tauri::generate_context!())
        .expect("failed to run AIUsage desktop shell");
}
