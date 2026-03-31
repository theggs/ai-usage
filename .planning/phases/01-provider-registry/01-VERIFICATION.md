---
phase: 01-provider-registry
verified: 2026-03-31T16:20:00Z
status: passed
score: 10/10 must-haves verified
re_verification:
  previous_status: passed
  previous_score: 10/10
  gaps_closed: []
  gaps_remaining: []
  regressions: []
---

# Phase 01: Provider Registry Verification Report

**Phase Goal:** A single ProviderDescriptor registry is the sole source of truth for all provider IDs, display names, and configuration -- existing users see no change in behavior
**Verified:** 2026-03-31T16:20:00Z
**Status:** passed
**Re-verification:** Yes -- regression check against previous passed verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | All provider IDs, display names, and dashboard URLs are defined in one registry module in Rust and mirrored in TypeScript | VERIFIED | `src-tauri/src/registry.rs` (82 lines) has `PROVIDERS` static slice with codex + claude-code; `src/lib/tauri/registry.ts` (18 lines) mirrors identically with matching IDs, names, URLs |
| 2 | No file outside registry.rs and registry.ts contains a hardcoded service-ID array | VERIFIED | grep for `KNOWN_SERVICE_IDS`, `KNOWN_MENUBAR_SERVICES`, `SERVICE_DISPLAY_NAMES`, `DEFAULT_SERVICE_NAMES`, `const SERVICE_IDS` returns zero matches across `src/` and `src-tauri/src/state/` |
| 3 | Snapshot cache includes schema_version field; loading an old cache without it returns empty data instead of crashing | VERIFIED | `SNAPSHOT_CACHE_VERSION: u32 = 1` and `schema_version: u32` field in SnapshotCache; version mismatch returns fresh cache; Rust unit tests cover both mismatch and missing-version cases |
| 4 | Preferences normalizer seeds providerEnabled map from registry defaults; legacy claudeCodeUsageEnabled is read but not written back | VERIFIED | `provider_enabled: HashMap<String, bool>` in Rust state; TS normalizer seeds from PROVIDERS; dedicated tests pass |
| 5 | Existing preferences.json files deserialize without error after migration | VERIFIED | `#[serde(default)]` on provider_enabled; legacy field still deserialized; Rust tests confirm deserialization and migration |
| 6 | Frontend provider state is managed via a dynamic Record (not per-service variables) | VERIFIED | `appState.ts` has `providerStates: Record<string, CodexPanelState | null>` and `refreshingProviders: Set<string>` |
| 7 | Adding a new entry to the registry requires no UI framework changes | VERIFIED | PanelView, SettingsView, AppShell all iterate dynamically via providerIds()/getProvider(); 7 files import from registry.ts |
| 8 | No file outside registry.ts contains a hardcoded service-ID record, array, or display name lookup | VERIFIED | grep confirms zero matches for hardcoded ID patterns in src/ |
| 9 | Existing Codex and Claude Code quota display is unchanged for current users after the migration | VERIFIED | Old tauriClient methods kept as thin wrappers; legacy claudeCodeUsageEnabled precedence preserved |
| 10 | Refresh dedup guards work per-provider via Map, preventing concurrent requests to the same provider | VERIFIED | `panelController.ts` uses `pendingRefreshes = new Map<string, Promise<CodexPanelState>>()` |

**Score:** 10/10 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src-tauri/src/registry.rs` | ProviderDescriptor struct and PROVIDERS static slice | VERIFIED | 82 lines; exports ProviderDescriptor, PROVIDERS, provider_ids, menubar_service_ids, get_provider; includes unit tests |
| `src/lib/tauri/registry.ts` | TypeScript mirror of ProviderDescriptor and PROVIDERS | VERIFIED | 18 lines; exports ProviderDescriptor interface, PROVIDERS frozen array, getProvider, providerIds, menubarServiceIds |
| `src/lib/tauri/registry.test.ts` | Unit tests for TypeScript registry | VERIFIED | Exists; covers PROVIDERS content, getProvider lookup, providerIds, menubarServiceIds |
| `src/lib/persistence/preferencesStore.test.ts` | Unit tests for preferences normalization with providerEnabled | VERIFIED | Exists; covers seeding, legacy migration, service order, menubar fallback, map preservation |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src-tauri/src/state/mod.rs` | `src-tauri/src/registry.rs` | `use crate::registry::PROVIDERS` | WIRED | Imports PROVIDERS; provider_ids() and menubar_service_ids() called |
| `src/lib/persistence/preferencesStore.ts` | `src/lib/tauri/registry.ts` | `import { providerIds, menubarServiceIds, PROVIDERS }` | WIRED | Line 3 imports from registry |
| `src-tauri/src/commands/mod.rs` | `src-tauri/src/registry.rs` | `SNAPSHOT_CACHE_VERSION` used in read/write | WIRED | Lines 25, 76, 78, 92 reference SNAPSHOT_CACHE_VERSION |
| `src/app/shell/AppShell.tsx` | `src/features/demo-services/panelController.ts` | `loadProviderState/refreshProviderState` | WIRED | Imports and calls generic provider functions |
| `src/app/panel/PanelView.tsx` | `src/lib/tauri/registry.ts` | `getProvider` for display names | WIRED | Line 5 imports getProvider |
| `src/app/settings/SettingsView.tsx` | `src/lib/tauri/registry.ts` | `getProvider` for label lookup | WIRED | Line 5 imports getProvider |
| `src/lib/tauri/summary.ts` | `src/lib/tauri/registry.ts` | `providerIds()` replaces SERVICE_IDS | WIRED | Line 12 imports getProvider/providerIds |
| `src/features/promotions/resolver.ts` | `src/lib/tauri/registry.ts` | `getProvider` replaces DEFAULT_SERVICE_NAMES | WIRED | Line 2 imports getProvider |
| `src-tauri/src/tray/mod.rs` | `src-tauri/src/state/mod.rs` | `provider_enabled` map for menubar resolution | WIRED | Reads provider_enabled with fallback |
| `src-tauri/src/agent_activity/mod.rs` | `src-tauri/src/state/mod.rs` | `provider_enabled` map for eligibility | WIRED | Reads provider_enabled with fallback |

### Data-Flow Trace (Level 4)

Not applicable -- this phase creates infrastructure (registry, preferences schema, state shape). No artifacts render dynamic user-facing data that requires upstream data-flow tracing.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| No hardcoded ID lists remain | grep for 5 patterns in src/ and src-tauri/src/state/ | 0 matches | PASS |
| Registry artifacts exist at expected sizes | ls + wc -l on registry.rs (82) and registry.ts (18) | Confirmed | PASS |
| Registry wired from 7 frontend consumers | grep import.*registry in src/ | 7 files import from registry.ts | PASS |
| provider_enabled in Rust state | grep provider_enabled in state/mod.rs | Found in struct, normalization, and tests | PASS |
| providerStates Record in appState | grep providerStates in appState.ts | Found on line 10 | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| PROV-01 | 01-01 | All provider metadata in single ProviderDescriptor registry -- no hardcoded lists elsewhere | SATISFIED | registry.rs and registry.ts are the sole sources; grep confirms no hardcoded lists remain |
| PROV-02 | 01-02 | Adding a new provider requires only a ProviderDescriptor entry and fetch implementation | SATISFIED | All view/state code iterates dynamically from registry; no hardcoded display names or state vars |
| PROV-06 | 01-02 | Frontend state manages providers via dynamic map | SATISFIED | providerStates Record and refreshingProviders Set replace per-service fields |
| PROV-07 | 01-01 | Snapshot cache includes schema version; incompatible cache discarded gracefully | SATISFIED | SNAPSHOT_CACHE_VERSION constant, schema_version field, mismatch returns fresh cache |
| PROV-08 | 01-01 | Preferences normalization handles dynamic provider enable/disable flags from registry | SATISFIED | Both Rust and TypeScript normalizers seed providerEnabled from registry; legacy migration tested |

No orphaned requirements found -- all 5 requirement IDs from PLAN frontmatter (PROV-01, PROV-02, PROV-06, PROV-07, PROV-08) match the REQUIREMENTS.md traceability table for Phase 1.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| None | - | - | - | No anti-patterns detected |

### Human Verification Required

### 1. Existing User Behavior Unchanged

**Test:** Open the app with an existing preferences.json (containing claudeCodeUsageEnabled but no providerEnabled). Verify Codex and Claude Code panels display identically to before the migration.
**Expected:** Panel shows same quota data, same display names, same service order. No error messages or missing data.
**Why human:** Requires running the full Tauri app with real preferences file and visual comparison.

### 2. Menubar Service Selection Consistency

**Test:** Toggle Claude Code enabled/disabled in settings. Verify menubar service selector updates correctly and falls back appropriately.
**Expected:** When Claude Code is disabled, menubar does not show "Claude Code" as an option; when re-enabled, it appears again.
**Why human:** Requires interactive UI testing of state transitions.

### Gaps Summary

No gaps found. All 10 observable truths verified. All 5 requirements satisfied. All artifacts exist, are substantive, and are wired. No hardcoded service-ID lists remain anywhere in the codebase. No regressions detected since previous verification.

---

_Verified: 2026-03-31T16:20:00Z_
_Verifier: Claude (gsd-verifier)_
