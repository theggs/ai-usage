use crate::autostart::set_autostart_status;
use crate::claude_code::{
    clear_access_pause as clear_claude_code_access_pause,
    load_snapshot as load_claude_code_snapshot, seed_stale_cache as seed_claude_code_stale_cache,
    RefreshKind as ClaudeCodeRefreshKind,
};
use crate::codex::{load_snapshot, save_accounts, save_preferences as persist_preferences_file};
use crate::notifications::send_demo_notification;
use crate::state::{
    ActiveCodexSession, AppState, CodexAccount, CodexAccountDraft, CodexPanelState,
    DesktopSurfaceState, NotificationCheckResult, PanelPlaceholderItem, PreferencePatch,
    UserPreferences,
};
use crate::tray::apply_display_mode;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Manager, State};

const MIN_CLAUDE_REFRESH_COOLDOWN_SECS: u64 = 60;

fn now_iso() -> String {
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();
    format!("{now}")
}

fn now_unix_secs() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs()
}

// ---------------------------------------------------------------------------
// Snapshot cache — persists panel state to disk so restarts can reuse recent
// data without re-fetching.  The cache file sits alongside preferences.json.
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
struct SnapshotCache {
    services: HashMap<String, CodexPanelState>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RuntimeFlags {
    pub is_e2_e: bool,
}

fn snapshot_cache_path() -> std::path::PathBuf {
    if let Ok(path) = std::env::var("AI_USAGE_SNAPSHOT_CACHE_FILE") {
        return std::path::PathBuf::from(path);
    }
    let mut path = crate::codex::preferences_path();
    path.set_file_name("snapshot-cache.json");
    path
}

fn read_snapshot_cache() -> SnapshotCache {
    let path = snapshot_cache_path();
    std::fs::read_to_string(path)
        .ok()
        .and_then(|contents| serde_json::from_str::<SnapshotCache>(&contents).ok())
        .unwrap_or_default()
}

fn write_snapshot_cache(cache: &SnapshotCache) {
    let path = snapshot_cache_path();
    if let Some(parent) = path.parent() {
        let _ = std::fs::create_dir_all(parent);
    }
    if let Ok(payload) = serde_json::to_string(cache) {
        let _ = std::fs::write(path, payload);
    }
}

fn save_to_snapshot_cache(service_id: &str, state: &CodexPanelState) {
    let mut cache = read_snapshot_cache();
    cache.services.insert(service_id.into(), state.clone());
    write_snapshot_cache(&cache);
}

fn effective_refresh_timestamp(
    service_id: &str,
    snapshot_state: &str,
    refreshed_at: &str,
) -> String {
    if snapshot_state == "fresh" {
        return refreshed_at.into();
    }

    read_snapshot_cache()
        .services
        .get(service_id)
        .map(|state| state.last_successful_refresh_at.clone())
        .unwrap_or_else(|| refreshed_at.into())
}

/// Returns a cached panel state if it exists and is fresh enough
/// (i.e., `now - last_successful_refresh_at < refresh_interval`).  The returned state
/// has its `snapshot_state` set to `"stale"` so the UI knows it is cached.
fn load_from_snapshot_cache(
    service_id: &str,
    refresh_interval_minutes: u16,
) -> Option<CodexPanelState> {
    let cache = read_snapshot_cache();
    let entry = cache.services.get(service_id)?;

    let cached_at: u64 = entry.last_successful_refresh_at.parse().ok()?;
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();

    let age_secs = now.saturating_sub(cached_at);
    let interval_secs = u64::from(refresh_interval_minutes) * 60;

    if age_secs < interval_secs {
        let mut restored = entry.clone();
        // Mark as stale so the user knows this is cached data, not a live fetch.
        if restored.snapshot_state == "fresh" {
            restored.snapshot_state = "stale".into();
        }
        Some(restored)
    } else {
        None
    }
}

fn is_claude_code_usage_enabled(preferences: &UserPreferences) -> bool {
    preferences.claude_code_usage_enabled
}

fn parse_refresh_timestamp(value: &str) -> Option<u64> {
    value.parse::<u64>().ok()
}

fn claude_refresh_cooldown_hit() -> bool {
    read_snapshot_cache()
        .services
        .get("claude-code")
        .and_then(|state| parse_refresh_timestamp(&state.last_successful_refresh_at))
        .map(|last_success| {
            now_unix_secs().saturating_sub(last_success) < MIN_CLAUDE_REFRESH_COOLDOWN_SECS
        })
        .unwrap_or(false)
}

fn normalize_summary_mode(summary_mode: &str) -> String {
    summary_mode.to_string()
}

fn normalize_icon_state(snapshot_state: &str) -> String {
    match snapshot_state {
        "fresh" => "idle".into(),
        _ => "attention".into(),
    }
}

fn quota_status(remaining_percent: Option<u8>) -> String {
    match remaining_percent {
        Some(percent) if percent > 50 => "healthy".into(),
        Some(percent) if percent >= 20 => "warning".into(),
        Some(_) => "exhausted".into(),
        None => "unknown".into(),
    }
}

fn quota_progress_tone(remaining_percent: Option<u8>) -> String {
    match remaining_percent {
        Some(percent) if percent > 50 => "success".into(),
        Some(percent) if percent >= 20 => "warning".into(),
        Some(_) => "danger".into(),
        None => "muted".into(),
    }
}

fn normalize_dimensions(
    dimensions: &[crate::state::QuotaDimension],
) -> Vec<crate::state::QuotaDimension> {
    dimensions
        .iter()
        .cloned()
        .map(|mut dimension| {
            dimension.status = quota_status(dimension.remaining_percent);
            dimension.progress_tone = quota_progress_tone(dimension.remaining_percent);
            dimension
        })
        .collect()
}

fn build_panel_state(
    preferences: &UserPreferences,
    accounts: &[CodexAccount],
    refreshed_at: &str,
) -> CodexPanelState {
    let configured_account_count = accounts.len();
    let enabled_accounts = accounts
        .iter()
        .filter(|account| account.enabled)
        .cloned()
        .collect::<Vec<_>>();
    let enabled_account_count = enabled_accounts.len();

    let snapshot = load_snapshot();
    let effective_refreshed_at =
        effective_refresh_timestamp("codex", &snapshot.snapshot_state, refreshed_at);
    let active_session = if snapshot.connection_state == "connected" {
        Some(ActiveCodexSession {
            session_id: "local-codex-session".into(),
            account_id: None,
            session_label: "Local Codex CLI".into(),
            connection_state: snapshot.connection_state.clone(),
            last_checked_at: effective_refreshed_at.clone(),
            source: snapshot.source.clone(),
        })
    } else {
        None
    };

    let items = if snapshot.dimensions.is_empty() {
        Vec::new()
    } else {
        vec![PanelPlaceholderItem {
            service_id: "codex".into(),
            service_name: "Codex".into(),
            account_label: None,
            icon_key: "codex".into(),
            quota_dimensions: normalize_dimensions(&snapshot.dimensions),
            status_label: "refreshing".into(),
            badge_label: Some(if snapshot.snapshot_state == "fresh" {
                "Live".into()
            } else {
                snapshot.snapshot_state.clone()
            }),
            last_successful_refresh_at: effective_refreshed_at.clone(),
        }]
    };

    CodexPanelState {
        desktop_surface: DesktopSurfaceState {
            platform: if cfg!(target_os = "macos") {
                "macos".into()
            } else {
                "windows".into()
            },
            icon_state: normalize_icon_state(&snapshot.snapshot_state),
            summary_mode: normalize_summary_mode(&preferences.tray_summary_mode),
            summary_text: None,
            panel_visible: false,
            last_opened_at: None,
        },
        items,
        configured_account_count,
        enabled_account_count,
        snapshot_state: snapshot.snapshot_state,
        status_message: snapshot.status_message,
        active_session,
        last_successful_refresh_at: effective_refreshed_at,
    }
}

pub fn build_tray_items(
    preferences: &UserPreferences,
    accounts: &[CodexAccount],
    refreshed_at: &str,
) -> Vec<PanelPlaceholderItem> {
    // Tray initialization uses the snapshot cache when available to avoid
    // unnecessary API calls on startup (especially during dev hot-reloads).
    let codex_items = if let Some(cached) =
        load_from_snapshot_cache("codex", preferences.refresh_interval_minutes)
    {
        cached.items
    } else {
        let result = build_panel_state(preferences, accounts, refreshed_at);
        save_to_snapshot_cache("codex", &result);
        result.items
    };

    let mut items = codex_items;
    if is_claude_code_usage_enabled(preferences) {
        let claude_items = if let Some(cached) =
            load_from_snapshot_cache("claude-code", preferences.refresh_interval_minutes)
        {
            let dims: Vec<_> = cached
                .items
                .iter()
                .flat_map(|item| item.quota_dimensions.clone())
                .collect();
            seed_claude_code_stale_cache(dims);
            cached.items
        } else {
            let result = build_claude_code_panel_state(preferences, refreshed_at);
            save_to_snapshot_cache("claude-code", &result);
            result.items
        };
        items.extend(claude_items);
    }
    items
}

pub fn build_claude_code_items(
    preferences: &UserPreferences,
    refreshed_at: &str,
    refresh_kind: ClaudeCodeRefreshKind,
) -> Vec<PanelPlaceholderItem> {
    let snapshot = load_claude_code_snapshot(preferences, refresh_kind);
    let effective_refreshed_at =
        effective_refresh_timestamp("claude-code", &snapshot.snapshot_state, refreshed_at);
    if snapshot.dimensions.is_empty() {
        return Vec::new();
    }
    vec![PanelPlaceholderItem {
        service_id: "claude-code".into(),
        service_name: "Claude Code".into(),
        account_label: None,
        icon_key: "claude-code".into(),
        quota_dimensions: normalize_dimensions(&snapshot.dimensions),
        status_label: "refreshing".into(),
        badge_label: Some(if snapshot.snapshot_state == "fresh" {
            "Live".into()
        } else {
            snapshot.snapshot_state.clone()
        }),
        last_successful_refresh_at: effective_refreshed_at,
    }]
}

fn build_claude_code_panel_state(
    preferences: &UserPreferences,
    refreshed_at: &str,
) -> CodexPanelState {
    build_claude_code_panel_state_with_kind(
        preferences,
        refreshed_at,
        ClaudeCodeRefreshKind::Automatic,
    )
}

fn empty_claude_code_panel_state(
    preferences: &UserPreferences,
    refreshed_at: &str,
    status_message: &str,
) -> CodexPanelState {
    CodexPanelState {
        desktop_surface: DesktopSurfaceState {
            platform: if cfg!(target_os = "macos") {
                "macos".into()
            } else {
                "windows".into()
            },
            icon_state: "attention".into(),
            summary_mode: normalize_summary_mode(&preferences.tray_summary_mode),
            summary_text: None,
            panel_visible: false,
            last_opened_at: None,
        },
        items: Vec::new(),
        configured_account_count: 0,
        enabled_account_count: 0,
        snapshot_state: "empty".into(),
        status_message: status_message.into(),
        active_session: None,
        last_successful_refresh_at: refreshed_at.into(),
    }
}

fn claude_code_disabled_panel_state(
    preferences: &UserPreferences,
    refreshed_at: &str,
) -> CodexPanelState {
    empty_claude_code_panel_state(
        preferences,
        refreshed_at,
        "Claude Code usage query is disabled.",
    )
}

fn build_claude_code_panel_state_with_kind(
    preferences: &UserPreferences,
    refreshed_at: &str,
    refresh_kind: ClaudeCodeRefreshKind,
) -> CodexPanelState {
    let snapshot = load_claude_code_snapshot(preferences, refresh_kind);
    let effective_refreshed_at =
        effective_refresh_timestamp("claude-code", &snapshot.snapshot_state, refreshed_at);
    let items = if snapshot.dimensions.is_empty() {
        Vec::new()
    } else {
        vec![PanelPlaceholderItem {
            service_id: "claude-code".into(),
            service_name: "Claude Code".into(),
            account_label: None,
            icon_key: "claude-code".into(),
            quota_dimensions: normalize_dimensions(&snapshot.dimensions),
            status_label: "refreshing".into(),
            badge_label: Some(if snapshot.snapshot_state == "fresh" {
                "Live".into()
            } else {
                snapshot.snapshot_state.clone()
            }),
            last_successful_refresh_at: effective_refreshed_at.clone(),
        }]
    };

    CodexPanelState {
        desktop_surface: DesktopSurfaceState {
            platform: if cfg!(target_os = "macos") {
                "macos".into()
            } else {
                "windows".into()
            },
            icon_state: normalize_icon_state(&snapshot.snapshot_state),
            summary_mode: normalize_summary_mode(&preferences.tray_summary_mode),
            summary_text: None,
            panel_visible: false,
            last_opened_at: None,
        },
        items,
        configured_account_count: 0,
        enabled_account_count: 0,
        snapshot_state: snapshot.snapshot_state,
        status_message: snapshot.status_message,
        active_session: None,
        last_successful_refresh_at: effective_refreshed_at,
    }
}

fn merge_preferences(patch: PreferencePatch, mut current: UserPreferences) -> UserPreferences {
    if let Some(language) = patch.language {
        current.language = language;
    }
    if let Some(interval) = patch.refresh_interval_minutes {
        current.refresh_interval_minutes = interval.max(5);
    }
    if let Some(tray_summary_mode) = patch.tray_summary_mode {
        current.tray_summary_mode = tray_summary_mode;
    }
    if let Some(autostart_enabled) = patch.autostart_enabled {
        current.autostart_enabled = autostart_enabled;
    }
    if let Some(notification_test_enabled) = patch.notification_test_enabled {
        current.notification_test_enabled = notification_test_enabled;
    }
    if let Some(menubar_service) = patch.menubar_service {
        current.menubar_service = menubar_service;
    }
    if let Some(service_order) = patch.service_order {
        current.service_order = service_order;
    }
    if let Some(network_proxy_mode) = patch.network_proxy_mode {
        current.network_proxy_mode = network_proxy_mode;
    }
    if let Some(network_proxy_url) = patch.network_proxy_url {
        current.network_proxy_url = network_proxy_url;
    }
    if let Some(onboarding_dismissed_at) = patch.onboarding_dismissed_at {
        current.onboarding_dismissed_at = if onboarding_dismissed_at.trim().is_empty() {
            None
        } else {
            Some(onboarding_dismissed_at)
        };
    }
    if let Some(claude_code_usage_enabled) = patch.claude_code_usage_enabled {
        current.claude_code_usage_enabled = claude_code_usage_enabled;
    }
    if let Some(claude_code_disclosure_dismissed_at) =
        patch.claude_code_disclosure_dismissed_at
    {
        current.claude_code_disclosure_dismissed_at =
            if claude_code_disclosure_dismissed_at.trim().is_empty() {
                None
            } else {
                Some(claude_code_disclosure_dismissed_at)
            };
    }
    current.last_saved_at = now_iso();
    crate::state::normalize_preferences(current)
}

fn persist_accounts(accounts: &[CodexAccount]) {
    if let Err(error) = save_accounts(accounts) {
        eprintln!("{error}");
    }
}

fn persist_preferences(preferences: &UserPreferences) {
    if let Err(error) = persist_preferences_file(preferences) {
        eprintln!("{error}");
    }
}

fn normalize_text(value: &str) -> String {
    value.split_whitespace().collect::<Vec<_>>().join(" ")
}

fn normalize_optional_text(value: Option<String>) -> Option<String> {
    value
        .map(|part| normalize_text(&part))
        .filter(|part| !part.is_empty())
}

fn next_account_id(alias: &str) -> String {
    let base = alias
        .to_ascii_lowercase()
        .chars()
        .map(|ch| if ch.is_ascii_alphanumeric() { ch } else { '-' })
        .collect::<String>()
        .trim_matches('-')
        .to_string();
    if base.is_empty() {
        format!("codex-account-{}", now_iso())
    } else {
        format!("codex-{base}-{}", now_iso())
    }
}

fn build_account(draft: CodexAccountDraft) -> CodexAccount {
    let alias = normalize_text(&draft.alias);
    let credential_label = normalize_text(&draft.credential_label);
    let organization_label = normalize_optional_text(draft.organization_label);
    let timestamp = now_iso();

    CodexAccount {
        id: next_account_id(&alias),
        alias,
        credential_label,
        organization_label,
        enabled: true,
        status: "reserved".into(),
        created_at: timestamp.clone(),
        updated_at: timestamp,
    }
}

#[tauri::command]
pub fn get_codex_panel_state(state: State<'_, AppState>) -> CodexPanelState {
    let preferences = state.preferences.lock().unwrap().clone();
    if let Some(cached) = load_from_snapshot_cache("codex", preferences.refresh_interval_minutes) {
        return cached;
    }
    let accounts = state.codex_accounts.lock().unwrap().clone();
    let result = build_panel_state(&preferences, &accounts, &now_iso());
    save_to_snapshot_cache("codex", &result);
    result
}

#[tauri::command]
pub fn refresh_codex_panel_state(app: AppHandle, state: State<'_, AppState>) -> CodexPanelState {
    let preferences = state.preferences.lock().unwrap().clone();
    let accounts = state.codex_accounts.lock().unwrap().clone();
    let result = build_panel_state(&preferences, &accounts, &now_iso());
    save_to_snapshot_cache("codex", &result);
    let items = build_tray_items(&preferences, &accounts, &result.last_successful_refresh_at);
    apply_display_mode(&app, &preferences, &items);
    result
}

#[tauri::command]
pub fn get_codex_accounts(state: State<'_, AppState>) -> Vec<CodexAccount> {
    state.codex_accounts.lock().unwrap().clone()
}

#[tauri::command]
pub fn save_codex_account(
    state: State<'_, AppState>,
    draft: CodexAccountDraft,
) -> Vec<CodexAccount> {
    let mut accounts = state.codex_accounts.lock().unwrap();
    accounts.push(build_account(draft));
    persist_accounts(&accounts);
    accounts.clone()
}

#[tauri::command]
pub fn remove_codex_account(state: State<'_, AppState>, account_id: String) -> Vec<CodexAccount> {
    let mut accounts = state.codex_accounts.lock().unwrap();
    accounts.retain(|account| account.id != account_id);
    persist_accounts(&accounts);
    accounts.clone()
}

#[tauri::command]
pub fn set_codex_account_enabled(
    state: State<'_, AppState>,
    account_id: String,
    enabled: bool,
) -> Vec<CodexAccount> {
    let mut accounts = state.codex_accounts.lock().unwrap();
    for account in accounts.iter_mut() {
        if account.id == account_id {
            account.enabled = enabled;
            account.updated_at = now_iso();
        }
    }
    persist_accounts(&accounts);
    accounts.clone()
}

#[tauri::command]
pub fn get_preferences(state: State<'_, AppState>) -> UserPreferences {
    state.preferences.lock().unwrap().clone()
}

#[tauri::command]
pub fn get_runtime_flags() -> RuntimeFlags {
    RuntimeFlags {
        is_e2_e: std::env::var("AI_USAGE_E2E_SHELL_HOOKS").unwrap_or_default() == "1",
    }
}

#[tauri::command]
pub fn hide_main_window(app: AppHandle) -> bool {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.hide();
        crate::tray::record_e2e_window_hidden();
        true
    } else {
        false
    }
}

#[tauri::command]
pub fn save_preferences(
    app: AppHandle,
    state: State<'_, AppState>,
    patch: PreferencePatch,
) -> UserPreferences {
    let current = state.preferences.lock().unwrap().clone();
    let next = merge_preferences(patch, current);
    if next.network_proxy_mode != state.preferences.lock().unwrap().network_proxy_mode
        || next.network_proxy_url != state.preferences.lock().unwrap().network_proxy_url
    {
        clear_claude_code_access_pause();
    }
    let refreshed_at = now_iso();
    let merged_items = {
        let accounts = state.codex_accounts.lock().unwrap().clone();
        build_tray_items(&next, &accounts, &refreshed_at)
    };
    apply_display_mode(&app, &next, &merged_items);
    persist_preferences(&next);
    *state.preferences.lock().unwrap() = next.clone();
    next
}

#[tauri::command]
pub fn set_autostart(app: AppHandle, state: State<'_, AppState>, enabled: bool) -> UserPreferences {
    let current = state.preferences.lock().unwrap().clone();
    let next = set_autostart_status(enabled, current);
    let refreshed_at = now_iso();
    let merged_items = {
        let accounts = state.codex_accounts.lock().unwrap().clone();
        build_tray_items(&next, &accounts, &refreshed_at)
    };
    apply_display_mode(&app, &next, &merged_items);
    persist_preferences(&next);
    *state.preferences.lock().unwrap() = next.clone();
    next
}

#[tauri::command]
pub fn get_claude_code_panel_state(state: State<'_, AppState>) -> CodexPanelState {
    let preferences = state.preferences.lock().unwrap().clone();
    if !is_claude_code_usage_enabled(&preferences) {
        return claude_code_disabled_panel_state(&preferences, &now_iso());
    }
    if let Some(cached) =
        load_from_snapshot_cache("claude-code", preferences.refresh_interval_minutes)
    {
        // Seed in-memory stale cache so session-recovery (401) handler has
        // data to display if the token expires before the next live fetch.
        let dims: Vec<_> = cached
            .items
            .iter()
            .flat_map(|item| item.quota_dimensions.clone())
            .collect();
        seed_claude_code_stale_cache(dims);
        return cached;
    }
    let result = build_claude_code_panel_state(&preferences, &now_iso());
    save_to_snapshot_cache("claude-code", &result);
    result
}

#[tauri::command]
pub fn refresh_claude_code_panel_state(
    app: AppHandle,
    state: State<'_, AppState>,
) -> CodexPanelState {
    let preferences = state.preferences.lock().unwrap().clone();
    if !is_claude_code_usage_enabled(&preferences) {
        let result = claude_code_disabled_panel_state(&preferences, &now_iso());
        let accounts = state.codex_accounts.lock().unwrap().clone();
        let items = build_tray_items(&preferences, &accounts, &result.last_successful_refresh_at);
        apply_display_mode(&app, &preferences, &items);
        return result;
    }
    if claude_refresh_cooldown_hit() {
        if let Some(cached) =
            load_from_snapshot_cache("claude-code", preferences.refresh_interval_minutes)
        {
            let accounts = state.codex_accounts.lock().unwrap().clone();
            let items = build_tray_items(&preferences, &accounts, &cached.last_successful_refresh_at);
            apply_display_mode(&app, &preferences, &items);
            return cached;
        }
    }
    let result = build_claude_code_panel_state_with_kind(
        &preferences,
        &now_iso(),
        ClaudeCodeRefreshKind::Manual,
    );
    save_to_snapshot_cache("claude-code", &result);
    let accounts = state.codex_accounts.lock().unwrap().clone();
    let items = build_tray_items(&preferences, &accounts, &result.last_successful_refresh_at);
    apply_display_mode(&app, &preferences, &items);
    result
}

#[tauri::command]
pub fn send_test_notification(message: Option<String>) -> NotificationCheckResult {
    send_demo_notification(message)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::env;
    use std::sync::{Mutex, OnceLock};

    fn env_lock() -> &'static Mutex<()> {
        static LOCK: OnceLock<Mutex<()>> = OnceLock::new();
        LOCK.get_or_init(|| Mutex::new(()))
    }

    fn make_panel_state(service_id: &str, last_successful_refresh_at: &str) -> CodexPanelState {
        CodexPanelState {
            desktop_surface: DesktopSurfaceState {
                platform: "macos".into(),
                icon_state: "idle".into(),
                summary_mode: "lowest-remaining".into(),
                summary_text: None,
                panel_visible: false,
                last_opened_at: None,
            },
            items: vec![PanelPlaceholderItem {
                service_id: service_id.into(),
                service_name: "Test".into(),
                account_label: None,
                icon_key: service_id.into(),
                quota_dimensions: vec![],
                status_label: "refreshing".into(),
                badge_label: Some("Live".into()),
                last_successful_refresh_at: last_successful_refresh_at.into(),
            }],
            configured_account_count: 0,
            enabled_account_count: 0,
            snapshot_state: "fresh".into(),
            status_message: "ok".into(),
            active_session: None,
            last_successful_refresh_at: last_successful_refresh_at.into(),
        }
    }

    #[test]
    fn snapshot_cache_round_trip() {
        let _guard = env_lock().lock().unwrap();
        let tmp = env::temp_dir().join(format!("ai-usage-test-{}", now_iso()));
        std::fs::create_dir_all(&tmp).unwrap();
        env::set_var(
            "AI_USAGE_SNAPSHOT_CACHE_FILE",
            tmp.join("snapshot-cache.json"),
        );

        let state = make_panel_state("test-svc", &now_iso());
        save_to_snapshot_cache("test-svc", &state);

        // Fresh cache should be returned.
        let loaded = load_from_snapshot_cache("test-svc", 15);
        assert!(loaded.is_some());
        let loaded = loaded.unwrap();
        assert_eq!(loaded.snapshot_state, "stale"); // marked stale
        assert_eq!(loaded.items.len(), 1);

        // Non-existent service returns None.
        assert!(load_from_snapshot_cache("other-svc", 15).is_none());

        // Cleanup
        let _ = std::fs::remove_dir_all(&tmp);
        env::remove_var("AI_USAGE_SNAPSHOT_CACHE_FILE");
    }

    #[test]
    fn snapshot_cache_expired_returns_none() {
        let _guard = env_lock().lock().unwrap();
        let tmp = env::temp_dir().join(format!("ai-usage-test-expired-{}", now_iso()));
        std::fs::create_dir_all(&tmp).unwrap();
        env::set_var(
            "AI_USAGE_SNAPSHOT_CACHE_FILE",
            tmp.join("snapshot-cache.json"),
        );

        // Create a state with an old timestamp (2 hours ago).
        let old_ts = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs()
            - 7200;
        let state = make_panel_state("test-svc", &format!("{old_ts}"));
        save_to_snapshot_cache("test-svc", &state);

        // With a 15-minute interval, 2-hour-old data should be expired.
        assert!(load_from_snapshot_cache("test-svc", 15).is_none());

        // Cleanup
        let _ = std::fs::remove_dir_all(&tmp);
        env::remove_var("AI_USAGE_SNAPSHOT_CACHE_FILE");
    }

    #[test]
    fn failed_refresh_preserves_previous_success_timestamp() {
        let _guard = env_lock().lock().unwrap();
        let tmp = env::temp_dir().join(format!("ai-usage-test-preserve-ts-{}", now_iso()));
        std::fs::create_dir_all(&tmp).unwrap();
        env::set_var(
            "AI_USAGE_SNAPSHOT_CACHE_FILE",
            tmp.join("snapshot-cache.json"),
        );

        let previous = make_panel_state("claude-code", "100");
        save_to_snapshot_cache("claude-code", &previous);

        assert_eq!(
            effective_refresh_timestamp("claude-code", "stale", "200"),
            "100"
        );
        assert_eq!(
            effective_refresh_timestamp("claude-code", "failed", "200"),
            "100"
        );
        assert_eq!(
            effective_refresh_timestamp("claude-code", "fresh", "200"),
            "200"
        );

        let _ = std::fs::remove_dir_all(&tmp);
        env::remove_var("AI_USAGE_SNAPSHOT_CACHE_FILE");
    }

    #[test]
    fn build_tray_items_uses_latest_cached_refresh_states_for_all_services() {
        let _guard = env_lock().lock().unwrap();
        let tmp = env::temp_dir().join(format!("ai-usage-test-tray-refresh-{}", now_iso()));
        std::fs::create_dir_all(&tmp).unwrap();
        env::set_var(
            "AI_USAGE_SNAPSHOT_CACHE_FILE",
            tmp.join("snapshot-cache.json"),
        );

        let refreshed_at = now_iso();
        let mut codex_state = make_panel_state("codex", &refreshed_at);
        codex_state.items[0].service_name = "Codex".into();
        let mut claude_state = make_panel_state("claude-code", &refreshed_at);
        claude_state.items[0].service_name = "Claude Code".into();

        save_to_snapshot_cache("codex", &codex_state);
        save_to_snapshot_cache("claude-code", &claude_state);

        let mut preferences = crate::state::default_preferences();
        preferences.claude_code_usage_enabled = true;
        let items = build_tray_items(&preferences, &[], &refreshed_at);

        assert_eq!(items.len(), 2);
        assert!(items.iter().any(|item| item.service_id == "codex"));
        assert!(items.iter().any(|item| item.service_id == "claude-code"));

        let _ = std::fs::remove_dir_all(&tmp);
        env::remove_var("AI_USAGE_SNAPSHOT_CACHE_FILE");
    }

    #[test]
    fn build_tray_items_hides_claude_when_usage_disabled() {
        let _guard = env_lock().lock().unwrap();
        let tmp = env::temp_dir().join(format!("ai-usage-test-tray-disabled-{}", now_iso()));
        std::fs::create_dir_all(&tmp).unwrap();
        env::set_var(
            "AI_USAGE_SNAPSHOT_CACHE_FILE",
            tmp.join("snapshot-cache.json"),
        );

        let refreshed_at = now_iso();
        save_to_snapshot_cache("codex", &make_panel_state("codex", &refreshed_at));
        save_to_snapshot_cache("claude-code", &make_panel_state("claude-code", &refreshed_at));

        let mut preferences = crate::state::default_preferences();
        preferences.claude_code_usage_enabled = false;
        let items = build_tray_items(&preferences, &[], &refreshed_at);

        assert_eq!(items.len(), 1);
        assert!(items.iter().all(|item| item.service_id != "claude-code"));

        let _ = std::fs::remove_dir_all(&tmp);
        env::remove_var("AI_USAGE_SNAPSHOT_CACHE_FILE");
    }

    #[test]
    fn claude_refresh_cooldown_hits_recent_cached_result() {
        let _guard = env_lock().lock().unwrap();
        let tmp = env::temp_dir().join(format!("ai-usage-test-cooldown-{}", now_iso()));
        std::fs::create_dir_all(&tmp).unwrap();
        env::set_var(
            "AI_USAGE_SNAPSHOT_CACHE_FILE",
            tmp.join("snapshot-cache.json"),
        );

        save_to_snapshot_cache("claude-code", &make_panel_state("claude-code", &now_iso()));

        assert!(claude_refresh_cooldown_hit());

        let _ = std::fs::remove_dir_all(&tmp);
        env::remove_var("AI_USAGE_SNAPSHOT_CACHE_FILE");
    }
}
