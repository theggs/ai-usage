use crate::state::{
    ActivityConfidence, ActivitySignalSource, AutoMenubarMode, AutoMenubarSelectionState,
    PanelPlaceholderItem, ServiceActivitySnapshot, UserPreferences, AUTO_ACTIVITY_WINDOW_SECS,
    AUTO_ROTATION_INTERVAL_SECS,
};
use chrono::{DateTime, NaiveDateTime, Utc};
use rusqlite::{types::ValueRef, Connection, OpenFlags};
use serde_json::Value;
use std::env;
use std::fs;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

const SUPPORTED_SERVICES: [&str; 2] = ["codex", "claude-code"];

#[derive(Clone, Debug)]
struct SignalReading {
    last_activity_at: Option<u64>,
    signal_source: ActivitySignalSource,
    confidence: ActivityConfidence,
    last_error: Option<String>,
}

impl Default for SignalReading {
    fn default() -> Self {
        Self {
            last_activity_at: None,
            signal_source: ActivitySignalSource::None,
            confidence: ActivityConfidence::None,
            last_error: None,
        }
    }
}

pub fn now_unix_secs() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs()
}

fn codex_activity_dir() -> PathBuf {
    if let Ok(dir) = env::var("AI_USAGE_CODEX_HOME") {
        return PathBuf::from(dir);
    }
    if let Ok(home) = env::var("HOME") {
        return PathBuf::from(home).join(".codex");
    }
    PathBuf::from(".codex")
}

fn claude_activity_dir() -> PathBuf {
    if let Ok(dir) = env::var("CLAUDE_CONFIG_DIR") {
        return PathBuf::from(dir);
    }
    if let Ok(dir) = env::var("AI_USAGE_CLAUDE_HOME") {
        return PathBuf::from(dir);
    }
    if let Ok(home) = env::var("HOME") {
        return PathBuf::from(home).join(".claude");
    }
    PathBuf::from(".claude")
}

fn system_time_to_secs(value: SystemTime) -> Option<u64> {
    value
        .duration_since(UNIX_EPOCH)
        .ok()
        .map(|duration| duration.as_secs())
}

fn metadata_mtime(path: &Path) -> Option<u64> {
    fs::metadata(path)
        .ok()
        .and_then(|metadata| metadata.modified().ok())
        .and_then(system_time_to_secs)
}

fn parse_timestamp_value(value: &str) -> Option<u64> {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        return None;
    }

    if let Ok(parsed) = trimmed.parse::<i64>() {
        return if parsed > 1_000_000_000_000 {
            Some((parsed / 1_000) as u64)
        } else if parsed >= 0 {
            Some(parsed as u64)
        } else {
            None
        };
    }

    if let Ok(parsed) = DateTime::parse_from_rfc3339(trimmed) {
        return Some(parsed.timestamp().max(0) as u64);
    }

    if let Ok(parsed) = NaiveDateTime::parse_from_str(trimmed, "%Y-%m-%d %H:%M:%S%.f") {
        return Some(DateTime::<Utc>::from_naive_utc_and_offset(parsed, Utc).timestamp() as u64);
    }

    None
}

fn parse_json_line_timestamp(path: &Path, key: &str) -> Option<u64> {
    let contents = fs::read_to_string(path).ok()?;
    contents
        .lines()
        .filter_map(|line| serde_json::from_str::<Value>(line).ok())
        .filter_map(|value| {
            value.get(key).and_then(|field| match field {
                Value::String(text) => parse_timestamp_value(text),
                Value::Number(number) => number.as_i64().and_then(|raw| {
                    if raw > 1_000_000_000_000 {
                        Some((raw / 1_000) as u64)
                    } else if raw >= 0 {
                        Some(raw as u64)
                    } else {
                        None
                    }
                }),
                _ => None,
            })
        })
        .max()
}

fn latest_matching_mtime(root: &Path, predicate: &dyn Fn(&Path) -> bool) -> Option<u64> {
    fn visit(path: &Path, predicate: &dyn Fn(&Path) -> bool, latest: &mut Option<u64>) {
        let Ok(metadata) = fs::metadata(path) else {
            return;
        };

        if metadata.is_file() {
            if predicate(path) {
                if let Some(modified) = metadata.modified().ok().and_then(system_time_to_secs) {
                    *latest = Some(latest.map_or(modified, |current| current.max(modified)));
                }
            }
            return;
        }

        if metadata.is_dir() {
            let Ok(entries) = fs::read_dir(path) else {
                return;
            };
            for entry in entries.flatten() {
                visit(&entry.path(), predicate, latest);
            }
        }
    }

    let mut latest = None;
    visit(root, predicate, &mut latest);
    latest
}

fn latest_directory_mtime(root: &Path) -> Option<u64> {
    fn visit(path: &Path, latest: &mut Option<u64>) {
        let Ok(metadata) = fs::metadata(path) else {
            return;
        };
        if metadata.is_dir() {
            if let Some(modified) = metadata.modified().ok().and_then(system_time_to_secs) {
                *latest = Some(latest.map_or(modified, |current| current.max(modified)));
            }
            let Ok(entries) = fs::read_dir(path) else {
                return;
            };
            for entry in entries.flatten() {
                visit(&entry.path(), latest);
            }
        }
    }

    let mut latest = None;
    visit(root, &mut latest);
    latest
}

fn read_sqlite_max_timestamp(path: &Path, query: &str) -> Result<Option<u64>, String> {
    let connection = Connection::open_with_flags(path, OpenFlags::SQLITE_OPEN_READ_ONLY)
        .map_err(|error| format!("failed to open sqlite {}: {error}", path.display()))?;
    let mut statement = connection
        .prepare(query)
        .map_err(|error| format!("failed to prepare sqlite query {}: {error}", path.display()))?;
    let value = statement
        .query_row([], |row| {
            let raw = row.get_ref(0)?;
            let timestamp = match raw {
                ValueRef::Null => None,
                ValueRef::Integer(value) => {
                    if value > 1_000_000_000_000 {
                        Some((value / 1_000) as u64)
                    } else if value >= 0 {
                        Some(value as u64)
                    } else {
                        None
                    }
                }
                ValueRef::Real(value) => Some(value as u64),
                ValueRef::Text(bytes) => std::str::from_utf8(bytes)
                    .ok()
                    .and_then(parse_timestamp_value),
                ValueRef::Blob(_) => None,
            };
            Ok(timestamp)
        })
        .map_err(|error| format!("failed to read sqlite query {}: {error}", path.display()))?;

    Ok(value)
}

fn has_displayable_items(items: &[PanelPlaceholderItem], service_id: &str) -> bool {
    items.iter().any(|item| {
        item.service_id == service_id
            && item
                .quota_dimensions
                .iter()
                .any(|dimension| dimension.remaining_percent.is_some())
    })
}

fn read_codex_signal(codex_dir: &Path) -> SignalReading {
    let state_path = codex_dir.join("state_5.sqlite");
    if state_path.exists() {
        match read_sqlite_max_timestamp(&state_path, "SELECT MAX(updated_at) FROM threads") {
            Ok(Some(last_activity_at)) => {
                return SignalReading {
                    last_activity_at: Some(last_activity_at),
                    signal_source: ActivitySignalSource::CodexStateSqlite,
                    confidence: ActivityConfidence::High,
                    last_error: None,
                }
            }
            Ok(None) => {}
            Err(error) => {
                return SignalReading {
                    last_activity_at: None,
                    signal_source: ActivitySignalSource::CodexStateSqlite,
                    confidence: ActivityConfidence::None,
                    last_error: Some(error),
                }
            }
        }
    }

    let session_index_path = codex_dir.join("session_index.jsonl");
    if session_index_path.exists() {
        if let Some(last_activity_at) = parse_json_line_timestamp(&session_index_path, "updated_at")
            .or_else(|| metadata_mtime(&session_index_path))
        {
            return SignalReading {
                last_activity_at: Some(last_activity_at),
                signal_source: ActivitySignalSource::CodexSessionIndex,
                confidence: ActivityConfidence::Medium,
                last_error: None,
            };
        }
    }

    let logs_path = codex_dir.join("logs_1.sqlite");
    if logs_path.exists() {
        if let Ok(Some(last_activity_at)) =
            read_sqlite_max_timestamp(&logs_path, "SELECT MAX(ts) FROM logs")
        {
            return SignalReading {
                last_activity_at: Some(last_activity_at),
                signal_source: ActivitySignalSource::CodexLogsSqlite,
                confidence: ActivityConfidence::Medium,
                last_error: None,
            };
        }
    }

    let sessions_path = codex_dir.join("sessions");
    if let Some(last_activity_at) = latest_matching_mtime(&sessions_path, &|path| {
        path.extension().and_then(|extension| extension.to_str()) == Some("jsonl")
    }) {
        return SignalReading {
            last_activity_at: Some(last_activity_at),
            signal_source: ActivitySignalSource::CodexSessionFile,
            confidence: ActivityConfidence::Low,
            last_error: None,
        };
    }

    SignalReading {
        last_activity_at: None,
        signal_source: ActivitySignalSource::None,
        confidence: ActivityConfidence::None,
        last_error: None,
    }
}

fn read_claude_signal(claude_dir: &Path) -> SignalReading {
    let projects_path = claude_dir.join("projects");
    if let Some(last_activity_at) = latest_matching_mtime(&projects_path, &|path| {
        path.extension().and_then(|extension| extension.to_str()) == Some("jsonl")
    }) {
        return SignalReading {
            last_activity_at: Some(last_activity_at),
            signal_source: ActivitySignalSource::ClaudeProjectFile,
            confidence: ActivityConfidence::High,
            last_error: None,
        };
    }

    let history_path = claude_dir.join("history.jsonl");
    if history_path.exists() {
        if let Some(last_activity_at) = parse_json_line_timestamp(&history_path, "timestamp")
            .or_else(|| metadata_mtime(&history_path))
        {
            return SignalReading {
                last_activity_at: Some(last_activity_at),
                signal_source: ActivitySignalSource::ClaudeHistoryFile,
                confidence: ActivityConfidence::Medium,
                last_error: None,
            };
        }
    }

    let session_env_path = claude_dir.join("session-env");
    if let Some(last_activity_at) = latest_directory_mtime(&session_env_path) {
        return SignalReading {
            last_activity_at: Some(last_activity_at),
            signal_source: ActivitySignalSource::ClaudeSessionEnv,
            confidence: ActivityConfidence::Low,
            last_error: None,
        };
    }

    SignalReading {
        last_activity_at: None,
        signal_source: ActivitySignalSource::None,
        confidence: ActivityConfidence::None,
        last_error: None,
    }
}

pub fn collect_service_activity_snapshots(
    preferences: &UserPreferences,
    items: &[PanelPlaceholderItem],
    _now_secs: u64,
) -> Vec<ServiceActivitySnapshot> {
    let codex = read_codex_signal(&codex_activity_dir());
    let claude = read_claude_signal(&claude_activity_dir());

    vec![
        ServiceActivitySnapshot {
            service_id: "codex".into(),
            last_activity_at: codex.last_activity_at,
            signal_source: codex.signal_source,
            confidence: codex.confidence,
            is_eligible_for_auto: has_displayable_items(items, "codex"),
            last_error: codex.last_error,
        },
        ServiceActivitySnapshot {
            service_id: "claude-code".into(),
            last_activity_at: claude.last_activity_at,
            signal_source: claude.signal_source,
            confidence: claude.confidence,
            is_eligible_for_auto: *preferences
                .provider_enabled
                .get("claude-code")
                .unwrap_or(&preferences.claude_code_usage_enabled)
                && has_displayable_items(items, "claude-code"),
            last_error: claude.last_error,
        },
    ]
}

fn eligible_recent_services(snapshots: &[ServiceActivitySnapshot], now_secs: u64) -> Vec<String> {
    let mut recent = snapshots
        .iter()
        .filter(|snapshot| snapshot.is_eligible_for_auto)
        .filter_map(|snapshot| {
            snapshot.last_activity_at.and_then(|last_activity_at| {
                let age = now_secs.saturating_sub(last_activity_at);
                if age <= AUTO_ACTIVITY_WINDOW_SECS {
                    Some(snapshot.service_id.clone())
                } else {
                    None
                }
            })
        })
        .collect::<Vec<_>>();
    recent.retain(|service_id| SUPPORTED_SERVICES.contains(&service_id.as_str()));
    recent.sort();
    recent.dedup();
    recent
}

pub fn resolve_auto_menubar_selection(
    previous: &AutoMenubarSelectionState,
    snapshots: &[ServiceActivitySnapshot],
    now_secs: u64,
) -> AutoMenubarSelectionState {
    let eligible = eligible_recent_services(snapshots, now_secs);

    if eligible.is_empty() {
        // Only retain previous service if it's still eligible (enabled + has displayable items).
        // A disabled service must not be retained — its icon and summary would be stale.
        if let Some(current_service_id) = previous.current_service_id.clone() {
            let still_eligible = snapshots
                .iter()
                .any(|s| s.service_id == current_service_id && s.is_eligible_for_auto);
            if still_eligible {
                return AutoMenubarSelectionState {
                    mode: AutoMenubarMode::Single,
                    current_service_id: Some(current_service_id),
                    rotation_service_ids: Vec::new(),
                    last_resolved_at: now_secs,
                    last_rotated_at: previous.last_rotated_at,
                    retained_from_previous: true,
                };
            }
        }

        return AutoMenubarSelectionState {
            mode: AutoMenubarMode::Neutral,
            current_service_id: None,
            rotation_service_ids: Vec::new(),
            last_resolved_at: now_secs,
            last_rotated_at: None,
            retained_from_previous: false,
        };
    }

    if eligible.len() == 1 {
        return AutoMenubarSelectionState {
            mode: AutoMenubarMode::Single,
            current_service_id: eligible.first().cloned(),
            rotation_service_ids: Vec::new(),
            last_resolved_at: now_secs,
            last_rotated_at: None,
            retained_from_previous: false,
        };
    }

    let same_rotation_set = previous.rotation_service_ids == eligible;
    let interval_hit = previous
        .last_rotated_at
        .map(|last_rotated_at| {
            now_secs.saturating_sub(last_rotated_at) >= AUTO_ROTATION_INTERVAL_SECS
        })
        .unwrap_or(false);

    let current_service_id = if same_rotation_set && !interval_hit {
        previous
            .current_service_id
            .clone()
            .or_else(|| eligible.first().cloned())
    } else if same_rotation_set {
        let current_index = previous
            .current_service_id
            .as_ref()
            .and_then(|current| eligible.iter().position(|service_id| service_id == current))
            .unwrap_or(0);
        eligible.get((current_index + 1) % eligible.len()).cloned()
    } else if let Some(previous_service) = previous.current_service_id.as_ref() {
        if eligible.contains(previous_service) {
            Some(previous_service.clone())
        } else {
            eligible.first().cloned()
        }
    } else {
        eligible.first().cloned()
    };

    AutoMenubarSelectionState {
        mode: AutoMenubarMode::Rotating,
        current_service_id,
        rotation_service_ids: eligible,
        last_resolved_at: now_secs,
        last_rotated_at: if same_rotation_set && !interval_hit {
            previous.last_rotated_at.or(Some(now_secs))
        } else {
            Some(now_secs)
        },
        retained_from_previous: false,
    }
}

#[cfg(test)]
mod tests {
    use super::{
        collect_service_activity_snapshots, parse_timestamp_value, read_claude_signal,
        read_codex_signal, resolve_auto_menubar_selection,
    };
    use crate::state::{
        default_preferences, ActivityConfidence, ActivitySignalSource, AutoMenubarMode,
        AutoMenubarSelectionState, PanelPlaceholderItem, QuotaDimension,
    };
    use rusqlite::Connection;
    use std::fs;
    use std::path::{Path, PathBuf};
    use std::sync::atomic::{AtomicUsize, Ordering};
    use std::time::{SystemTime, UNIX_EPOCH};

    fn unique_temp_dir(label: &str) -> PathBuf {
        static COUNTER: AtomicUsize = AtomicUsize::new(0);
        let suffix = COUNTER.fetch_add(1, Ordering::Relaxed);
        let base = std::env::temp_dir().join(format!(
            "ai-usage-agent-activity-{label}-{}-{suffix}",
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap_or_default()
                .as_nanos()
        ));
        fs::create_dir_all(&base).expect("temp dir");
        base
    }

    fn write_file(path: &Path, contents: &str) {
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent).expect("parent");
        }
        fs::write(path, contents).expect("write file");
    }

    fn item_for_service(service_id: &str) -> PanelPlaceholderItem {
        PanelPlaceholderItem {
            service_id: service_id.into(),
            service_name: service_id.into(),
            account_label: None,
            icon_key: service_id.into(),
            quota_dimensions: vec![QuotaDimension {
                label: "5h".into(),
                remaining_percent: Some(42),
                remaining_absolute: "42%".into(),
                resets_at: None,
                reset_hint: None,
                status: "warning".into(),
                progress_tone: "warning".into(),
            }],
            status_label: "refreshing".into(),
            badge_label: Some("Live".into()),
            last_successful_refresh_at: "0".into(),
        }
    }

    #[test]
    fn parses_iso_and_unix_timestamps() {
        assert_eq!(parse_timestamp_value("1730000000"), Some(1_730_000_000));
        assert_eq!(
            parse_timestamp_value("2026-03-27T10:00:00Z"),
            Some(1_774_605_600)
        );
    }

    #[test]
    fn reads_codex_activity_from_state_sqlite() {
        let dir = unique_temp_dir("codex-sqlite");
        let db_path = dir.join("state_5.sqlite");
        let connection = Connection::open(&db_path).expect("sqlite");
        connection
            .execute("CREATE TABLE threads (updated_at TEXT)", [])
            .expect("create threads");
        connection
            .execute(
                "INSERT INTO threads (updated_at) VALUES ('2026-03-27T10:00:00Z')",
                [],
            )
            .expect("insert");

        let reading = read_codex_signal(&dir);
        assert_eq!(
            reading.signal_source,
            ActivitySignalSource::CodexStateSqlite
        );
        assert_eq!(reading.confidence, ActivityConfidence::High);
        assert_eq!(reading.last_activity_at, Some(1_774_605_600));
    }

    #[test]
    fn reads_codex_fallback_from_session_index() {
        let dir = unique_temp_dir("codex-session-index");
        write_file(
            &dir.join("session_index.jsonl"),
            r#"{"id":"thread","updated_at":"2026-03-27T11:00:00Z"}"#,
        );

        let reading = read_codex_signal(&dir);
        assert_eq!(
            reading.signal_source,
            ActivitySignalSource::CodexSessionIndex
        );
        assert_eq!(reading.confidence, ActivityConfidence::Medium);
        assert_eq!(reading.last_activity_at, Some(1_774_609_200));
    }

    #[test]
    fn reads_claude_activity_from_project_files() {
        let dir = unique_temp_dir("claude-project");
        write_file(&dir.join("projects/demo/session.jsonl"), "{}");

        let reading = read_claude_signal(&dir);
        assert_eq!(
            reading.signal_source,
            ActivitySignalSource::ClaudeProjectFile
        );
        assert_eq!(reading.confidence, ActivityConfidence::High);
        assert!(reading.last_activity_at.is_some());
    }

    #[test]
    fn computes_eligible_snapshots_from_preferences_and_items() {
        let codex_dir = unique_temp_dir("collect-codex");
        let claude_dir = unique_temp_dir("collect-claude");
        write_file(
            &codex_dir.join("session_index.jsonl"),
            r#"{"updated_at":"2026-03-27T11:00:00Z"}"#,
        );
        write_file(&claude_dir.join("projects/demo/session.jsonl"), "{}");
        std::env::set_var("AI_USAGE_CODEX_HOME", &codex_dir);
        std::env::set_var("AI_USAGE_CLAUDE_HOME", &claude_dir);

        let mut preferences = default_preferences();
        preferences.claude_code_usage_enabled = false;

        let snapshots = collect_service_activity_snapshots(
            &preferences,
            &[item_for_service("codex"), item_for_service("claude-code")],
            1_774_612_500,
        );

        assert_eq!(snapshots.len(), 2);
        assert!(snapshots
            .iter()
            .any(|snapshot| snapshot.service_id == "codex" && snapshot.is_eligible_for_auto));
        assert!(
            snapshots
                .iter()
                .any(|snapshot| snapshot.service_id == "claude-code"
                    && !snapshot.is_eligible_for_auto)
        );
    }

    #[test]
    fn rotates_between_multiple_recent_services() {
        let previous = AutoMenubarSelectionState {
            mode: AutoMenubarMode::Rotating,
            current_service_id: Some("codex".into()),
            rotation_service_ids: vec!["claude-code".into(), "codex".into()],
            last_resolved_at: 100,
            last_rotated_at: Some(100),
            retained_from_previous: false,
        };
        let snapshots = vec![
            crate::state::ServiceActivitySnapshot {
                service_id: "codex".into(),
                last_activity_at: Some(200),
                signal_source: ActivitySignalSource::CodexSessionIndex,
                confidence: ActivityConfidence::Medium,
                is_eligible_for_auto: true,
                last_error: None,
            },
            crate::state::ServiceActivitySnapshot {
                service_id: "claude-code".into(),
                last_activity_at: Some(205),
                signal_source: ActivitySignalSource::ClaudeProjectFile,
                confidence: ActivityConfidence::High,
                is_eligible_for_auto: true,
                last_error: None,
            },
        ];

        let next = resolve_auto_menubar_selection(&previous, &snapshots, 131);
        assert_eq!(next.mode, AutoMenubarMode::Rotating);
        assert_eq!(next.current_service_id.as_deref(), Some("claude-code"));
    }

    #[test]
    fn retains_previous_service_when_no_recent_activity_exists() {
        let previous = AutoMenubarSelectionState {
            mode: AutoMenubarMode::Single,
            current_service_id: Some("codex".into()),
            rotation_service_ids: Vec::new(),
            last_resolved_at: 100,
            last_rotated_at: None,
            retained_from_previous: false,
        };
        let snapshots = vec![crate::state::ServiceActivitySnapshot {
            service_id: "codex".into(),
            last_activity_at: Some(1),
            signal_source: ActivitySignalSource::CodexSessionIndex,
            confidence: ActivityConfidence::Medium,
            is_eligible_for_auto: true,
            last_error: None,
        }];

        let next = resolve_auto_menubar_selection(&previous, &snapshots, 1_000);
        assert_eq!(next.mode, AutoMenubarMode::Single);
        assert_eq!(next.current_service_id.as_deref(), Some("codex"));
        assert!(next.retained_from_previous);
    }
}
