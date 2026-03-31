pub mod autostart;
pub mod agent_activity;
pub mod claude_code;
pub mod codex;
pub mod commands;
pub mod notifications;
pub mod registry;
pub mod snapshot;
pub mod state;
pub mod tray;

use serde::Deserialize;
use state::AppState;
use tauri::{Manager, WindowEvent};

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct E2EControlCommand {
    sequence: u64,
    action: String,
}

fn start_e2e_control_loop(app: &tauri::AppHandle) {
    let Ok(control_file) = std::env::var("AI_USAGE_E2E_CONTROL_FILE") else {
        return;
    };

    let app_handle = app.clone();
    let (tray_rect, event_position) = tray::e2e_startup_anchor();
    std::thread::spawn(move || {
        let mut last_sequence = 0_u64;
        loop {
            if let Ok(payload) = std::fs::read_to_string(&control_file) {
                if let Ok(command) = serde_json::from_str::<E2EControlCommand>(&payload) {
                    if command.sequence > last_sequence {
                        last_sequence = command.sequence;
                        if command.action == "toggle-main-window" {
                            tray::toggle_main_window_with_event(
                                &app_handle,
                                tray_rect.clone(),
                                event_position,
                            );
                        }
                    }
                }
            }

            std::thread::sleep(std::time::Duration::from_millis(150));
        }
    });
}

fn start_auto_menubar_loop(app: &tauri::AppHandle) {
    let app_handle = app.clone();
    std::thread::spawn(move || loop {
        let app_state = app_handle.state::<AppState>();
        let preferences = app_state.preferences.lock().unwrap().clone();

        if preferences.menubar_service == "auto" {
            let items = crate::commands::build_cached_tray_items(&preferences);
            crate::commands::refresh_auto_menubar_selection(
                &app_state,
                &preferences,
                &items,
                crate::agent_activity::now_unix_secs(),
            );
            crate::tray::apply_display_mode(&app_handle, &preferences, &items);
        }

        std::thread::sleep(std::time::Duration::from_secs(
            crate::state::AUTO_SCAN_INTERVAL_SECS,
        ));
    });
}

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
                let mtm = objc2::MainThreadMarker::new().expect("setup runs on main thread");
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
            commands::refresh_auto_menubar_selection(
                &app_state,
                &preferences,
                &tray_items,
                agent_activity::now_unix_secs(),
            );
            tray::initialize_tray(app.handle(), &preferences, &tray_items);
            start_auto_menubar_loop(app.handle());
            let test_mode = std::env::var("AIUSAGE_E2E").unwrap_or_default() == "1";
            if let Some(window) = app.get_webview_window("main") {
                let window_handle = window.clone();
                window.on_window_event(move |event| match event {
                    WindowEvent::CloseRequested { api, .. } => {
                        api.prevent_close();
                        let _ = window_handle.hide();
                        tray::record_e2e_window_hidden();
                    }
                    WindowEvent::Focused(is_focused)
                        if tray::should_hide_on_focus_change(*is_focused) =>
                    {
                        let _ = window_handle.hide();
                        tray::record_e2e_window_hidden();
                    }
                    _ => {}
                });

                if !test_mode {
                    let _ = window.hide();
                } else {
                    start_e2e_control_loop(app.handle());
                    let (tray_rect, event_position) = tray::e2e_startup_anchor();
                    tray::toggle_main_window_with_event(app.handle(), tray_rect, event_position);
                }
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
            commands::get_runtime_flags,
            commands::hide_main_window,
            commands::save_preferences,
            commands::set_autostart,
            commands::send_test_notification
        ])
        .run(tauri::generate_context!())
        .expect("failed to run AIUsage desktop shell");
}
