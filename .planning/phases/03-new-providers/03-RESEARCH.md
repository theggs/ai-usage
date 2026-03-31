# Phase 3: New Providers - Research

**Researched:** 2026-03-31
**Domain:** New provider integration (Kimi Code, GLM Coding Plan) into existing ProviderFetcher pipeline
**Confidence:** MEDIUM

## Summary

Phase 3 adds Kimi Code and GLM Coding Plan as new providers. The existing Provider Registry (Phase 1) and ProviderFetcher pipeline (Phase 2) are fully generic -- adding a new provider requires a registry entry, a fetcher implementation, a pipeline registration line, and frontend mirror updates. No new UI components are needed; ServiceCard already handles all SnapshotStatus variants.

Both providers have documented quota APIs that return percentage-based usage with reset times, which maps directly to the existing `QuotaDimension` model. Kimi Code uses `https://api.kimi.com/coding/v1/usages` with Bearer token auth; GLM Coding Plan uses `https://api.z.ai/api/monitor/usage/quota/limit` (or `open.bigmodel.cn` for China) with raw token auth (no Bearer prefix). Both APIs are confirmed by third-party open-source implementations that actively use them.

**Primary recommendation:** Implement both providers in parallel since both APIs are documented and have reference implementations. Each provider is ~500 lines of Rust (fetcher module + HTTP client logic) plus ~10 lines of registry/pipeline wiring. Token input fields in Settings follow the existing proxy URL pattern.

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
| NPROV-01 | Kimi Code provider displays quota/usage data in the panel (pending API research confirmation) | Kimi API endpoint confirmed: `GET https://api.kimi.com/coding/v1/usages` returns usage/limits with remaining%, resetTime. Bearer token auth. Reference impl in opencode-bar KimiProvider.swift |
| NPROV-02 | GLM Coding Plan provider displays quota/usage data in the panel (pending API research confirmation) | GLM API endpoint confirmed: `GET https://api.z.ai/api/monitor/usage/quota/limit` returns limits[] with percentage, nextResetTime. Raw token auth (no Bearer prefix). Reference impl in opencode-glm-quota |
| NPROV-03 | New providers appear in the service order configuration and can be reordered | Registry + normalize_service_order already handles dynamic provider lists. Adding entries to PROVIDERS const auto-populates service_order |
| NPROV-04 | New providers use the same SnapshotStatus enum and visual treatment as existing providers | ServiceCard already renders all SnapshotStatus variants. New fetchers map HTTP errors to existing variants |
| NPROV-05 | If a provider's API is unreachable or undocumented, the UI shows a clear "not available" state | SnapshotStatus::NoCredentials (no token), SnapshotStatus::TemporarilyUnavailable (API errors) already handle these cases |
</phase_requirements>

## Standard Stack

### Core (already in project)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `ureq` | 2.x | HTTP client for API calls | Already used by Claude Code fetcher; supports proxy resolution |
| `serde` + `serde_json` | 1.0 | JSON deserialization of API responses | Already used throughout project |
| `chrono` | 0.4 | ISO 8601 date parsing for reset times | Already in Cargo.toml |

### No New Dependencies Required
Both new providers use HTTP GET + JSON parsing, which is fully covered by existing crates. No new Cargo dependencies needed.

**Installation:** None required -- all dependencies already present.

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

#[derive(Deserialize)]
struct KimiUsageResponse {
    usage: Option<KimiUsage>,
    limits: Option<Vec<KimiLimit>>,
}

#[derive(Deserialize)]
struct KimiUsage {
    limit: Option<String>,   // numeric string
    remaining: Option<String>,
    reset_time: Option<String>, // ISO 8601
}

#[derive(Deserialize)]
struct KimiLimit {
    window: Option<KimiWindow>,
    detail: Option<KimiDetail>,
}

// ... credential resolution, HTTP call, response mapping to ServiceSnapshot
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
1. Environment variable (e.g., `KIMI_API_KEY`)
2. `~/.kimi/config.toml` -- parse `[providers.kimi-for-coding]` section for `api_key`
3. Manual token from `preferences.provider_tokens["kimi-code"]`

**For GLM Coding Plan:**
1. Environment variable (e.g., `GLM_API_KEY` or `ZHIPU_API_KEY`)
2. Manual token from `preferences.provider_tokens["glm-coding"]`

### Anti-Patterns to Avoid
- **Hardcoding provider IDs outside registry:** All provider ID references must come from registry constants
- **Provider-specific UI components:** Reuse ServiceCard for all providers; no KimiCard or GlmCard
- **Storing tokens in a separate file:** Use existing preferences.json per D-06

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| HTTP client with proxy | Custom HTTP wrapper | `ureq` + existing `resolve_proxy()` | Proxy detection already solved |
| ISO 8601 date parsing | Manual string parsing | `chrono::DateTime::parse_from_rfc3339` | Handles fractional seconds, timezone offsets |
| TOML config parsing | Manual string parsing | `toml` crate (for Kimi `~/.kimi/config.toml`) | Robust key extraction; small dependency |
| Service order normalization | Custom logic | Existing `normalize_service_order()` | Already handles unknown providers gracefully |

**Key insight:** The Provider Registry + ProviderFetcher pipeline was designed specifically so that adding new providers requires no framework changes. The entire integration surface is: registry entry + fetcher module + pipeline registration.

## API Specifications

### Kimi Code Usage API
**Confidence:** HIGH (verified by two independent open-source implementations)

**Endpoint:** `GET https://api.kimi.com/coding/v1/usages`

**Authentication:**
```
Authorization: Bearer {api_key}
Content-Type: application/json
```

**Response structure:**
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

**Key fields for QuotaDimension mapping:**
- `usage.remaining` / `usage.limit` -> weekly remaining percent
- `usage.resetTime` -> weekly reset hint
- `limits[0].detail.remaining` / `limits[0].detail.limit` -> 5-hour remaining percent
- `limits[0].detail.resetTime` -> 5-hour reset hint
- Numeric values are **strings** (must parse to int)

**Credential sources (priority order):**
1. Env var: `KIMI_API_KEY`
2. Local config: `~/.kimi/config.toml` -> `[providers.kimi-for-coding].api_key`
3. Manual input: `preferences.provider_tokens["kimi-code"]`

**Note on `/login` flow:** `kimi-cli` uses a `/login` command that stores credentials locally. The config path `~/.kimi/config.toml` is the canonical location. If TOML is absent but `~/.kimi/config.json` exists, the JSON format has the same structure.

### GLM Coding Plan Quota API
**Confidence:** HIGH (verified by open-source opencode-glm-quota plugin with full source code)

**Endpoint:** `GET https://api.z.ai/api/monitor/usage/quota/limit`
**China endpoint:** `GET https://open.bigmodel.cn/api/monitor/usage/quota/limit`

**Authentication:**
```
Authorization: {token}          (NO "Bearer" prefix!)
Accept-Language: en-US,en
Content-Type: application/json
```

**Response structure:**
```json
{
  "limits": [
    {
      "type": "token_5h_quota",
      "percentage": 75.5,
      "unit": 5,
      "number": 300,
      "currentValue": 50000,
      "total": 200000,
      "nextResetTime": 1711900800000,
      "usageDetails": {}
    },
    {
      "type": "time_limit",
      "percentage": 40.0,
      "currentValue": 120,
      "usage": 300,
      "usageDetails": { "model_a": 80, "model_b": 40 }
    }
  ]
}
```

**Key fields for QuotaDimension mapping:**
- `limits[].percentage` -> remaining percent (already 0-100 float)
- `limits[].nextResetTime` -> Unix timestamp in milliseconds -> reset hint
- `limits[].type` -> dimension label (map "token_5h_quota" -> "5h Token Quota", "time_limit" -> "MCP Usage")

**Credential sources (priority order):**
1. Env var: `GLM_API_KEY` or `ZHIPU_API_KEY`
2. Manual input: `preferences.provider_tokens["glm-coding"]`

**Platform detection:** If user has a China-region account, use `open.bigmodel.cn` base URL. Could be auto-detected from token format or configurable in settings.

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
**How to avoid:** Each provider module handles its own auth header format. GLM must use raw token.
**Warning signs:** 401 responses from GLM API when token is known-valid

### Pitfall 2: Kimi Numeric Strings
**What goes wrong:** JSON parsing fails or produces zeros when treating limit/used/remaining as numbers
**Why it happens:** Kimi API returns numeric values as strings (e.g., `"1000000"` not `1000000`)
**How to avoid:** Deserialize as `Option<String>`, then parse to u64/f64 in mapping code
**Warning signs:** Zero-value quota dimensions when data should be present

### Pitfall 3: GLM Reset Time in Milliseconds
**What goes wrong:** Reset time appears as year 55000+ or similar nonsense
**Why it happens:** GLM `nextResetTime` is Unix timestamp in **milliseconds**, not seconds
**How to avoid:** Divide by 1000 before converting to chrono DateTime
**Warning signs:** Reset hints showing impossibly far-future dates

### Pitfall 4: Stale Token After Config File Change
**What goes wrong:** User updates `~/.kimi/config.toml` but app keeps using old token
**Why it happens:** If token is read once and cached
**How to avoid:** Re-read credential chain on every fetch (matching existing Claude Code pattern)
**Warning signs:** Auth failures after user rotates credentials

### Pitfall 5: GLM Platform Region Mismatch
**What goes wrong:** API returns 404 or connection timeout
**Why it happens:** User has China-region GLM account but app hits `api.z.ai` (or vice versa)
**How to avoid:** Allow user to select platform (z.ai vs bigmodel.cn) in settings, or auto-detect from API key format
**Warning signs:** Connection failures only for some users

### Pitfall 6: TOML Parsing Dependency
**What goes wrong:** Adding `toml` crate may conflict or add unwanted dependency weight
**Why it happens:** Kimi stores config in TOML format
**How to avoid:** Use the `toml` crate (well-maintained, small footprint) or do minimal string parsing for just the api_key field. The `toml` crate is the safer choice.
**Warning signs:** N/A -- decision point at implementation time

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
// Map Kimi /usages response to QuotaDimension vec
fn map_kimi_response(resp: &KimiUsageResponse) -> Vec<QuotaDimension> {
    let mut dims = Vec::new();
    // Weekly usage dimension
    if let Some(usage) = &resp.usage {
        let limit: u64 = usage.limit.as_deref().and_then(|s| s.parse().ok()).unwrap_or(0);
        let remaining: u64 = usage.remaining.as_deref().and_then(|s| s.parse().ok()).unwrap_or(0);
        let pct = if limit > 0 { Some(((remaining * 100) / limit) as u8) } else { None };
        dims.push(QuotaDimension {
            label: "Weekly".into(),
            remaining_percent: pct,
            remaining_absolute: format!("{remaining} / {limit}"),
            reset_hint: usage.reset_time.clone(),
            status: "normal".into(),
            progress_tone: /* derive from pct */,
        });
    }
    // 5-hour window dimension from limits[0]
    // ...similar pattern
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

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Per-service hardcoded commands | Generic `get_provider_state`/`refresh_provider_state` | Phase 2 (2026-03) | New providers need zero command changes |
| Hardcoded service ID lists | ProviderDescriptor registry | Phase 1 (2026-03) | New providers need only registry + mirror entry |

## Open Questions

1. **TOML parsing for Kimi config**
   - What we know: Kimi stores config at `~/.kimi/config.toml` with api_key field
   - What's unclear: Whether to add `toml` crate or do minimal string parsing
   - Recommendation: Add `toml` crate -- it's well-maintained (~200KB), avoids fragile parsing

2. **GLM platform region selection**
   - What we know: Global uses `api.z.ai`, China uses `open.bigmodel.cn`
   - What's unclear: How to detect which region the user needs
   - Recommendation: Add a "GLM Region" dropdown in settings (Global / China), defaulting to Global. Could also try both and use whichever responds.

3. **Kimi credential chain depth**
   - What we know: `~/.kimi/config.toml` stores api_key; `/login` flow populates it; VS Code extension may use separate secret storage
   - What's unclear: Whether additional credential sources exist beyond config.toml
   - Recommendation: Start with env var -> config.toml -> manual input chain. If users report credential discovery issues, add sources later.

4. **User-provided API traffic captures (D-02)**
   - What we know: Research found both APIs via third-party implementations, not user-provided captures
   - What's unclear: Whether user still needs to provide captures given research findings
   - Recommendation: Present research findings to user for confirmation. The reference implementations (opencode-bar for Kimi, opencode-glm-quota for GLM) provide strong evidence that these APIs are stable and usable.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| ureq | HTTP API calls | Already in Cargo.toml | 2.x | -- |
| serde/serde_json | Response parsing | Already in Cargo.toml | 1.0 | -- |
| chrono | Date parsing | Already in Cargo.toml | 0.4 | -- |
| toml (NEW) | Kimi config parsing | Not yet added | TBD | Manual string parsing |

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
| NPROV-02 | GLM provider returns valid QuotaDimension from API response | unit | `cargo test --lib glm` | No -- Wave 0 |
| NPROV-03 | New providers appear in service order after registry update | unit | `cargo test --lib registry && npx vitest run src/lib/tauri/registry.test.ts` | Partially (registry.test.ts exists, needs new entries) |
| NPROV-04 | New providers produce SnapshotStatus variants rendered by ServiceCard | unit | `npx vitest run src/components/panel/ServiceCard.test.tsx` | Yes (existing, needs new provider test cases) |
| NPROV-05 | NoCredentials / TemporarilyUnavailable states render correctly for new providers | unit | `npx vitest run src/components/panel/ServiceCard.test.tsx` | Yes (existing status variants already tested) |

### Sampling Rate
- **Per task commit:** `cargo test --lib && npx vitest run`
- **Per wave merge:** Full suite
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src-tauri/src/kimi/mod.rs` tests -- response parsing, credential chain, error mapping
- [ ] `src-tauri/src/glm/mod.rs` tests -- response parsing, credential chain, error mapping
- [ ] `src/lib/tauri/registry.test.ts` -- add assertions for new provider entries
- [ ] `src-tauri/src/registry.rs` tests -- add assertions for new provider entries

## Sources

### Primary (HIGH confidence)
- opencode-bar KimiProvider.swift (GitHub: opgginc/opencode-bar) -- Full Kimi API implementation with endpoint, auth, response structure
- opencode-glm-quota (GitHub: guyinwonder168/opencode-glm-quota) -- Full GLM API implementation with 3 endpoints, auth header format, response parsing
- Kimi Code CLI docs (moonshotai.github.io/kimi-cli) -- Config file paths: `~/.kimi/config.toml`, TOML structure, provider key format

### Secondary (MEDIUM confidence)
- Kimi Code membership docs (kimi.com/code/docs/en) -- Console URL, /login flow, 30-day session expiry
- Z.ai developer docs (docs.z.ai) -- Platform overview, subscription tiers

### Tertiary (LOW confidence)
- WebSearch results on quota structures and pricing -- general context only, not relied on for implementation details

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new dependencies beyond optional `toml` crate
- Architecture: HIGH -- follows established patterns exactly; Phase 1+2 were designed for this
- API specifications: HIGH -- verified by multiple independent open-source implementations
- Pitfalls: MEDIUM -- based on analysis of API response formats; edge cases may emerge during implementation
- Credential discovery: MEDIUM -- Kimi config path confirmed by official docs; GLM credential sources less documented

**Research date:** 2026-03-31
**Valid until:** 2026-04-30 (APIs appear stable; both have active third-party consumers)
