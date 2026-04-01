use crate::registry::PROVIDERS;
use crate::snapshot::SnapshotStatus;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
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

fn default_glm_platform() -> String {
    "global".into()
}

pub const AUTO_ACTIVITY_WINDOW_SECS: u64 = 5 * 60;
pub const AUTO_ROTATION_INTERVAL_SECS: u64 = 15;
pub const AUTO_SCAN_INTERVAL_SECS: u64 = 15;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "kebab-case")]
pub enum ActivitySignalSource {
    CodexStateSqlite,
    CodexSessionIndex,
    CodexLogsSqlite,
    CodexSessionFile,
    ClaudeProjectFile,
    ClaudeHistoryFile,
    ClaudeSessionEnv,
    None,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum ActivityConfidence {
    High,
    Medium,
    Low,
    None,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ServiceActivitySnapshot {
    pub service_id: String,
    pub last_activity_at: Option<u64>,
    pub signal_source: ActivitySignalSource,
    pub confidence: ActivityConfidence,
    pub is_eligible_for_auto: bool,
    pub last_error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum AutoMenubarMode {
    Neutral,
    Single,
    Rotating,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct AutoMenubarSelectionState {
    pub mode: AutoMenubarMode,
    pub current_service_id: Option<String>,
    pub rotation_service_ids: Vec<String>,
    pub last_resolved_at: u64,
    pub last_rotated_at: Option<u64>,
    pub retained_from_previous: bool,
}

impl Default for AutoMenubarSelectionState {
    fn default() -> Self {
        Self {
            mode: AutoMenubarMode::Neutral,
            current_service_id: None,
            rotation_service_ids: Vec::new(),
            last_resolved_at: 0,
            last_rotated_at: None,
            retained_from_previous: false,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct QuotaDimension {
    pub label: String,
    pub remaining_percent: Option<u8>,
    pub remaining_absolute: String,
    #[serde(default)]
    pub resets_at: Option<String>,
    #[serde(default)]
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
    pub status: SnapshotStatus,
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
    #[serde(default = "default_claude_code_usage_enabled", skip_serializing)]
    pub claude_code_usage_enabled: bool,
    #[serde(default = "default_claude_code_disclosure_dismissed_at")]
    pub claude_code_disclosure_dismissed_at: Option<String>,
    #[serde(default)]
    pub provider_enabled: HashMap<String, bool>,
    #[serde(default)]
    pub provider_tokens: HashMap<String, String>,
    #[serde(default = "default_glm_platform")]
    pub glm_platform: String,
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
    pub provider_enabled: Option<HashMap<String, bool>>,
    pub provider_tokens: Option<HashMap<String, String>>,
    pub glm_platform: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NotificationCheckResult {
    pub notification_id: String,
    pub triggered_at: String,
    pub result: String,
    pub message_preview: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct LastSuccessfulPopoverPlacement {
    pub x: i32,
    pub y: i32,
    pub width: u32,
    pub height: u32,
    pub monitor_name: Option<String>,
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
        provider_enabled: HashMap::new(),
        provider_tokens: HashMap::new(),
        glm_platform: default_glm_platform(),
    })
}

fn normalize_service_order(service_order: Vec<String>) -> Vec<String> {
    let known = crate::registry::provider_ids();
    let mut normalized = service_order
        .into_iter()
        .filter(|service_id| known.contains(&service_id.as_str()))
        .fold(Vec::new(), |mut acc, service_id| {
            if !acc.contains(&service_id) {
                acc.push(service_id);
            }
            acc
        });

    for service_id in &known {
        if !normalized.iter().any(|existing| existing == service_id) {
            normalized.push((*service_id).into());
        }
    }

    normalized
}

pub fn normalize_preferences(mut preferences: UserPreferences) -> UserPreferences {
    preferences.refresh_interval_minutes = preferences.refresh_interval_minutes.max(5);
    preferences.service_order = normalize_service_order(preferences.service_order);

    // Seed provider_enabled from registry defaults / legacy field
    if preferences.provider_enabled.is_empty() {
        for provider in PROVIDERS {
            if provider.id == "claude-code" {
                // Migrate legacy claude_code_usage_enabled
                preferences
                    .provider_enabled
                    .insert(provider.id.into(), preferences.claude_code_usage_enabled);
            } else {
                preferences
                    .provider_enabled
                    .insert(provider.id.into(), provider.default_enabled);
            }
        }
    } else {
        // Ensure all registry providers have an entry
        for provider in PROVIDERS {
            preferences
                .provider_enabled
                .entry(provider.id.into())
                .or_insert(provider.default_enabled);
        }
    }

    // Trim whitespace from provider tokens and remove blank entries
    preferences.provider_tokens = preferences
        .provider_tokens
        .into_iter()
        .map(|(k, v)| (k, v.trim().to_string()))
        .filter(|(_, v)| !v.is_empty())
        .collect();

    // Normalize glm_platform
    if preferences.glm_platform != "global" && preferences.glm_platform != "china" {
        preferences.glm_platform = default_glm_platform();
    }

    if preferences.menubar_service == "auto" {
        return preferences;
    }

    let claude_enabled = *preferences
        .provider_enabled
        .get("claude-code")
        .unwrap_or(&false);
    if !claude_enabled && preferences.menubar_service == "claude-code" {
        preferences.menubar_service = "codex".into();
    }

    let known_menubar = crate::registry::menubar_service_ids();
    if !known_menubar.contains(&preferences.menubar_service.as_str()) {
        preferences.menubar_service = "codex".into();
    }

    preferences
}

pub struct AppState {
    pub preferences: Mutex<UserPreferences>,
    pub codex_accounts: Mutex<Vec<CodexAccount>>,
    pub last_successful_popover_placement: Mutex<Option<LastSuccessfulPopoverPlacement>>,
    pub auto_menubar_selection: Mutex<AutoMenubarSelectionState>,
}

impl Default for AppState {
    fn default() -> Self {
        Self {
            preferences: Mutex::new(default_preferences()),
            codex_accounts: Mutex::new(Vec::new()),
            last_successful_popover_placement: Mutex::new(None),
            auto_menubar_selection: Mutex::new(AutoMenubarSelectionState::default()),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::{normalize_preferences, UserPreferences};
    use std::collections::HashMap;

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
        // provider_enabled should default to empty HashMap from serde
        assert!(prefs.provider_enabled.is_empty());

        // After normalization, provider_enabled should be seeded
        let normalized = normalize_preferences(prefs);
        assert_eq!(normalized.provider_enabled.get("codex"), Some(&true));
        assert_eq!(normalized.provider_enabled.get("claude-code"), Some(&false));
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
            provider_enabled: HashMap::new(),
            provider_tokens: HashMap::new(),
            glm_platform: "global".into(),
        });

        assert_eq!(prefs.menubar_service, "codex");
        assert_eq!(prefs.service_order, vec!["claude-code", "codex", "kimi-code", "glm-coding"]);
        assert_eq!(prefs.refresh_interval_minutes, 5);
        // provider_enabled should reflect claude-code disabled (from legacy field)
        assert_eq!(prefs.provider_enabled.get("claude-code"), Some(&false));
    }

    #[test]
    fn keeps_auto_menubar_selection_when_claude_is_disabled() {
        let prefs = normalize_preferences(UserPreferences {
            language: "zh-CN".into(),
            refresh_interval_minutes: 15,
            tray_summary_mode: "lowest-remaining".into(),
            autostart_enabled: true,
            notification_test_enabled: true,
            last_saved_at: "2025-01-01T00:00:00.000Z".into(),
            menubar_service: "auto".into(),
            service_order: vec!["codex".into(), "claude-code".into()],
            network_proxy_mode: "system".into(),
            network_proxy_url: String::new(),
            onboarding_dismissed_at: None,
            claude_code_usage_enabled: false,
            claude_code_disclosure_dismissed_at: None,
            provider_enabled: HashMap::new(),
            provider_tokens: HashMap::new(),
            glm_platform: "global".into(),
        });

        assert_eq!(prefs.menubar_service, "auto");
    }

    #[test]
    fn legacy_claude_code_usage_enabled_migrates_to_provider_enabled() {
        let prefs = normalize_preferences(UserPreferences {
            language: "zh-CN".into(),
            refresh_interval_minutes: 15,
            tray_summary_mode: "lowest-remaining".into(),
            autostart_enabled: true,
            notification_test_enabled: true,
            last_saved_at: "2025-01-01T00:00:00.000Z".into(),
            menubar_service: "codex".into(),
            service_order: vec!["codex".into(), "claude-code".into()],
            network_proxy_mode: "system".into(),
            network_proxy_url: String::new(),
            onboarding_dismissed_at: None,
            claude_code_usage_enabled: true,
            claude_code_disclosure_dismissed_at: None,
            provider_enabled: HashMap::new(),
            provider_tokens: HashMap::new(),
            glm_platform: "global".into(),
        });

        assert_eq!(prefs.provider_enabled.get("codex"), Some(&true));
        assert_eq!(prefs.provider_enabled.get("claude-code"), Some(&true));
    }

    #[test]
    fn existing_provider_enabled_map_is_preserved() {
        let mut provider_enabled = HashMap::new();
        provider_enabled.insert("codex".into(), true);
        provider_enabled.insert("claude-code".into(), true);

        let prefs = normalize_preferences(UserPreferences {
            language: "zh-CN".into(),
            refresh_interval_minutes: 15,
            tray_summary_mode: "lowest-remaining".into(),
            autostart_enabled: true,
            notification_test_enabled: true,
            last_saved_at: "2025-01-01T00:00:00.000Z".into(),
            menubar_service: "codex".into(),
            service_order: vec!["codex".into(), "claude-code".into()],
            network_proxy_mode: "system".into(),
            network_proxy_url: String::new(),
            onboarding_dismissed_at: None,
            claude_code_usage_enabled: false,
            claude_code_disclosure_dismissed_at: None,
            provider_enabled,
            provider_tokens: HashMap::new(),
            glm_platform: "global".into(),
        });

        // Existing map should be preserved, not overridden by legacy field
        assert_eq!(prefs.provider_enabled.get("codex"), Some(&true));
        assert_eq!(prefs.provider_enabled.get("claude-code"), Some(&true));
    }
}
