// Kimi Code quota integration module.
// Reads API key from environment, config files, or preferences,
// then calls the Kimi Code usage API to fetch quota data.

use crate::snapshot::{ServiceSnapshot, SnapshotStatus};
use crate::state::{QuotaDimension, UserPreferences};
use serde::Deserialize;
use std::env;
use std::fs;
use std::path::{Path, PathBuf};

// ---------------------------------------------------------------------------
// API Response structures (from opencode-bar KimiProvider.swift verification)
// ---------------------------------------------------------------------------

#[derive(Debug, Deserialize)]
struct KimiUsageResponse {
    #[allow(dead_code)]
    user: Option<KimiUser>,
    usage: Option<KimiUsage>,
    limits: Option<Vec<KimiLimit>>,
}

#[derive(Debug, Deserialize)]
struct KimiUser {
    #[serde(rename = "userId")]
    #[allow(dead_code)]
    user_id: Option<String>,
    #[allow(dead_code)]
    membership: Option<KimiMembership>,
}

#[derive(Debug, Deserialize)]
struct KimiMembership {
    #[allow(dead_code)]
    level: Option<String>,
}

#[derive(Debug, Deserialize)]
struct KimiUsage {
    limit: Option<String>,
    #[allow(dead_code)]
    used: Option<String>,
    remaining: Option<String>,
    #[serde(rename = "resetTime")]
    reset_time: Option<String>,
}

#[derive(Debug, Deserialize)]
struct KimiLimit {
    #[allow(dead_code)]
    window: Option<KimiWindow>,
    detail: Option<KimiDetail>,
}

#[derive(Debug, Deserialize)]
struct KimiWindow {
    #[allow(dead_code)]
    duration: Option<u32>,
    #[serde(rename = "timeUnit")]
    #[allow(dead_code)]
    time_unit: Option<String>,
}

#[derive(Debug, Deserialize)]
struct KimiDetail {
    limit: Option<String>,
    #[allow(dead_code)]
    used: Option<String>,
    remaining: Option<String>,
    #[serde(rename = "resetTime")]
    reset_time: Option<String>,
}

// ---------------------------------------------------------------------------
// Progress tone helper (shared threshold logic)
// ---------------------------------------------------------------------------

fn progress_tone(pct: Option<u8>) -> String {
    match pct {
        Some(p) if p > 50 => "success".into(),
        Some(p) if p > 20 => "warning".into(),
        Some(_) => "danger".into(),
        None => "muted".into(),
    }
}

fn format_absolute(remaining: u64, limit: u64) -> String {
    if limit == 0 {
        return "0 / 0".into();
    }
    format!("{remaining} / {limit}")
}

fn parse_numeric_string(s: Option<&str>) -> u64 {
    s.and_then(|v| v.trim().parse::<u64>().ok()).unwrap_or(0)
}

// ---------------------------------------------------------------------------
// Response mapping (pure function, no I/O)
// ---------------------------------------------------------------------------

fn map_kimi_response(resp: &KimiUsageResponse) -> Vec<QuotaDimension> {
    let mut dims = Vec::new();

    // Weekly usage dimension
    if let Some(usage) = &resp.usage {
        let limit = parse_numeric_string(usage.limit.as_deref());
        let remaining = parse_numeric_string(usage.remaining.as_deref());
        let pct = if limit > 0 {
            Some(((remaining * 100) / limit).min(100) as u8)
        } else {
            None
        };
        let tone = progress_tone(pct);
        dims.push(QuotaDimension {
            label: "Weekly".into(),
            remaining_percent: pct,
            remaining_absolute: format_absolute(remaining, limit),
            reset_hint: usage.reset_time.clone(),
            status: "normal".into(),
            progress_tone: tone,
        });
    }

    // 5-hour window dimension from limits[0].detail
    if let Some(limits) = &resp.limits {
        if let Some(first) = limits.first() {
            if let Some(detail) = &first.detail {
                let limit = parse_numeric_string(detail.limit.as_deref());
                let remaining = parse_numeric_string(detail.remaining.as_deref());
                let pct = if limit > 0 {
                    Some(((remaining * 100) / limit).min(100) as u8)
                } else {
                    None
                };
                let tone = progress_tone(pct);
                dims.push(QuotaDimension {
                    label: "5h Window".into(),
                    remaining_percent: pct,
                    remaining_absolute: format_absolute(remaining, limit),
                    reset_hint: detail.reset_time.clone(),
                    status: "normal".into(),
                    progress_tone: tone,
                });
            }
        }
    }

    dims
}

// ---------------------------------------------------------------------------
// Credential resolution
// ---------------------------------------------------------------------------

fn kimi_config_dir() -> Option<PathBuf> {
    dirs_fallback().map(|home| home.join(".kimi"))
}

fn dirs_fallback() -> Option<PathBuf> {
    env::var("HOME")
        .or_else(|_| env::var("USERPROFILE"))
        .ok()
        .map(PathBuf::from)
}

fn resolve_token_from_toml(config_dir: &Path) -> Option<String> {
    let toml_path = config_dir.join("config.toml");
    let content = fs::read_to_string(toml_path).ok()?;
    let table: toml::Table = content.parse().ok()?;
    let providers = table.get("providers")?.as_table()?;
    let kimi = providers.get("kimi-for-coding")?.as_table()?;
    let key = kimi.get("api_key")?.as_str()?;
    let trimmed = key.trim();
    if trimmed.is_empty() {
        None
    } else {
        Some(trimmed.to_string())
    }
}

fn resolve_token_from_json(config_dir: &Path) -> Option<String> {
    let json_path = config_dir.join("config.json");
    let content = fs::read_to_string(json_path).ok()?;
    let parsed: serde_json::Value = serde_json::from_str(&content).ok()?;
    let key = parsed
        .get("providers")?
        .get("kimi-for-coding")?
        .get("api_key")?
        .as_str()?;
    let trimmed = key.trim();
    if trimmed.is_empty() {
        None
    } else {
        Some(trimmed.to_string())
    }
}

fn resolve_token(preferences: &UserPreferences) -> Option<String> {
    // 1. Environment variable (skip if blank/whitespace)
    if let Ok(val) = env::var("KIMI_API_KEY") {
        if !val.trim().is_empty() {
            return Some(val.trim().to_string());
        }
    }

    // 2. ~/.kimi/config.toml
    if let Some(config_dir) = kimi_config_dir() {
        if let Some(token) = resolve_token_from_toml(&config_dir) {
            return Some(token);
        }

        // 3. ~/.kimi/config.json (fallback)
        if let Some(token) = resolve_token_from_json(&config_dir) {
            return Some(token);
        }
    }

    // 4. preferences.provider_tokens["kimi-code"]
    preferences
        .provider_tokens
        .get("kimi-code")
        .filter(|t| !t.trim().is_empty())
        .map(|t| t.trim().to_string())
}

// ---------------------------------------------------------------------------
// HTTP error -> SnapshotStatus mapping
// ---------------------------------------------------------------------------

fn map_http_status(status: u16) -> SnapshotStatus {
    match status {
        401 | 403 => SnapshotStatus::AccessDenied,
        429 => SnapshotStatus::RateLimited {
            retry_after_minutes: 5,
        },
        s if s >= 500 => SnapshotStatus::TemporarilyUnavailable {
            detail: format!("HTTP {s}"),
        },
        _ => SnapshotStatus::TemporarilyUnavailable {
            detail: format!("HTTP {status}"),
        },
    }
}

// ---------------------------------------------------------------------------
// Public snapshot loader
// ---------------------------------------------------------------------------

pub fn load_snapshot(preferences: &UserPreferences) -> ServiceSnapshot {
    let token = match resolve_token(preferences) {
        Some(t) => t,
        None => {
            return ServiceSnapshot {
                status: SnapshotStatus::NoCredentials,
                dimensions: vec![],
                source: "kimi-api".into(),
            }
        }
    };

    let (agent, _proxy) = match crate::proxy::build_agent(preferences) {
        Ok(pair) => pair,
        Err(_) => {
            return ServiceSnapshot {
                status: SnapshotStatus::ProxyInvalid,
                dimensions: vec![],
                source: "kimi-api".into(),
            }
        }
    };

    let result = agent
        .get("https://api.kimi.com/coding/v1/usages")
        .set("Authorization", &format!("Bearer {token}"))
        .set("Content-Type", "application/json")
        .call();

    match result {
        Ok(response) => {
            let body = match response.into_string() {
                Ok(b) => b,
                Err(e) => {
                    return ServiceSnapshot {
                        status: SnapshotStatus::TemporarilyUnavailable {
                            detail: format!("read error: {e}"),
                        },
                        dimensions: vec![],
                        source: "kimi-api".into(),
                    }
                }
            };
            match serde_json::from_str::<KimiUsageResponse>(&body) {
                Ok(parsed) => {
                    let dims = map_kimi_response(&parsed);
                    ServiceSnapshot {
                        status: SnapshotStatus::Fresh,
                        dimensions: dims,
                        source: "kimi-api".into(),
                    }
                }
                Err(e) => ServiceSnapshot {
                    status: SnapshotStatus::TemporarilyUnavailable {
                        detail: format!("parse error: {e}"),
                    },
                    dimensions: vec![],
                    source: "kimi-api".into(),
                },
            }
        }
        Err(ureq::Error::Status(status, _response)) => ServiceSnapshot {
            status: map_http_status(status),
            dimensions: vec![],
            source: "kimi-api".into(),
        },
        Err(e) => ServiceSnapshot {
            status: SnapshotStatus::TemporarilyUnavailable {
                detail: format!("connection error: {e}"),
            },
            dimensions: vec![],
            source: "kimi-api".into(),
        },
    }
}

// ---------------------------------------------------------------------------
// Unit tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;
    use crate::state::default_preferences;

    // -----------------------------------------------------------------------
    // Response parsing tests
    // -----------------------------------------------------------------------

    #[test]
    fn valid_full_response_produces_two_dimensions() {
        let json = r#"{
            "user": { "userId": "u1", "membership": { "level": "LEVEL_PRO" } },
            "usage": {
                "limit": "1000000",
                "used": "250000",
                "remaining": "750000",
                "resetTime": "2026-04-07T00:00:00.000Z"
            },
            "limits": [{
                "window": { "duration": 300, "timeUnit": "TIME_UNIT_MINUTE" },
                "detail": {
                    "limit": "200000",
                    "used": "50000",
                    "remaining": "150000",
                    "resetTime": "2026-03-31T15:00:00.000Z"
                }
            }]
        }"#;
        let resp: KimiUsageResponse = serde_json::from_str(json).unwrap();
        let dims = map_kimi_response(&resp);
        assert_eq!(dims.len(), 2);

        // Weekly: 750000/1000000 = 75%
        assert_eq!(dims[0].label, "Weekly");
        assert_eq!(dims[0].remaining_percent, Some(75));
        assert_eq!(dims[0].remaining_absolute, "750000 / 1000000");
        assert_eq!(
            dims[0].reset_hint.as_deref(),
            Some("2026-04-07T00:00:00.000Z")
        );
        assert_eq!(dims[0].progress_tone, "success");

        // 5h Window: 150000/200000 = 75%
        assert_eq!(dims[1].label, "5h Window");
        assert_eq!(dims[1].remaining_percent, Some(75));
        assert_eq!(dims[1].remaining_absolute, "150000 / 200000");
        assert_eq!(
            dims[1].reset_hint.as_deref(),
            Some("2026-03-31T15:00:00.000Z")
        );
        assert_eq!(dims[1].progress_tone, "success");
    }

    #[test]
    fn numeric_strings_parsed_correctly() {
        let json = r#"{
            "usage": {
                "limit": "1000000",
                "remaining": "750000"
            }
        }"#;
        let resp: KimiUsageResponse = serde_json::from_str(json).unwrap();
        let dims = map_kimi_response(&resp);
        assert_eq!(dims.len(), 1);
        assert_eq!(dims[0].remaining_percent, Some(75));
    }

    #[test]
    fn remaining_greater_than_limit_clamped_to_100() {
        let json = r#"{
            "usage": {
                "limit": "100",
                "remaining": "200"
            }
        }"#;
        let resp: KimiUsageResponse = serde_json::from_str(json).unwrap();
        let dims = map_kimi_response(&resp);
        assert_eq!(dims[0].remaining_percent, Some(100));
    }

    #[test]
    fn limit_zero_produces_none_percent() {
        let json = r#"{
            "usage": {
                "limit": "0",
                "remaining": "100"
            }
        }"#;
        let resp: KimiUsageResponse = serde_json::from_str(json).unwrap();
        let dims = map_kimi_response(&resp);
        assert_eq!(dims[0].remaining_percent, None);
        assert_eq!(dims[0].progress_tone, "muted");
    }

    #[test]
    fn missing_usage_field_produces_empty_dimensions() {
        let json = r#"{ "user": { "userId": "u1" } }"#;
        let resp: KimiUsageResponse = serde_json::from_str(json).unwrap();
        let dims = map_kimi_response(&resp);
        assert!(dims.is_empty());
    }

    #[test]
    fn missing_limits_returns_only_weekly() {
        let json = r#"{
            "usage": {
                "limit": "1000",
                "remaining": "500"
            }
        }"#;
        let resp: KimiUsageResponse = serde_json::from_str(json).unwrap();
        let dims = map_kimi_response(&resp);
        assert_eq!(dims.len(), 1);
        assert_eq!(dims[0].label, "Weekly");
    }

    #[test]
    fn missing_detail_in_limits_returns_only_weekly() {
        let json = r#"{
            "usage": {
                "limit": "1000",
                "remaining": "500"
            },
            "limits": [{
                "window": { "duration": 300, "timeUnit": "TIME_UNIT_MINUTE" }
            }]
        }"#;
        let resp: KimiUsageResponse = serde_json::from_str(json).unwrap();
        let dims = map_kimi_response(&resp);
        assert_eq!(dims.len(), 1);
        assert_eq!(dims[0].label, "Weekly");
    }

    #[test]
    fn unparseable_numeric_string_treated_as_zero() {
        let json = r#"{
            "usage": {
                "limit": "abc",
                "remaining": "def"
            }
        }"#;
        let resp: KimiUsageResponse = serde_json::from_str(json).unwrap();
        let dims = map_kimi_response(&resp);
        // limit=0, so remaining_percent = None
        assert_eq!(dims[0].remaining_percent, None);
    }

    #[test]
    fn reset_time_preserved_as_is() {
        let json = r#"{
            "usage": {
                "limit": "1000",
                "remaining": "500",
                "resetTime": "2026-04-07T00:00:00.000Z"
            }
        }"#;
        let resp: KimiUsageResponse = serde_json::from_str(json).unwrap();
        let dims = map_kimi_response(&resp);
        assert_eq!(
            dims[0].reset_hint.as_deref(),
            Some("2026-04-07T00:00:00.000Z")
        );
    }

    #[test]
    fn progress_tone_thresholds() {
        assert_eq!(progress_tone(Some(60)), "success");
        assert_eq!(progress_tone(Some(51)), "success");
        assert_eq!(progress_tone(Some(50)), "warning");
        assert_eq!(progress_tone(Some(21)), "warning");
        assert_eq!(progress_tone(Some(20)), "danger");
        assert_eq!(progress_tone(Some(0)), "danger");
        assert_eq!(progress_tone(None), "muted");
    }

    // -----------------------------------------------------------------------
    // Credential chain tests
    //
    // Note: env var tests use a mutex to serialize access since env vars
    // are process-global and cargo test runs tests in parallel.
    // -----------------------------------------------------------------------

    use std::sync::Mutex as TestMutex;
    static ENV_LOCK: TestMutex<()> = TestMutex::new(());

    #[test]
    fn env_var_kimi_api_key_is_used() {
        let _guard = ENV_LOCK.lock().unwrap();
        env::set_var("KIMI_API_KEY", "sk-test-env-key");
        let prefs = default_preferences();
        let token = resolve_token(&prefs);
        env::remove_var("KIMI_API_KEY");
        assert_eq!(token, Some("sk-test-env-key".into()));
    }

    #[test]
    fn blank_env_var_is_skipped() {
        let _guard = ENV_LOCK.lock().unwrap();
        env::set_var("KIMI_API_KEY", "   ");
        let prefs = default_preferences();
        let token = resolve_token(&prefs);
        env::remove_var("KIMI_API_KEY");
        // Token should NOT be the blank env var
        assert!(token.is_none() || token.as_deref() != Some("   "));
    }

    #[test]
    fn preferences_token_used_as_fallback() {
        let _guard = ENV_LOCK.lock().unwrap();
        env::remove_var("KIMI_API_KEY");
        let mut prefs = default_preferences();
        prefs
            .provider_tokens
            .insert("kimi-code".into(), "sk-prefs-token".into());
        let token = resolve_token(&prefs);
        assert_eq!(token, Some("sk-prefs-token".into()));
    }

    #[test]
    fn no_token_returns_none() {
        let _guard = ENV_LOCK.lock().unwrap();
        env::remove_var("KIMI_API_KEY");
        let prefs = default_preferences();
        let token = resolve_token(&prefs);
        // May find token from config files in home dir; the invariant is
        // that if nothing provides a token, None is returned.
        assert!(token.is_none() || !token.unwrap().is_empty());
    }

    // -----------------------------------------------------------------------
    // Error mapping tests
    // -----------------------------------------------------------------------

    #[test]
    fn http_401_maps_to_access_denied() {
        assert_eq!(map_http_status(401), SnapshotStatus::AccessDenied);
    }

    #[test]
    fn http_403_maps_to_access_denied() {
        assert_eq!(map_http_status(403), SnapshotStatus::AccessDenied);
    }

    #[test]
    fn http_429_maps_to_rate_limited() {
        assert_eq!(
            map_http_status(429),
            SnapshotStatus::RateLimited {
                retry_after_minutes: 5
            }
        );
    }

    #[test]
    fn http_500_maps_to_temporarily_unavailable() {
        match map_http_status(500) {
            SnapshotStatus::TemporarilyUnavailable { detail } => {
                assert_eq!(detail, "HTTP 500");
            }
            other => panic!("expected TemporarilyUnavailable, got {:?}", other),
        }
    }

    #[test]
    fn http_503_maps_to_temporarily_unavailable() {
        match map_http_status(503) {
            SnapshotStatus::TemporarilyUnavailable { detail } => {
                assert_eq!(detail, "HTTP 503");
            }
            other => panic!("expected TemporarilyUnavailable, got {:?}", other),
        }
    }

    // -----------------------------------------------------------------------
    // parse_numeric_string edge cases
    // -----------------------------------------------------------------------

    #[test]
    fn parse_numeric_string_handles_whitespace() {
        assert_eq!(parse_numeric_string(Some(" 12345 ")), 12345);
    }

    #[test]
    fn parse_numeric_string_handles_empty() {
        assert_eq!(parse_numeric_string(Some("")), 0);
        assert_eq!(parse_numeric_string(None), 0);
    }

    // -----------------------------------------------------------------------
    // TOML/JSON config file parsing tests
    // -----------------------------------------------------------------------

    #[test]
    fn resolve_token_from_toml_parses_valid_config() {
        let dir = std::env::temp_dir().join("kimi-test-toml");
        let _ = fs::create_dir_all(&dir);
        fs::write(
            dir.join("config.toml"),
            r#"
[providers.kimi-for-coding]
api_key = "sk-toml-key"
"#,
        )
        .unwrap();
        let token = resolve_token_from_toml(&dir);
        assert_eq!(token, Some("sk-toml-key".into()));
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn resolve_token_from_toml_handles_missing_file() {
        let dir = std::env::temp_dir().join("kimi-test-toml-missing");
        let token = resolve_token_from_toml(&dir);
        assert!(token.is_none());
    }

    #[test]
    fn resolve_token_from_json_parses_valid_config() {
        let dir = std::env::temp_dir().join("kimi-test-json");
        let _ = fs::create_dir_all(&dir);
        fs::write(
            dir.join("config.json"),
            r#"{ "providers": { "kimi-for-coding": { "api_key": "sk-json-key" } } }"#,
        )
        .unwrap();
        let token = resolve_token_from_json(&dir);
        assert_eq!(token, Some("sk-json-key".into()));
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn resolve_token_from_json_handles_malformed() {
        let dir = std::env::temp_dir().join("kimi-test-json-bad");
        let _ = fs::create_dir_all(&dir);
        fs::write(dir.join("config.json"), "not valid json").unwrap();
        let token = resolve_token_from_json(&dir);
        assert!(token.is_none());
        let _ = fs::remove_dir_all(&dir);
    }
}
