# Phase 3: New Providers - Research

**Researched:** 2026-03-31 (revised)
**Domain:** New provider integration (Kimi Code, GLM Coding Plan) into existing ProviderFetcher pipeline
**Confidence:** HIGH

## Summary

Phase 3 adds Kimi Code and GLM Coding Plan as new providers. The existing Provider Registry (Phase 1) and ProviderFetcher pipeline (Phase 2) are fully generic -- adding a new provider requires a registry entry, a fetcher implementation, a pipeline registration line, and frontend mirror updates. No new UI components are needed; ServiceCard already handles all SnapshotStatus variants.

Both providers have verified quota APIs confirmed by two independent open-source implementations each (opencode-bar Swift + opencode-glm-quota TypeScript for GLM; opencode-bar Swift for Kimi). Kimi Code uses `GET https://api.kimi.com/coding/v1/usages` with Bearer token auth and returns numeric strings. GLM Coding Plan uses `GET https://api.z.ai/api/monitor/usage/quota/limit` with raw token auth (NO Bearer prefix) and returns a `data`-wrapped response with percentage values representing **usage** (not remaining).

**Primary recommendation:** Implement both providers in parallel since both APIs are source-code-verified. Each provider is ~300-500 lines of Rust (fetcher module + HTTP client logic) plus ~10 lines of registry/pipeline wiring. Add `toml` crate (v1.1.0) for Kimi config parsing. Token input fields in Settings follow the existing proxy URL pattern.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Skip until confirmed -- do NOT register a provider unless its quota API is verified. No stub fetchers or placeholder providers.
- **D-02:** Research is user-driven: user captures dashboard API traffic (browser DevTools network tab) and provides request/response samples. Researcher agent validates and structures them into specs.
- **D-03:** Both providers have web dashboards showing usage/quota. Research should focus on dashboard API inspection, not VS Code extension internals.
- **D-04:** Auth mechanism is a key research question. User reports browser session/cookies for dashboard auth, but the actual credential flow (API key, OAuth, long-lived token from VS Code extension config) must be determined from captured API traffic.
- **D-05:** If manual token input is required, add a token/credential input field per provider in the Settings page (similar to proxy URL configuration today).
- **D-06:** Manually-entered tokens are stored in preferences.json alongside other settings. Same security posture as existing credential storage.
- **D-07:** Reuse existing SnapshotStatus-based error cards (NoCredentials, TemporarilyUnavailable, etc.). Same messages, same localization, fully consistent across all providers. No provider-specific error UI.
- **D-08:** Ship what's ready. If only one provider's API is confirmed, ship that provider alone. The other can be added as a follow-up quick task or decimal phase (3.1).
- **D-09:** Identical ServiceCard layout as Codex/Claude Code -- same progress bar, colors, badge treatment. No visual distinction per provider beyond the name and data.
- **D-10:** Same tray/menubar summary format (e.g., "Kimi: 80%") as existing providers.
- **D-11:** Auto-menubar detection is manual only for new providers initially. Auto-detection (activity-based switching) requires separate research into activity signals and is out of scope for Phase 3.

### Claude's Discretion
- Provider module structure (e.g., `src-tauri/src/kimi/mod.rs` vs inline) -- match existing patterns
- Error mapping from provider-specific API errors to SnapshotStatus variants
- Settings UI layout for token input fields -- integrate naturally with existing settings flow
- i18n keys for new provider names and messages -- follow existing localization patterns

### Deferred Ideas (OUT OF SCOPE)
- Auto-menubar activity detection for new providers -- requires separate research into file mtimes, process detection, or config file monitoring for Kimi Code / GLM Coding Plan
- Provider-colored accents or custom card styling -- decided against for now; revisit if users request visual distinction
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| NPROV-01 | Kimi Code provider displays quota/usage data in the panel (pending API research confirmation) | API CONFIRMED: `GET https://api.kimi.com/coding/v1/usages` returns `usage.{limit,used,remaining}` (strings) + `usage.resetTime` (ISO 8601) + `limits[].detail` for 5h window. Bearer token auth. Verified via opencode-bar KimiProvider.swift source code. |
| NPROV-02 | GLM Coding Plan provider displays quota/usage data in the panel (pending API research confirmation) | API CONFIRMED: `GET https://api.z.ai/api/monitor/usage/quota/limit` returns `data.limits[]` with `percentage` (usage %, float), `nextResetTime` (ms epoch), `type` discriminator. Raw token auth (no Bearer). Verified via opencode-bar ZaiCodingPlanProvider.swift + opencode-glm-quota source code. |
| NPROV-03 | New providers appear in the service order configuration and can be reordered | Registry + `normalize_service_order()` already handles dynamic provider lists. Adding entries to PROVIDERS const auto-populates service_order. Verified in `src-tauri/src/state/mod.rs` line 274-293. |
| NPROV-04 | New providers use the same SnapshotStatus enum and visual treatment as existing providers | ServiceCard already renders all SnapshotStatus variants. New fetchers map HTTP errors to existing variants. No code changes needed in ServiceCard. |
| NPROV-05 | If a provider's API is unreachable or undocumented, the UI shows a clear "not available" state | `SnapshotStatus::NoCredentials` (no token), `SnapshotStatus::TemporarilyUnavailable` (API errors), `SnapshotStatus::Disabled` (user disabled) already handle these cases. |
</phase_requirements>

## Standard Stack

### Core (already in project)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `ureq` | 2.x | HTTP client for API calls | Already used by Claude Code fetcher; supports proxy resolution |
| `serde` + `serde_json` | 1.0 | JSON deserialization of API responses | Already used throughout project |
| `chrono` | 0.4 | ISO 8601 date parsing for reset times | Already in Cargo.toml |

### New Dependency
| Library | Version | Purpose | Why Needed |
|---------|---------|---------|------------|
| `toml` | 1.1.0 | Parse `~/.kimi/config.toml` for API key | Kimi CLI stores credentials in TOML format; manual string parsing is fragile |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `toml` crate | Manual regex/string parsing | Fragile, breaks on comments or complex values; `toml` adds ~200KB |

**Installation:**
```bash
# In src-tauri/Cargo.toml [dependencies]
toml = "1.1"
```

**Version verification:** `toml` 1.1.0 confirmed current via `cargo search toml` on 2026-03-31.

## Architecture Patterns

### Recommended Module Structure
```
src-tauri/src/
  kimi/
    mod.rs               # Kimi Code credential resolution + HTTP fetch + response parsing
  glm/
    mod.rs               # GLM Coding Plan credential resolution + HTTP fetch + response parsing
  pipeline/
    kimi.rs              # KimiFetcher (ProviderFetcher impl, ~25 lines)
    glm.rs               # GlmFetcher (ProviderFetcher impl, ~25 lines)
    mod.rs               # Updated: add kimi + glm modules, register in fetchers()
  registry.rs            # Updated: add 2 new ProviderDescriptor entries
src/
  lib/tauri/registry.ts  # Updated: mirror 2 new entries
  app/shared/i18n.ts     # Updated: add provider names + messages
  app/settings/SettingsView.tsx  # Updated: add token input fields
```

### Pattern 1: Provider Module (credential chain + fetch)
**What:** Each provider owns its entire credential resolution and API interaction
**When to use:** Every new provider
**Example (based on existing claude_code/mod.rs pattern):**
```rust
// src-tauri/src/kimi/mod.rs
use crate::snapshot::{ServiceSnapshot, SnapshotStatus};
use crate::state::{QuotaDimension, UserPreferences};
use serde::Deserialize;

// Response types match verified KimiUsageResponse from opencode-bar
#[derive(Deserialize)]
struct KimiUsageResponse {
    user: Option<KimiUser>,
    usage: Option<KimiUsage>,
    limits: Option<Vec<KimiLimit>>,
}

#[derive(Deserialize)]
struct KimiUser {
    #[serde(rename = "userId")]
    user_id: Option<String>,
    membership: Option<KimiMembership>,
}

#[derive(Deserialize)]
struct KimiMembership {
    level: Option<String>,
}

#[derive(Deserialize)]
struct KimiUsage {
    limit: Option<String>,      // numeric STRING, e.g. "1000000"
    used: Option<String>,       // numeric STRING
    remaining: Option<String>,  // numeric STRING
    #[serde(rename = "resetTime")]
    reset_time: Option<String>, // ISO 8601, e.g. "2026-04-07T00:00:00.000Z"
}

#[derive(Deserialize)]
struct KimiLimit {
    window: Option<KimiWindow>,
    detail: Option<KimiDetail>,
}

#[derive(Deserialize)]
struct KimiWindow {
    duration: Option<u32>,
    #[serde(rename = "timeUnit")]
    time_unit: Option<String>,  // "TIME_UNIT_MINUTE"
}

#[derive(Deserialize)]
struct KimiDetail {
    limit: Option<String>,
    used: Option<String>,
    remaining: Option<String>,
    #[serde(rename = "resetTime")]
    reset_time: Option<String>,
}
```

### Pattern 2: Thin Pipeline Fetcher (delegation wrapper)
**What:** ~25-line struct implementing ProviderFetcher that delegates to the provider module
**When to use:** Every provider fetcher
**Example (based on existing pipeline/codex.rs):**
```rust
// src-tauri/src/pipeline/kimi.rs
pub struct KimiFetcher;

impl ProviderFetcher for KimiFetcher {
    fn provider_id(&self) -> &str { "kimi-code" }
    fn strategy_name(&self) -> &str { "api" }
    fn fetch(&self, preferences: &UserPreferences, _refresh_kind: RefreshKind) -> ServiceSnapshot {
        crate::kimi::load_snapshot(preferences)
    }
}
```

### Pattern 3: Token Storage in Preferences
**What:** Add `provider_tokens: HashMap<String, String>` to UserPreferences for manually-entered API tokens
**When to use:** Providers requiring manual token input (both new providers)
**Example:**
```rust
// In UserPreferences struct
#[serde(default)]
pub provider_tokens: HashMap<String, String>,

// In PreferencePatch
pub provider_tokens: Option<HashMap<String, String>>,
```

### Pattern 4: Credential Chain (per D-04, D-05)
**What:** Each provider tries multiple credential sources in priority order
**For Kimi Code:**
1. Environment variable: `KIMI_API_KEY`
2. `~/.kimi/config.toml` -- parse `[providers.kimi-for-coding]` section for `api_key`
3. Fallback: `~/.kimi/config.json` (same structure, JSON format -- Kimi CLI auto-migrates)
4. Manual token from `preferences.provider_tokens["kimi-code"]`

**For GLM Coding Plan:**
1. Environment variable: `ZAI_API_KEY` (global platform) or `ZHIPU_API_KEY` / `ZHIPUAI_API_KEY` (China platform)
2. Manual token from `preferences.provider_tokens["glm-coding"]`

### Pattern 5: GLM Response Envelope Handling
**What:** GLM API wraps responses in `{ "data": { ... } }`. Decode must try envelope first, then bare payload.
**Source:** Verified in opencode-bar ZaiCodingPlanProvider.swift line 313-319
```rust
// Try envelope first, fall back to bare payload
#[derive(Deserialize)]
struct GlmEnvelope<T> {
    data: Option<T>,
}

fn decode_glm_response<T: for<'de> Deserialize<'de>>(body: &str) -> Result<T, String> {
    // Try { "data": T } envelope first
    if let Ok(envelope) = serde_json::from_str::<GlmEnvelope<T>>(body) {
        if let Some(data) = envelope.data {
            return Ok(data);
        }
    }
    // Fall back to bare T
    serde_json::from_str::<T>(body).map_err(|e| e.to_string())
}
```

### Anti-Patterns to Avoid
- **Hardcoding provider IDs outside registry:** All provider ID references must come from registry constants
- **Provider-specific UI components:** Reuse ServiceCard for all providers; no KimiCard or GlmCard
- **Storing tokens in a separate file:** Use existing preferences.json per D-06
- **Treating GLM `percentage` as remaining:** It is **usage** percentage (amount consumed). Convert to remaining via `100.0 - percentage`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| HTTP client with proxy | Custom HTTP wrapper | `ureq` + existing `resolve_proxy()` | Proxy detection already solved |
| ISO 8601 date parsing | Manual string parsing | `chrono::DateTime::parse_from_rfc3339` | Handles fractional seconds, timezone offsets |
| TOML config parsing | Manual string parsing | `toml` crate v1.1.0 | Robust key extraction; handles comments, multi-line, escaped strings |
| Service order normalization | Custom logic | Existing `normalize_service_order()` | Already handles unknown providers gracefully |
| GLM number decoding | Assume single type | Flexible decode (try i64, f64, String) | GLM API returns mixed types for same fields across different limit items |

**Key insight:** The Provider Registry + ProviderFetcher pipeline was designed specifically so that adding new providers requires no framework changes. The entire integration surface is: registry entry + fetcher module + pipeline registration.

## API Specifications

### Kimi Code Usage API
**Confidence:** HIGH (verified by reading opencode-bar KimiProvider.swift source code)

**Endpoint:** `GET https://api.kimi.com/coding/v1/usages`

**Authentication:**
```
Authorization: Bearer {api_key}
Content-Type: application/json
```

**Response structure (verified from KimiUsageResponse struct):**
```json
{
  "user": {
    "userId": "string",
    "region": "string",
    "membership": { "level": "LEVEL_xxx" },
    "businessId": "string"
  },
  "usage": {
    "limit": "1000000",
    "used": "250000",
    "remaining": "750000",
    "resetTime": "2026-04-07T00:00:00.000Z"
  },
  "limits": [
    {
      "window": { "duration": 300, "timeUnit": "TIME_UNIT_MINUTE" },
      "detail": {
        "limit": "200000",
        "used": "50000",
        "remaining": "150000",
        "resetTime": "2026-03-31T15:00:00.000Z"
      }
    }
  ]
}
```

**CRITICAL: Numeric values are STRINGS.** `usage.limit`, `usage.used`, `usage.remaining` and all `detail.*` equivalents are string-encoded integers. Must deserialize as `Option<String>` then parse to u64.

**Key fields for QuotaDimension mapping:**
- `usage.remaining` / `usage.limit` -> weekly remaining percent (compute: `remaining * 100 / limit`)
- `usage.resetTime` -> weekly reset hint (ISO 8601 with fractional seconds)
- `limits[0].detail.remaining` / `limits[0].detail.limit` -> 5-hour remaining percent
- `limits[0].detail.resetTime` -> 5-hour reset hint

**Credential sources (priority order):**
1. Env var: `KIMI_API_KEY`
2. Local config: `~/.kimi/config.toml` -> `[providers.kimi-for-coding].api_key`
3. Fallback config: `~/.kimi/config.json` (Kimi CLI auto-migrates TOML from JSON; backup kept as `config.json.bak`)
4. Manual input: `preferences.provider_tokens["kimi-code"]`

**Note on config migration:** Per official Kimi CLI docs: "If `~/.kimi/config.toml` doesn't exist but `~/.kimi/config.json` exists, Kimi Code CLI will automatically migrate the JSON configuration to TOML format and backup the original file as `config.json.bak`." Check TOML first, fall back to JSON.

### GLM Coding Plan Quota API
**Confidence:** HIGH (verified by reading opencode-bar ZaiCodingPlanProvider.swift + opencode-glm-quota TypeScript source code)

**Endpoint:** `GET https://api.z.ai/api/monitor/usage/quota/limit`
**China endpoint:** `GET https://open.bigmodel.cn/api/monitor/usage/quota/limit`

**Authentication:**
```
Authorization: {token}          (NO "Bearer" prefix!)
Accept-Language: en-US,en
Content-Type: application/json
```

**Response structure (verified from ZaiCodingPlanProvider.swift + opencode-glm-quota):**
```json
{
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
        "total": 300,
        "usageDetails": [
          { "modelCode": "tool_a", "usage": 80 },
          { "modelCode": "tool_b", "usage": 40 }
        ]
      }
    ],
    "level": "standard"
  }
}
```

**CRITICAL: Response is wrapped in `data` envelope.** Decode as `{ data: { limits: [...] } }`.

**CRITICAL: `percentage` is USAGE percentage (amount consumed), NOT remaining.** To get remaining: `100.0 - percentage`. Verified in opencode-bar ZaiCodingPlanProvider.swift line 193: `let remainingPercent = Int((100.0 - overallUsed).rounded())`.

**Limit type discrimination (verified from opencode-glm-quota token-limits.ts):**
- `type="TOKENS_LIMIT"` + `unit=3, number=5` -> 5-hour token window
- `type="TOKENS_LIMIT"` + `unit=6, number=1` -> Weekly token window (added Feb 2026)
- `type="TIME_LIMIT"` -> MCP usage (monthly)

**CRITICAL: Number types are polymorphic.** Fields like `percentage`, `currentValue`, `total`, `nextResetTime` may arrive as int, float, or string depending on the limit item. The opencode-bar Swift implementation uses flexible decoding (try Int, then Double, then String for each field). Rust implementation should use `serde_json::Value` or custom deserializer for robustness.

**Key fields for QuotaDimension mapping:**
- `limits[].percentage` -> **usage** percent (convert to remaining: `100 - percentage`)
- `limits[].nextResetTime` -> Unix timestamp in **milliseconds** (divide by 1000 for seconds)
- `limits[].type` + `unit` + `number` -> dimension label mapping:
  - `TOKENS_LIMIT, unit=3, number=5` -> "5h Token Quota"
  - `TOKENS_LIMIT, unit=6, number=1` -> "Weekly Token Quota"
  - `TIME_LIMIT` -> "MCP Usage"

**Credential sources (priority order):**
1. Env var: `ZAI_API_KEY` (global) or `ZHIPU_API_KEY` / `ZHIPUAI_API_KEY` (China)
2. Manual input: `preferences.provider_tokens["glm-coding"]`

**Platform detection:** Env var name determines platform: `ZAI_API_KEY` -> `api.z.ai`, `ZHIPU_API_KEY` -> `open.bigmodel.cn`. For manual tokens, add a GLM region preference (`glm_platform: "global" | "china"`, default "global").

### Provider Registration

**Registry entries:**
```rust
ProviderDescriptor {
    id: "kimi-code",
    display_name: "Kimi Code",
    default_enabled: false,
    dashboard_url: Some("https://www.kimi.com/code/console"),
},
ProviderDescriptor {
    id: "glm-coding",
    display_name: "GLM Coding Plan",
    default_enabled: false,
    dashboard_url: Some("https://z.ai/subscribe"),
},
```

Both `default_enabled: false` -- users must opt in and provide tokens.

## Common Pitfalls

### Pitfall 1: GLM Token Auth Without Bearer Prefix
**What goes wrong:** Sending `Authorization: Bearer {token}` to GLM API returns 401
**Why it happens:** GLM/Z.ai API expects the raw token without "Bearer " prefix, unlike most OAuth APIs
**How to avoid:** Each provider module handles its own auth header format. GLM must use raw token. Kimi uses `Bearer {token}`.
**Warning signs:** 401 responses from GLM API when token is known-valid
**Source:** Verified in opencode-glm-quota client.ts line 199 comment: `// NO "Bearer" prefix`

### Pitfall 2: GLM `percentage` Is Usage, Not Remaining
**What goes wrong:** Panel shows inverted progress bars -- "75% remaining" when user has actually consumed 75%
**Why it happens:** GLM `percentage` field represents how much has been **used**, not how much remains
**How to avoid:** Convert to remaining: `remaining_percent = (100.0 - percentage).round() as u8`. Verified in opencode-bar ZaiCodingPlanProvider.swift line 193.
**Warning signs:** Percentages that seem backwards compared to the GLM dashboard

### Pitfall 3: Kimi Numeric Strings
**What goes wrong:** JSON parsing fails or produces zeros when treating limit/used/remaining as numbers
**Why it happens:** Kimi API returns numeric values as strings (e.g., `"1000000"` not `1000000`)
**How to avoid:** Deserialize as `Option<String>`, then parse to u64/f64 in mapping code
**Warning signs:** Zero-value quota dimensions when data should be present

### Pitfall 4: GLM Reset Time in Milliseconds
**What goes wrong:** Reset time appears as year 55000+ or similar nonsense
**Why it happens:** GLM `nextResetTime` is Unix timestamp in **milliseconds**, not seconds
**How to avoid:** Divide by 1000 before converting to chrono DateTime
**Warning signs:** Reset hints showing impossibly far-future dates

### Pitfall 5: GLM Response Wrapped in `data` Envelope
**What goes wrong:** Deserialization fails because top-level JSON has `data` key, not `limits` directly
**Why it happens:** GLM API wraps actual payload in `{ "data": { ... } }` envelope
**How to avoid:** Try envelope first (`ZaiEnvelope<T>`), fall back to bare payload. Verified in opencode-bar ZaiCodingPlanProvider.swift line 313-319.
**Warning signs:** Deserialization error on valid 200 response

### Pitfall 6: GLM Polymorphic Number Types
**What goes wrong:** Deserialization fails for some limit items but not others
**Why it happens:** GLM returns `percentage` as float for some items, int for others; `nextResetTime` can be i64 or absent; `currentValue`/`total` can be int or float
**How to avoid:** Use flexible deserialization: try each numeric type in order (i64 -> f64 -> String). The opencode-bar Swift implementation does exactly this with `decodeDouble`/`decodeInt`/`decodeInt64` helper methods.
**Warning signs:** Partial data -- some quota dimensions parsed, others missing

### Pitfall 7: Stale Token After Config File Change
**What goes wrong:** User updates `~/.kimi/config.toml` but app keeps using old token
**Why it happens:** If token is read once and cached
**How to avoid:** Re-read credential chain on every fetch (matching existing Claude Code pattern)
**Warning signs:** Auth failures after user rotates credentials

### Pitfall 8: GLM Platform Region Mismatch
**What goes wrong:** API returns 404 or connection timeout
**Why it happens:** User has China-region GLM account but app hits `api.z.ai` (or vice versa)
**How to avoid:** Allow user to select platform (global vs china) in settings. Default to global. Auto-detect from env var name if present.
**Warning signs:** Connection failures only for some users

## Code Examples

### Registry Entry Addition
```rust
// Source: existing pattern in src-tauri/src/registry.rs
pub const PROVIDERS: &[ProviderDescriptor] = &[
    ProviderDescriptor { id: "codex", display_name: "Codex", default_enabled: true, dashboard_url: Some("https://chatgpt.com/admin/usage") },
    ProviderDescriptor { id: "claude-code", display_name: "Claude Code", default_enabled: false, dashboard_url: Some("https://console.anthropic.com/settings/usage") },
    // NEW:
    ProviderDescriptor { id: "kimi-code", display_name: "Kimi Code", default_enabled: false, dashboard_url: Some("https://www.kimi.com/code/console") },
    ProviderDescriptor { id: "glm-coding", display_name: "GLM Coding Plan", default_enabled: false, dashboard_url: Some("https://z.ai/subscribe") },
];
```

### Pipeline Registration
```rust
// Source: existing pattern in src-tauri/src/pipeline/mod.rs
FETCHERS.get_or_init(|| {
    vec![
        Box::new(codex::CodexFetcher),
        Box::new(claude_code::ClaudeCodeFetcher),
        // NEW:
        Box::new(kimi::KimiFetcher),
        Box::new(glm::GlmFetcher),
    ]
})
```

### Kimi Response Mapping to QuotaDimension
```rust
// Source: pattern derived from opencode-bar KimiProvider.swift lines 96-135
fn map_kimi_response(resp: &KimiUsageResponse) -> Vec<QuotaDimension> {
    let mut dims = Vec::new();

    // Weekly usage dimension
    if let Some(usage) = &resp.usage {
        let limit: u64 = usage.limit.as_deref().and_then(|s| s.parse().ok()).unwrap_or(0);
        let remaining: u64 = usage.remaining.as_deref().and_then(|s| s.parse().ok()).unwrap_or(0);
        let pct = if limit > 0 { Some(((remaining * 100) / limit) as u8) } else { None };
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

    // 5-hour window dimension from limits[0]
    if let Some(limits) = &resp.limits {
        if let Some(first) = limits.first() {
            if let Some(detail) = &first.detail {
                let limit: u64 = detail.limit.as_deref().and_then(|s| s.parse().ok()).unwrap_or(0);
                let remaining: u64 = detail.remaining.as_deref().and_then(|s| s.parse().ok()).unwrap_or(0);
                let pct = if limit > 0 { Some(((remaining * 100) / limit) as u8) } else { None };
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
```

### GLM Response Mapping to QuotaDimension
```rust
// Source: pattern derived from opencode-bar ZaiCodingPlanProvider.swift + opencode-glm-quota
fn map_glm_response(resp: &GlmQuotaResponse) -> Vec<QuotaDimension> {
    let mut dims = Vec::new();

    if let Some(limits) = &resp.limits {
        for limit in limits {
            let label = match (limit.limit_type.as_str(), limit.unit, limit.number) {
                ("TOKENS_LIMIT", Some(3), Some(5)) => "5h Token Quota",
                ("TOKENS_LIMIT", Some(6), Some(1)) => "Weekly Token Quota",
                ("TIME_LIMIT", _, _) => "MCP Usage",
                _ => "Quota",
            };

            // CRITICAL: percentage is USAGE, not remaining
            let usage_pct = limit.percentage.unwrap_or(0.0);
            let remaining_pct = ((100.0 - usage_pct).round() as u8).min(100);
            let tone = progress_tone(Some(remaining_pct));

            let reset_hint = limit.next_reset_time.map(|ms| {
                // Convert milliseconds to ISO 8601
                chrono::DateTime::from_timestamp(ms / 1000, 0)
                    .map(|dt| dt.to_rfc3339())
                    .unwrap_or_default()
            });

            let remaining_abs = match (limit.current_value, limit.total) {
                (Some(cv), Some(t)) => format!("{} / {}", t - cv, t),
                _ => format!("{}%", remaining_pct),
            };

            dims.push(QuotaDimension {
                label: label.into(),
                remaining_percent: Some(remaining_pct),
                remaining_absolute: remaining_abs,
                reset_hint,
                status: "normal".into(),
                progress_tone: tone,
            });
        }
    }

    dims
}
```

### Token Input in Settings (frontend)
```tsx
// Pattern: identical to existing proxy URL input in SettingsView.tsx
{isProviderEnabled("kimi-code") ? (
  <PreferenceField label={copy.kimiCodeToken} description={copy.kimiCodeTokenHint}>
    <input
      aria-label={copy.kimiCodeToken}
      className={inputClassName}
      placeholder="sk-..."
      type="password"
      value={providerTokens["kimi-code"] ?? ""}
      onBlur={() => void commitProviderToken("kimi-code")}
      onChange={(e) => setProviderTokenDraft("kimi-code", e.target.value)}
    />
  </PreferenceField>
) : null}
```

### GLM Flexible Number Deserialization
```rust
// Source: pattern from opencode-bar ZaiCodingPlanProvider.swift lines 43-83
// GLM API returns polymorphic number types -- must handle int, float, and string
use serde::de::{self, Deserializer};

fn deserialize_flexible_f64<'de, D: Deserializer<'de>>(deserializer: D) -> Result<Option<f64>, D::Error> {
    let value = serde_json::Value::deserialize(deserializer)?;
    match value {
        serde_json::Value::Number(n) => Ok(n.as_f64()),
        serde_json::Value::String(s) => Ok(s.parse::<f64>().ok()),
        serde_json::Value::Null => Ok(None),
        _ => Err(de::Error::custom("expected number or string")),
    }
}

fn deserialize_flexible_i64<'de, D: Deserializer<'de>>(deserializer: D) -> Result<Option<i64>, D::Error> {
    let value = serde_json::Value::deserialize(deserializer)?;
    match value {
        serde_json::Value::Number(n) => Ok(n.as_i64()),
        serde_json::Value::String(s) => Ok(s.parse::<i64>().ok()),
        serde_json::Value::Null => Ok(None),
        _ => Err(de::Error::custom("expected number or string")),
    }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Per-service hardcoded commands | Generic `get_provider_state`/`refresh_provider_state` | Phase 2 (2026-03) | New providers need zero command changes |
| Hardcoded service ID lists | ProviderDescriptor registry | Phase 1 (2026-03) | New providers need only registry + mirror entry |
| Single quota window | GLM now has 5h + weekly + MCP windows | Feb 2026 | Must handle 3 limit items, not just 1 |

## Open Questions

1. **TOML parsing for Kimi config -- RESOLVED**
   - Recommendation: Add `toml` crate v1.1.0. Well-maintained, small footprint, avoids fragile manual parsing.

2. **GLM platform region selection**
   - What we know: Global uses `api.z.ai`, China uses `open.bigmodel.cn`
   - What's unclear: Whether to auto-detect or let user choose
   - Recommendation: Add `glm_platform` preference field (`"global"` | `"china"`, default `"global"`). If env var is `ZHIPU_API_KEY`, auto-select `"china"`. User can override in settings.

3. **User-provided API traffic captures (D-02) -- status update**
   - What we know: Research found both APIs via two independent open-source implementations with full source code verification
   - Recommendation: Present research findings to user for confirmation. The reference implementations (opencode-bar for both providers, opencode-glm-quota for GLM) provide strong evidence that these APIs are stable and actively used. User traffic capture may still be valuable for validation but is no longer blocking.

4. **GLM weekly quota window -- NEW finding**
   - What we know: As of Feb 2026, GLM added weekly token limits (type=TOKENS_LIMIT, unit=6, number=1) in addition to the existing 5-hour window
   - What's unclear: Whether all plan tiers have weekly limits
   - Recommendation: Handle dynamically -- iterate all `limits[]` items and map each to a QuotaDimension. Unknown combinations get a generic label.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| ureq | HTTP API calls | Already in Cargo.toml | 2.x | -- |
| serde/serde_json | Response parsing | Already in Cargo.toml | 1.0 | -- |
| chrono | Date parsing | Already in Cargo.toml | 0.4 | -- |
| toml (NEW) | Kimi config parsing | Not yet added | 1.1.0 | Manual string parsing (fragile) |

**Missing dependencies with no fallback:** None

**Missing dependencies with fallback:**
- `toml` crate: Not yet in Cargo.toml. Fallback is manual string parsing of `~/.kimi/config.toml`, but this is fragile. Recommend adding the crate.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 3.x (frontend) + cargo test (Rust) |
| Config file | `vitest.config.ts` / `Cargo.toml` |
| Quick run command | `npx vitest run && cargo test` |
| Full suite command | `npx vitest run && cargo test` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| NPROV-01 | Kimi provider returns valid QuotaDimension from API response | unit | `cargo test --lib kimi` | No -- Wave 0 |
| NPROV-01 | Kimi provider handles numeric string parsing edge cases | unit | `cargo test --lib kimi` | No -- Wave 0 |
| NPROV-02 | GLM provider returns valid QuotaDimension from API response | unit | `cargo test --lib glm` | No -- Wave 0 |
| NPROV-02 | GLM provider correctly inverts percentage (usage -> remaining) | unit | `cargo test --lib glm` | No -- Wave 0 |
| NPROV-02 | GLM provider handles data envelope and polymorphic numbers | unit | `cargo test --lib glm` | No -- Wave 0 |
| NPROV-03 | New providers appear in service order after registry update | unit | `cargo test --lib registry && npx vitest run src/lib/tauri/registry.test.ts` | Partially (registry.test.ts needs new entries) |
| NPROV-04 | New providers produce SnapshotStatus variants rendered by ServiceCard | unit | `npx vitest run src/components/panel/ServiceCard.test.tsx` | Yes (existing, needs new provider test cases) |
| NPROV-05 | NoCredentials / TemporarilyUnavailable states render correctly for new providers | unit | `npx vitest run src/components/panel/ServiceCard.test.tsx` | Yes (existing status variants already tested) |

### Sampling Rate
- **Per task commit:** `cargo test --lib && npx vitest run`
- **Per wave merge:** Full suite
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src-tauri/src/kimi/mod.rs` tests -- response parsing (numeric strings, missing fields), credential chain, error mapping
- [ ] `src-tauri/src/glm/mod.rs` tests -- response parsing (envelope unwrap, percentage inversion, polymorphic numbers, millisecond timestamps), credential chain, error mapping
- [ ] `src/lib/tauri/registry.test.ts` -- add assertions for new provider entries (kimi-code, glm-coding)
- [ ] `src-tauri/src/registry.rs` tests -- add assertions for new provider entries

## Sources

### Primary (HIGH confidence)
- opencode-bar KimiProvider.swift (GitHub: opgginc/opencode-bar, read from local clone at `/tmp/opencode-bar/CopilotMonitor/CopilotMonitor/Providers/KimiProvider.swift`) -- Full Kimi API implementation: endpoint URL, Bearer auth, response struct with all field types, credential discovery via `kimi-for-coding` key in opencode auth.json
- opencode-bar ZaiCodingPlanProvider.swift (GitHub: opgginc/opencode-bar, read from local clone) -- Full GLM API implementation: endpoint URLs, raw token auth, `data` envelope, flexible number decoding, percentage-as-usage semantics, millisecond timestamp handling
- opencode-glm-quota (GitHub: guyinwonder168/opencode-glm-quota, read from local clone at `/tmp/opencode-glm-quota/src/`) -- Complete GLM plugin: endpoint definitions, client.ts HTTP headers, index.ts credential discovery, token-limits.ts limit type discrimination (5h/weekly/MCP)
- Kimi Code CLI docs (moonshotai.github.io/kimi-cli) -- Config file paths: `~/.kimi/config.toml`, TOML structure, provider key format, JSON-to-TOML auto-migration

### Secondary (MEDIUM confidence)
- Kimi Code membership docs (kimi.com/code/docs/en) -- Console URL, /usage slash command, membership levels
- Z.ai developer docs (docs.z.ai) -- Platform overview, subscription tiers
- WebSearch results confirming weekly limits added Feb 2026

### Tertiary (LOW confidence)
- WebSearch results on quota structures and pricing -- general context only, not relied on for implementation details

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new dependencies beyond `toml` crate (verified v1.1.0)
- Architecture: HIGH -- follows established patterns exactly; Phase 1+2 were designed for this
- API specifications: HIGH -- verified by reading actual source code of two independent implementations (Swift + TypeScript) for each API
- Pitfalls: HIGH (upgraded from MEDIUM) -- pitfalls now verified from source code patterns (percentage inversion, envelope wrapping, polymorphic numbers)
- Credential discovery: MEDIUM -- Kimi config path confirmed by official docs + opencode-bar; GLM credential sources confirmed by opencode-glm-quota

**Research date:** 2026-03-31 (revised)
**Valid until:** 2026-04-30 (APIs appear stable; both have active third-party consumers)
