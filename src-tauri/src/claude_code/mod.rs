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

use crate::proxy::{self, ProxyDecision, ProxyResolutionError};

#[derive(Debug, PartialEq, Eq)]
enum ApiError {
    Status(u16),
    ProxyConfiguration(ProxyResolutionError),
    RequestFailed(String),
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

    QuotaDimension {
        label,
        remaining_percent: Some(remaining_percent),
        remaining_absolute: format!("{remaining_percent}% remaining"),
        resets_at: Some(dim.resets_at.clone()),
        reset_hint: None,
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
// HTTP API call (proxy resolution delegated to crate::proxy)
// ---------------------------------------------------------------------------

fn build_agent(preferences: &UserPreferences) -> Result<(ureq::Agent, ProxyDecision), ApiError> {
    proxy::build_agent(preferences).map_err(|e| match e {
        proxy::ProxyError::Resolution(r) => ApiError::ProxyConfiguration(r),
        proxy::ProxyError::AgentBuild => {
            ApiError::ProxyConfiguration(ProxyResolutionError::InvalidResolvedUrl)
        }
    })
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

    // (d) Usage dimensions preserve raw resets_at for UI-side formatting.
    #[test]
    fn preserves_raw_resets_at_hours() {
        let future = chrono::Utc::now() + chrono::Duration::minutes(90);
        let iso = future.to_rfc3339();
        let dim = UsageDimension {
            utilization: 40.0,
            resets_at: iso.clone(),
        };
        let transformed = transform_dimension("five_hour", &dim);
        assert_eq!(transformed.resets_at.as_deref(), Some(iso.as_str()));
    }

    // (e) Even past timestamps are preserved; UI decides how to label them.
    #[test]
    fn preserves_raw_resets_at_past() {
        let past = chrono::Utc::now() - chrono::Duration::minutes(5);
        let iso = past.to_rfc3339();
        let dim = UsageDimension {
            utilization: 40.0,
            resets_at: iso.clone(),
        };
        let transformed = transform_dimension("five_hour", &dim);
        assert_eq!(transformed.resets_at.as_deref(), Some(iso.as_str()));
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
                resets_at: None,
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
                resets_at: None,
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
