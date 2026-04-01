// GLM Coding Plan quota integration module.
// Reads API key from environment or preferences, selects the correct
// platform endpoint (api.z.ai or open.bigmodel.cn), and fetches quota data.
//
// CRITICAL: GLM uses raw token auth (NO Bearer prefix).
// CRITICAL: GLM `percentage` is USAGE (consumed), not remaining.
// CRITICAL: GLM wraps responses in `{ "data": { ... } }` envelope.
// CRITICAL: GLM number types are polymorphic (int, float, or string).

use crate::snapshot::{ServiceSnapshot, SnapshotStatus};
use crate::state::{QuotaDimension, UserPreferences};
use serde::de::{self, Deserializer};
use serde::Deserialize;
use std::env;

// ---------------------------------------------------------------------------
// Flexible number deserializers for polymorphic GLM API responses
// ---------------------------------------------------------------------------

fn deserialize_flexible_f64<'de, D: Deserializer<'de>>(
    deserializer: D,
) -> Result<Option<f64>, D::Error> {
    let value = serde_json::Value::deserialize(deserializer)?;
    match value {
        serde_json::Value::Number(n) => Ok(n.as_f64()),
        serde_json::Value::String(s) => Ok(s.parse::<f64>().ok()),
        serde_json::Value::Null => Ok(None),
        _ => Err(de::Error::custom("expected number or string")),
    }
}

fn deserialize_flexible_i64<'de, D: Deserializer<'de>>(
    deserializer: D,
) -> Result<Option<i64>, D::Error> {
    let value = serde_json::Value::deserialize(deserializer)?;
    match value {
        serde_json::Value::Number(n) => Ok(n.as_i64()),
        serde_json::Value::String(s) => Ok(s.parse::<i64>().ok()),
        serde_json::Value::Null => Ok(None),
        _ => Err(de::Error::custom("expected number or string")),
    }
}

// ---------------------------------------------------------------------------
// API Response structures
// ---------------------------------------------------------------------------

#[derive(Debug, Deserialize)]
struct GlmEnvelope {
    data: Option<GlmQuotaResponse>,
}

#[derive(Debug, Deserialize)]
struct GlmQuotaResponse {
    limits: Option<Vec<GlmLimit>>,
    #[allow(dead_code)]
    level: Option<String>,
}

#[derive(Debug, Deserialize)]
struct GlmLimit {
    #[serde(rename = "type")]
    limit_type: Option<String>,
    #[serde(
        deserialize_with = "deserialize_flexible_i64",
        default
    )]
    unit: Option<i64>,
    #[serde(
        deserialize_with = "deserialize_flexible_i64",
        default
    )]
    number: Option<i64>,
    #[serde(
        deserialize_with = "deserialize_flexible_f64",
        default
    )]
    percentage: Option<f64>,
    #[serde(
        rename = "currentValue",
        deserialize_with = "deserialize_flexible_i64",
        default
    )]
    current_value: Option<i64>,
    #[serde(
        deserialize_with = "deserialize_flexible_i64",
        default
    )]
    total: Option<i64>,
    #[serde(
        rename = "nextResetTime",
        deserialize_with = "deserialize_flexible_i64",
        default
    )]
    next_reset_time: Option<i64>,
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

fn reset_time_iso_from_unix_ms(next_reset_time_ms: Option<i64>) -> Option<String> {
    let reset_unix = next_reset_time_ms?.checked_div(1000)?;
    chrono::DateTime::from_timestamp(reset_unix, 0).map(|dt| dt.to_rfc3339())
}

// ---------------------------------------------------------------------------
// Response decoding (envelope + bare fallback)
// ---------------------------------------------------------------------------

fn decode_glm_response(body: &str) -> Result<GlmQuotaResponse, String> {
    // Try { "data": { ... } } envelope first
    if let Ok(envelope) = serde_json::from_str::<GlmEnvelope>(body) {
        if let Some(data) = envelope.data {
            return Ok(data);
        }
    }
    // Fall back to bare payload
    serde_json::from_str::<GlmQuotaResponse>(body).map_err(|e| e.to_string())
}

// ---------------------------------------------------------------------------
// Limit type -> label mapping
// ---------------------------------------------------------------------------

fn limit_label(limit_type: Option<&str>, unit: Option<i64>, number: Option<i64>) -> &'static str {
    match (limit_type.unwrap_or(""), unit, number) {
        ("TOKENS_LIMIT", Some(3), Some(5)) => "5h Token Quota",
        ("TOKENS_LIMIT", Some(6), Some(1)) => "Weekly Token Quota",
        ("TIME_LIMIT", _, _) => "MCP Usage",
        _ => "Quota",
    }
}

// ---------------------------------------------------------------------------
// Response mapping (pure function, no I/O)
// ---------------------------------------------------------------------------

fn map_glm_response(resp: &GlmQuotaResponse) -> Vec<QuotaDimension> {
    let mut dims = Vec::new();

    if let Some(limits) = &resp.limits {
        for limit in limits {
            let label = limit_label(
                limit.limit_type.as_deref(),
                limit.unit,
                limit.number,
            );

            // CRITICAL: Clamp usage_pct BEFORE inversion (review concern #4)
            let remaining_pct = match limit.percentage {
                Some(pct) => {
                    let usage_pct = pct.clamp(0.0, 100.0);
                    Some((100.0 - usage_pct).round() as u8)
                }
                None => None,
            };
            let tone = progress_tone(remaining_pct);

            let resets_at = reset_time_iso_from_unix_ms(limit.next_reset_time);

            // Compute remaining absolute from total - currentValue
            let remaining_abs = match (limit.current_value, limit.total) {
                (Some(cv), Some(t)) => {
                    let remaining = (t - cv).max(0);
                    format!("{remaining} / {t}")
                }
                _ => match remaining_pct {
                    Some(p) => format!("{p}%"),
                    None => "N/A".into(),
                },
            };

            dims.push(QuotaDimension {
                label: label.into(),
                remaining_percent: remaining_pct,
                remaining_absolute: remaining_abs,
                resets_at,
                reset_hint: None,
                burn_rate_history: Vec::new(),
                status: "normal".into(),
                progress_tone: tone,
            });
        }
    }

    dims
}

// ---------------------------------------------------------------------------
// Credential resolution
// ---------------------------------------------------------------------------

/// Returns (token, endpoint_base_url) or None if no credentials found.
fn resolve_token_and_endpoint(preferences: &UserPreferences) -> Option<(String, String)> {
    let global_endpoint = "https://api.z.ai".to_string();
    let china_endpoint = "https://open.bigmodel.cn".to_string();

    // 1. ZAI_API_KEY -> global endpoint
    if let Ok(val) = env::var("ZAI_API_KEY") {
        if !val.trim().is_empty() {
            return Some((val.trim().to_string(), global_endpoint));
        }
    }

    // 2. ZHIPU_API_KEY / ZHIPUAI_API_KEY -> china endpoint
    for var_name in &["ZHIPU_API_KEY", "ZHIPUAI_API_KEY"] {
        if let Ok(val) = env::var(var_name) {
            if !val.trim().is_empty() {
                return Some((val.trim().to_string(), china_endpoint));
            }
        }
    }

    // 3. Preferences token + glm_platform
    let token = preferences
        .provider_tokens
        .get("glm-coding")
        .filter(|t| !t.trim().is_empty())
        .map(|t| t.trim().to_string())?;

    let endpoint = match preferences.glm_platform.as_str() {
        "china" => china_endpoint,
        _ => global_endpoint,
    };

    Some((token, endpoint))
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
    let (token, endpoint) = match resolve_token_and_endpoint(preferences) {
        Some(pair) => pair,
        None => {
            return ServiceSnapshot {
                status: SnapshotStatus::NoCredentials,
                dimensions: vec![],
                source: "glm-api".into(),
            }
        }
    };

    let (agent, _proxy) = match crate::proxy::build_agent(preferences) {
        Ok(pair) => pair,
        Err(_) => {
            return ServiceSnapshot {
                status: SnapshotStatus::ProxyInvalid,
                dimensions: vec![],
                source: "glm-api".into(),
            }
        }
    };

    let url = format!("{endpoint}/api/monitor/usage/quota/limit");
    let result = agent
        .get(&url)
        .set("Authorization", &token) // NO Bearer prefix!
        .set("Accept-Language", "en-US,en")
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
                        source: "glm-api".into(),
                    }
                }
            };
            match decode_glm_response(&body) {
                Ok(parsed) => {
                    let dims = map_glm_response(&parsed);
                    ServiceSnapshot {
                        status: SnapshotStatus::Fresh,
                        dimensions: dims,
                        source: "glm-api".into(),
                    }
                }
                Err(e) => ServiceSnapshot {
                    status: SnapshotStatus::TemporarilyUnavailable {
                        detail: format!("parse error: {e}"),
                    },
                    dimensions: vec![],
                    source: "glm-api".into(),
                },
            }
        }
        Err(ureq::Error::Status(status, _response)) => ServiceSnapshot {
            status: map_http_status(status),
            dimensions: vec![],
            source: "glm-api".into(),
        },
        Err(e) => ServiceSnapshot {
            status: SnapshotStatus::TemporarilyUnavailable {
                detail: format!("connection error: {e}"),
            },
            dimensions: vec![],
            source: "glm-api".into(),
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
    fn valid_three_limit_response_produces_three_dimensions() {
        let json = r#"{
            "data": {
                "limits": [
                    {
                        "type": "TOKENS_LIMIT",
                        "unit": 3,
                        "number": 5,
                        "percentage": 24.5,
                        "currentValue": 50000,
                        "total": 200000,
                        "nextResetTime": 1711900800000
                    },
                    {
                        "type": "TOKENS_LIMIT",
                        "unit": 6,
                        "number": 1,
                        "percentage": 10.2,
                        "currentValue": 100000,
                        "total": 1000000,
                        "nextResetTime": 1712505600000
                    },
                    {
                        "type": "TIME_LIMIT",
                        "percentage": 40.0,
                        "currentValue": 120,
                        "total": 300
                    }
                ],
                "level": "standard"
            }
        }"#;
        let resp = decode_glm_response(&json).unwrap();
        let dims = map_glm_response(&resp);
        assert_eq!(dims.len(), 3);
        assert_eq!(dims[0].label, "5h Token Quota");
        assert_eq!(dims[1].label, "Weekly Token Quota");
        assert_eq!(dims[2].label, "MCP Usage");
    }

    #[test]
    fn percentage_inversion_24_5_usage_to_76_remaining() {
        let json = r#"{
            "limits": [{
                "type": "TOKENS_LIMIT",
                "unit": 3,
                "number": 5,
                "percentage": 24.5,
                "currentValue": 50000,
                "total": 200000
            }]
        }"#;
        let resp = decode_glm_response(&json).unwrap();
        let dims = map_glm_response(&resp);
        // 100 - 24.5 = 75.5 -> round -> 76
        assert_eq!(dims[0].remaining_percent, Some(76));
    }

    #[test]
    fn percentage_0_means_100_remaining() {
        let json = r#"{
            "limits": [{
                "type": "TOKENS_LIMIT",
                "unit": 3,
                "number": 5,
                "percentage": 0.0
            }]
        }"#;
        let resp = decode_glm_response(&json).unwrap();
        let dims = map_glm_response(&resp);
        assert_eq!(dims[0].remaining_percent, Some(100));
    }

    #[test]
    fn percentage_100_means_0_remaining() {
        let json = r#"{
            "limits": [{
                "type": "TOKENS_LIMIT",
                "unit": 3,
                "number": 5,
                "percentage": 100.0
            }]
        }"#;
        let resp = decode_glm_response(&json).unwrap();
        let dims = map_glm_response(&resp);
        assert_eq!(dims[0].remaining_percent, Some(0));
        assert_eq!(dims[0].progress_tone, "danger");
    }

    #[test]
    fn percentage_overflow_105_clamped_to_0_remaining() {
        let json = r#"{
            "limits": [{
                "type": "TOKENS_LIMIT",
                "unit": 3,
                "number": 5,
                "percentage": 105.0
            }]
        }"#;
        let resp = decode_glm_response(&json).unwrap();
        let dims = map_glm_response(&resp);
        // clamp(0, 100) -> 100 usage -> 0 remaining
        assert_eq!(dims[0].remaining_percent, Some(0));
    }

    #[test]
    fn percentage_underflow_negative_clamped_to_100_remaining() {
        let json = r#"{
            "limits": [{
                "type": "TOKENS_LIMIT",
                "unit": 3,
                "number": 5,
                "percentage": -5.0
            }]
        }"#;
        let resp = decode_glm_response(&json).unwrap();
        let dims = map_glm_response(&resp);
        // clamp(0, 100) -> 0 usage -> 100 remaining
        assert_eq!(dims[0].remaining_percent, Some(100));
    }

    #[test]
    fn percentage_absent_produces_none() {
        let json = r#"{
            "limits": [{
                "type": "TOKENS_LIMIT",
                "unit": 3,
                "number": 5,
                "currentValue": 50,
                "total": 200
            }]
        }"#;
        let resp = decode_glm_response(&json).unwrap();
        let dims = map_glm_response(&resp);
        assert_eq!(dims[0].remaining_percent, None);
        assert_eq!(dims[0].progress_tone, "muted");
    }

    #[test]
    fn next_reset_time_ms_converted_to_iso8601() {
        let next_reset_time = (chrono::Utc::now() + chrono::Duration::minutes(90)).timestamp_millis();
        let json = r#"{
            "limits": [{
                "type": "TOKENS_LIMIT",
                "unit": 3,
                "number": 5,
                "percentage": 10.0,
                "nextResetTime": __NEXT_RESET_TIME__
            }]
        }"#
        .replace("__NEXT_RESET_TIME__", &next_reset_time.to_string());
        let resp = decode_glm_response(&json).unwrap();
        let dims = map_glm_response(&resp);
        assert_eq!(
            dims[0].resets_at.as_deref(),
            chrono::DateTime::from_timestamp(next_reset_time / 1000, 0)
                .map(|dt| dt.to_rfc3339())
                .as_deref()
        );
    }

    #[test]
    fn next_reset_time_absent_produces_none() {
        let json = r#"{
            "limits": [{
                "type": "TIME_LIMIT",
                "percentage": 10.0
            }]
        }"#;
        let resp = decode_glm_response(&json).unwrap();
        let dims = map_glm_response(&resp);
        assert!(dims[0].reset_hint.is_none());
    }

    #[test]
    fn data_envelope_unwraps_correctly() {
        let json = r#"{
            "data": {
                "limits": [{
                    "type": "TOKENS_LIMIT",
                    "unit": 3,
                    "number": 5,
                    "percentage": 50.0
                }]
            }
        }"#;
        let resp = decode_glm_response(&json).unwrap();
        assert!(resp.limits.is_some());
        assert_eq!(resp.limits.unwrap().len(), 1);
    }

    #[test]
    fn bare_response_without_envelope_still_parses() {
        let json = r#"{
            "limits": [{
                "type": "TOKENS_LIMIT",
                "unit": 6,
                "number": 1,
                "percentage": 30.0
            }]
        }"#;
        let resp = decode_glm_response(&json).unwrap();
        assert!(resp.limits.is_some());
    }

    #[test]
    fn polymorphic_percentage_as_int() {
        let json = r#"{
            "limits": [{
                "type": "TOKENS_LIMIT",
                "unit": 3,
                "number": 5,
                "percentage": 24
            }]
        }"#;
        let resp = decode_glm_response(&json).unwrap();
        let dims = map_glm_response(&resp);
        // 100 - 24 = 76
        assert_eq!(dims[0].remaining_percent, Some(76));
    }

    #[test]
    fn polymorphic_percentage_as_string() {
        let json = r#"{
            "limits": [{
                "type": "TOKENS_LIMIT",
                "unit": 3,
                "number": 5,
                "percentage": "24.5"
            }]
        }"#;
        let resp = decode_glm_response(&json).unwrap();
        let dims = map_glm_response(&resp);
        assert_eq!(dims[0].remaining_percent, Some(76));
    }

    #[test]
    fn polymorphic_current_value_and_total_as_ints() {
        let json = r#"{
            "limits": [{
                "type": "TOKENS_LIMIT",
                "unit": 3,
                "number": 5,
                "percentage": 25.0,
                "currentValue": 50000,
                "total": 200000
            }]
        }"#;
        let resp = decode_glm_response(&json).unwrap();
        let dims = map_glm_response(&resp);
        assert_eq!(dims[0].remaining_absolute, "150000 / 200000");
    }

    #[test]
    fn tokens_limit_unit3_number5_is_5h() {
        let json = r#"{ "limits": [{ "type": "TOKENS_LIMIT", "unit": 3, "number": 5, "percentage": 0 }] }"#;
        let resp = decode_glm_response(&json).unwrap();
        let dims = map_glm_response(&resp);
        assert_eq!(dims[0].label, "5h Token Quota");
    }

    #[test]
    fn tokens_limit_unit6_number1_is_weekly() {
        let json = r#"{ "limits": [{ "type": "TOKENS_LIMIT", "unit": 6, "number": 1, "percentage": 0 }] }"#;
        let resp = decode_glm_response(&json).unwrap();
        let dims = map_glm_response(&resp);
        assert_eq!(dims[0].label, "Weekly Token Quota");
    }

    #[test]
    fn time_limit_is_mcp_usage() {
        let json = r#"{ "limits": [{ "type": "TIME_LIMIT", "percentage": 0 }] }"#;
        let resp = decode_glm_response(&json).unwrap();
        let dims = map_glm_response(&resp);
        assert_eq!(dims[0].label, "MCP Usage");
    }

    #[test]
    fn unknown_type_combo_is_generic_quota() {
        let json = r#"{ "limits": [{ "type": "UNKNOWN_TYPE", "percentage": 0 }] }"#;
        let resp = decode_glm_response(&json).unwrap();
        let dims = map_glm_response(&resp);
        assert_eq!(dims[0].label, "Quota");
    }

    #[test]
    fn empty_limits_array_produces_empty_dimensions() {
        let json = r#"{ "limits": [] }"#;
        let resp = decode_glm_response(&json).unwrap();
        let dims = map_glm_response(&resp);
        assert!(dims.is_empty());
    }

    // -----------------------------------------------------------------------
    // Credential chain tests (serialized via mutex)
    // -----------------------------------------------------------------------

    use std::sync::Mutex as TestMutex;
    static GLM_ENV_LOCK: TestMutex<()> = TestMutex::new(());

    #[test]
    fn zai_api_key_uses_global_endpoint() {
        let _guard = GLM_ENV_LOCK.lock().unwrap();
        env::set_var("ZAI_API_KEY", "zai-test-key");
        env::remove_var("ZHIPU_API_KEY");
        env::remove_var("ZHIPUAI_API_KEY");
        let prefs = default_preferences();
        let result = resolve_token_and_endpoint(&prefs);
        env::remove_var("ZAI_API_KEY");
        assert!(result.is_some());
        let (token, endpoint) = result.unwrap();
        assert_eq!(token, "zai-test-key");
        assert!(endpoint.contains("api.z.ai"));
    }

    #[test]
    fn zhipu_api_key_uses_china_endpoint() {
        let _guard = GLM_ENV_LOCK.lock().unwrap();
        env::remove_var("ZAI_API_KEY");
        env::set_var("ZHIPU_API_KEY", "zhipu-test-key");
        env::remove_var("ZHIPUAI_API_KEY");
        let prefs = default_preferences();
        let result = resolve_token_and_endpoint(&prefs);
        env::remove_var("ZHIPU_API_KEY");
        assert!(result.is_some());
        let (token, endpoint) = result.unwrap();
        assert_eq!(token, "zhipu-test-key");
        assert!(endpoint.contains("open.bigmodel.cn"));
    }

    #[test]
    fn preferences_token_with_global_platform() {
        let _guard = GLM_ENV_LOCK.lock().unwrap();
        env::remove_var("ZAI_API_KEY");
        env::remove_var("ZHIPU_API_KEY");
        env::remove_var("ZHIPUAI_API_KEY");
        let mut prefs = default_preferences();
        prefs.glm_platform = "global".into();
        prefs
            .provider_tokens
            .insert("glm-coding".into(), "prefs-token".into());
        let result = resolve_token_and_endpoint(&prefs);
        assert!(result.is_some());
        let (token, endpoint) = result.unwrap();
        assert_eq!(token, "prefs-token");
        assert!(endpoint.contains("api.z.ai"));
    }

    #[test]
    fn preferences_token_with_china_platform() {
        let _guard = GLM_ENV_LOCK.lock().unwrap();
        env::remove_var("ZAI_API_KEY");
        env::remove_var("ZHIPU_API_KEY");
        env::remove_var("ZHIPUAI_API_KEY");
        let mut prefs = default_preferences();
        prefs.glm_platform = "china".into();
        prefs
            .provider_tokens
            .insert("glm-coding".into(), "prefs-token-cn".into());
        let result = resolve_token_and_endpoint(&prefs);
        assert!(result.is_some());
        let (token, endpoint) = result.unwrap();
        assert_eq!(token, "prefs-token-cn");
        assert!(endpoint.contains("open.bigmodel.cn"));
    }

    #[test]
    fn no_token_returns_none() {
        let _guard = GLM_ENV_LOCK.lock().unwrap();
        env::remove_var("ZAI_API_KEY");
        env::remove_var("ZHIPU_API_KEY");
        env::remove_var("ZHIPUAI_API_KEY");
        let prefs = default_preferences();
        let result = resolve_token_and_endpoint(&prefs);
        assert!(result.is_none());
    }

    #[test]
    fn blank_env_var_is_skipped() {
        let _guard = GLM_ENV_LOCK.lock().unwrap();
        env::set_var("ZAI_API_KEY", "   ");
        env::remove_var("ZHIPU_API_KEY");
        env::remove_var("ZHIPUAI_API_KEY");
        let prefs = default_preferences();
        let result = resolve_token_and_endpoint(&prefs);
        env::remove_var("ZAI_API_KEY");
        assert!(result.is_none());
    }

    // -----------------------------------------------------------------------
    // Error mapping tests
    // -----------------------------------------------------------------------

    #[test]
    fn http_401_maps_to_access_denied() {
        assert_eq!(map_http_status(401), SnapshotStatus::AccessDenied);
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
    fn malformed_json_returns_error() {
        let result = decode_glm_response("not valid json");
        assert!(result.is_err());
    }

    // -----------------------------------------------------------------------
    // Progress tone tests
    // -----------------------------------------------------------------------

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
    // Label mapping tests
    // -----------------------------------------------------------------------

    #[test]
    fn limit_label_mapping() {
        assert_eq!(limit_label(Some("TOKENS_LIMIT"), Some(3), Some(5)), "5h Token Quota");
        assert_eq!(limit_label(Some("TOKENS_LIMIT"), Some(6), Some(1)), "Weekly Token Quota");
        assert_eq!(limit_label(Some("TIME_LIMIT"), None, None), "MCP Usage");
        assert_eq!(limit_label(Some("OTHER"), Some(1), Some(1)), "Quota");
        assert_eq!(limit_label(None, None, None), "Quota");
    }
}
