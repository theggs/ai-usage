use crate::autostart::set_autostart_status;
use crate::notifications::send_demo_notification;
use crate::state::{
    AppState, DemoPanelState, DesktopSurfaceState, NotificationCheckResult, PanelPlaceholderItem,
    PreferencePatch, QuotaDimension, UserPreferences,
};
use crate::tray::{apply_display_mode, format_summary};
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, State};

fn now_iso() -> String {
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();
    format!("{now}")
}

fn demo_panel_state(preferences: &UserPreferences) -> DemoPanelState {
    let refreshed_at = now_iso();
    let items = vec![
            PanelPlaceholderItem {
                service_id: "openai-demo".into(),
                service_name: "OpenAI".into(),
                account_label: Some("Personal Sandbox".into()),
                icon_key: "openai".into(),
                status_label: "demo".into(),
                last_refreshed_at: refreshed_at.clone(),
                quota_dimensions: vec![
                    QuotaDimension {
                        label: "5h window".into(),
                        remaining_percent: 64,
                        remaining_absolute: "64% left".into(),
                        reset_hint: Some("Resets in 2h".into()),
                    },
                    QuotaDimension {
                        label: "7d window".into(),
                        remaining_percent: 82,
                        remaining_absolute: "82% left".into(),
                        reset_hint: Some("Resets in 4d".into()),
                    },
                ],
            },
            PanelPlaceholderItem {
                service_id: "claude-demo".into(),
                service_name: "Claude".into(),
                account_label: Some("Team Seat".into()),
                icon_key: "claude".into(),
                status_label: "demo".into(),
                last_refreshed_at: refreshed_at.clone(),
                quota_dimensions: vec![QuotaDimension {
                    label: "Daily quota".into(),
                    remaining_percent: 48,
                    remaining_absolute: "48% left".into(),
                    reset_hint: Some("Resets tomorrow".into()),
                }],
            },
        ];

    DemoPanelState {
        desktop_surface: DesktopSurfaceState {
            platform: if cfg!(target_os = "macos") {
                "macos".into()
            } else {
                "windows".into()
            },
            icon_state: "offline-demo".into(),
            summary_mode: preferences.display_mode.clone(),
            summary_text: format_summary(&preferences.display_mode, &items),
            panel_visible: false,
            last_opened_at: None,
        },
        updated_at: refreshed_at,
        items,
    }
}

fn merge_preferences(patch: PreferencePatch, mut current: UserPreferences) -> UserPreferences {
    if let Some(language) = patch.language {
        current.language = language;
    }
    if let Some(interval) = patch.refresh_interval_minutes {
        current.refresh_interval_minutes = interval.max(5);
    }
    if let Some(display_mode) = patch.display_mode {
        current.display_mode = display_mode;
    }
    if let Some(autostart_enabled) = patch.autostart_enabled {
        current.autostart_enabled = autostart_enabled;
    }
    if let Some(notification_test_enabled) = patch.notification_test_enabled {
        current.notification_test_enabled = notification_test_enabled;
    }
    current.last_saved_at = now_iso();
    current
}

#[tauri::command]
pub fn get_demo_panel_state(state: State<'_, AppState>) -> DemoPanelState {
    let preferences = state.preferences.lock().unwrap().clone();
    demo_panel_state(&preferences)
}

#[tauri::command]
pub fn refresh_demo_panel_state(state: State<'_, AppState>) -> DemoPanelState {
    let preferences = state.preferences.lock().unwrap().clone();
    demo_panel_state(&preferences)
}

#[tauri::command]
pub fn get_preferences(state: State<'_, AppState>) -> UserPreferences {
    state.preferences.lock().unwrap().clone()
}

#[tauri::command]
pub fn save_preferences(
    app: AppHandle,
    state: State<'_, AppState>,
    patch: PreferencePatch,
) -> UserPreferences {
    let current = state.preferences.lock().unwrap().clone();
    let next = merge_preferences(patch, current);
    let panel_state = demo_panel_state(&next);
    apply_display_mode(&app, &next, &panel_state.items);
    *state.preferences.lock().unwrap() = next.clone();
    next
}

#[tauri::command]
pub fn set_autostart(app: AppHandle, state: State<'_, AppState>, enabled: bool) -> UserPreferences {
    let current = state.preferences.lock().unwrap().clone();
    let next = set_autostart_status(enabled, current);
    let panel_state = demo_panel_state(&next);
    apply_display_mode(&app, &next, &panel_state.items);
    *state.preferences.lock().unwrap() = next.clone();
    next
}

#[tauri::command]
pub fn send_test_notification(message: Option<String>) -> NotificationCheckResult {
    send_demo_notification(message)
}
