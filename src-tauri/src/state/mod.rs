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

fn default_network_proxy_mode() -> String {
    "system".into()
}

fn default_network_proxy_url() -> String {
    String::new()
}

fn default_onboarding_dismissed_at() -> Option<String> {
    None
}

fn default_claude_code_usage_enabled() -> bool {
    false
}

fn default_claude_code_disclosure_dismissed_at() -> Option<String> {
    None
}

const KNOWN_SERVICE_IDS: [&str; 2] = ["codex", "claude-code"];

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
    #[serde(alias = "lastRefreshedAt")]
    pub last_successful_refresh_at: String,
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
    #[serde(alias = "updatedAt")]
    pub last_successful_refresh_at: String,
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
    #[serde(default = "default_network_proxy_mode")]
    pub network_proxy_mode: String,
    #[serde(default = "default_network_proxy_url")]
    pub network_proxy_url: String,
    #[serde(default = "default_onboarding_dismissed_at")]
    pub onboarding_dismissed_at: Option<String>,
    #[serde(default = "default_claude_code_usage_enabled")]
    pub claude_code_usage_enabled: bool,
    #[serde(default = "default_claude_code_disclosure_dismissed_at")]
    pub claude_code_disclosure_dismissed_at: Option<String>,
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
    pub network_proxy_mode: Option<String>,
    pub network_proxy_url: Option<String>,
    pub onboarding_dismissed_at: Option<String>,
    pub claude_code_usage_enabled: Option<bool>,
    pub claude_code_disclosure_dismissed_at: Option<String>,
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
    normalize_preferences(UserPreferences {
        language: "zh-CN".into(),
        refresh_interval_minutes: 15,
        tray_summary_mode: "lowest-remaining".into(),
        autostart_enabled: true,
        notification_test_enabled: true,
        last_saved_at: "1970-01-01T00:00:00.000Z".into(),
        menubar_service: default_menubar_service(),
        service_order: default_service_order(),
        network_proxy_mode: default_network_proxy_mode(),
        network_proxy_url: default_network_proxy_url(),
        onboarding_dismissed_at: default_onboarding_dismissed_at(),
        claude_code_usage_enabled: default_claude_code_usage_enabled(),
        claude_code_disclosure_dismissed_at: default_claude_code_disclosure_dismissed_at(),
    })
}

fn normalize_service_order(service_order: Vec<String>) -> Vec<String> {
    let mut normalized = service_order
        .into_iter()
        .filter(|service_id| KNOWN_SERVICE_IDS.contains(&service_id.as_str()))
        .fold(Vec::new(), |mut acc, service_id| {
            if !acc.contains(&service_id) {
                acc.push(service_id);
            }
            acc
        });

    for service_id in KNOWN_SERVICE_IDS {
        if !normalized.iter().any(|existing| existing == service_id) {
            normalized.push(service_id.into());
        }
    }

    normalized
}

pub fn normalize_preferences(mut preferences: UserPreferences) -> UserPreferences {
    preferences.refresh_interval_minutes = preferences.refresh_interval_minutes.max(5);
    preferences.service_order = normalize_service_order(preferences.service_order);

    if !preferences.claude_code_usage_enabled
        && preferences.menubar_service == "claude-code"
    {
        preferences.menubar_service = "codex".into();
    }

    if !KNOWN_SERVICE_IDS.contains(&preferences.menubar_service.as_str()) {
        preferences.menubar_service = "codex".into();
    }

    preferences
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
    use super::{normalize_preferences, UserPreferences};

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
        assert_eq!(prefs.network_proxy_mode, "system");
        assert_eq!(prefs.network_proxy_url, "");
        assert_eq!(prefs.onboarding_dismissed_at, None);
        assert!(!prefs.claude_code_usage_enabled);
        assert_eq!(prefs.claude_code_disclosure_dismissed_at, None);
        assert_eq!(prefs.refresh_interval_minutes, 20);
        assert_eq!(prefs.tray_summary_mode, "window-5h");
    }

    #[test]
    fn normalizes_disabled_claude_menubar_selection() {
        let prefs = normalize_preferences(UserPreferences {
            language: "zh-CN".into(),
            refresh_interval_minutes: 1,
            tray_summary_mode: "lowest-remaining".into(),
            autostart_enabled: false,
            notification_test_enabled: true,
            last_saved_at: "2025-01-01T00:00:00.000Z".into(),
            menubar_service: "claude-code".into(),
            service_order: vec!["unknown".into(), "claude-code".into()],
            network_proxy_mode: "system".into(),
            network_proxy_url: String::new(),
            onboarding_dismissed_at: None,
            claude_code_usage_enabled: false,
            claude_code_disclosure_dismissed_at: None,
        });

        assert_eq!(prefs.menubar_service, "codex");
        assert_eq!(prefs.service_order, vec!["claude-code", "codex"]);
        assert_eq!(prefs.refresh_interval_minutes, 5);
    }
}
