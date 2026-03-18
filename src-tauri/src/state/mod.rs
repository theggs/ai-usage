use serde::{Deserialize, Serialize};
use std::sync::Mutex;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct QuotaDimension {
    pub label: String,
    pub remaining_percent: u8,
    pub remaining_absolute: String,
    pub reset_hint: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PanelPlaceholderItem {
    pub service_id: String,
    pub service_name: String,
    pub account_label: Option<String>,
    pub icon_key: String,
    pub quota_dimensions: Vec<QuotaDimension>,
    pub status_label: String,
    pub last_refreshed_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DesktopSurfaceState {
    pub platform: String,
    pub icon_state: String,
    pub summary_mode: String,
    pub summary_text: Option<String>,
    pub panel_visible: bool,
    pub last_opened_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DemoPanelState {
    pub desktop_surface: DesktopSurfaceState,
    pub items: Vec<PanelPlaceholderItem>,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UserPreferences {
    pub language: String,
    pub refresh_interval_minutes: u16,
    pub display_mode: String,
    pub autostart_enabled: bool,
    pub notification_test_enabled: bool,
    pub last_saved_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PreferencePatch {
    pub language: Option<String>,
    pub refresh_interval_minutes: Option<u16>,
    pub display_mode: Option<String>,
    pub autostart_enabled: Option<bool>,
    pub notification_test_enabled: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NotificationCheckResult {
    pub notification_id: String,
    pub triggered_at: String,
    pub result: String,
    pub message_preview: String,
}

pub fn default_preferences() -> UserPreferences {
    UserPreferences {
        language: "zh-CN".into(),
        refresh_interval_minutes: 15,
        display_mode: "icon-plus-percent".into(),
        autostart_enabled: true,
        notification_test_enabled: true,
        last_saved_at: "1970-01-01T00:00:00.000Z".into(),
    }
}

pub struct AppState {
    pub preferences: Mutex<UserPreferences>,
}

impl Default for AppState {
    fn default() -> Self {
        Self {
            preferences: Mutex::new(default_preferences()),
        }
    }
}
