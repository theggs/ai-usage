---
phase: 03-new-providers
plan: 01
subsystem: infra, ui
tags: [rust, typescript, provider-registry, pipeline, proxy, i18n, preferences, tauri]

# Dependency graph
requires:
  - phase: 02-fetch-pipeline-migration
    provides: ProviderFetcher trait, pipeline/mod.rs dispatcher, generic IPC commands
provides:
  - Shared proxy module (src-tauri/src/proxy.rs) usable by all providers
  - Kimi Code and GLM Coding Plan registry entries (Rust + TypeScript)
  - Pipeline stub fetchers that return NoCredentials until Plan 02 implements real HTTP fetch
  - provider_tokens and glm_platform fields in UserPreferences (both languages)
  - Token whitespace trimming and blank removal in both normalizers
  - i18n strings (en-US + zh-CN) for both new providers
  - Settings UI token inputs (password type) and GLM region selector
affects: [03-02-PLAN, phase-04, phase-05]

# Tech tracking
tech-stack:
  added: [toml = "1.1" (Cargo dependency)]
  patterns:
    - Provider token storage via provider_tokens HashMap with replace-all patch semantics
    - Shared proxy module extraction pattern for cross-provider reuse
    - Pipeline stub pattern returning NoCredentials for phased provider rollout

key-files:
  created:
    - src-tauri/src/proxy.rs
    - src-tauri/src/pipeline/kimi.rs
    - src-tauri/src/pipeline/glm.rs
    - src/lib/persistence/preferencesStore.test.ts
  modified:
    - src-tauri/src/claude_code/mod.rs
    - src-tauri/src/lib.rs
    - src-tauri/src/registry.rs
    - src-tauri/src/state/mod.rs
    - src-tauri/src/pipeline/mod.rs
    - src/lib/tauri/contracts.ts
    - src/lib/tauri/registry.ts
    - src/lib/persistence/preferencesStore.ts
    - src/features/preferences/defaultPreferences.ts
    - src/app/settings/SettingsView.tsx
    - src/app/shared/i18n.ts
    - src-tauri/Cargo.toml

key-decisions:
  - "Extracted proxy to shared module (crate::proxy) so all providers reuse detection logic"
  - "provider_tokens uses replace-all patch semantics (frontend sends full map on every save)"
  - "Stub fetchers return NoCredentials as transient artifact; Plan 02 replaces with real HTTP fetch"
  - "GLM platform restricted to global/china enum values with normalization fallback to global"

patterns-established:
  - "Shared proxy module: new providers import from crate::proxy instead of reimplementing"
  - "Token storage: provider_tokens HashMap keyed by provider ID, trimmed on both sides"
  - "Pipeline stub: implement ProviderFetcher trait with NoCredentials return for phased rollout"

requirements-completed: [NPROV-03, NPROV-04, NPROV-05]

# Metrics
duration: 12min
completed: 2026-04-01
---

# Phase 03 Plan 01: Infrastructure, Contracts, and UI Wiring Summary

**Shared proxy module extracted from Claude Code; 4-provider registry with pipeline stubs; token storage and Settings UI for Kimi Code and GLM Coding Plan**

## Performance

- **Duration:** 12 min
- **Started:** 2026-04-01T03:32:15Z
- **Completed:** 2026-04-01T03:44:00Z
- **Tasks:** 2
- **Files modified:** 22

## Accomplishments
- Extracted all proxy resolution logic from `claude_code/mod.rs` into a shared `proxy.rs` module with public API (`resolve_proxy`, `build_agent`, `ProxyDecision`, `ProxyError`) so all providers can reuse system proxy detection
- Registered Kimi Code and GLM Coding Plan in both Rust and TypeScript registries (4 providers total: codex, claude-code, kimi-code, glm-coding) with pipeline stub fetchers
- Added `provider_tokens` (HashMap<String, String>) and `glm_platform` (String) to UserPreferences on both Rust and TypeScript sides, with whitespace trimming and blank removal in both normalizers
- Wired Settings UI with enable/disable toggles, password-type token inputs, and GLM region selector for both new providers
- Added complete i18n strings (en-US and zh-CN) for both Kimi Code and GLM Coding Plan sections

## Task Commits

Each task was committed atomically:

1. **Task 1: Extract shared proxy module + add provider_tokens/glm_platform to preferences** - `5cfbbef` (feat)
2. **Task 2: Registry entries, pipeline stubs, i18n, and Settings UI** - `5cfbbef` (feat)

Note: Both tasks were committed together in a single commit by the previous executor. The commit message covers all changes from both tasks.

## Files Created/Modified
- `src-tauri/src/proxy.rs` - Shared proxy resolution module extracted from claude_code
- `src-tauri/src/pipeline/kimi.rs` - KimiFetcher stub returning NoCredentials when no token
- `src-tauri/src/pipeline/glm.rs` - GlmFetcher stub returning NoCredentials when no token
- `src-tauri/src/claude_code/mod.rs` - Proxy functions removed, now imports from crate::proxy
- `src-tauri/src/lib.rs` - Added `pub mod proxy` declaration
- `src-tauri/src/registry.rs` - Added kimi-code and glm-coding entries, updated tests
- `src-tauri/src/state/mod.rs` - Added provider_tokens, glm_platform fields with trimming
- `src-tauri/src/pipeline/mod.rs` - Registered KimiFetcher and GlmFetcher, updated tests
- `src-tauri/Cargo.toml` - Added toml = "1.1" dependency
- `src/lib/tauri/contracts.ts` - Added providerTokens and glmPlatform to interfaces
- `src/lib/tauri/registry.ts` - Added kimi-code and glm-coding entries
- `src/lib/persistence/preferencesStore.ts` - Token trimming and glmPlatform normalization
- `src/lib/persistence/preferencesStore.test.ts` - Tests for token trimming and glmPlatform
- `src/features/preferences/defaultPreferences.ts` - Added providerTokens and glmPlatform defaults
- `src/app/settings/SettingsView.tsx` - Token input fields and GLM region selector
- `src/app/shared/i18n.ts` - All i18n strings for both providers (en-US and zh-CN)
- `src/lib/tauri/registry.test.ts` - Updated for 4 providers
- `src/app/settings/SettingsView.test.tsx` - Updated for new UI elements
- `tests/integration/preferences-persistence.test.ts` - Updated for new fields
- `src-tauri/src/commands/mod.rs` - Provider token handling in preference save
- `Cargo.lock` - Updated with toml dependency

## Decisions Made
- Extracted proxy to shared module (`crate::proxy`) so Kimi and GLM providers can reuse the same system proxy detection logic -- addresses review concern #1
- Used replace-all semantics for `provider_tokens` patch (frontend sends complete map, not incremental) -- addresses review concern #5
- Token whitespace trimming implemented in both Rust and TypeScript normalizers; blank tokens are removed entirely -- addresses review concern #6
- GLM platform values restricted to `"global"` and `"china"` with normalization fallback to `"global"` for invalid values
- Stub fetchers are a transient development artifact: they return `NoCredentials` when no token is configured, which is correct behavior until Plan 02 implements real HTTP fetch logic

## Deviations from Plan

None - plan executed exactly as written. The previous executor combined both tasks into a single commit rather than separate atomic commits; all acceptance criteria are met.

## Known Stubs

| File | Line | Stub | Resolution |
|------|------|------|------------|
| src-tauri/src/pipeline/kimi.rs | 34 | `// Real fetch implementation in Plan 02` - returns NoCredentials even when token present | Plan 03-02 (Wave 2) |
| src-tauri/src/pipeline/glm.rs | 40 | `// Real fetch implementation in Plan 02` - returns NoCredentials even when token present | Plan 03-02 (Wave 2) |

These stubs are intentional and documented in the plan. When a user provides a token but the real fetcher is not yet implemented, the stub still returns NoCredentials -- this is correct because Plan 02 replaces the stub body with actual HTTP fetch logic.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Plan 03-02 can now implement real HTTP fetch logic for both providers by replacing the stub `fetch()` bodies with calls to `crate::kimi::load_snapshot` and `crate::glm::load_snapshot`
- The shared proxy module (`crate::proxy`) is ready for use by new provider modules
- Settings UI token inputs and GLM region selector are already functional for saving preferences
- All 93 Rust tests and 120 frontend tests pass

## Self-Check: PASSED

All created files verified present. Commit 5cfbbef confirmed in git history. 93 Rust tests passed, 120 frontend tests passed, clippy clean (pre-existing warnings only).

---
*Phase: 03-new-providers*
*Completed: 2026-04-01*
