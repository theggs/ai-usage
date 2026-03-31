---
phase: 02-fetch-pipeline-migration
plan: 01
subsystem: api
tags: [rust, trait, pipeline, provider-fetcher, codex, claude-code]

# Dependency graph
requires:
  - phase: 01-provider-registry
    provides: ProviderDescriptor registry with static provider metadata
provides:
  - ProviderFetcher trait with Send + Sync bounds
  - CodexFetcher and ClaudeCodeFetcher implementations
  - get_fetcher() dispatch by provider_id
  - fetchers() static registry of all fetcher instances
affects: [02-02-PLAN, generic-ipc-commands, new-provider-onboarding]

# Tech tracking
tech-stack:
  added: []
  patterns: [trait-based-fetcher-dispatch, thin-delegation-wrapper, OnceLock-static-registry]

key-files:
  created:
    - src-tauri/src/pipeline/mod.rs
    - src-tauri/src/pipeline/codex.rs
    - src-tauri/src/pipeline/claude_code.rs
  modified:
    - src-tauri/src/lib.rs

key-decisions:
  - "Pipeline fetchers are thin delegation wrappers; no code moved from existing provider modules"
  - "RefreshKind defined in pipeline module independently of claude_code::RefreshKind; mapped at call boundary"
  - "OnceLock-based static registry for fetchers; no Arc/Mutex overhead"

patterns-established:
  - "ProviderFetcher trait: new providers implement this trait with provider_id(), fetch(), optional seed_stale_cache/clear_access_pause"
  - "get_fetcher() dispatch: look up fetcher by provider_id string from static OnceLock registry"

requirements-completed: [PROV-03, PROV-04, PROV-05]

# Metrics
duration: 4min
completed: 2026-03-31
---

# Phase 02 Plan 01: Fetch Pipeline Trait Summary

**ProviderFetcher trait with CodexFetcher and ClaudeCodeFetcher thin-delegation implementations, OnceLock-based registry, and get_fetcher() dispatch**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-31T04:56:08Z
- **Completed:** 2026-03-31T04:59:59Z
- **Tasks:** 1
- **Files modified:** 4

## Accomplishments
- Defined ProviderFetcher trait with Send + Sync bounds, provider_id(), fetch(), seed_stale_cache(), and clear_access_pause() methods
- Implemented CodexFetcher delegating to codex::load_snapshot() (ignoring preferences/refresh_kind as Codex takes no args)
- Implemented ClaudeCodeFetcher delegating to claude_code::load_snapshot() with RefreshKind mapping, plus seed_stale_cache and clear_access_pause delegation
- Created get_fetcher() dispatch using OnceLock static registry with 6 passing unit tests

## Task Commits

Each task was committed atomically:

1. **Task 1: Define ProviderFetcher trait and implement for both providers** - `93588a3` (feat)

## Files Created/Modified
- `src-tauri/src/pipeline/mod.rs` - ProviderFetcher trait, RefreshKind enum, fetchers() registry, get_fetcher() dispatch, 6 unit tests
- `src-tauri/src/pipeline/codex.rs` - CodexFetcher struct implementing ProviderFetcher via delegation to codex::load_snapshot()
- `src-tauri/src/pipeline/claude_code.rs` - ClaudeCodeFetcher struct implementing ProviderFetcher via delegation to claude_code functions
- `src-tauri/src/lib.rs` - Added `pub mod pipeline;` declaration

## Decisions Made
- Pipeline fetchers are thin delegation wrappers calling existing provider module functions; no code was moved or refactored out of codex/mod.rs or claude_code/mod.rs
- Defined a separate pipeline::RefreshKind enum rather than re-exporting claude_code::RefreshKind, keeping the pipeline module independent; mapping happens at the ClaudeCodeFetcher call boundary
- Used OnceLock<Vec<Box<dyn ProviderFetcher>>> for the static fetcher registry, avoiding Arc/Mutex overhead since the registry is write-once

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Pre-existing clippy warnings (6 errors) exist in the codebase unrelated to pipeline changes; pipeline code itself is clippy-clean

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Pipeline trait and implementations ready for Plan 02 to wire generic IPC commands
- get_fetcher() dispatch enables Plan 02 to replace per-service Tauri commands with a single generic refresh command

## Self-Check: PASSED

- All 4 created/modified files verified present
- Task commit 93588a3 verified in git log
- 6 pipeline tests pass, 13 codex tests pass, 27 claude_code tests pass, 102 frontend tests pass

---
*Phase: 02-fetch-pipeline-migration*
*Completed: 2026-03-31*
