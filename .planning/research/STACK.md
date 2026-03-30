# Technology Stack — Provider Architecture Milestone

**Project:** ai-usage v2 Provider Architecture & Smart Alerts
**Researched:** 2026-03-31
**Scope:** Additions only — does not re-document the existing Tauri 2 / React 19 / Rust stack

---

## Summary Verdict

No new runtime dependencies are needed for the Provider Registry, Fetch Pipeline,
Burn Rate forecasting, or the About page. All five features can be built entirely
within the existing Rust + TypeScript stack. The one area of genuine uncertainty
is the Kimi Code and GLM Coding Plan quota APIs — both are underdocumented in
English and may require reverse-engineering or community investigation before
provider implementation can begin.

---

## 1. Provider Registry — Rust Side

### Recommended Pattern: Concrete Struct Dispatch, Not `dyn Trait`

**Why not `dyn Trait`:** The existing codebase is entirely synchronous (no Tokio,
no `async fn`). A `Box<dyn ProviderFetcher>` with object-safe methods would be
idiomatic Rust for a dynamic plugin system, but it adds vtable overhead and
lifetime complexity for no practical gain when the provider set is compile-time
fixed (currently 4 providers, not user-installed plugins).

**Recommended approach:** A `ProviderDescriptor` struct (data, not behavior) plus
a centralized `PROVIDER_REGISTRY` array of static `ProviderDescriptor` values.
Per-provider fetch logic lives in dedicated modules (`codex`, `claude_code`,
`kimi_code`, `glm_coding`) and is dispatched via a `match provider_id` in the
command handler. This mirrors CodexBar's approach (a static enum with a descriptor
per member) and avoids dynamic dispatch.

```rust
// src-tauri/src/providers/registry.rs
pub struct ProviderDescriptor {
    pub id: &'static str,             // "codex", "claude-code", "kimi-code", "glm-coding"
    pub display_name: &'static str,
    pub icon_key: &'static str,
    pub dashboard_url: &'static str,
    pub supports_activity_signals: bool,
    pub default_enabled: bool,
}

pub const REGISTRY: &[ProviderDescriptor] = &[
    ProviderDescriptor { id: "codex", display_name: "Codex", ... },
    ProviderDescriptor { id: "claude-code", display_name: "Claude Code", ... },
    ProviderDescriptor { id: "kimi-code", display_name: "Kimi Code", ... },
    ProviderDescriptor { id: "glm-coding", display_name: "GLM Coding", ... },
];
```

**Replaces:** The hardcoded `KNOWN_SERVICE_IDS: [&str; 2]` in `state/mod.rs`,
`SERVICE_IDS` in `summary.ts`, and `SUPPORTED_SERVICES` in `agent_activity/mod.rs`.
All three must be updated to derive from the registry (Rust reads REGISTRY; TypeScript
uses a generated or mirrored constant).

**Confidence:** HIGH — this pattern exactly matches the current module structure
and requires no new crates.

---

### TypeScript Mirror: Interface + Registry Constant

The frontend currently hardcodes service IDs in `summary.ts` and `contracts.ts`.
Replace with a typed registry constant derived from the Rust-side IDs at the IPC
contract layer:

```typescript
// src/lib/tauri/providerRegistry.ts
export interface ProviderMeta {
  id: string;
  displayName: string;
  iconKey: string;
  dashboardUrl: string;
  defaultEnabled: boolean;
}

export const PROVIDER_REGISTRY: readonly ProviderMeta[] = [
  { id: "codex",       displayName: "Codex",       iconKey: "codex",       dashboardUrl: "https://openai.com/codex",         defaultEnabled: true },
  { id: "claude-code", displayName: "Claude Code", iconKey: "claude-code", dashboardUrl: "https://claude.ai",                defaultEnabled: false },
  { id: "kimi-code",   displayName: "Kimi Code",   iconKey: "kimi-code",   dashboardUrl: "https://kimi.moonshot.cn",          defaultEnabled: false },
  { id: "glm-coding",  displayName: "GLM Coding",  iconKey: "glm-coding",  dashboardUrl: "https://open.bigmodel.cn",          defaultEnabled: false },
] as const;

export const PROVIDER_IDS = PROVIDER_REGISTRY.map(p => p.id) as string[];
```

The TypeScript `MenubarService` union type and `serviceOrder` validation in
`normalizePreferences` must both be updated to accept provider IDs from this
registry rather than a literal union.

**Confidence:** HIGH — mirrors Rust structure exactly, no new npm packages needed.

---

## 2. Multi-Strategy Fetch Pipeline — Rust Side

### Recommended Pattern: Strategy Array with Early Return

The existing Claude Code module already implements a three-stage credential chain:

```rust
fn read_oauth_token() -> Option<(String, String)> {
    read_token_from_env()
        .or_else(read_token_from_keychain)
        .or_else(read_token_from_file)
}
```

Generalize this into a reusable `FetchPipeline` abstraction by extracting the
pattern into a shared type in a new `src-tauri/src/providers/pipeline.rs` module:

```rust
// A fetch strategy is a function that returns Some(credential) or None.
// The pipeline tries each in order and stops at first success.
pub type CredentialStrategy = fn() -> Option<(String, String)>;

pub fn run_pipeline(strategies: &[CredentialStrategy]) -> Option<(String, String)> {
    for strategy in strategies {
        if let Some(result) = strategy() {
            return Some(result);
        }
    }
    None
}
```

For providers needing HTTP (Kimi Code, GLM Coding), the credential strategy
returns the API key/token; the actual HTTP fetch stays in the provider module.
The pipeline only resolves credentials; error handling and stale cache live
in each provider's `load_snapshot()` function (as they do today for Claude Code).

**Do not** generalize `load_snapshot()` into a trait method. The stale cache
logic, `PauseState` handling, and proxy resolution differ enough per provider
that a trait abstraction would either be leaky (exposing internal types) or
require duplicating the same pattern. Keep `load_snapshot` as a free function
per provider module.

**Confidence:** HIGH — this is a pure refactor of the existing pattern.

---

## 3. Burn Rate / Pace Forecasting — TypeScript (Frontend Only)

### Recommended: Pure frontend computation, no new libraries

Burn rate requires only three inputs already present in every `QuotaDimension`:
- `remainingPercent` (current state)
- `resetHint` (reset timestamp string, already returned by both providers)
- The previous snapshot's `remainingPercent` (stored in snapshot cache)

CodexBar's `UsagePace` module classifies rate into 7 buckets. For this codebase,
a simpler 3-bucket classification (on-track, ahead-of-pace, behind-pace) is
sufficient for the first version and maps cleanly to the existing
`QuotaProgressTone` values.

**Formula (frontend, in `summary.ts` or a new `burnRate.ts`):**

```typescript
// consumed = 100 - remainingPercent
// elapsed  = now - windowStartAt (derived from resetsAt and window duration)
// pace     = consumed / elapsed (% per hour)
// etaHours = remainingPercent / pace
export function computeBurnRate(
  remainingPercent: number,
  windowDurationHours: number,
  elapsedHours: number
): { pace: "on-track" | "ahead" | "behind"; etaHours: number | null } { ... }
```

The window duration (5h for Codex, 7-day for Claude Code) is already embedded
in the `label` field of each `QuotaDimension`. It must be made explicit in the
`QuotaDimension` contract (add `windowDurationHours?: number` to the Rust struct
and TypeScript interface) for burn rate to compute correctly.

**No new npm packages.** The built-in `Date` and `Intl` APIs are sufficient.
`chrono` (already in Cargo.toml) handles any Rust-side timestamp math if needed.

**Confidence:** HIGH — all inputs are available. LOW confidence on window duration
availability until `QuotaDimension` schema is extended.

---

## 4. Time-Aware Warning Thresholds — TypeScript (Frontend Only)

### Recommended: Replace `summary.ts` threshold logic with time-adjusted computation

Current logic in `src/lib/tauri/summary.ts`:
```
>50% remaining → success (green)
20–50%         → warning (amber)
<20%           → danger (red)
```

Time-aware logic computes "expected remaining percent" based on elapsed fraction
of the window and compares actual vs. expected:

```typescript
// expectedRemaining = 1.0 - (elapsedFraction)
// actualRemaining   = remainingPercent / 100
// ratio             = actualRemaining / expectedRemaining
// ratio > 1.2  → under-consuming (safe, green)
// ratio 0.8–1.2 → on-track (green)
// ratio 0.5–0.8 → warning (amber)
// ratio < 0.5  → danger (red)
// Special case: <4h to reset + <10% remaining → always danger
```

This replaces the three hard-coded constants in `summary.ts` with a single
function. The same `QuotaDimension.windowDurationHours` extension required for
burn rate also enables this computation.

**No new libraries.** Same `Date` / `Intl` approach as burn rate.

**Confidence:** HIGH for the pattern. LOW for exact threshold calibration — this
needs real usage data to tune.

---

## 5. About Page — Frontend Only

### Recommended: Static page with license metadata embedded at build time

The About page needs:
- App version (from `tauri.conf.json` → `package.version`, already accessible via `@tauri-apps/api/app`)
- GitHub URL (static string)
- Dependency license list (generated at build time)

**For version:** Use `@tauri-apps/api/app` — `getVersion()` is already available
in the existing `@tauri-apps/api` 2.0.0 dependency. No new package needed.

**For license audit (Rust crates):** Use `cargo-deny` for policy enforcement and
`cargo-license` for generating the license manifest.

```bash
# License policy enforcement (CI)
cargo install cargo-deny
cargo deny check licenses

# License manifest generation (build step)
cargo install cargo-license
cargo license --json > licenses-rust.json
```

**For license audit (npm packages):** Use `license-checker-rseidelsohn`
(maintained fork of `license-checker`, MIT license, no runtime dep):

```bash
npm install -D license-checker-rseidelsohn
npx license-checker-rseidelsohn --production --json > licenses-npm.json
```

**Embedding in the app:** Run both license commands as a pre-build script; embed
the JSON output as a static asset (`public/licenses.json`) consumed at runtime
by the About page component. This avoids shipping a build tool as a runtime
dependency.

**Important: license-checker-rseidelsohn version as of 2026-03 is 4.x** (check
`npm show license-checker-rseidelsohn version` before pinning — training data
confidence is MEDIUM; version 4.x has been stable since 2023).

**cargo-deny version:** 0.14.x (MEDIUM confidence — verify with `cargo search cargo-deny`).
**cargo-license version:** 0.6.x (MEDIUM confidence — verify with `cargo search cargo-license`).

These are dev-time tools only. They produce static output; the runtime About
page only reads the pre-generated JSON.

---

## 6. Kimi Code Provider Integration

### API Investigation

**Confidence: LOW — no verified official documentation accessible.**

Kimi Code is the VS Code extension product from Moonshot AI (Beijing). The
company's public API platform is `platform.moonshot.cn`. As of training data
(August 2025), Moonshot AI exposes:

- **Base URL:** `https://api.moonshot.cn/v1`
- **Auth:** Bearer token via API key from `https://platform.moonshot.cn/console/api-keys`
- **Known endpoints:** `/v1/models`, `/v1/chat/completions` (standard OpenAI-compatible)
- **Balance/quota endpoint:** `https://api.moonshot.cn/v1/users/me/balance` — returns
  `{ cash_balance, bonus_balance, voucher_balance }` in CNY, **not** a usage quota
  in the style of Claude Code's `remainingPercent`

**Critical gap:** The VS Code extension "Kimi Code" may use a separate internal
API endpoint that exposes subscription quota (e.g., requests remaining in plan
period), not just API credit balance. This endpoint is **not documented** in the
public Moonshot developer platform as of training data.

**Investigation path required before implementation:**
1. Inspect Kimi Code VS Code extension network traffic (Chrome DevTools or
   Proxyman/Charles on the extension host) to identify the actual quota endpoint
2. Check if a `~/.kimi` or `~/.moonshot` credentials directory exists after
   installing the extension (for a credential source analogous to `~/.claude`)
3. Search Kimi Code GitHub issues or community forums (Discord/WeChat group) for
   any community-documented API

**Provisional strategy (subject to investigation):**
- Credential source: API key from env var `KIMI_API_KEY`, falling back to a
  `~/.kimi/config.json` or VS Code extension settings SQLite/JSON file
- Fetch strategy: HTTP GET to balance endpoint; map credit balance to a synthetic
  `remainingPercent` if subscription quota endpoint is unavailable
- Fallback: Show `NoData` status with a link to the platform dashboard if the
  actual quota metric cannot be determined

**Do not block roadmap on Kimi Code API research.** Scaffold the provider module
with stub implementation; fill in the real endpoint after investigation.

---

## 7. GLM Coding Plan Provider Integration

### API Investigation

**Confidence: LOW — endpoint details not verified from official docs.**

GLM Coding Plan is the code-completion plan offered by Zhipu AI through their
BigModel platform (`open.bigmodel.cn`). As of training data (August 2025):

- **Base URL:** `https://open.bigmodel.cn/api/paas/v4`
- **Auth:** JWT token derived from API key, OR direct API key as Bearer token
  (BigModel platform supports both; the API key format is `{id}.{secret}`)
- **Known endpoints:** Standard chat/completion (`/chat/completions`),
  model list, embeddings
- **Balance endpoint:** `https://open.bigmodel.cn/api/paas/v4/billing/usage` or
  `/billing/balance` — returns available credit, **not** a plan quota counter

**Critical gap:** The "Coding Plan" (编程计划) product is a subscription tier
within BigModel that provides a fixed monthly allocation of code model calls.
The specific API endpoint that exposes remaining calls within the current plan
period is **not publicly documented** in the English developer docs.

**Investigation path required before implementation:**
1. Inspect network traffic from the official BigModel web console
   (`https://open.bigmodel.cn/console`) when the "编程计划" usage page is open
2. Check for a VS Code extension configuration directory (`~/.glm` or inside
   `~/.config/Code/User/globalStorage/zhipuai.*`)
3. Review Chinese-language developer community sources (Zhihu, SegmentFault,
   official Feishu/WeChat group) for any documented internal endpoint

**Provisional strategy (subject to investigation):**
- Credential source: API key from env var `BIGMODEL_API_KEY`, falling back to
  VS Code extension storage or `~/.config/bigmodel/config.json`
- Auth method: Use API key directly as Bearer token (simpler than JWT derivation
  for a read-only quota check)
- Fetch strategy: HTTP GET to billing/balance endpoint; present credit balance
  as a proxy metric if plan quota endpoint is unavailable
- Fallback: `NoData` status with dashboard link

**Do not block roadmap on GLM API research.** Same stub approach as Kimi Code.

---

## 8. HTTP Client for New Providers

### Recommended: Reuse existing `ureq` 2.x

Both Kimi Code and GLM Coding Plan use standard REST APIs with Bearer token
auth over HTTPS. The existing `ureq` setup in `claude_code/mod.rs` covers:
- Bearer token injection in headers
- System proxy auto-detection (`scutil --proxy` fallback)
- JSON response parsing via `serde_json`
- Timeout handling
- Error mapping to `SnapshotStatus` variants

**No new HTTP crate needed.** Copy the `resolve_proxy` + `call_*_api` pattern
from `claude_code/mod.rs` into each new provider module. The proxy resolution
code should be extracted to `src-tauri/src/providers/http.rs` (shared utility)
to avoid duplication across 4 provider modules.

**Confidence:** HIGH — ureq 2.x is already proven for this use case.

---

## 9. What NOT to Add

| Temptation | Why to avoid |
|------------|-------------|
| `reqwest` + `tokio` | Async runtime is heavyweight; ureq synchronous model works fine for background polling; adding Tokio would require restructuring all command handlers |
| `axum` or any HTTP server | App is a read-only consumer of APIs; no inbound server needed |
| `dyn ProviderFetcher` trait objects | Adds vtable, lifetime complexity with no benefit for a compile-time fixed provider set |
| Third-party date libraries (e.g., `time` crate) | `chrono` already in Cargo.toml; no reason to add a second date library |
| `keyring` crate | macOS Keychain is already accessed via `security` CLI subprocess; adding a Rust crate abstraction would change tested behavior |
| Any state management library (Redux, Zustand) | React Context already in use; adding another state management layer would split state across two systems |
| New storage layer | PROJECT.md constraint: continue using preferences.json + snapshot-cache.json only |

---

## 10. Dependency Risk Assessment

| Dependency | Current Version | Risk | Mitigation |
|------------|----------------|------|------------|
| `ureq` | 2.x | MEDIUM — no connection pooling, no HTTP/2 | Acceptable for polling intervals >1min; would need `reqwest` at <10s intervals |
| `rusqlite` | 0.32 (bundled) | LOW — read-only, bundled SQLite | Schema change in Codex/Claude would break reader; version-detect defensively |
| `chrono` | 0.4 | LOW — stable, widely used | Could replace with `time` crate for lighter build, not worth the disruption |
| `license-checker-rseidelsohn` | 4.x | LOW | Dev-only tool, not shipped in app binary |
| `cargo-deny` | 0.14.x | LOW | Dev-only CI tool |

---

## 11. Confidence Summary

| Area | Confidence | Reason |
|------|------------|--------|
| Provider Registry pattern (Rust) | HIGH | Direct extension of existing module structure; no new crates |
| Provider Registry pattern (TypeScript) | HIGH | Trivial refactor of existing constant; no new npm packages |
| Fetch Pipeline abstraction | HIGH | Existing `or_else` chain is already the pattern |
| Burn rate / forecasting | HIGH (pattern), LOW (window duration availability) | Math is clear; needs schema extension verified |
| Time-aware thresholds | HIGH (pattern) | Replaces existing constant in `summary.ts` |
| About page + version | HIGH | `@tauri-apps/api` already present; `getVersion()` is documented |
| License audit tooling | MEDIUM | `cargo-deny`, `cargo-license`, `license-checker-rseidelsohn` versions need verification |
| Kimi Code quota API | LOW | No official public documentation found; network inspection required |
| GLM Coding Plan quota API | LOW | No official public documentation found; network inspection required |

---

## Sources

- Codebase direct inspection: `src-tauri/src/claude_code/mod.rs` (credential chain, proxy, HTTP)
- Codebase direct inspection: `src-tauri/src/snapshot.rs` (ServiceSnapshot, SnapshotStatus)
- Codebase direct inspection: `src-tauri/src/state/mod.rs` (KNOWN_SERVICE_IDS hardcoding)
- `.planning/codebase/CONCERNS.md` — service ID hardcoding concern, ureq connection pooling risk
- `.planning/codebase/INTEGRATIONS.md` — API endpoint details, credential priority
- `.planning/research/codexbar-analysis.md` — ProviderDescriptor pattern reference
- Training data (LOW confidence): Moonshot AI API structure, BigModel API structure
- Versions: Rust crates confirmed from `src-tauri/Cargo.toml`; npm versions from `package.json`
- `cargo-deny` and `cargo-license` versions: MEDIUM confidence (training data, verify before use)
- `license-checker-rseidelsohn` version: MEDIUM confidence (training data, verify before use)

---

*Research complete: 2026-03-31*
