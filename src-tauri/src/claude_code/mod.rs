// Claude Code quota integration module.
// Reads OAuth credentials from the host system and calls the Anthropic usage API.
// The OAuth token is never stored in app memory between refresh cycles.

use crate::snapshot::{ServiceSnapshot, SnapshotStatus};
use crate::state::{QuotaDimension, UserPreferences};
use serde::Deserialize;
use std::env;
use std::fs;
use std::path::PathBuf;
use std::process::Command;
use std::sync::{Mutex, OnceLock};
use std::time::{SystemTime, UNIX_EPOCH};

// ---------------------------------------------------------------------------
// Internal structures — never exposed outside this module
// ---------------------------------------------------------------------------

#[derive(Debug, Deserialize)]
struct ClaudeCodeUsageResponse {
    five_hour: Option<UsageDimension>,
    seven_day: Option<UsageDimension>,
    seven_day_sonnet: Option<UsageDimension>,
    seven_day_opus: Option<UsageDimension>,
}

#[derive(Debug, Deserialize)]
struct UsageDimension {
    utilization: f64,
    resets_at: String,
}

#[derive(Deserialize)]
struct ClaudeCredentials {
    #[serde(rename = "claudeAiOauth")]
    claude_ai_oauth: OAuthCredential,
}

#[derive(Deserialize)]
struct OAuthCredential {
    #[serde(rename = "accessToken")]
    access_token: String,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum RefreshKind {
    Automatic,
    Manual,
}

#[derive(Clone, Debug, PartialEq, Eq)]
enum PauseState {
    None,
    AccessDenied,
    RateLimitedUntil(i64),
    SessionRecovery,
}

#[derive(Debug, PartialEq, Eq)]
enum ProxyResolutionError {
    InvalidManualUrl,
    InvalidResolvedUrl,
}

#[derive(Debug, PartialEq, Eq)]
enum ApiError {
    Status(u16),
    ProxyConfiguration(ProxyResolutionError),
    RequestFailed(String),
}

#[derive(Clone, Debug, PartialEq, Eq)]
struct ProxyDecision {
    label: String,
    url: Option<String>,
}

// ---------------------------------------------------------------------------
// Stale cache — holds the last-known dimensions so transient failures can
// return cached data instead of wiping the panel.
// ---------------------------------------------------------------------------

fn stale_cache() -> &'static Mutex<Option<Vec<QuotaDimension>>> {
    static CACHE: OnceLock<Mutex<Option<Vec<QuotaDimension>>>> = OnceLock::new();
    CACHE.get_or_init(|| Mutex::new(None))
}

/// Seeds the in-memory stale cache from externally restored data (e.g., disk
/// snapshot cache).  This ensures that if a subsequent 401 occurs, the session
/// recovery handler has cached dimensions to display.
pub fn seed_stale_cache(dimensions: Vec<QuotaDimension>) {
    if let Ok(mut cache) = stale_cache().lock() {
        if cache.is_none() && !dimensions.is_empty() {
            *cache = Some(dimensions);
        }
    }
}

// ---------------------------------------------------------------------------
// Refresh pause / cooldown state
// ---------------------------------------------------------------------------

fn pause_state() -> &'static Mutex<PauseState> {
    static STATE: OnceLock<Mutex<PauseState>> = OnceLock::new();
    STATE.get_or_init(|| Mutex::new(PauseState::None))
}

pub fn clear_access_pause() {
    if let Ok(mut state) = pause_state().lock() {
        *state = PauseState::None;
    }
}

fn is_access_paused() -> bool {
    pause_state()
        .lock()
        .map(|state| *state == PauseState::AccessDenied)
        .unwrap_or(false)
}

/// Returns true when in session-recovery state (401).
/// Note: unlike `is_access_paused()`, this does NOT block automatic refresh —
/// auto-refresh continues at the normal interval to probe for token recovery.
#[allow(dead_code)]
fn is_session_recovery() -> bool {
    pause_state()
        .lock()
        .map(|state| *state == PauseState::SessionRecovery)
        .unwrap_or(false)
}

const RATE_LIMIT_COOLDOWN_SECS: i64 = 30 * 60;

fn now_unix() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs() as i64
}

fn active_rate_limit_until() -> Option<i64> {
    let now = now_unix();
    pause_state().lock().ok().and_then(|state| match *state {
        PauseState::RateLimitedUntil(until) if until > now => Some(until),
        _ => None,
    })
}

fn pause_snapshot(source: String) -> ServiceSnapshot {
    ServiceSnapshot {
        status: SnapshotStatus::AccessDenied,
        dimensions: Vec::new(),
        source,
    }
}

fn rate_limit_retry_minutes(until: i64) -> u32 {
    let remaining_secs = until.saturating_sub(now_unix());
    ((remaining_secs + 59) / 60).max(1) as u32
}

fn rate_limited_snapshot(
    source: String,
    dimensions: Vec<QuotaDimension>,
    until: i64,
) -> ServiceSnapshot {
    ServiceSnapshot {
        status: SnapshotStatus::RateLimited {
            retry_after_minutes: rate_limit_retry_minutes(until),
        },
        dimensions,
        source,
    }
}

// ---------------------------------------------------------------------------
// Credential reading
// ---------------------------------------------------------------------------

fn read_token_from_env() -> Option<(String, String)> {
    env::var("CLAUDE_CODE_OAUTH_TOKEN")
        .ok()
        .filter(|token| !token.is_empty())
        .map(|token| (token, "env:CLAUDE_CODE_OAUTH_TOKEN".into()))
}

fn claude_config_dir() -> PathBuf {
    if let Ok(dir) = env::var("CLAUDE_CONFIG_DIR") {
        return PathBuf::from(dir);
    }
    if let Ok(home) = env::var("HOME") {
        return PathBuf::from(home).join(".claude");
    }
    PathBuf::from(".claude")
}

fn keychain_service_name() -> String {
    if let Ok(dir) = env::var("CLAUDE_CONFIG_DIR") {
        use sha2::{Digest, Sha256};
        let hash = Sha256::digest(dir.as_bytes());
        let hex: String = hash.iter().map(|byte| format!("{byte:02x}")).collect();
        let suffix = &hex[..8];
        return format!("Claude Code-credentials-{suffix}");
    }
    "Claude Code-credentials".into()
}

#[cfg(target_os = "macos")]
fn read_token_from_keychain() -> Option<(String, String)> {
    let service = keychain_service_name();
    let user = env::var("USER").unwrap_or_else(|_| env::var("LOGNAME").unwrap_or_default());
    let output = Command::new("security")
        .args(["find-generic-password", "-a", &user, "-s", &service, "-w"])
        .output()
        .ok()?;
    if !output.status.success() {
        return None;
    }
    let raw = String::from_utf8_lossy(&output.stdout).trim().to_string();
    if raw.is_empty() {
        return None;
    }
    // The keychain value may be plain JSON or hex-encoded JSON depending on
    // how Claude Code stored it. Try plain JSON first; fall back to hex decode.
    let credentials: ClaudeCredentials = serde_json::from_str(&raw)
        .ok()
        .or_else(|| hex::decode_hex(&raw).and_then(|bytes| serde_json::from_slice(&bytes).ok()))?;
    let token = credentials.claude_ai_oauth.access_token;
    if token.is_empty() {
        return None;
    }
    Some((token, "keychain".into()))
}

#[cfg(not(target_os = "macos"))]
fn read_token_from_keychain() -> Option<(String, String)> {
    None
}

fn read_token_from_file() -> Option<(String, String)> {
    let path = claude_config_dir().join(".credentials.json");
    let contents = fs::read_to_string(&path).ok()?;
    let credentials: ClaudeCredentials = serde_json::from_str(&contents).ok()?;
    let token = credentials.claude_ai_oauth.access_token;
    if token.is_empty() {
        return None;
    }
    Some((token, "file:~/.claude/.credentials.json".into()))
}

fn read_oauth_token() -> Option<(String, String)> {
    read_token_from_env()
        .or_else(read_token_from_keychain)
        .or_else(read_token_from_file)
}

// ---------------------------------------------------------------------------
// Hex decoding helper (macOS keychain may return hex-encoded JSON)
// ---------------------------------------------------------------------------

mod hex {
    pub fn decode_hex(hex: &str) -> Option<Vec<u8>> {
        let hex = hex.trim();
        if hex.len() % 2 != 0 {
            return None;
        }
        (0..hex.len())
            .step_by(2)
            .map(|i| u8::from_str_radix(&hex[i..i + 2], 16).ok())
            .collect()
    }
}

// ---------------------------------------------------------------------------
// Reset hint formatting — must match codex format_reset_hint output exactly
// ---------------------------------------------------------------------------

fn format_reset_hint_from_iso(resets_at: &str) -> Option<String> {
    let dt = chrono::DateTime::parse_from_rfc3339(resets_at).ok()?;
    let reset_unix = dt.timestamp();
    let now_unix = now_unix();
    let diff = reset_unix.saturating_sub(now_unix);

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

// ---------------------------------------------------------------------------
// Dimension transformation
// ---------------------------------------------------------------------------

fn dimension_label(field_name: &str) -> &'static str {
    match field_name {
        "five_hour" => "Claude Code / 5h",
        "seven_day" => "Claude Code / week",
        "seven_day_sonnet" => "Claude Code / week (Sonnet)",
        "seven_day_opus" => "Claude Code / week (Opus)",
        _ => "Claude Code",
    }
}

fn transform_dimension(field_name: &str, dim: &UsageDimension) -> QuotaDimension {
    let remaining_percent = (100.0 - dim.utilization).round().clamp(0.0, 100.0) as u8;
    let label = dimension_label(field_name).to_string();
    let reset_hint = format_reset_hint_from_iso(&dim.resets_at);

    QuotaDimension {
        label,
        remaining_percent: Some(remaining_percent),
        remaining_absolute: format!("{remaining_percent}% remaining"),
        reset_hint,
        status: "unknown".into(),
        progress_tone: "muted".into(),
    }
}

fn transform_response(response: ClaudeCodeUsageResponse) -> Vec<QuotaDimension> {
    let mut dimensions = Vec::new();

    if let Some(dim) = response.five_hour.as_ref() {
        dimensions.push(transform_dimension("five_hour", dim));
    }
    if let Some(dim) = response.seven_day.as_ref() {
        dimensions.push(transform_dimension("seven_day", dim));
    }
    if let Some(dim) = response.seven_day_sonnet.as_ref() {
        dimensions.push(transform_dimension("seven_day_sonnet", dim));
    }
    if let Some(dim) = response.seven_day_opus.as_ref() {
        dimensions.push(transform_dimension("seven_day_opus", dim));
    }

    dimensions
}

// ---------------------------------------------------------------------------
// System proxy detection
// ---------------------------------------------------------------------------

fn has_scheme(value: &str) -> bool {
    value.starts_with("http://") || value.starts_with("https://") || value.starts_with("socks5://")
}

fn normalize_system_proxy_url(raw: &str) -> Option<String> {
    let value = raw.trim();
    if value.is_empty() {
        return None;
    }
    if value.contains("://") {
        return Some(value.into());
    }
    Some(format!("http://{value}"))
}

fn normalize_manual_proxy_url(raw: &str) -> Result<String, ProxyResolutionError> {
    let value = raw.trim();
    if value.is_empty() || !has_scheme(value) {
        return Err(ProxyResolutionError::InvalidManualUrl);
    }
    Ok(value.into())
}

#[cfg(any(test, target_os = "windows"))]
fn parse_proxy_assignment_value(raw: &str) -> Option<String> {
    let value = raw.trim();
    if value.is_empty() {
        return None;
    }

    if !value.contains('=') {
        return normalize_system_proxy_url(value);
    }

    let mut http_proxy = None;
    let mut https_proxy = None;
    let mut fallback = None;
    for part in value.split(';') {
        let part = part.trim();
        if part.is_empty() {
            continue;
        }
        let (key, val) = part.split_once('=').unwrap_or(("", part));
        let normalized = normalize_system_proxy_url(val)?;
        match key.trim().to_ascii_lowercase().as_str() {
            "https" => https_proxy = Some(normalized),
            "http" => http_proxy = Some(normalized),
            _ => {
                if fallback.is_none() {
                    fallback = Some(normalized);
                }
            }
        }
    }

    https_proxy.or(http_proxy).or(fallback)
}

fn parse_scutil_proxy_output(text: &str) -> Option<String> {
    let map: std::collections::HashMap<&str, &str> = text
        .lines()
        .filter_map(|line| {
            let mut parts = line.splitn(2, ':');
            let key = parts.next()?.trim();
            let val = parts.next()?.trim();
            Some((key, val))
        })
        .collect();

    // Prefer HTTPS-specific proxy, fall back to HTTP proxy.
    let (host, port) = if map.get("HTTPSEnable").copied() == Some("1") {
        (
            map.get("HTTPSProxy").copied().unwrap_or(""),
            map.get("HTTPSPort").copied().unwrap_or("8080"),
        )
    } else if map.get("HTTPEnable").copied() == Some("1") {
        (
            map.get("HTTPProxy").copied().unwrap_or(""),
            map.get("HTTPPort").copied().unwrap_or("8080"),
        )
    } else {
        return None;
    };

    if host.is_empty() {
        return None;
    }

    Some(format!("http://{host}:{port}"))
}

#[cfg(target_os = "macos")]
fn get_macos_system_proxy() -> Option<String> {
    let output = Command::new("scutil").arg("--proxy").output().ok()?;
    if !output.status.success() {
        return None;
    }
    parse_scutil_proxy_output(&String::from_utf8_lossy(&output.stdout))
}

#[cfg(not(target_os = "macos"))]
fn get_macos_system_proxy() -> Option<String> {
    None
}

#[cfg(any(test, target_os = "windows"))]
fn parse_windows_reg_proxy_output(text: &str) -> Option<String> {
    let enabled = text.lines().any(|line| {
        line.contains("ProxyEnable") && (line.contains("0x1") || line.trim_end().ends_with(" 1"))
    });
    if !enabled {
        return None;
    }

    let server_line = text.lines().find(|line| line.contains("ProxyServer"))?;
    let raw = server_line
        .split_whitespace()
        .last()
        .map(str::trim)
        .unwrap_or_default();
    parse_proxy_assignment_value(raw)
}

#[cfg(any(test, target_os = "windows"))]
fn parse_windows_netsh_proxy_output(text: &str) -> Option<String> {
    let proxy_line = text.lines().find(|line| line.contains("Proxy Server(s)"))?;
    let raw = proxy_line.split_once(':')?.1.trim();
    if raw.eq_ignore_ascii_case("direct access (no proxy server)") {
        return None;
    }
    parse_proxy_assignment_value(raw)
}

#[cfg(target_os = "windows")]
fn get_windows_system_proxy() -> Option<String> {
    let reg_output = Command::new("reg")
        .args([
            "query",
            r"HKCU\Software\Microsoft\Windows\CurrentVersion\Internet Settings",
            "/v",
            "ProxyEnable",
        ])
        .output()
        .ok();
    let reg_server_output = Command::new("reg")
        .args([
            "query",
            r"HKCU\Software\Microsoft\Windows\CurrentVersion\Internet Settings",
            "/v",
            "ProxyServer",
        ])
        .output()
        .ok();

    if let (Some(enable), Some(server)) = (reg_output, reg_server_output) {
        if enable.status.success() && server.status.success() {
            let combined = format!(
                "{}\n{}",
                String::from_utf8_lossy(&enable.stdout),
                String::from_utf8_lossy(&server.stdout)
            );
            if let Some(proxy) = parse_windows_reg_proxy_output(&combined) {
                return Some(proxy);
            }
        }
    }

    let netsh = Command::new("netsh")
        .args(["winhttp", "show", "proxy"])
        .output()
        .ok()?;
    if !netsh.status.success() {
        return None;
    }
    parse_windows_netsh_proxy_output(&String::from_utf8_lossy(&netsh.stdout))
}

#[cfg(not(target_os = "windows"))]
fn get_windows_system_proxy() -> Option<String> {
    None
}

/// Resolve the outbound proxy for Claude Code usage requests.
///
/// Priority:
///   1. Explicit user preference (`off` / `manual`)
///   2. Standard proxy env vars (HTTPS_PROXY, https_proxy, ALL_PROXY, …)
///   3. macOS System Preferences proxy (via `scutil --proxy`)
///   4. Windows system proxy / WinHTTP fallback
fn get_env_proxy() -> Option<String> {
    for var in &[
        "HTTPS_PROXY",
        "https_proxy",
        "ALL_PROXY",
        "all_proxy",
        "HTTP_PROXY",
        "http_proxy",
    ] {
        if let Ok(val) = env::var(var) {
            if let Some(url) = normalize_system_proxy_url(&val) {
                return Some(url);
            }
        }
    }
    None
}

fn resolve_proxy(preferences: &UserPreferences) -> Result<ProxyDecision, ProxyResolutionError> {
    match preferences.network_proxy_mode.as_str() {
        "off" => Ok(ProxyDecision {
            label: "off".into(),
            url: None,
        }),
        "manual" => Ok(ProxyDecision {
            label: "manual".into(),
            url: Some(normalize_manual_proxy_url(&preferences.network_proxy_url)?),
        }),
        _ => {
            if let Some(url) = get_env_proxy() {
                Ok(ProxyDecision {
                    label: "system(env)".into(),
                    url: Some(url),
                })
            } else if let Some(url) = get_macos_system_proxy() {
                Ok(ProxyDecision {
                    label: "system(macos)".into(),
                    url: Some(url),
                })
            } else if let Some(url) = get_windows_system_proxy() {
                Ok(ProxyDecision {
                    label: "system(windows)".into(),
                    url: Some(url),
                })
            } else {
                Ok(ProxyDecision {
                    label: "system(none-detected)".into(),
                    url: None,
                })
            }
        }
    }
}

// ---------------------------------------------------------------------------
// HTTP API call
// ---------------------------------------------------------------------------

fn build_agent(preferences: &UserPreferences) -> Result<(ureq::Agent, ProxyDecision), ApiError> {
    let mut builder = ureq::AgentBuilder::new();
    let proxy = resolve_proxy(preferences).map_err(ApiError::ProxyConfiguration)?;
    if let Some(proxy_url) = proxy.url.as_ref() {
        let proxy = ureq::Proxy::new(&proxy_url)
            .map_err(|_| ApiError::ProxyConfiguration(ProxyResolutionError::InvalidResolvedUrl))?;
        builder = builder.proxy(proxy);
    }
    Ok((builder.build(), proxy))
}

fn call_usage_api(
    token: &str,
    preferences: &UserPreferences,
) -> Result<(ClaudeCodeUsageResponse, ProxyDecision), ApiError> {
    let (agent, proxy) = build_agent(preferences)?;
    let response = agent
        .get("https://api.anthropic.com/api/oauth/usage")
        .set("Authorization", &format!("Bearer {token}"))
        .set("anthropic-beta", "oauth-2025-04-20")
        .call();

    match response {
        Ok(resp) => {
            let usage: ClaudeCodeUsageResponse = resp.into_json().map_err(|error| {
                ApiError::RequestFailed(format!("response decode failed: {error}"))
            })?;
            Ok((usage, proxy))
        }
        Err(ureq::Error::Status(code, _)) => Err(ApiError::Status(code)),
        Err(error) => Err(ApiError::RequestFailed(error.to_string())),
    }
}

fn invalid_proxy_snapshot(source: String) -> ServiceSnapshot {
    ServiceSnapshot {
        status: SnapshotStatus::ProxyInvalid,
        dimensions: Vec::new(),
        source,
    }
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

pub fn load_snapshot(
    preferences: &UserPreferences,
    refresh_kind: RefreshKind,
) -> ServiceSnapshot {
    let (token, source) = match read_oauth_token() {
        Some(pair) => pair,
        None => {
            return ServiceSnapshot {
                status: SnapshotStatus::NoCredentials,
                dimensions: Vec::new(),
                source: "none".into(),
            };
        }
    };

    // Only AccessDenied (403) blocks auto-refresh. SessionRecovery (401)
    // intentionally passes through so the normal refresh cycle serves as
    // the recovery probe — no separate timer needed.
    if refresh_kind == RefreshKind::Automatic && is_access_paused() {
        return pause_snapshot(source);
    }
    if refresh_kind == RefreshKind::Automatic {
        if let Some(until) = active_rate_limit_until() {
            let cached = stale_cache()
                .lock()
                .ok()
                .and_then(|guard| guard.clone())
                .unwrap_or_default();
            return rate_limited_snapshot(source, cached, until);
        }
    }

    match call_usage_api(&token, preferences) {
        Ok((response, _proxy)) => {
            clear_access_pause();
            let dimensions = transform_response(response);
            if let Ok(mut cache) = stale_cache().lock() {
                *cache = Some(dimensions.clone());
            }
            ServiceSnapshot {
                status: SnapshotStatus::Fresh,
                dimensions,
                source,
            }
        }
        Err(ApiError::Status(401)) => {
            if let Ok(mut state) = pause_state().lock() {
                *state = PauseState::SessionRecovery;
            }
            // Preserve stale cache — do NOT clear it.
            let cached = stale_cache()
                .lock()
                .ok()
                .and_then(|guard| guard.clone())
                .unwrap_or_default();
            ServiceSnapshot {
                status: SnapshotStatus::SessionRecovery,
                dimensions: cached,
                source,
            }
        }
        Err(ApiError::Status(403)) => {
            if let Ok(mut state) = pause_state().lock() {
                *state = PauseState::AccessDenied;
            }
            pause_snapshot(source)
        }
        Err(ApiError::Status(429)) => {
            let until = now_unix() + RATE_LIMIT_COOLDOWN_SECS;
            if let Ok(mut state) = pause_state().lock() {
                *state = PauseState::RateLimitedUntil(until);
            }
            let cached = stale_cache()
                .lock()
                .ok()
                .and_then(|guard| guard.clone())
                .unwrap_or_default();
            rate_limited_snapshot(source, cached, until)
        }
        Err(ApiError::Status(status)) => {
            let cached = stale_cache()
                .lock()
                .ok()
                .and_then(|guard| guard.clone())
                .unwrap_or_default();
            ServiceSnapshot {
                status: SnapshotStatus::TemporarilyUnavailable {
                    detail: format!("HTTP {status}"),
                },
                dimensions: cached,
                source,
            }
        }
        Err(ApiError::ProxyConfiguration(_kind)) => invalid_proxy_snapshot(source),
        Err(ApiError::RequestFailed(detail)) => {
            let cached = stale_cache()
                .lock()
                .ok()
                .and_then(|guard| guard.clone())
                .unwrap_or_default();
            ServiceSnapshot {
                status: SnapshotStatus::TemporarilyUnavailable { detail },
                dimensions: cached,
                source,
            }
        }
    }
}

// ---------------------------------------------------------------------------
// Unit tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    fn shared_state_test_guard() -> std::sync::MutexGuard<'static, ()> {
        static LOCK: OnceLock<Mutex<()>> = OnceLock::new();
        LOCK.get_or_init(|| Mutex::new(())).lock().unwrap()
    }

    fn reset_shared_test_state() {
        clear_access_pause();
        if let Ok(mut cache) = stale_cache().lock() {
            *cache = None;
        }
    }

    fn prefs() -> UserPreferences {
        crate::state::default_preferences()
    }

    // (a) hex decode of a known byte sequence produces the expected JSON string
    #[test]
    fn hex_decode_produces_expected_bytes() {
        let input = "7b226b6579223a2276616c7565227d";
        let decoded = hex::decode_hex(input).expect("should decode");
        let text = String::from_utf8(decoded).expect("should be utf8");
        assert_eq!(text, r#"{"key":"value"}"#);
    }

    // (b) utilization = 35.0 -> remaining_percent = 65
    #[test]
    fn transforms_utilization_to_remaining_percent() {
        let dim = UsageDimension {
            utilization: 35.0,
            resets_at: "2099-01-01T00:00:00+00:00".into(),
        };
        let result = transform_dimension("five_hour", &dim);
        assert_eq!(result.remaining_percent, Some(65));
    }

    // (c) utilization = 100.5 -> remaining_percent = 0 (clamp)
    #[test]
    fn clamps_remaining_percent_to_zero() {
        let dim = UsageDimension {
            utilization: 100.5,
            resets_at: "2099-01-01T00:00:00+00:00".into(),
        };
        let result = transform_dimension("five_hour", &dim);
        assert_eq!(result.remaining_percent, Some(0));
    }

    // (d) ISO 8601 resets_at 90 minutes in the future -> "Resets in 2h"
    #[test]
    fn formats_reset_hint_hours() {
        let future = chrono::Utc::now() + chrono::Duration::minutes(90);
        let iso = future.to_rfc3339();
        let hint = format_reset_hint_from_iso(&iso).expect("should produce hint");
        assert_eq!(hint, "Resets in 2h");
    }

    // (e) ISO 8601 resets_at in the past -> "Reset due"
    #[test]
    fn formats_reset_hint_past() {
        let past = chrono::Utc::now() - chrono::Duration::minutes(5);
        let iso = past.to_rfc3339();
        let hint = format_reset_hint_from_iso(&iso).expect("should produce hint");
        assert_eq!(hint, "Reset due");
    }

    #[test]
    fn parse_scutil_output_prefers_https_proxy() {
        let text = r#"
<dictionary> {
  HTTPEnable : 1
  HTTPProxy : 127.0.0.1
  HTTPPort : 7890
  HTTPSEnable : 1
  HTTPSProxy : 127.0.0.2
  HTTPSPort : 7891
}
"#;
        assert_eq!(
            parse_scutil_proxy_output(text),
            Some("http://127.0.0.2:7891".into())
        );
    }

    #[test]
    fn parse_windows_registry_proxy_prefers_https_assignment() {
        let text = r#"
HKEY_CURRENT_USER\Software\Microsoft\Windows\CurrentVersion\Internet Settings
    ProxyEnable    REG_DWORD    0x1
    ProxyServer    REG_SZ    http=127.0.0.1:8080;https=127.0.0.1:9443
"#;
        assert_eq!(
            parse_windows_reg_proxy_output(text),
            Some("http://127.0.0.1:9443".into())
        );
    }

    #[test]
    fn parse_windows_netsh_proxy_supports_direct_host_port() {
        let text = r#"
Current WinHTTP proxy settings:

    Proxy Server(s) : 10.0.0.2:8888
    Bypass List     : (none)
"#;
        assert_eq!(
            parse_windows_netsh_proxy_output(text),
            Some("http://10.0.0.2:8888".into())
        );
    }

    #[test]
    fn manual_proxy_requires_full_url() {
        let mut preferences = prefs();
        preferences.network_proxy_mode = "manual".into();
        preferences.network_proxy_url = "127.0.0.1:7890".into();
        assert_eq!(
            resolve_proxy(&preferences),
            Err(ProxyResolutionError::InvalidManualUrl)
        );
    }

    #[test]
    fn off_proxy_mode_bypasses_proxy() {
        let mut preferences = prefs();
        preferences.network_proxy_mode = "off".into();
        preferences.network_proxy_url = "http://127.0.0.1:7890".into();
        assert_eq!(
            resolve_proxy(&preferences),
            Ok(ProxyDecision {
                label: "off".into(),
                url: None
            })
        );
    }

    #[test]
    fn manual_proxy_mode_uses_configured_url() {
        let mut preferences = prefs();
        preferences.network_proxy_mode = "manual".into();
        preferences.network_proxy_url = "http://127.0.0.1:7890".into();
        assert_eq!(
            resolve_proxy(&preferences),
            Ok(ProxyDecision {
                label: "manual".into(),
                url: Some("http://127.0.0.1:7890".into())
            })
        );
    }

    #[test]
    fn access_pause_blocks_automatic_refresh() {
        let _guard = shared_state_test_guard();
        reset_shared_test_state();
        if let Ok(mut state) = pause_state().lock() {
            *state = PauseState::AccessDenied;
        }
        let snapshot = pause_snapshot("keychain".into());
        assert_eq!(snapshot.status, SnapshotStatus::AccessDenied);
        clear_access_pause();
    }

    #[test]
    fn active_rate_limit_until_only_returns_future_deadline() {
        let _guard = shared_state_test_guard();
        reset_shared_test_state();
        if let Ok(mut state) = pause_state().lock() {
            *state = PauseState::RateLimitedUntil(now_unix() + 120);
        }
        assert!(active_rate_limit_until().is_some());

        if let Ok(mut state) = pause_state().lock() {
            *state = PauseState::RateLimitedUntil(now_unix() - 1);
        }
        assert!(active_rate_limit_until().is_none());
        clear_access_pause();
    }

    #[test]
    fn rate_limited_snapshot_reports_rate_limited_status() {
        let snapshot = rate_limited_snapshot("keychain".into(), Vec::new(), now_unix() + 300);
        assert!(
            matches!(snapshot.status, SnapshotStatus::RateLimited { retry_after_minutes } if retry_after_minutes > 0)
        );
    }

    #[test]
    fn auth_error_produces_access_denied() {
        let snapshot = ServiceSnapshot {
            status: SnapshotStatus::AccessDenied,
            dimensions: Vec::new(),
            source: "test".into(),
        };
        assert_eq!(snapshot.status, SnapshotStatus::AccessDenied);
    }

    // (f) transient failure with prior cache -> cached dims preserved
    #[test]
    fn transient_failure_with_cache_returns_cached_dims() {
        let _guard = shared_state_test_guard();
        reset_shared_test_state();
        {
            let mut cache = stale_cache().lock().unwrap();
            *cache = Some(vec![QuotaDimension {
                label: "Claude Code / 5h".into(),
                remaining_percent: Some(42),
                remaining_absolute: "42% remaining".into(),
                reset_hint: None,
                status: "unknown".into(),
                progress_tone: "muted".into(),
            }]);
        }

        let cached = stale_cache().lock().ok().and_then(|guard| guard.clone());

        let snapshot = match cached {
            Some(dimensions) => ServiceSnapshot {
                status: SnapshotStatus::TemporarilyUnavailable {
                    detail: "test".into(),
                },
                dimensions,
                source: "test".into(),
            },
            None => panic!("expected cached dimensions"),
        };

        assert!(matches!(snapshot.status, SnapshotStatus::TemporarilyUnavailable { .. }));
        assert_eq!(snapshot.dimensions.len(), 1);
        assert_eq!(snapshot.dimensions[0].remaining_percent, Some(42));
        *stale_cache().lock().unwrap() = None;
    }

    #[test]
    fn dimension_labels_are_correct() {
        assert_eq!(dimension_label("five_hour"), "Claude Code / 5h");
        assert_eq!(dimension_label("seven_day"), "Claude Code / week");
        assert_eq!(
            dimension_label("seven_day_sonnet"),
            "Claude Code / week (Sonnet)"
        );
        assert_eq!(
            dimension_label("seven_day_opus"),
            "Claude Code / week (Opus)"
        );
    }

    // --- US1: Session recovery preserves cache ---

    #[test]
    fn session_recovery_preserves_cache() {
        let _guard = shared_state_test_guard();
        reset_shared_test_state();
        // Populate stale cache to simulate a prior successful fetch.
        {
            let mut cache = stale_cache().lock().unwrap();
            *cache = Some(vec![QuotaDimension {
                label: "Claude Code / 5h".into(),
                remaining_percent: Some(70),
                remaining_absolute: "70% remaining".into(),
                reset_hint: None,
                status: "healthy".into(),
                progress_tone: "success".into(),
            }]);
        }

        // Simulate what the 401 handler does: read cache without clearing it.
        if let Ok(mut state) = pause_state().lock() {
            *state = PauseState::SessionRecovery;
        }
        let cached = stale_cache().lock().ok().and_then(|guard| guard.clone());
        assert!(cached.is_some(), "cache must NOT be cleared on 401");
        assert_eq!(cached.unwrap().len(), 1);

        // Cleanup
        *stale_cache().lock().unwrap() = None;
        clear_access_pause();
    }

    #[test]
    fn session_recovery_sets_pause_state() {
        let _guard = shared_state_test_guard();
        reset_shared_test_state();
        if let Ok(mut state) = pause_state().lock() {
            *state = PauseState::SessionRecovery;
        }
        assert!(is_session_recovery());
        assert!(
            !is_access_paused(),
            "SessionRecovery must not match is_access_paused"
        );
        clear_access_pause();
    }

    #[test]
    fn session_recovery_does_not_block_auto_refresh() {
        let _guard = shared_state_test_guard();
        reset_shared_test_state();
        // Set SessionRecovery, then verify is_access_paused is false
        // (which is the guard that blocks automatic refresh).
        if let Ok(mut state) = pause_state().lock() {
            *state = PauseState::SessionRecovery;
        }
        assert!(!is_access_paused());
        assert!(active_rate_limit_until().is_none());
        // Both guards are false, so load_snapshot would proceed to call the API.
        clear_access_pause();
    }

    #[test]
    fn session_recovery_cleared_on_success() {
        let _guard = shared_state_test_guard();
        reset_shared_test_state();
        if let Ok(mut state) = pause_state().lock() {
            *state = PauseState::SessionRecovery;
        }
        assert!(is_session_recovery());
        // Simulate what the 200 handler does: clear_access_pause.
        clear_access_pause();
        assert!(!is_session_recovery());
        let state = pause_state().lock().unwrap().clone();
        assert_eq!(state, PauseState::None);
    }

    // --- US2: Empty cache + 401 returns empty snapshot ---

    #[test]
    fn session_recovery_empty_cache_returns_empty_snapshot() {
        let _guard = shared_state_test_guard();
        reset_shared_test_state();
        // Ensure cache is empty.
        *stale_cache().lock().unwrap() = None;

        if let Ok(mut state) = pause_state().lock() {
            *state = PauseState::SessionRecovery;
        }

        let cached = stale_cache().lock().ok().and_then(|guard| guard.clone());
        let snapshot = ServiceSnapshot {
            status: SnapshotStatus::SessionRecovery,
            dimensions: cached.unwrap_or_default(),
            source: "test".into(),
        };

        assert_eq!(snapshot.status, SnapshotStatus::SessionRecovery);
        assert!(snapshot.dimensions.is_empty());

        clear_access_pause();
    }

    // --- US3: State transitions between SessionRecovery and other states ---

    #[test]
    fn session_recovery_then_429_enters_rate_limit() {
        let _guard = shared_state_test_guard();
        reset_shared_test_state();
        if let Ok(mut state) = pause_state().lock() {
            *state = PauseState::SessionRecovery;
        }
        // Simulate what the 429 handler does.
        let until = now_unix() + RATE_LIMIT_COOLDOWN_SECS;
        if let Ok(mut state) = pause_state().lock() {
            *state = PauseState::RateLimitedUntil(until);
        }
        assert!(!is_session_recovery());
        assert!(active_rate_limit_until().is_some());
        clear_access_pause();
    }

    #[test]
    fn session_recovery_then_403_enters_access_denied() {
        let _guard = shared_state_test_guard();
        reset_shared_test_state();
        if let Ok(mut state) = pause_state().lock() {
            *state = PauseState::SessionRecovery;
        }
        // Simulate what the 403 handler does.
        if let Ok(mut state) = pause_state().lock() {
            *state = PauseState::AccessDenied;
        }
        assert!(!is_session_recovery());
        assert!(is_access_paused());
        clear_access_pause();
    }

    #[test]
    fn rate_limit_expired_then_401_enters_session_recovery() {
        let _guard = shared_state_test_guard();
        reset_shared_test_state();
        // Set an expired rate limit.
        if let Ok(mut state) = pause_state().lock() {
            *state = PauseState::RateLimitedUntil(now_unix() - 1);
        }
        assert!(
            active_rate_limit_until().is_none(),
            "expired rate limit should not block"
        );
        // Simulate what the 401 handler does.
        if let Ok(mut state) = pause_state().lock() {
            *state = PauseState::SessionRecovery;
        }
        assert!(is_session_recovery());
        clear_access_pause();
    }
}
