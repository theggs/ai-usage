use crate::autostart::set_autostart_status;
use crate::claude_code::load_snapshot as load_claude_code_snapshot;
use crate::codex::{load_snapshot, save_accounts, save_preferences as persist_preferences_file};
use crate::notifications::send_demo_notification;
use crate::state::{
    ActiveCodexSession, AppState, CodexAccount, CodexAccountDraft, CodexPanelState,
    DesktopSurfaceState, NotificationCheckResult, PanelPlaceholderItem, PreferencePatch,
    UserPreferences,
};
use crate::tray::apply_display_mode;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, State};

fn now_iso() -> String {
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();
    format!("{now}")
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
    let active_session = if snapshot.connection_state == "connected" {
        Some(ActiveCodexSession {
            session_id: "local-codex-session".into(),
            account_id: None,
            session_label: "Local Codex CLI".into(),
            connection_state: snapshot.connection_state.clone(),
            last_checked_at: refreshed_at.into(),
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
            last_refreshed_at: refreshed_at.into(),
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
        updated_at: refreshed_at.into(),
    }
}

pub fn build_tray_items(
    preferences: &UserPreferences,
    accounts: &[CodexAccount],
    refreshed_at: &str,
) -> Vec<PanelPlaceholderItem> {
    let mut items = build_panel_state(preferences, accounts, refreshed_at).items;
    items.extend(build_claude_code_items(refreshed_at));
    items
}

pub fn build_claude_code_items(refreshed_at: &str) -> Vec<PanelPlaceholderItem> {
    let snapshot = load_claude_code_snapshot();
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
        last_refreshed_at: refreshed_at.into(),
    }]
}

fn build_claude_code_panel_state(preferences: &UserPreferences, refreshed_at: &str) -> CodexPanelState {
    let snapshot = load_claude_code_snapshot();
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
            last_refreshed_at: refreshed_at.into(),
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
        updated_at: refreshed_at.into(),
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
    current.last_saved_at = now_iso();
    current
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
    let accounts = state.codex_accounts.lock().unwrap().clone();
    build_panel_state(&preferences, &accounts, &now_iso())
}

#[tauri::command]
pub fn refresh_codex_panel_state(state: State<'_, AppState>) -> CodexPanelState {
    let preferences = state.preferences.lock().unwrap().clone();
    let accounts = state.codex_accounts.lock().unwrap().clone();
    build_panel_state(&preferences, &accounts, &now_iso())
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
pub fn save_preferences(
    app: AppHandle,
    state: State<'_, AppState>,
    patch: PreferencePatch,
) -> UserPreferences {
    let current = state.preferences.lock().unwrap().clone();
    let next = merge_preferences(patch, current);
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
    build_claude_code_panel_state(&preferences, &now_iso())
}

#[tauri::command]
pub fn refresh_claude_code_panel_state(state: State<'_, AppState>) -> CodexPanelState {
    let preferences = state.preferences.lock().unwrap().clone();
    build_claude_code_panel_state(&preferences, &now_iso())
}

#[tauri::command]
pub fn send_test_notification(message: Option<String>) -> NotificationCheckResult {
    send_demo_notification(message)
}
