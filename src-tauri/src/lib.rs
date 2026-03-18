pub mod autostart;
pub mod codex;
pub mod commands;
pub mod notifications;
pub mod state;
pub mod tray;

use state::AppState;
use tauri::Manager;

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
            let panel_state = commands::get_codex_panel_state(app_state);
            tray::initialize_tray(app.handle(), &preferences, &panel_state.items);
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.hide();
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_codex_panel_state,
            commands::refresh_codex_panel_state,
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
