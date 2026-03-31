---
phase: 02-fetch-pipeline-migration
plan: 02
subsystem: api
tags: [rust, tauri-ipc, pipeline-dispatch, generic-commands, registry-iteration, typescript-mock]

# Dependency graph
requires:
  - phase: 02-fetch-pipeline-migration
    plan: 01
    provides: ProviderFetcher trait, get_fetcher() dispatch, CodexFetcher and ClaudeCodeFetcher implementations
  - phase: 01-provider-registry
    provides: ProviderDescriptor registry with provider_ids() and get_provider()
provides:
  - Generic get_provider_state and refresh_provider_state IPC commands
  - Pipeline-dispatched fetch for any registered provider
  - Legacy per-service commands as thin wrappers
  - Registry-driven build_tray_items and build_cached_tray_items
  - Frontend mock layer handling generic IPC commands
affects: [03-new-providers, new-provider-onboarding, frontend-provider-integration]

# Tech tracking
tech-stack:
  added: []
  patterns: [generic-ipc-dispatch, thin-wrapper-legacy-commands, registry-driven-tray-iteration]

key-files:
  modified:
    - src-tauri/src/commands/mod.rs
    - src-tauri/src/lib.rs
    - src/lib/tauri/client.ts

key-decisions:
  - "Generic commands dispatch via pipeline::get_fetcher(); Codex wrappers overlay account-specific fields post-build"
  - "build_tray_items iterates registry::provider_ids() instead of hardcoding codex + claude-code"
  - "Frontend switches from commandMap lookup to direct get_provider_state/refresh_provider_state invocation"
  - "Legacy per-service commands kept as thin wrappers for backward compatibility"

patterns-established:
  - "Generic IPC: new providers get automatic IPC support by registering a ProviderFetcher -- no command changes needed"
  - "Provider-specific overlays: Codex wrapper overlays account_count and active_session after generic build"
  - "Registry-driven iteration: build_tray_items and build_cached_tray_items iterate provider_ids() for all enabled providers"

requirements-completed: [PROV-03, PROV-04, PROV-05]

# Metrics
duration: 7min
completed: 2026-03-31
---

# Phase 02 Plan 02: Generic IPC Commands Summary

**Generic get_provider_state/refresh_provider_state IPC commands with pipeline dispatch, legacy wrappers, registry-driven tray iteration, and frontend mock layer update**

## Performance

- **Duration:** 7 min
- **Started:** 2026-03-31T05:04:48Z
- **Completed:** 2026-03-31T05:12:00Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Added generic get_provider_state and refresh_provider_state IPC commands that dispatch through pipeline::get_fetcher()
- Converted all 4 legacy per-service commands (get/refresh for codex and claude-code) to thin wrappers around generic commands
- Generalized build_tray_items and build_cached_tray_items to iterate registry::provider_ids() instead of hardcoding service IDs
- Updated frontend tauriClient to invoke generic commands directly and added mock switch cases for both new commands
- Removed 5 duplicated functions (build_panel_state, build_claude_code_panel_state, build_claude_code_panel_state_with_kind, build_claude_code_items, claude_code_disabled_panel_state)

## Task Commits

Each task was committed atomically:

1. **Task 1: Add generic IPC commands and convert legacy commands to wrappers** - `c1722f8` (feat)
2. **Task 2: Update frontend mock layer for generic commands** - `f196fc3` (feat)

## Files Created/Modified
- `src-tauri/src/commands/mod.rs` - Generic get_provider_state/refresh_provider_state commands, build_provider_panel_state, is_provider_enabled, provider_refresh_cooldown_hit, disabled_provider_panel_state; legacy commands as thin wrappers; registry-driven build_tray_items
- `src-tauri/src/lib.rs` - Registered get_provider_state and refresh_provider_state in generate_handler! macro
- `src/lib/tauri/client.ts` - Switched getProviderPanelState/refreshProviderPanelState to invoke generic commands; added mock cases for get_provider_state/refresh_provider_state

## Decisions Made
- Generic commands dispatch via pipeline::get_fetcher(); Codex wrappers overlay account-specific fields (configured_account_count, enabled_account_count, active_session) post-build since these are Codex-only concerns
- build_tray_items iterates registry::provider_ids() instead of hardcoding codex + claude-code, making new provider addition zero-touch in the tray layer
- Frontend switches from commandMap lookup to direct get_provider_state/refresh_provider_state invocation; legacy aliases kept for backward compatibility
- Cooldown check stays in command layer (provider_refresh_cooldown_hit) rather than inside ProviderFetcher trait, per research Pitfall 3

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Pre-existing clippy warnings (7 errors) in codex/mod.rs, claude_code/mod.rs, and lib.rs are unrelated to this plan's changes; pipeline and commands code is clippy-clean
- Pre-existing AppShell test isolation issue (shadow-sm class check fails in full suite but passes individually); unrelated to IPC changes

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 02 fetch pipeline migration is now complete
- Adding a new provider in Phase 3 requires only: a ProviderFetcher trait impl, a registry entry, and a frontend registry entry
- No changes needed to commands, tray, or frontend IPC for new providers

## Self-Check: PASSED

- All 3 modified files verified present
- Task commit c1722f8 verified in git log
- Task commit f196fc3 verified in git log
- 89 Rust tests pass, 114 TypeScript tests pass (1 pre-existing isolation flake)

---
*Phase: 02-fetch-pipeline-migration*
*Completed: 2026-03-31*
