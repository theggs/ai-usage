---
phase: 03-new-providers
plan: 02
subsystem: api, rust
tags: [rust, ureq, serde, chrono, toml, kimi, glm, tdd, http, provider, quota]

# Dependency graph
requires:
  - phase: 03-new-providers-01
    provides: Shared proxy module, provider_tokens/glm_platform in UserPreferences, pipeline stub fetchers, registry entries
provides:
  - Kimi Code provider module with credential chain, HTTP fetch, and response parsing
  - GLM Coding Plan provider module with credential chain, HTTP fetch, percentage inversion, and polymorphic number handling
  - Pipeline fetcher delegation from stubs to real load_snapshot implementations
affects: [phase-04, phase-05]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Provider module pattern with resolve_token + map_response + load_snapshot public API
    - Env var mutex serialization pattern for parallel test execution
    - Flexible serde deserializer for polymorphic API number types
    - Percentage inversion with input clamping before conversion (GLM-specific)

key-files:
  created:
    - src-tauri/src/kimi/mod.rs
    - src-tauri/src/glm/mod.rs
  modified:
    - src-tauri/src/pipeline/kimi.rs
    - src-tauri/src/pipeline/glm.rs
    - src-tauri/src/lib.rs

key-decisions:
  - "Kimi uses numeric string parsing (parse_numeric_string helper) since API returns string-encoded integers"
  - "GLM uses flexible serde deserializers for polymorphic number fields (int/float/string)"
  - "GLM percentage is clamped to 0..100 BEFORE inversion to prevent underflow/overflow"
  - "GLM auth uses raw token (no Bearer prefix) per verified API behavior"
  - "Both providers re-read credentials on every fetch (no caching) to handle token rotation"
  - "seed_stale_cache not implemented for new providers (follow-up item, review concern #3)"

patterns-established:
  - "Provider module structure: resolve_token -> load_snapshot (public) -> map_response (pure)"
  - "Env var test serialization via static Mutex for process-global env var safety"
  - "Flexible number deserialization pattern for APIs with polymorphic JSON types"

requirements-completed: [NPROV-01, NPROV-02, NPROV-04, NPROV-05]

# Metrics
duration: 12min
completed: 2026-04-01
---

# Phase 03 Plan 02: Kimi Code and GLM Coding Plan HTTP Fetch Summary

**Kimi Code and GLM Coding Plan provider modules with full credential chains, HTTP fetching via shared proxy, response parsing with numeric edge cases, and 57 unit tests**

## Performance

- **Duration:** 12 min
- **Started:** 2026-04-01T06:23:11Z
- **Completed:** 2026-04-01T06:35:33Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Implemented Kimi Code provider with credential chain (env var -> TOML config -> JSON fallback -> preferences token), Bearer auth HTTP fetch, numeric string parsing, and value clamping to 0..100
- Implemented GLM Coding Plan provider with dual-platform credential chain (env var name determines endpoint), raw token auth (no Bearer), data envelope unwrap with bare fallback, flexible polymorphic number deserialization, percentage inversion (usage -> remaining) with input clamping, and millisecond timestamp conversion
- Both providers delegate through thin pipeline fetchers to their respective load_snapshot functions, producing QuotaDimension arrays rendered by existing ServiceCard component
- Comprehensive TDD: 25 Kimi tests + 31 GLM tests = 56 new tests; all 149 tests pass (93 existing + 56 new)

## Task Commits

Each task was committed atomically:

1. **Task 1: Kimi Code provider module with TDD** - `d874cb4` (feat)
2. **Task 2: GLM Coding Plan provider module with TDD** - `a720189` (feat)

## Files Created/Modified
- `src-tauri/src/kimi/mod.rs` - Kimi Code credential chain, HTTP fetch, response parsing with numeric string handling, 25 unit tests
- `src-tauri/src/glm/mod.rs` - GLM Coding Plan credential chain, HTTP fetch, percentage inversion, polymorphic number deserialization, 31 unit tests
- `src-tauri/src/pipeline/kimi.rs` - KimiFetcher now delegates to crate::kimi::load_snapshot
- `src-tauri/src/pipeline/glm.rs` - GlmFetcher now delegates to crate::glm::load_snapshot
- `src-tauri/src/lib.rs` - Added pub mod kimi and pub mod glm declarations

## Decisions Made
- Kimi numeric strings are parsed via a shared `parse_numeric_string` helper that returns 0 for unparseable values (matching the "treat as empty" pattern from existing providers)
- GLM flexible deserializers try `serde_json::Value` dispatch (Number -> as_f64/as_i64, String -> parse, Null -> None) to handle all observed API polymorphism
- GLM percentage clamping is applied BEFORE inversion (`pct.clamp(0.0, 100.0)` then `100.0 - usage_pct`) to prevent negative remaining or >100% remaining
- Both providers skip blank/whitespace-only env vars and config values to prevent silent auth failures
- Config file token parsing (TOML for Kimi, JSON for GLM none) uses Option chaining with early None returns -- no panics on missing/malformed files
- GLM token is sent as raw `Authorization: {token}` without Bearer prefix, verified from opencode-bar Swift source code

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed clippy warnings for PathBuf reference parameters**
- **Found during:** Task 2 (post-implementation verification)
- **Issue:** `resolve_token_from_toml` and `resolve_token_from_json` accepted `&PathBuf` instead of `&Path`, triggering clippy `ptr_arg` warning
- **Fix:** Changed parameter types from `&PathBuf` to `&Path` with `use std::path::Path`
- **Files modified:** `src-tauri/src/kimi/mod.rs`
- **Verification:** `cargo clippy --lib` shows no warnings from kimi or glm modules
- **Committed in:** `a720189` (Task 2 commit)

**2. [Rule 1 - Bug] Fixed env var test race condition with mutex serialization**
- **Found during:** Task 1 (initial test run)
- **Issue:** Parallel cargo test execution caused env var set/remove race conditions between credential chain tests
- **Fix:** Added static `ENV_LOCK` mutex in test modules; all env-var-modifying tests acquire lock before manipulating process env
- **Files modified:** `src-tauri/src/kimi/mod.rs`, `src-tauri/src/glm/mod.rs`
- **Verification:** All env var tests pass reliably in parallel execution
- **Committed in:** `d874cb4` (Task 1), `a720189` (Task 2)

---

**Total deviations:** 2 auto-fixed (2 bugs)
**Impact on plan:** Both auto-fixes necessary for correctness. No scope creep.

## Known Stubs

None -- all stubs from Plan 01 (pipeline fetcher bodies returning NoCredentials) have been replaced with real HTTP fetch logic.

## Follow-up Items

- **seed_stale_cache not implemented** for Kimi and GLM providers (review concern #3). New providers use the default no-op from the ProviderFetcher trait. This means fast app restarts won't show stale data while refresh is in-flight for these providers (unlike Codex/Claude Code which do have stale cache support). This is a future enhancement, not a correctness issue.

## Issues Encountered
None

## User Setup Required
None -- users configure tokens via Settings UI (already wired in Plan 01). No external service configuration required beyond obtaining an API key from the provider's dashboard.

## Next Phase Readiness
- Both new providers are fully functional and produce QuotaDimension arrays when valid tokens are configured
- Existing ServiceCard component renders them identically to Codex/Claude Code (verified by trait contract)
- Phase 3 is complete -- all NPROV requirements are satisfied
- Phase 4 (Time-Aware Thresholds) and Phase 5 (Burn Rate Forecasting) can proceed independently

## Self-Check: PASSED

All created files verified present. Commits d874cb4 and a720189 confirmed in git history. kimi/mod.rs: 671 lines (min 150), glm/mod.rs: 798 lines (min 200). 149 Rust tests passed, clippy clean for new modules.

---
*Phase: 03-new-providers*
*Completed: 2026-04-01*
