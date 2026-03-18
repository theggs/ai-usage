pub mod autostart;
pub mod commands;
pub mod notifications;
pub mod state;
pub mod tray;

use tauri::Manager;
use state::AppState;

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
            let preferences = app.state::<AppState>().preferences.lock().unwrap().clone();
            let panel_state = commands::get_demo_panel_state(app.state::<AppState>());
            tray::initialize_tray(app.handle(), &preferences, &panel_state.items);
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.hide();
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_demo_panel_state,
            commands::refresh_demo_panel_state,
            commands::get_preferences,
            commands::save_preferences,
            commands::set_autostart,
            commands::send_test_notification
        ])
        .run(tauri::generate_context!())
        .expect("failed to run AIUsage desktop shell");
}
