use crate::state::QuotaDimension;
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::collections::HashMap;
use std::env;
use std::fs;
use std::io::{BufRead, BufReader, Read, Write};
use std::path::PathBuf;
use std::process::{Command, Stdio};
use std::sync::mpsc;
use std::thread;
use std::time::{SystemTime, UNIX_EPOCH};

const RATE_LIMIT_REQUEST_ID: u64 = 2;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CodexSnapshot {
    pub snapshot_state: String,
    pub connection_state: String,
    pub status_message: String,
    pub dimensions: Vec<QuotaDimension>,
    pub source: String,
}

#[derive(Debug, Deserialize)]
struct JsonRpcResponseEnvelope {
    id: Option<u64>,
    result: Option<serde_json::Value>,
    error: Option<JsonRpcError>,
}

#[derive(Debug, Deserialize)]
struct JsonRpcError {
    code: i64,
    message: String,
}

#[derive(Debug, Deserialize)]
struct JsonRpcNotificationEnvelope {
    method: String,
    params: Option<serde_json::Value>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct GetAccountRateLimitsResponse {
    rate_limits: RateLimitSnapshot,
    rate_limits_by_limit_id: Option<HashMap<String, RateLimitSnapshot>>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct RateLimitSnapshot {
    limit_id: Option<String>,
    limit_name: Option<String>,
    primary: Option<RateLimitWindow>,
    secondary: Option<RateLimitWindow>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct RateLimitWindow {
    used_percent: u16,
    window_duration_mins: Option<u64>,
    resets_at: Option<i64>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct AccountRateLimitsUpdatedNotification {
    rate_limits: RateLimitSnapshot,
}

#[derive(Debug)]
struct CommandOutput {
    status_success: bool,
    stdout: String,
    stderr: String,
}

fn codex_bin() -> String {
    if let Ok(explicit) = env::var("AI_USAGE_CODEX_BIN") {
        return explicit;
    }

    // macOS .app bundles launch with a minimal PATH (/usr/bin:/bin:/usr/sbin:/sbin),
    // so user-installed CLIs are not discoverable by bare name. Probe common locations.
    let home = env::var("HOME").unwrap_or_default();
    let candidates = [
        format!("{home}/.local/bin/codex"),
        "/opt/homebrew/bin/codex".into(),
        "/usr/local/bin/codex".into(),
        format!("{home}/.cargo/bin/codex"),
    ];
    for path in &candidates {
        if std::path::Path::new(path).exists() {
            return path.clone();
        }
    }

    // Fallback: rely on PATH (works in dev mode / terminal launches)
    "codex".into()
}

fn trim_wrapping_punctuation(value: &str) -> String {
    value
        .trim()
        .trim_start_matches('(')
        .trim_end_matches(')')
        .trim()
        .to_string()
}

fn parse_percent(value: &str) -> Option<u8> {
    value
        .split(|ch: char| !ch.is_ascii_digit())
        .find(|part| !part.is_empty())
        .and_then(|digits| digits.parse::<u8>().ok())
}

fn parse_dimension(line: &str) -> Option<QuotaDimension> {
    let separator = if line.contains(':') {
        ':'
    } else if line.contains('-') {
        '-'
    } else {
        return None;
    };
    let mut parts = line.splitn(2, separator);
    let label = parts.next()?.trim();
    let remainder = parts.next()?.trim();
    if label.is_empty() || remainder.is_empty() {
        return None;
    }

    let (remaining_absolute, reset_hint) = if let Some((value, hint)) = remainder.split_once('(') {
        (
            value.trim().to_string(),
            Some(trim_wrapping_punctuation(hint)),
        )
    } else {
        (remainder.to_string(), None)
    };

    Some(QuotaDimension {
        label: label.to_string(),
        remaining_percent: parse_percent(&remaining_absolute),
        remaining_absolute,
        reset_hint,
    })
}

pub fn parse_status_snapshot(text: &str) -> Result<Vec<QuotaDimension>, String> {
    let dimensions = text
        .lines()
        .map(str::trim)
        .filter(|line| !line.is_empty())
        .filter(|line| !line.starts_with('#') && !line.eq_ignore_ascii_case("current usage limits"))
        .filter_map(parse_dimension)
        .collect::<Vec<_>>();

    Ok(dimensions)
}

fn run_command(bin: &str, args: &[&str]) -> Result<CommandOutput, String> {
    let output = Command::new(bin)
        .args(args)
        .output()
        .map_err(|error| format!("Failed to run {bin}: {error}"))?;

    Ok(CommandOutput {
        status_success: output.status.success(),
        stdout: String::from_utf8_lossy(&output.stdout).trim().to_string(),
        stderr: String::from_utf8_lossy(&output.stderr).trim().to_string(),
    })
}

fn parse_rate_limit_message(line: &str) -> Result<Option<GetAccountRateLimitsResponse>, String> {
    if line.trim().is_empty() {
        return Ok(None);
    }

    if let Ok(envelope) = serde_json::from_str::<JsonRpcResponseEnvelope>(line) {
        if envelope.id == Some(RATE_LIMIT_REQUEST_ID) {
            if let Some(error) = envelope.error {
                return Err(format!(
                    "Codex rate-limit read failed ({}): {}",
                    error.code, error.message
                ));
            }

            let result = envelope
                .result
                .ok_or_else(|| "Codex rate-limit read returned no result payload.".to_string())?;

            let response = serde_json::from_value::<GetAccountRateLimitsResponse>(result)
                .map_err(|error| format!("Failed to decode Codex rate-limit payload: {error}"))?;
            return Ok(Some(response));
        }
    }

    if let Ok(notification) = serde_json::from_str::<JsonRpcNotificationEnvelope>(line) {
        if notification.method == "account/rateLimits/updated" {
            let params = notification
                .params
                .ok_or_else(|| "Codex rate-limit update notification had no params.".to_string())?;
            let notification = serde_json::from_value::<AccountRateLimitsUpdatedNotification>(
                params,
            )
            .map_err(|error| format!("Failed to decode Codex rate-limit notification: {error}"))?;

            return Ok(Some(GetAccountRateLimitsResponse {
                rate_limits: notification.rate_limits,
                rate_limits_by_limit_id: None,
            }));
        }
    }

    Ok(None)
}

fn run_app_server_request(bin: &str) -> Result<GetAccountRateLimitsResponse, String> {
    let mut child = Command::new(bin)
        .arg("app-server")
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|error| format!("Failed to start Codex app-server: {error}"))?;

    let stdout = child
        .stdout
        .take()
        .ok_or_else(|| "Failed to capture Codex app-server stdout.".to_string())?;
    let stderr = child
        .stderr
        .take()
        .ok_or_else(|| "Failed to capture Codex app-server stderr.".to_string())?;

    let (stdout_tx, stdout_rx) = mpsc::channel::<String>();
    let stdout_handle = thread::spawn(move || {
        let reader = BufReader::new(stdout);
        for line in reader.lines() {
            match line {
                Ok(line) => {
                    if stdout_tx.send(line).is_err() {
                        break;
                    }
                }
                Err(_) => break,
            }
        }
    });

    let stderr_handle = thread::spawn(move || {
        let mut reader = BufReader::new(stderr);
        let mut buffer = String::new();
        let _ = reader.read_to_string(&mut buffer);
        buffer
    });

    if let Some(mut stdin) = child.stdin.take() {
        for request in [
            json!({
                "jsonrpc": "2.0",
                "id": 1,
                "method": "initialize",
                "params": {
                    "clientInfo": { "name": "ai-usage", "version": env!("CARGO_PKG_VERSION") },
                    "capabilities": { "experimentalApi": true, "optOutNotificationMethods": [] }
                }
            }),
            json!({
                "jsonrpc": "2.0",
                "method": "initialized"
            }),
            json!({
                "jsonrpc": "2.0",
                "id": RATE_LIMIT_REQUEST_ID,
                "method": "account/rateLimits/read",
                "params": serde_json::Value::Null
            }),
        ] {
            let line = serde_json::to_string(&request).map_err(|error| {
                format!("Failed to serialize Codex app-server request: {error}")
            })?;
            stdin
                .write_all(line.as_bytes())
                .map_err(|error| format!("Failed to write Codex app-server request: {error}"))?;
            stdin
                .write_all(b"\n")
                .map_err(|error| format!("Failed to write Codex app-server request: {error}"))?;
        }
        stdin
            .flush()
            .map_err(|error| format!("Failed to flush Codex app-server request: {error}"))?;

        let mut observed_stdout = Vec::new();
        let response = loop {
            match stdout_rx.recv_timeout(std::time::Duration::from_secs(5)) {
                Ok(line) => {
                    observed_stdout.push(line.clone());
                    if let Some(response) = parse_rate_limit_message(&line)? {
                        break Ok(response);
                    }
                }
                Err(mpsc::RecvTimeoutError::Timeout) => {
                    break Err(format!(
                        "Codex app-server timed out waiting for rate limits. Observed stdout: {}",
                        observed_stdout.join(" | ")
                    ));
                }
                Err(mpsc::RecvTimeoutError::Disconnected) => {
                    break Err(format!(
                        "Codex app-server did not return an account/rateLimits/read response. Observed stdout: {}",
                        observed_stdout.join(" | ")
                    ));
                }
            }
        };

        let _ = child.kill();
        let _ = child.wait();
        let _ = stdout_handle.join();
        let stderr = stderr_handle.join().unwrap_or_default();

        return response.map_err(|message| {
            if stderr.trim().is_empty() {
                message
            } else {
                format!("{message}. stderr: {}", stderr.trim())
            }
        });
    }

    Err("Failed to open Codex app-server stdin.".into())
}

fn snapshot_from_text(text: &str, source: &str) -> CodexSnapshot {
    match parse_status_snapshot(text) {
        Ok(dimensions) if dimensions.is_empty() => CodexSnapshot {
            snapshot_state: "empty".into(),
            connection_state: "connected".into(),
            status_message: "Codex status snapshot did not expose any limit rows.".into(),
            dimensions,
            source: source.into(),
        },
        Ok(dimensions) => CodexSnapshot {
            snapshot_state: "fresh".into(),
            connection_state: "connected".into(),
            status_message: "Live Codex limits available.".into(),
            dimensions,
            source: source.into(),
        },
        Err(message) => CodexSnapshot {
            snapshot_state: "failed".into(),
            connection_state: "failed".into(),
            status_message: message,
            dimensions: Vec::new(),
            source: source.into(),
        },
    }
}

fn read_snapshot_source() -> Result<Option<CodexSnapshot>, String> {
    if let Ok(text) = env::var("AI_USAGE_CODEX_STATUS_TEXT") {
        return Ok(Some(snapshot_from_text(
            &text,
            "env:AI_USAGE_CODEX_STATUS_TEXT",
        )));
    }

    if let Ok(path) = env::var("AI_USAGE_CODEX_STATUS_FILE") {
        let contents = fs::read_to_string(&path)
            .map_err(|error| format!("Failed to read Codex status snapshot file: {error}"))?;
        return Ok(Some(snapshot_from_text(&contents, &path)));
    }

    Ok(None)
}

fn codex_cli_is_available(bin: &str) -> bool {
    run_command(bin, &["--version"])
        .map(|output| output.status_success)
        .unwrap_or(false)
}

fn login_state_message(bin: &str) -> Option<String> {
    run_command(bin, &["login", "status"]).ok().map(|output| {
        if !output.stdout.is_empty() {
            output.stdout
        } else if !output.stderr.is_empty() {
            output.stderr
        } else if output.status_success {
            "Codex login status available.".into()
        } else {
            "Codex login status unavailable.".into()
        }
    })
}

fn login_message_indicates_logged_in(message: &str) -> bool {
    let normalized = message.trim().to_ascii_lowercase();
    normalized.starts_with("logged in") || normalized.contains("logged in using")
}

fn format_window_duration(minutes: Option<u64>, fallback: &str) -> String {
    match minutes {
        Some(10_080) => "week".into(),
        Some(value) if value % 1_440 == 0 && value >= 1_440 => format!("{}d", value / 1_440),
        Some(value) if value % 60 == 0 && value >= 60 => format!("{}h", value / 60),
        Some(value) if value > 0 => format!("{value}m"),
        _ => fallback.into(),
    }
}

fn format_reset_hint(resets_at: Option<i64>) -> Option<String> {
    let timestamp = resets_at?;
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .ok()
        .map(|duration| duration.as_secs() as i64)?;
    let diff = timestamp.saturating_sub(now);

    if diff <= 0 {
        return Some("Reset due".into());
    }

    let value = if diff < 3_600 {
        format!("{}m", (diff + 59) / 60)
    } else if diff < 172_800 {
        format!("{}h", (diff + 3_599) / 3_600)
    } else {
        format!("{}d", (diff + 86_399) / 86_400)
    };

    Some(format!("Resets in {value}"))
}

fn to_quota_dimension(
    base_label: &str,
    window: &RateLimitWindow,
    fallback: &str,
) -> QuotaDimension {
    let remaining = 100u16.saturating_sub(window.used_percent.min(100));

    QuotaDimension {
        label: format!(
            "{base_label} / {}",
            format_window_duration(window.window_duration_mins, fallback)
        ),
        remaining_percent: Some(remaining as u8),
        remaining_absolute: format!("{remaining}% remaining"),
        reset_hint: format_reset_hint(window.resets_at),
    }
}

fn snapshot_dimensions(
    snapshot: &RateLimitSnapshot,
    fallback_label: Option<&str>,
) -> Vec<QuotaDimension> {
    let base_label = snapshot
        .limit_name
        .as_deref()
        .or(snapshot.limit_id.as_deref())
        .or(fallback_label)
        .unwrap_or("Codex");
    let mut dimensions = Vec::new();

    if let Some(primary) = snapshot.primary.as_ref() {
        dimensions.push(to_quota_dimension(base_label, primary, "primary"));
    }
    if let Some(secondary) = snapshot.secondary.as_ref() {
        dimensions.push(to_quota_dimension(base_label, secondary, "secondary"));
    }

    dimensions
}

fn normalize_rate_limits(response: GetAccountRateLimitsResponse) -> Vec<QuotaDimension> {
    let mut dimensions = Vec::new();

    if let Some(by_limit_id) = response.rate_limits_by_limit_id {
        for (limit_id, snapshot) in by_limit_id {
            dimensions.extend(snapshot_dimensions(&snapshot, Some(limit_id.as_str())));
        }
    }

    if dimensions.is_empty() {
        dimensions.extend(snapshot_dimensions(&response.rate_limits, None));
    }

    dimensions
}

fn snapshot_from_rate_limits(response: GetAccountRateLimitsResponse) -> CodexSnapshot {
    let dimensions = normalize_rate_limits(response);

    if dimensions.is_empty() {
        CodexSnapshot {
            snapshot_state: "empty".into(),
            connection_state: "connected".into(),
            status_message: "Codex CLI is logged in, but no live limit windows are available yet."
                .into(),
            dimensions,
            source: "codex app-server".into(),
        }
    } else {
        CodexSnapshot {
            snapshot_state: "fresh".into(),
            connection_state: "connected".into(),
            status_message: "Live Codex limits available from the local Codex CLI session.".into(),
            dimensions,
            source: "codex app-server".into(),
        }
    }
}

fn read_live_snapshot() -> Result<CodexSnapshot, String> {
    let bin = codex_bin();
    match run_app_server_request(&bin) {
        Ok(response) => Ok(snapshot_from_rate_limits(response)),
        Err(detail) => {
            let login_message = login_state_message(&bin).unwrap_or_default();

            if login_message_indicates_logged_in(&login_message) {
                return Err(format!("Codex app-server failed while logged in: {detail}"));
            }

            Ok(CodexSnapshot {
                snapshot_state: "stale".into(),
                connection_state: "disconnected".into(),
                status_message: if login_message.is_empty() {
                    "Codex CLI is installed, but no readable logged-in session is available.".into()
                } else {
                    format!("Codex CLI session is not ready: {login_message}")
                },
                dimensions: Vec::new(),
                source: "codex app-server".into(),
            })
        }
    }
}

pub fn load_snapshot() -> CodexSnapshot {
    let bin = codex_bin();

    if codex_cli_is_available(&bin) {
        return match read_live_snapshot() {
            Ok(snapshot) => snapshot,
            Err(message) => CodexSnapshot {
                snapshot_state: "failed".into(),
                connection_state: "failed".into(),
                status_message: message,
                dimensions: Vec::new(),
                source: "codex app-server".into(),
            },
        };
    }

    match read_snapshot_source() {
        Ok(Some(snapshot)) => snapshot,
        Ok(None) => CodexSnapshot {
            snapshot_state: "stale".into(),
            connection_state: "unavailable".into(),
            status_message: "Codex CLI is not available on this device.".into(),
            dimensions: Vec::new(),
            source: "codex-cli".into(),
        },
        Err(message) => CodexSnapshot {
            snapshot_state: "failed".into(),
            connection_state: "failed".into(),
            status_message: message,
            dimensions: Vec::new(),
            source: "codex-cli".into(),
        },
    }
}

pub fn storage_path() -> PathBuf {
    if let Ok(path) = env::var("AI_USAGE_CODEX_ACCOUNTS_FILE") {
        return PathBuf::from(path);
    }

    #[cfg(target_os = "windows")]
    {
        if let Ok(appdata) = env::var("APPDATA") {
            return PathBuf::from(appdata)
                .join("ai-usage")
                .join("codex-accounts.json");
        }
    }

    #[cfg(target_os = "macos")]
    {
        if let Ok(home) = env::var("HOME") {
            return PathBuf::from(home)
                .join("Library")
                .join("Application Support")
                .join("ai-usage")
                .join("codex-accounts.json");
        }
    }

    if let Ok(home) = env::var("HOME") {
        return PathBuf::from(home)
            .join(".config")
            .join("ai-usage")
            .join("codex-accounts.json");
    }

    PathBuf::from("codex-accounts.json")
}

pub fn preferences_path() -> PathBuf {
    if let Ok(path) = env::var("AI_USAGE_PREFERENCES_FILE") {
        return PathBuf::from(path);
    }

    let mut path = storage_path();
    path.set_file_name("preferences.json");
    path
}

pub fn load_accounts() -> Vec<crate::state::CodexAccount> {
    let path = storage_path();
    fs::read_to_string(path)
        .ok()
        .and_then(|contents| {
            serde_json::from_str::<Vec<crate::state::CodexAccount>>(&contents).ok()
        })
        .unwrap_or_default()
}

pub fn load_preferences() -> crate::state::UserPreferences {
    let path = preferences_path();
    fs::read_to_string(path)
        .ok()
        .and_then(|contents| serde_json::from_str::<crate::state::UserPreferences>(&contents).ok())
        .unwrap_or_else(crate::state::default_preferences)
}

pub fn save_accounts(accounts: &[crate::state::CodexAccount]) -> Result<(), String> {
    let path = storage_path();
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|error| {
            format!("Failed to create Codex account storage directory: {error}")
        })?;
    }

    let payload = serde_json::to_string_pretty(accounts)
        .map_err(|error| format!("Failed to serialize Codex accounts: {error}"))?;
    fs::write(path, payload).map_err(|error| format!("Failed to persist Codex accounts: {error}"))
}

pub fn save_preferences(preferences: &crate::state::UserPreferences) -> Result<(), String> {
    let path = preferences_path();
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|error| format!("Failed to create preferences storage directory: {error}"))?;
    }

    let payload = serde_json::to_string_pretty(preferences)
        .map_err(|error| format!("Failed to serialize preferences: {error}"))?;
    fs::write(path, payload).map_err(|error| format!("Failed to persist preferences: {error}"))
}

#[cfg(test)]
mod tests {
    use super::{load_preferences, load_snapshot, parse_status_snapshot, save_preferences};
    use std::env;
    use std::fs;
    use std::path::PathBuf;
    use std::sync::{Mutex, OnceLock};
    use std::time::{SystemTime, UNIX_EPOCH};

    fn env_lock() -> &'static Mutex<()> {
        static LOCK: OnceLock<Mutex<()>> = OnceLock::new();
        LOCK.get_or_init(|| Mutex::new(()))
    }

    fn unique_temp_path(name: &str) -> PathBuf {
        let nanos = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_nanos();
        let extension = if cfg!(windows) { "cmd" } else { "sh" };
        env::temp_dir().join(format!("ai-usage-{name}-{nanos}.{extension}"))
    }

    fn write_mock_codex(app_server_stdout: &[&str], app_server_stderr: &[&str], app_server_exit: i32, login_stdout: &[&str], login_stderr: &[&str], login_exit: i32) -> PathBuf {
        let path = unique_temp_path("mock-codex");
        let script_body = if cfg!(windows) {
            let mut body = String::from("@echo off\n");
            body.push_str("if \"%~1\"==\"--version\" (\n");
            body.push_str("  echo codex 0.0.0\n");
            body.push_str("  exit /b 0\n");
            body.push_str(")\n");
            body.push_str("if \"%~1\"==\"app-server\" (\n");
            for line in app_server_stdout {
                body.push_str(&format!("  echo {line}\n"));
            }
            for line in app_server_stderr {
                body.push_str(&format!("  echo {line} 1>&2\n"));
            }
            body.push_str(&format!("  exit /b {app_server_exit}\n"));
            body.push_str(")\n");
            body.push_str("if \"%~1\"==\"login\" if \"%~2\"==\"status\" (\n");
            for line in login_stdout {
                body.push_str(&format!("  echo {line}\n"));
            }
            for line in login_stderr {
                body.push_str(&format!("  echo {line} 1>&2\n"));
            }
            body.push_str(&format!("  exit /b {login_exit}\n"));
            body.push_str(")\n");
            body.push_str("exit /b 1\n");
            body
        } else {
            let mut body = String::from("#!/bin/sh\n");
            body.push_str("if [ \"$1\" = \"--version\" ]; then\n");
            body.push_str("  printf 'codex 0.0.0\\n'\n");
            body.push_str("  exit 0\n");
            body.push_str("fi\n");
            body.push_str("if [ \"$1\" = \"app-server\" ]; then\n");
            for line in app_server_stdout {
                body.push_str(&format!("  printf '%s\\n' '{}'\n", line.replace('\'', "'\\''")));
            }
            for line in app_server_stderr {
                body.push_str(&format!("  printf '%s\\n' '{}' >&2\n", line.replace('\'', "'\\''")));
            }
            body.push_str(&format!("  exit {app_server_exit}\n"));
            body.push_str("fi\n");
            body.push_str("if [ \"$1\" = \"login\" ] && [ \"$2\" = \"status\" ]; then\n");
            for line in login_stdout {
                body.push_str(&format!("  printf '%s\\n' '{}'\n", line.replace('\'', "'\\''")));
            }
            for line in login_stderr {
                body.push_str(&format!("  printf '%s\\n' '{}' >&2\n", line.replace('\'', "'\\''")));
            }
            body.push_str(&format!("  exit {login_exit}\n"));
            body.push_str("fi\n");
            body.push_str("exit 1\n");
            body
        };
        fs::write(&path, script_body).expect("script should write");
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let mut permissions = fs::metadata(&path).expect("metadata").permissions();
            permissions.set_mode(0o755);
            fs::set_permissions(&path, permissions).expect("chmod");
        }
        path
    }

    fn clear_snapshot_env() {
        env::remove_var("AI_USAGE_CODEX_STATUS_TEXT");
        env::remove_var("AI_USAGE_CODEX_STATUS_FILE");
        env::remove_var("AI_USAGE_CODEX_BIN");
    }

    fn clear_preferences_env() {
        env::remove_var("AI_USAGE_PREFERENCES_FILE");
    }

    #[test]
    fn parses_healthy_snapshot_rows() {
        let parsed = parse_status_snapshot(
            "Local Messages / 5h: 64% remaining (Resets in 2h)\nCode Reviews / week: 82% remaining (Resets in 4d)",
        )
        .expect("snapshot should parse");

        assert_eq!(parsed.len(), 2);
        assert_eq!(parsed[0].label, "Local Messages / 5h");
        assert_eq!(parsed[0].remaining_percent, Some(64));
        assert_eq!(parsed[1].reset_hint.as_deref(), Some("Resets in 4d"));
    }

    #[test]
    fn allows_empty_snapshots() {
        let parsed =
            parse_status_snapshot("Current usage limits").expect("empty snapshot should parse");
        assert!(parsed.is_empty());
    }

    #[test]
    fn reports_failed_snapshot_file_reads_when_cli_is_missing() {
        let _guard = env_lock().lock().unwrap_or_else(|error| error.into_inner());
        clear_snapshot_env();
        env::set_var("AI_USAGE_CODEX_BIN", "/definitely/missing/codex");
        env::set_var(
            "AI_USAGE_CODEX_STATUS_FILE",
            "/definitely/missing/codex-status.txt",
        );

        let snapshot = load_snapshot();

        assert_eq!(snapshot.snapshot_state, "failed");
        assert_eq!(snapshot.connection_state, "failed");
        assert!(snapshot
            .status_message
            .contains("Failed to read Codex status snapshot file"));

        clear_snapshot_env();
    }

    #[test]
    fn prefers_real_cli_rate_limit_reads_over_env_snapshot_fallback() {
        let _guard = env_lock().lock().unwrap_or_else(|error| error.into_inner());
        clear_snapshot_env();
        env::set_var(
            "AI_USAGE_CODEX_STATUS_TEXT",
            "Local Messages / 5h: 64% remaining",
        );
        let script = write_mock_codex(
            &[
                r#"{"id":1,"result":{"platformFamily":"unix"}}"#,
                r#"{"id":2,"result":{"rateLimits":{"limitId":"codex","limitName":"Codex","primary":{"usedPercent":36,"windowDurationMins":300,"resetsAt":4102444800},"secondary":{"usedPercent":18,"windowDurationMins":10080,"resetsAt":4103049600}},"rateLimitsByLimitId":null}}"#,
            ],
            &[],
            0,
            &["Logged in using ChatGPT"],
            &[],
            0,
        );
        env::set_var("AI_USAGE_CODEX_BIN", &script);

        let snapshot = load_snapshot();

        assert_eq!(snapshot.snapshot_state, "fresh");
        assert_eq!(snapshot.connection_state, "connected");
        assert_eq!(snapshot.source, "codex app-server");
        assert_eq!(snapshot.dimensions.len(), 2);
        assert_eq!(snapshot.dimensions[0].label, "Codex / 5h");
        assert_eq!(snapshot.dimensions[0].remaining_percent, Some(64));

        let _ = fs::remove_file(script);
        clear_snapshot_env();
    }

    #[test]
    fn reports_disconnected_when_cli_exists_but_login_is_missing() {
        let _guard = env_lock().lock().unwrap_or_else(|error| error.into_inner());
        clear_snapshot_env();
        let script = write_mock_codex(&[], &["session missing"], 1, &["Not logged in"], &[], 1);
        env::set_var("AI_USAGE_CODEX_BIN", &script);

        let snapshot = load_snapshot();

        assert_eq!(snapshot.snapshot_state, "stale");
        assert_eq!(snapshot.connection_state, "disconnected");
        assert!(snapshot.status_message.contains("Not logged in"));

        let _ = fs::remove_file(script);
        clear_snapshot_env();
    }

    #[test]
    fn reports_failed_when_logged_in_cli_read_errors() {
        let _guard = env_lock().lock().unwrap_or_else(|error| error.into_inner());
        clear_snapshot_env();
        let script = write_mock_codex(
            &[],
            &["app-server panic"],
            1,
            &["Logged in using ChatGPT"],
            &[],
            0,
        );
        env::set_var("AI_USAGE_CODEX_BIN", &script);

        let snapshot = load_snapshot();

        assert_eq!(snapshot.snapshot_state, "failed");
        assert_eq!(snapshot.connection_state, "failed");
        assert!(snapshot.status_message.contains("logged in"));

        let _ = fs::remove_file(script);
        clear_snapshot_env();
    }

    #[test]
    fn persists_preferences_to_disk() {
        let _guard = env_lock().lock().unwrap_or_else(|error| error.into_inner());
        clear_preferences_env();
        let path = unique_temp_path("preferences").with_extension("json");
        env::set_var("AI_USAGE_PREFERENCES_FILE", &path);

        let mut preferences = crate::state::default_preferences();
        preferences.tray_summary_mode = "window-week".into();
        preferences.refresh_interval_minutes = 30;

        save_preferences(&preferences).expect("preferences should persist");
        let loaded = load_preferences();

        assert_eq!(loaded.tray_summary_mode, "window-week");
        assert_eq!(loaded.refresh_interval_minutes, 30);

        let _ = fs::remove_file(path);
        clear_preferences_env();
    }
}
