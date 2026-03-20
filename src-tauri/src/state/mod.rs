use serde::{Deserialize, Serialize};
use std::sync::Mutex;

fn default_tray_summary_mode() -> String {
    "lowest-remaining".into()
}

fn default_menubar_service() -> String {
    "codex".into()
}

fn default_service_order() -> Vec<String> {
    vec!["codex".into(), "claude-code".into()]
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct QuotaDimension {
    pub label: String,
    pub remaining_percent: Option<u8>,
    pub remaining_absolute: String,
    pub reset_hint: Option<String>,
    pub status: String,
    pub progress_tone: String,
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
    pub badge_label: Option<String>,
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
pub struct ActiveCodexSession {
    pub session_id: String,
    pub account_id: Option<String>,
    pub session_label: String,
    pub connection_state: String,
    pub last_checked_at: String,
    pub source: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CodexPanelState {
    pub desktop_surface: DesktopSurfaceState,
    pub items: Vec<PanelPlaceholderItem>,
    pub configured_account_count: usize,
    pub enabled_account_count: usize,
    pub snapshot_state: String,
    pub status_message: String,
    pub active_session: Option<ActiveCodexSession>,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UserPreferences {
    pub language: String,
    pub refresh_interval_minutes: u16,
    #[serde(default = "default_tray_summary_mode", alias = "displayMode")]
    pub tray_summary_mode: String,
    pub autostart_enabled: bool,
    pub notification_test_enabled: bool,
    pub last_saved_at: String,
    #[serde(default = "default_menubar_service")]
    pub menubar_service: String,
    #[serde(default = "default_service_order")]
    pub service_order: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PreferencePatch {
    pub language: Option<String>,
    pub refresh_interval_minutes: Option<u16>,
    #[serde(alias = "displayMode")]
    pub tray_summary_mode: Option<String>,
    pub autostart_enabled: Option<bool>,
    pub notification_test_enabled: Option<bool>,
    pub menubar_service: Option<String>,
    pub service_order: Option<Vec<String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NotificationCheckResult {
    pub notification_id: String,
    pub triggered_at: String,
    pub result: String,
    pub message_preview: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CodexAccount {
    pub id: String,
    pub alias: String,
    pub credential_label: String,
    pub organization_label: Option<String>,
    pub enabled: bool,
    pub status: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CodexAccountDraft {
    pub alias: String,
    pub credential_label: String,
    pub organization_label: Option<String>,
}

pub fn default_preferences() -> UserPreferences {
    UserPreferences {
        language: "zh-CN".into(),
        refresh_interval_minutes: 15,
        tray_summary_mode: "lowest-remaining".into(),
        autostart_enabled: true,
        notification_test_enabled: true,
        last_saved_at: "1970-01-01T00:00:00.000Z".into(),
        menubar_service: default_menubar_service(),
        service_order: default_service_order(),
    }
}

pub struct AppState {
    pub preferences: Mutex<UserPreferences>,
    pub codex_accounts: Mutex<Vec<CodexAccount>>,
}

impl Default for AppState {
    fn default() -> Self {
        Self {
            preferences: Mutex::new(default_preferences()),
            codex_accounts: Mutex::new(Vec::new()),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::UserPreferences;

    // T022: Backward-compatibility gate — existing preference files without
    // the new fields must deserialize cleanly and pick up defaults.
    #[test]
    fn deserializes_legacy_preferences_with_defaults() {
        // A minimal preferences JSON that omits menubarService and serviceOrder
        // (as would be saved by an older version of the app).
        let json = r#"{
            "language": "zh-CN",
            "refreshIntervalMinutes": 20,
            "traySummaryMode": "window-5h",
            "autostartEnabled": false,
            "notificationTestEnabled": true,
            "lastSavedAt": "2025-01-01T00:00:00.000Z"
        }"#;

        let prefs: UserPreferences = serde_json::from_str(json)
            .expect("legacy preferences should deserialize without new fields");

        assert_eq!(prefs.menubar_service, "codex");
        assert_eq!(prefs.service_order, vec!["codex", "claude-code"]);
        assert_eq!(prefs.refresh_interval_minutes, 20);
        assert_eq!(prefs.tray_summary_mode, "window-5h");
    }
}
