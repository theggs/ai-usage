---
phase: 03-new-providers
verified: 2026-04-01T17:05:00Z
status: passed
score: 14/14 must-haves verified
re_verification:
  previous_status: passed
  previous_score: 14/14
  gaps_closed: []
  gaps_remaining: []
  regressions: []
---

# Phase 03: New Providers Verification Report

**Phase Goal:** Kimi Code and GLM Coding Plan appear in the panel and can be reordered alongside existing providers; providers with unconfirmed APIs show a clear "not available" state rather than a blank panel
**Verified:** 2026-04-01T17:05:00Z
**Status:** passed
**Re-verification:** Yes -- independent re-verification confirming previous passed result

## Goal Achievement

### Observable Truths

Truths sourced from Plan 01 (infrastructure), Plan 02 (HTTP fetch), Plan 03 (i18n gap closure), and Plan 04 (capsule overflow + token refresh gap closure).

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Kimi Code and GLM Coding Plan appear as registered providers in the system | VERIFIED | `src-tauri/src/registry.rs` has 4 ProviderDescriptor entries (codex, claude-code, kimi-code, glm-coding) at lines 14-32; `src/lib/tauri/registry.ts` mirrors with 4 entries at lines 9-12 |
| 2 | New providers appear in service order settings and can be reordered | VERIFIED | `SettingsView.tsx` renders enable/disable toggle cards for kimi-code and glm-coding; `flex-wrap` at line 496 allows capsules to wrap; registry-driven service order includes all 4 providers |
| 3 | Provider tokens can be stored and retrieved via preferences | VERIFIED | Rust: `provider_tokens: HashMap<String, String>` at state/mod.rs:199; TS: `providerTokens: Record<string, string>` at contracts.ts:88; Settings UI has password inputs for both providers |
| 4 | Token whitespace is trimmed on save in both Rust and TypeScript normalizers | VERIFIED | Rust: `v.trim().to_string()` at state/mod.rs:339; TS: `.trim()` + blank check at preferencesStore.ts:121-122 |
| 5 | resolve_proxy is a shared module usable by all providers | VERIFIED | `src-tauri/src/proxy.rs` (376 lines) exports `resolve_proxy` (line 233), `build_agent` (line 270), `ProxyDecision`, `ProxyResolutionError`; imported by claude_code (line 59), kimi (line 263), and glm (line 271) |
| 6 | Stub fetchers replaced with real implementations delegating to load_snapshot | VERIFIED | `pipeline/kimi.rs` line 17: `crate::kimi::load_snapshot(preferences)`; `pipeline/glm.rs` line 17: `crate::glm::load_snapshot(preferences)`; no TODO/stub comments remain |
| 7 | Kimi Code quota data displays in the panel when a valid token is configured | VERIFIED | `kimi::load_snapshot` makes GET to `api.kimi.com/coding/v1/usages` (line 275) with Bearer auth, parses into QuotaDimension array via `map_kimi_response`; 26 unit tests pass |
| 8 | GLM Coding Plan quota data displays in the panel when a valid token is configured | VERIFIED | `glm::load_snapshot` makes GET to platform-specific endpoint (line 282) with raw token auth, parses via `decode_glm_response` + `map_glm_response`; 32 unit tests pass |
| 9 | GLM percentage is correctly inverted from usage to remaining | VERIFIED | `let usage_pct = pct.clamp(0.0, 100.0); Some((100.0 - usage_pct).round() as u8)` at glm/mod.rs:157-158 |
| 10 | Kimi numeric strings are parsed to integers without error | VERIFIED | `parse_numeric_string` helper at line 95; tested for valid, empty, whitespace, and unparseable inputs |
| 11 | GLM polymorphic number fields deserialize correctly | VERIFIED | `deserialize_flexible_f64` and `deserialize_flexible_i64` handle Number, String, and Null JSON; tested with int/float/string variants |
| 12 | Missing or invalid tokens produce NoCredentials status | VERIFIED | Both providers return `SnapshotStatus::NoCredentials` when no token found (kimi:256, glm:264); token-based providers show "Token not configured" copy via i18n routing at i18n.ts:623-624; Claude Code still gets its CLI-specific message at line 626 |
| 13 | API errors produce appropriate SnapshotStatus variants | VERIFIED | Both providers map: 401/403 to AccessDenied, 429 to RateLimited, 5xx to TemporarilyUnavailable, proxy errors to ProxyInvalid; tested exhaustively in unit tests |
| 14 | Percentage values are clamped to 0..100 for both providers | VERIFIED | Kimi: `.min(100)` at lines 111, 133; GLM: `.clamp(0.0, 100.0)` before inversion at line 157 |

**Score:** 14/14 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src-tauri/src/proxy.rs` | Shared proxy resolution module | VERIFIED | 376 lines; exports resolve_proxy (line 233), build_agent (line 270) |
| `src-tauri/src/registry.rs` | Registry with 4 providers | VERIFIED | 108 lines; 4 ProviderDescriptor entries with 7 tests |
| `src/lib/tauri/registry.ts` | Frontend registry mirror with 4 providers | VERIFIED | 20 lines; 4 entries matching Rust registry |
| `src-tauri/src/state/mod.rs` | UserPreferences with provider_tokens and glm_platform | VERIFIED | Both fields at lines 199-201 with serde defaults, normalization at lines 336-345 |
| `src-tauri/src/kimi/mod.rs` | Kimi Code credential chain + HTTP fetch + response parsing | VERIFIED | 671 lines (min 150 required); exports load_snapshot at line 251; 26 unit tests |
| `src-tauri/src/glm/mod.rs` | GLM Coding Plan credential chain + HTTP fetch + response parsing | VERIFIED | 798 lines (min 200 required); exports load_snapshot at line 259; 32 unit tests |
| `src-tauri/src/pipeline/kimi.rs` | KimiFetcher delegating to kimi::load_snapshot | VERIFIED | 19 lines; delegates at line 17 |
| `src-tauri/src/pipeline/glm.rs` | GlmFetcher delegating to glm::load_snapshot | VERIFIED | 19 lines; delegates at line 17 |
| `src/lib/tauri/contracts.ts` | providerTokens and glmPlatform in interfaces | VERIFIED | UserPreferences (lines 88-89) and PreferencePatch (lines 106-107) |
| `src/lib/persistence/preferencesStore.ts` | Token trimming and glmPlatform normalization | VERIFIED | Trims tokens (line 121), removes blanks, validates glmPlatform |
| `src/app/settings/SettingsView.tsx` | Token inputs, GLM region selector, flex-wrap capsules | VERIFIED | Password inputs for both providers; capsule container uses flex-wrap (line 496) and px-2.5 spacing (line 376) |
| `src/app/shared/i18n.ts` | Provider-aware getPlaceholderCopy with generic token-based copy keys | VERIFIED | tokenNotConfiguredTitle at line 129/307/486; getPlaceholderCopy accepts serviceId (line 615); routing at line 623 |
| `src/app/panel/PanelView.tsx` | Generic refreshing copy for non-Claude-Code providers | VERIFIED | Passes serviceId to getPlaceholderCopy at line 150 |
| `src/app/shell/AppShell.tsx` | Token-change-aware auto-refresh in savePreferences | VERIFIED | tokenChanged detection at line 285; triggers refresh at line 288 |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| proxy.rs | claude_code/mod.rs | `use crate::proxy::{self, ProxyDecision, ProxyResolutionError}` | WIRED | Line 59 of claude_code/mod.rs |
| pipeline/mod.rs | pipeline/kimi.rs | `pub mod kimi` + `Box::new(kimi::KimiFetcher)` | WIRED | Lines 8, 55 of pipeline/mod.rs |
| pipeline/mod.rs | pipeline/glm.rs | `pub mod glm` + `Box::new(glm::GlmFetcher)` | WIRED | Lines 7, 56 of pipeline/mod.rs |
| pipeline/kimi.rs | kimi/mod.rs | `crate::kimi::load_snapshot(preferences)` | WIRED | Line 17 of pipeline/kimi.rs |
| pipeline/glm.rs | glm/mod.rs | `crate::glm::load_snapshot(preferences)` | WIRED | Line 17 of pipeline/glm.rs |
| kimi/mod.rs | proxy.rs | `crate::proxy::build_agent(preferences)` | WIRED | Line 263 of kimi/mod.rs |
| glm/mod.rs | proxy.rs | `crate::proxy::build_agent(preferences)` | WIRED | Line 271 of glm/mod.rs |
| lib.rs | kimi, glm, proxy | `pub mod kimi`, `pub mod glm`, `pub mod proxy` | WIRED | Lines 6, 7, 10 of lib.rs |
| PanelView.tsx | i18n.ts | `getPlaceholderCopy(copy, state.status, serviceId)` | WIRED | Line 150 of PanelView.tsx |
| i18n.ts | routing | Direct serviceId check for kimi-code, glm-coding | WIRED | Line 623 of i18n.ts |
| AppShell.tsx | refreshProviderState | `"providerTokens" in patch` triggers refresh | WIRED | Line 285 of AppShell.tsx |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|-------------------|--------|
| kimi/mod.rs | ServiceSnapshot.dimensions | HTTP GET api.kimi.com/coding/v1/usages -> parse KimiUsageResponse -> map_kimi_response() | Yes: parses JSON into QuotaDimension vec with remaining%, labels, reset hints | FLOWING |
| glm/mod.rs | ServiceSnapshot.dimensions | HTTP GET {endpoint}/api/monitor/usage/quota/limit -> decode_glm_response() -> map_glm_response() | Yes: parses JSON with envelope unwrap, inverts percentage, computes remaining_absolute | FLOWING |
| pipeline/kimi.rs | ServiceSnapshot | Delegates to crate::kimi::load_snapshot | Yes: pass-through to real implementation | FLOWING |
| pipeline/glm.rs | ServiceSnapshot | Delegates to crate::glm::load_snapshot | Yes: pass-through to real implementation | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| All 149 Rust tests pass | `cargo test --lib` | 149 passed; 0 failed | PASS |
| All 130 frontend tests pass | `npx vitest run` | 130 passed in 18 test files | PASS |
| Clippy clean for new modules | `cargo clippy --lib` | 5 pre-existing warnings (claude_code, tray, lib); 0 from kimi/glm/proxy/registry/pipeline | PASS |
| No anti-patterns in new code | grep TODO/FIXME/stub/placeholder in all new files | 0 matches | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| NPROV-01 | 03-02, 03-03, 03-04 | Kimi Code provider displays quota/usage data in the panel | SATISFIED | kimi::load_snapshot returns ServiceSnapshot with QuotaDimension items; pipeline dispatches via KimiFetcher; generic IPC commands serve to frontend; ServiceCard renders; token-change triggers auto-refresh |
| NPROV-02 | 03-02, 03-03, 03-04 | GLM Coding Plan provider displays quota/usage data in the panel | SATISFIED | glm::load_snapshot returns ServiceSnapshot with QuotaDimension items; same pipeline path; auto-refresh on token change |
| NPROV-03 | 03-01, 03-04 | New providers appear in the service order configuration and can be reordered | SATISFIED | Registry has 4 providers; service order derives from registry; Settings UI has toggle cards; capsule container uses flex-wrap to prevent overflow |
| NPROV-04 | 03-01, 03-02, 03-03, 03-04 | New providers use the same SnapshotStatus enum and visual treatment as existing providers | SATISFIED | Both providers return SnapshotStatus variants (Fresh, NoCredentials, AccessDenied, etc.); ServiceCard renders all providers identically via QuotaDimension |
| NPROV-05 | 03-01, 03-02, 03-03, 03-04 | If a provider's API is unreachable or undocumented, the UI shows a clear "not available" state | SATISFIED | NoCredentials shows "Token not configured" for token-based providers (i18n.ts:623-624); AccessDenied, RateLimited, TemporarilyUnavailable, ProxyInvalid all produce status-specific messages |

No orphaned requirements. All 5 NPROV requirements mapped to Phase 3 in REQUIREMENTS.md are claimed by at least one plan and verified in the codebase. All 5 are marked complete in REQUIREMENTS.md.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| None | - | - | - | No anti-patterns detected in new provider code |

All new files (kimi/mod.rs, glm/mod.rs, proxy.rs, registry.rs, pipeline/kimi.rs, pipeline/glm.rs) are clean of TODO, FIXME, placeholder, stub, and empty-return patterns.

### Human Verification Required

### 1. End-to-end Kimi Code panel display with real API token

**Test:** Enable Kimi Code in Settings, enter a valid Kimi API token, switch to panel view
**Expected:** Kimi Code section shows quota cards with Weekly and 5h Window dimensions, progress bars, remaining percentages, and reset hints
**Why human:** Requires a real Kimi Code API token and running Tauri app to verify HTTP fetch + rendering end-to-end

### 2. End-to-end GLM panel display with real API token

**Test:** Enable GLM Coding Plan in Settings, enter a valid GLM API token, select region, switch to panel view
**Expected:** GLM section shows quota cards with correct remaining percentages (inverted from usage), progress bars, and reset hints
**Why human:** Requires a real GLM API token and running Tauri app

### 3. Service reorder includes new providers

**Test:** Open Settings, reorder Kimi Code to top of service order list
**Expected:** Panel view shows Kimi Code first, then other providers in new order
**Why human:** Drag-and-drop interaction cannot be verified programmatically without running the app

### 4. Token masking and onBlur commit behavior

**Test:** Type a token in the Kimi Code token field, verify it shows as dots (password), tab out
**Expected:** Token is masked; token is committed on blur with leading/trailing whitespace trimmed
**Why human:** Visual and interaction behavior requires running UI

### 5. NoCredentials message displays correctly for new providers

**Test:** Enable Kimi Code but do not enter a token, switch to panel view
**Expected:** Panel shows "Token not configured" / "Enter your API token in Settings to connect this service." -- NOT "Install Claude Code CLI"
**Why human:** Requires running the app to see the actual rendered message in context

### 6. Token change triggers immediate auto-refresh

**Test:** Enter a token for Kimi Code in Settings, save, switch to panel view
**Expected:** Panel immediately refreshes Kimi Code state (shows refreshing indicator then result) without needing manual refresh
**Why human:** Requires running the app to observe the auto-refresh lifecycle

### Gaps Summary

No gaps found. All 14 observable truths are verified against the actual codebase across all 4 plans. All 14 required artifacts exist, are substantive (meeting or exceeding minimum line counts), and are properly wired. All 11 key links are connected. All 4 data-flow traces show real data flowing. All 5 NPROV requirements are satisfied. 149 Rust tests and 130 frontend tests pass. No anti-patterns detected in new code. No regressions from previous verification.

Follow-up item noted (not a gap): `seed_stale_cache` is not implemented for new providers. This means fast app restarts will not show stale data while refresh is in-flight for Kimi/GLM. This is a documented future enhancement, not a correctness issue.

---

_Verified: 2026-04-01T17:05:00Z_
_Verifier: Claude (gsd-verifier)_
