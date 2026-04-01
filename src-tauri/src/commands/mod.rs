use crate::agent_activity::{
    collect_service_activity_snapshots, resolve_auto_menubar_selection,
};
use crate::autostart::set_autostart_status;
use crate::claude_code::clear_access_pause as clear_claude_code_access_pause;
use crate::codex::{save_accounts, save_preferences as persist_preferences_file};
use crate::notifications::send_demo_notification;
use crate::pipeline;
use crate::snapshot::SnapshotStatus;
use crate::state::{
    ActiveCodexSession, AppState, AutoMenubarSelectionState, BurnRateSample, CodexAccount,
    CodexAccountDraft, CodexPanelState, DesktopSurfaceState, NotificationCheckResult,
    PanelPlaceholderItem, PreferencePatch, UserPreferences,
};
use crate::tray::apply_display_mode;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Manager, State};

const MIN_CLAUDE_REFRESH_COOLDOWN_SECS: u64 = 60;
const SNAPSHOT_CACHE_VERSION: u32 = 1;

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
    #[serde(default)]
    schema_version: u32,
    services: HashMap<String, CodexPanelState>,
    #[serde(default)]
    burn_rate_history: HashMap<String, Vec<BurnRateSample>>,
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
    let cache = std::fs::read_to_string(path)
        .ok()
        .and_then(|contents| serde_json::from_str::<SnapshotCache>(&contents).ok())
        .unwrap_or_default();

    if cache.schema_version != SNAPSHOT_CACHE_VERSION {
        return SnapshotCache {
            schema_version: SNAPSHOT_CACHE_VERSION,
            services: HashMap::new(),
            burn_rate_history: HashMap::new(),
        };
    }

    cache
}

fn write_snapshot_cache(cache: &SnapshotCache) {
    let path = snapshot_cache_path();
    if let Some(parent) = path.parent() {
        let _ = std::fs::create_dir_all(parent);
    }
    let mut cache = cache.clone();
    cache.schema_version = SNAPSHOT_CACHE_VERSION;
    if let Ok(payload) = serde_json::to_string(&cache) {
        let _ = std::fs::write(path, payload);
    }
}

fn burn_rate_history_key(service_id: &str, label: &str) -> String {
    // D-02: isolate history by provider + raw quota label
    format!("{service_id}::{label}")
}

fn prune_burn_rate_samples(samples: &mut Vec<BurnRateSample>) {
    if samples.len() > 3 {
        let keep_from = samples.len() - 3;
        samples.drain(..keep_from);
    }
}

fn attach_burn_rate_history(
    service_id: &str,
    state: &mut CodexPanelState,
    history: &HashMap<String, Vec<BurnRateSample>>,
) {
    for item in &mut state.items {
        for dimension in &mut item.quota_dimensions {
            let key = burn_rate_history_key(service_id, &dimension.label);
            dimension.burn_rate_history = history.get(&key).cloned().unwrap_or_default();
        }
    }
}

fn record_successful_burn_rate_history(
    service_id: &str,
    state: &CodexPanelState,
    cache: &mut SnapshotCache,
) {
    if !state.status.is_fresh() {
        return;
    }

    for item in &state.items {
        for dimension in &item.quota_dimensions {
            let Some(remaining_percent) = dimension.remaining_percent else {
                continue;
            };

            let key = burn_rate_history_key(service_id, &dimension.label);
            let samples = cache.burn_rate_history.entry(key).or_default();
            // D-03: visible minute ticks and failed refreshes must not create synthetic burn-rate samples
            samples.push(BurnRateSample {
                captured_at: state.last_successful_refresh_at.clone(),
                remaining_percent,
            });
            prune_burn_rate_samples(samples);
        }
    }
}

fn read_cached_items_for_service(service_id: &str) -> Vec<PanelPlaceholderItem> {
    read_snapshot_cache()
        .services
        .get(service_id)
        .map(|state| state.items.clone())
        .unwrap_or_default()
}

pub fn build_cached_tray_items(preferences: &UserPreferences) -> Vec<PanelPlaceholderItem> {
    let mut items = Vec::new();
    for pid in crate::registry::provider_ids() {
        if !is_provider_enabled(preferences, pid) {
            continue;
        }
        items.extend(read_cached_items_for_service(pid));
    }
    items
}

fn save_to_snapshot_cache(service_id: &str, state: &CodexPanelState) {
    let mut cache = read_snapshot_cache();
    let mut to_save = state.clone();
    // When the fetch returned a non-fresh status with empty items (e.g. rate-limited),
    // preserve the previously cached items so quota data survives across restarts.
    if to_save.items.is_empty() && !to_save.status.is_fresh() {
        if let Some(existing) = cache.services.get(service_id) {
            if !existing.items.is_empty() {
                to_save.items = existing.items.clone();
            }
        }
    }
    record_successful_burn_rate_history(service_id, &to_save, &mut cache);
    attach_burn_rate_history(service_id, &mut to_save, &cache.burn_rate_history);
    cache.services.insert(service_id.into(), to_save);
    write_snapshot_cache(&cache);
}

fn effective_refresh_timestamp(
    service_id: &str,
    status: &SnapshotStatus,
    refreshed_at: &str,
) -> String {
    if status.is_fresh() {
        return refreshed_at.into();
    }

    read_snapshot_cache()
        .services
        .get(service_id)
        .map(|state| state.last_successful_refresh_at.clone())
        .unwrap_or_else(|| refreshed_at.into())
}

/// Returns a cached panel state if it exists and is fresh enough
/// (i.e., `now - last_successful_refresh_at < refresh_interval`).
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
        let mut cached = entry.clone();
        attach_burn_rate_history(service_id, &mut cached, &cache.burn_rate_history);
        Some(cached)
    } else {
        None
    }
}

fn is_claude_code_usage_enabled(preferences: &UserPreferences) -> bool {
    *preferences
        .provider_enabled
        .get("claude-code")
        .unwrap_or(&preferences.claude_code_usage_enabled)
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

fn normalize_icon_state(status: &SnapshotStatus) -> String {
    if status.is_fresh() {
        "idle".into()
    } else {
        "attention".into()
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

fn is_provider_enabled(preferences: &UserPreferences, provider_id: &str) -> bool {
    if provider_id == "codex" {
        return true; // Codex always enabled
    }
    if provider_id == "claude-code" {
        return is_claude_code_usage_enabled(preferences);
    }
    *preferences.provider_enabled.get(provider_id).unwrap_or(&false)
}

fn provider_refresh_cooldown_hit(provider_id: &str) -> bool {
    if provider_id == "claude-code" {
        return claude_refresh_cooldown_hit();
    }
    false // No cooldown for other providers currently
}

fn disabled_provider_panel_state(
    preferences: &UserPreferences,
    _provider_id: &str,
    refreshed_at: &str,
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
        status: SnapshotStatus::Disabled,
        active_session: None,
        last_successful_refresh_at: refreshed_at.into(),
    }
}

fn build_provider_panel_state(
    provider_id: &str,
    preferences: &UserPreferences,
    refresh_kind: pipeline::RefreshKind,
    refreshed_at: &str,
) -> CodexPanelState {
    let descriptor = crate::registry::get_provider(provider_id);
    let display_name = descriptor.map(|d| d.display_name).unwrap_or(provider_id);
    let snapshot = pipeline::fetch_provider(provider_id, preferences, refresh_kind)
        .unwrap_or_else(|| crate::snapshot::ServiceSnapshot {
            status: SnapshotStatus::TemporarilyUnavailable {
                detail: format!("No fetcher for provider: {}", provider_id),
            },
            dimensions: Vec::new(),
            source: provider_id.into(),
        });
    let effective_refreshed_at =
        effective_refresh_timestamp(provider_id, &snapshot.status, refreshed_at);
    let items = if snapshot.dimensions.is_empty() {
        Vec::new()
    } else {
        vec![PanelPlaceholderItem {
            service_id: provider_id.into(),
            service_name: display_name.into(),
            account_label: None,
            icon_key: provider_id.into(),
            quota_dimensions: normalize_dimensions(&snapshot.dimensions),
            status_label: "refreshing".into(),
            badge_label: Some(if snapshot.status.is_fresh() {
                "Live".into()
            } else {
                "stale".into()
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
            icon_state: normalize_icon_state(&snapshot.status),
            summary_mode: normalize_summary_mode(&preferences.tray_summary_mode),
            summary_text: None,
            panel_visible: false,
            last_opened_at: None,
        },
        items,
        configured_account_count: 0,
        enabled_account_count: 0,
        status: snapshot.status,
        active_session: None,
        last_successful_refresh_at: effective_refreshed_at,
    }
}

pub fn build_tray_items(
    preferences: &UserPreferences,
    _accounts: &[CodexAccount],
    refreshed_at: &str,
) -> Vec<PanelPlaceholderItem> {
    let mut items = Vec::new();
    for pid in crate::registry::provider_ids() {
        if !is_provider_enabled(preferences, pid) {
            continue;
        }
        if let Some(cached) =
            load_from_snapshot_cache(pid, preferences.refresh_interval_minutes)
        {
            if let Some(fetcher) = pipeline::get_fetcher(pid) {
                let dims: Vec<_> = cached
                    .items
                    .iter()
                    .flat_map(|item| item.quota_dimensions.clone())
                    .collect();
                fetcher.seed_stale_cache(dims);
            }
            items.extend(cached.items);
        } else {
            let result = build_provider_panel_state(
                pid,
                preferences,
                pipeline::RefreshKind::Automatic,
                refreshed_at,
            );
            save_to_snapshot_cache(pid, &result);
            items.extend(result.items);
        }
    }
    items
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
    if let Some(provider_enabled) = patch.provider_enabled {
        for (key, value) in provider_enabled {
            current.provider_enabled.insert(key, value);
        }
    }
    if let Some(provider_tokens) = patch.provider_tokens {
        current.provider_tokens = provider_tokens;
    }
    if let Some(glm_platform) = patch.glm_platform {
        current.glm_platform = glm_platform;
    }
    if let Some(claude_code_usage_enabled) = patch.claude_code_usage_enabled {
        current.claude_code_usage_enabled = claude_code_usage_enabled;
        current.provider_enabled.insert("claude-code".into(), claude_code_usage_enabled);
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

pub fn refresh_auto_menubar_selection(
    state: &AppState,
    preferences: &UserPreferences,
    items: &[PanelPlaceholderItem],
    now_secs: u64,
) -> AutoMenubarSelectionState {
    let mut selection = state.auto_menubar_selection.lock().unwrap();
    if preferences.menubar_service != "auto" {
        return selection.clone();
    }

    let snapshots = collect_service_activity_snapshots(preferences, items, now_secs);
    let next = resolve_auto_menubar_selection(&selection, &snapshots, now_secs);
    *selection = next.clone();
    next
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

// ---------------------------------------------------------------------------
// Generic IPC commands — dispatch through pipeline by provider_id
// ---------------------------------------------------------------------------

#[tauri::command]
pub fn get_provider_state(state: State<'_, AppState>, provider_id: String) -> CodexPanelState {
    let preferences = state.preferences.lock().unwrap().clone();
    if !is_provider_enabled(&preferences, &provider_id) {
        return disabled_provider_panel_state(&preferences, &provider_id, &now_iso());
    }
    if let Some(cached) =
        load_from_snapshot_cache(&provider_id, preferences.refresh_interval_minutes)
    {
        if let Some(fetcher) = pipeline::get_fetcher(&provider_id) {
            let dims: Vec<_> = cached
                .items
                .iter()
                .flat_map(|item| item.quota_dimensions.clone())
                .collect();
            fetcher.seed_stale_cache(dims);
        }
        return cached;
    }
    let mut result = build_provider_panel_state(
        &provider_id,
        &preferences,
        pipeline::RefreshKind::Automatic,
        &now_iso(),
    );
    // When rate-limited (empty items, non-fresh), restore cached items for display
    if result.items.is_empty() && !result.status.is_fresh() {
        if let Some(existing) = read_snapshot_cache().services.get(&provider_id) {
            if !existing.items.is_empty() {
                result.items = existing.items.clone();
            }
        }
    }
    save_to_snapshot_cache(&provider_id, &result);
    result
}

#[tauri::command]
pub fn refresh_provider_state(
    app: AppHandle,
    state: State<'_, AppState>,
    provider_id: String,
) -> CodexPanelState {
    let preferences = state.preferences.lock().unwrap().clone();
    if !is_provider_enabled(&preferences, &provider_id) {
        let result = disabled_provider_panel_state(&preferences, &provider_id, &now_iso());
        let accounts = state.codex_accounts.lock().unwrap().clone();
        let items = build_tray_items(&preferences, &accounts, &result.last_successful_refresh_at);
        refresh_auto_menubar_selection(&state, &preferences, &items, now_unix_secs());
        apply_display_mode(&app, &preferences, &items);
        return result;
    }
    if provider_refresh_cooldown_hit(&provider_id) {
        if let Some(cached) =
            load_from_snapshot_cache(&provider_id, preferences.refresh_interval_minutes)
        {
            let accounts = state.codex_accounts.lock().unwrap().clone();
            let items =
                build_tray_items(&preferences, &accounts, &cached.last_successful_refresh_at);
            refresh_auto_menubar_selection(&state, &preferences, &items, now_unix_secs());
            apply_display_mode(&app, &preferences, &items);
            return cached;
        }
    }
    let mut result = build_provider_panel_state(
        &provider_id,
        &preferences,
        pipeline::RefreshKind::Manual,
        &now_iso(),
    );
    // When rate-limited (empty items, non-fresh), restore cached items for display
    if result.items.is_empty() && !result.status.is_fresh() {
        if let Some(existing) = read_snapshot_cache().services.get(&provider_id) {
            if !existing.items.is_empty() {
                result.items = existing.items.clone();
            }
        }
    }
    save_to_snapshot_cache(&provider_id, &result);
    let accounts = state.codex_accounts.lock().unwrap().clone();
    let items = build_tray_items(&preferences, &accounts, &result.last_successful_refresh_at);
    refresh_auto_menubar_selection(&state, &preferences, &items, now_unix_secs());
    apply_display_mode(&app, &preferences, &items);
    result
}

// ---------------------------------------------------------------------------
// Legacy per-service commands — thin wrappers around generic commands
// ---------------------------------------------------------------------------

#[tauri::command]
pub fn get_codex_panel_state(state: State<'_, AppState>) -> CodexPanelState {
    let mut result = get_provider_state(state.clone(), "codex".into());
    // Overlay Codex-specific account fields
    let accounts = state.codex_accounts.lock().unwrap().clone();
    let enabled_count = accounts.iter().filter(|a| a.enabled).count();
    result.configured_account_count = accounts.len();
    result.enabled_account_count = enabled_count;
    if result.status.is_fresh() {
        result.active_session = Some(ActiveCodexSession {
            session_id: "local-codex-session".into(),
            account_id: None,
            session_label: "Local Codex CLI".into(),
            connection_state: "connected".into(),
            last_checked_at: result.last_successful_refresh_at.clone(),
            source: "codex app-server".into(),
        });
    }
    result
}

#[tauri::command]
pub fn refresh_codex_panel_state(app: AppHandle, state: State<'_, AppState>) -> CodexPanelState {
    let mut result = refresh_provider_state(app, state.clone(), "codex".into());
    let accounts = state.codex_accounts.lock().unwrap().clone();
    let enabled_count = accounts.iter().filter(|a| a.enabled).count();
    result.configured_account_count = accounts.len();
    result.enabled_account_count = enabled_count;
    if result.status.is_fresh() {
        result.active_session = Some(ActiveCodexSession {
            session_id: "local-codex-session".into(),
            account_id: None,
            session_label: "Local Codex CLI".into(),
            connection_state: "connected".into(),
            last_checked_at: result.last_successful_refresh_at.clone(),
            source: "codex app-server".into(),
        });
    }
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
    refresh_auto_menubar_selection(&state, &next, &merged_items, now_unix_secs());
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
    refresh_auto_menubar_selection(&state, &next, &merged_items, now_unix_secs());
    apply_display_mode(&app, &next, &merged_items);
    persist_preferences(&next);
    *state.preferences.lock().unwrap() = next.clone();
    next
}

#[tauri::command]
pub fn get_claude_code_panel_state(state: State<'_, AppState>) -> CodexPanelState {
    get_provider_state(state, "claude-code".into())
}

#[tauri::command]
pub fn refresh_claude_code_panel_state(
    app: AppHandle,
    state: State<'_, AppState>,
) -> CodexPanelState {
    refresh_provider_state(app, state, "claude-code".into())
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
            status: SnapshotStatus::Fresh,
            active_session: None,
            last_successful_refresh_at: last_successful_refresh_at.into(),
        }
    }

    fn make_dimension(label: &str, remaining_percent: Option<u8>) -> crate::state::QuotaDimension {
        crate::state::QuotaDimension {
            label: label.into(),
            remaining_percent,
            remaining_absolute: remaining_percent
                .map(|value| format!("{value}% remaining"))
                .unwrap_or_else(|| "Unknown".into()),
            resets_at: Some("2100-01-01T00:00:00Z".into()),
            reset_hint: Some("Resets later".into()),
            burn_rate_history: Vec::new(),
            status: quota_status(remaining_percent),
            progress_tone: quota_progress_tone(remaining_percent),
        }
    }

    fn recent_timestamp(seconds_ago: u64) -> String {
        now_unix_secs().saturating_sub(seconds_ago).to_string()
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
            effective_refresh_timestamp(
                "claude-code",
                &SnapshotStatus::TemporarilyUnavailable { detail: "test".into() },
                "200"
            ),
            "100"
        );
        assert_eq!(
            effective_refresh_timestamp("claude-code", &SnapshotStatus::AccessDenied, "200"),
            "100"
        );
        assert_eq!(
            effective_refresh_timestamp("claude-code", &SnapshotStatus::Fresh, "200"),
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
        preferences.provider_enabled.insert("claude-code".into(), true);
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
        preferences.provider_enabled.insert("claude-code".into(), false);
        let items = build_tray_items(&preferences, &[], &refreshed_at);

        assert_eq!(items.len(), 1);
        assert!(items.iter().all(|item| item.service_id != "claude-code"));

        let _ = std::fs::remove_dir_all(&tmp);
        env::remove_var("AI_USAGE_SNAPSHOT_CACHE_FILE");
    }

    #[test]
    fn build_cached_tray_items_reads_snapshot_cache_without_live_refresh() {
        let _guard = env_lock().lock().unwrap();
        let tmp = env::temp_dir().join(format!("ai-usage-test-tray-cached-{}", now_iso()));
        std::fs::create_dir_all(&tmp).unwrap();
        env::set_var(
            "AI_USAGE_SNAPSHOT_CACHE_FILE",
            tmp.join("snapshot-cache.json"),
        );

        let refreshed_at = now_iso();
        save_to_snapshot_cache("codex", &make_panel_state("codex", &refreshed_at));
        save_to_snapshot_cache("claude-code", &make_panel_state("claude-code", &refreshed_at));

        let mut preferences = crate::state::default_preferences();
        preferences.menubar_service = "auto".into();
        preferences.claude_code_usage_enabled = true;
        preferences.provider_enabled.insert("claude-code".into(), true);

        let items = build_cached_tray_items(&preferences);

        assert_eq!(items.len(), 2);
        assert!(items.iter().any(|item| item.service_id == "codex"));
        assert!(items.iter().any(|item| item.service_id == "claude-code"));

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

    #[test]
    fn snapshot_cache_version_mismatch_returns_empty() {
        let _guard = env_lock().lock().unwrap();
        let tmp = env::temp_dir().join(format!("ai-usage-test-ver-mismatch-{}", now_iso()));
        std::fs::create_dir_all(&tmp).unwrap();
        let cache_path = tmp.join("snapshot-cache.json");
        env::set_var("AI_USAGE_SNAPSHOT_CACHE_FILE", &cache_path);

        // Write a cache with a future schema version
        let mut cache = SnapshotCache::default();
        cache.schema_version = 99;
        cache
            .services
            .insert("codex".into(), make_panel_state("codex", &now_iso()));
        std::fs::write(&cache_path, serde_json::to_string(&cache).unwrap()).unwrap();

        let loaded = read_snapshot_cache();
        assert_eq!(loaded.schema_version, SNAPSHOT_CACHE_VERSION);
        assert!(loaded.services.is_empty());

        let _ = std::fs::remove_dir_all(&tmp);
        env::remove_var("AI_USAGE_SNAPSHOT_CACHE_FILE");
    }

    #[test]
    fn snapshot_cache_missing_version_returns_empty() {
        let _guard = env_lock().lock().unwrap();
        let tmp = env::temp_dir().join(format!("ai-usage-test-ver-missing-{}", now_iso()));
        std::fs::create_dir_all(&tmp).unwrap();
        let cache_path = tmp.join("snapshot-cache.json");
        env::set_var("AI_USAGE_SNAPSHOT_CACHE_FILE", &cache_path);

        // Write JSON without schema_version field
        std::fs::write(&cache_path, r#"{"services":{}}"#).unwrap();

        // schema_version defaults to 0 via #[serde(default)], which triggers mismatch
        let loaded = read_snapshot_cache();
        assert_eq!(loaded.schema_version, SNAPSHOT_CACHE_VERSION);
        assert!(loaded.services.is_empty());

        let _ = std::fs::remove_dir_all(&tmp);
        env::remove_var("AI_USAGE_SNAPSHOT_CACHE_FILE");
    }

    #[test]
    fn snapshot_cache_records_burn_rate_history_for_fresh_saves() {
        let _guard = env_lock().lock().unwrap();
        let tmp = env::temp_dir().join(format!("ai-usage-test-burn-rate-fresh-{}", now_iso()));
        std::fs::create_dir_all(&tmp).unwrap();
        env::set_var(
            "AI_USAGE_SNAPSHOT_CACHE_FILE",
            tmp.join("snapshot-cache.json"),
        );

        let captured_at = recent_timestamp(60);
        let mut state = make_panel_state("codex", &captured_at);
        state.items[0].quota_dimensions = vec![
            make_dimension("codex / 5h", Some(80)),
            make_dimension("codex / week", Some(60)),
        ];

        save_to_snapshot_cache("codex", &state);

        let loaded = load_from_snapshot_cache("codex", 15).unwrap();
        let dimensions = &loaded.items[0].quota_dimensions;
        assert_eq!(dimensions[0].burn_rate_history.len(), 1);
        assert_eq!(dimensions[0].burn_rate_history[0].captured_at, captured_at);
        assert_eq!(dimensions[0].burn_rate_history[0].remaining_percent, 80);
        assert_eq!(dimensions[1].burn_rate_history.len(), 1);
        assert_eq!(dimensions[1].burn_rate_history[0].remaining_percent, 60);

        let _ = std::fs::remove_dir_all(&tmp);
        env::remove_var("AI_USAGE_SNAPSHOT_CACHE_FILE");
    }

    #[test]
    fn snapshot_cache_appends_burn_rate_history_for_second_fresh_save() {
        let _guard = env_lock().lock().unwrap();
        let tmp = env::temp_dir().join(format!("ai-usage-test-burn-rate-append-{}", now_iso()));
        std::fs::create_dir_all(&tmp).unwrap();
        env::set_var(
            "AI_USAGE_SNAPSHOT_CACHE_FILE",
            tmp.join("snapshot-cache.json"),
        );

        let first_at = recent_timestamp(120);
        let second_at = recent_timestamp(60);
        let mut first = make_panel_state("codex", &first_at);
        first.items[0].quota_dimensions = vec![make_dimension("codex / 5h", Some(80))];
        save_to_snapshot_cache("codex", &first);

        let mut second = make_panel_state("codex", &second_at);
        second.items[0].quota_dimensions = vec![make_dimension("codex / 5h", Some(70))];
        save_to_snapshot_cache("codex", &second);

        let loaded = load_from_snapshot_cache("codex", 15).unwrap();
        let history = &loaded.items[0].quota_dimensions[0].burn_rate_history;
        assert_eq!(history.len(), 2);
        assert_eq!(history[0].captured_at, first_at);
        assert_eq!(history[1].captured_at, second_at);

        let _ = std::fs::remove_dir_all(&tmp);
        env::remove_var("AI_USAGE_SNAPSHOT_CACHE_FILE");
    }

    #[test]
    fn snapshot_cache_does_not_append_history_for_non_fresh_saves() {
        let _guard = env_lock().lock().unwrap();
        let tmp = env::temp_dir().join(format!("ai-usage-test-burn-rate-stale-{}", now_iso()));
        std::fs::create_dir_all(&tmp).unwrap();
        env::set_var(
            "AI_USAGE_SNAPSHOT_CACHE_FILE",
            tmp.join("snapshot-cache.json"),
        );

        let captured_at = recent_timestamp(60);
        let mut fresh = make_panel_state("codex", &captured_at);
        fresh.items[0].quota_dimensions = vec![make_dimension("codex / 5h", Some(80))];
        save_to_snapshot_cache("codex", &fresh);

        let mut stale = make_panel_state("codex", &captured_at);
        stale.status = SnapshotStatus::TemporarilyUnavailable {
            detail: "offline".into(),
        };
        stale.items = vec![PanelPlaceholderItem {
            service_id: "codex".into(),
            service_name: "Test".into(),
            account_label: None,
            icon_key: "codex".into(),
            quota_dimensions: vec![make_dimension("codex / 5h", Some(75))],
            status_label: "refreshing".into(),
            badge_label: Some("stale".into()),
            last_successful_refresh_at: captured_at.clone(),
        }];
        save_to_snapshot_cache("codex", &stale);

        let loaded = load_from_snapshot_cache("codex", 15).unwrap();
        let history = &loaded.items[0].quota_dimensions[0].burn_rate_history;
        assert_eq!(history.len(), 1);
        assert_eq!(history[0].captured_at, captured_at);

        let _ = std::fs::remove_dir_all(&tmp);
        env::remove_var("AI_USAGE_SNAPSHOT_CACHE_FILE");
    }

    #[test]
    fn snapshot_cache_uses_distinct_history_keys_per_dimension_label() {
        let _guard = env_lock().lock().unwrap();
        let tmp = env::temp_dir().join(format!("ai-usage-test-burn-rate-keys-{}", now_iso()));
        std::fs::create_dir_all(&tmp).unwrap();
        let cache_path = tmp.join("snapshot-cache.json");
        env::set_var("AI_USAGE_SNAPSHOT_CACHE_FILE", &cache_path);

        let mut state = make_panel_state("codex", &recent_timestamp(60));
        state.items[0].quota_dimensions = vec![
            make_dimension("codex / 5h", Some(80)),
            make_dimension("codex / week", Some(60)),
        ];
        save_to_snapshot_cache("codex", &state);

        let cache = read_snapshot_cache();
        assert!(cache
            .burn_rate_history
            .contains_key(&burn_rate_history_key("codex", "codex / 5h")));
        assert!(cache
            .burn_rate_history
            .contains_key(&burn_rate_history_key("codex", "codex / week")));

        let _ = std::fs::remove_dir_all(&tmp);
        env::remove_var("AI_USAGE_SNAPSHOT_CACHE_FILE");
    }

    #[test]
    fn snapshot_cache_without_burn_rate_history_loads_with_empty_histories() {
        let _guard = env_lock().lock().unwrap();
        let tmp = env::temp_dir().join(format!("ai-usage-test-burn-rate-compat-{}", now_iso()));
        std::fs::create_dir_all(&tmp).unwrap();
        let cache_path = tmp.join("snapshot-cache.json");
        env::set_var("AI_USAGE_SNAPSHOT_CACHE_FILE", &cache_path);

        let last_successful_refresh_at = recent_timestamp(60);
        std::fs::write(
            &cache_path,
            format!(
                r#"{{
              "schema_version":1,
              "services":{{
                "codex":{{
                  "desktopSurface":{{
                    "platform":"macos",
                    "iconState":"idle",
                    "summaryMode":"lowest-remaining",
                    "panelVisible":false
                  }},
                  "items":[{{
                    "serviceId":"codex",
                    "serviceName":"Codex",
                    "iconKey":"codex",
                    "quotaDimensions":[{{
                      "label":"codex / 5h",
                      "remainingPercent":75,
                      "remainingAbsolute":"75% remaining",
                      "status":"healthy",
                      "progressTone":"success"
                    }}],
                    "statusLabel":"refreshing",
                    "lastSuccessfulRefreshAt":"{last_successful_refresh_at}"
                  }}],
                  "configuredAccountCount":0,
                  "enabledAccountCount":0,
                  "status":{{"kind":"Fresh"}},
                  "lastSuccessfulRefreshAt":"{last_successful_refresh_at}"
                }}
              }}
            }}"#
            ),
        )
        .unwrap();

        let loaded = load_from_snapshot_cache("codex", 15).unwrap();
        assert_eq!(loaded.items[0].quota_dimensions[0].burn_rate_history.len(), 0);

        let _ = std::fs::remove_dir_all(&tmp);
        env::remove_var("AI_USAGE_SNAPSHOT_CACHE_FILE");
    }
}
