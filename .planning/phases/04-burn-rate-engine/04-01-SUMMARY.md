---
phase: 04-burn-rate-engine
plan: 01
subsystem: infra, ui
tags: [rust, typescript, tauri, burn-rate, snapshot-cache, vitest]

# Dependency graph
requires:
  - phase: 02-fetch-pipeline-migration
    provides: Generic provider snapshot pipeline and additive snapshot-cache persistence
provides:
  - Snapshot-cache burn-rate history keyed by provider ID plus raw quota label
  - Frontend BurnRateSample contract on quota dimensions
  - Pure TypeScript burn-rate projection helper with pace classification and depletion ETA math
  - Regression coverage for cache compatibility and burn-rate degradation paths
affects: [04-02-PLAN, phase-05]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Additive snapshot-cache payloads that preserve backward compatibility at schema version 1
    - Burn-rate history owned by the backend and attached onto quota dimensions at cache load/save boundaries
    - Pure burn-rate projection helper layered on top of existing summary status/progress tone logic

key-files:
  created:
    - src/lib/tauri/burnRate.ts
  modified:
    - src-tauri/src/commands/mod.rs
    - src-tauri/src/state/mod.rs
    - src/lib/tauri/contracts.ts
    - src/lib/tauri/summary.ts
    - src/lib/tauri/summary.test.ts

key-decisions:
  - "Burn-rate history is isolated by provider ID plus raw quota label and pruned to the newest three successful samples"
  - "Only fresh successful refreshes record samples; stale states and visible-window ticks reuse prior history without synthesizing new points"
  - "Burn-rate projection stays in a pure TypeScript helper so Phase 04 adds forecast output without changing existing status/progress-tone rules"

patterns-established:
  - "Snapshot cache enrichment: attach additive transport data during cache load/save rather than mutating frontend state ownership"
  - "Burn-rate math: derive pace from sample consumption coverage versus time-until-reset and degrade silently on invalid inputs"

requirements-completed: [ALERT-01]

# Metrics
duration: 3min
completed: 2026-04-02
---

# Phase 04 Plan 01: Burn-Rate Data Foundation Summary

**Per-dimension burn-rate history persisted in the snapshot cache, transported to the frontend, and projected through a pure TypeScript helper with degradation-safe tests**

## Performance

- **Duration:** 3 min
- **Started:** 2026-04-01T16:38:56Z
- **Completed:** 2026-04-01T16:41:14Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Added `BurnRateSample` transport types in Rust and TypeScript, plus `burnRateHistory` on quota dimensions so cached histories can flow to the panel without breaking older payloads
- Extended the snapshot cache with per-`providerId::rawLabel` history storage, successful-refresh sample recording, three-sample pruning, and attachment of prior histories onto cached non-fresh results
- Created `src/lib/tauri/burnRate.ts` as a pure projection helper and wired `summary.ts` to expose burn-rate output without altering existing quota status or progress-tone logic
- Locked the behavior with Rust cache tests and Vitest coverage for on-track, behind, far-behind, and all silent-degradation paths

## Task Commits

Each task was committed atomically:

1. **Task 1: Persist burn-rate sample history in snapshot cache and expose it on quota dimensions** - `9455fcc` (feat)
2. **Task 2: Add a pure sample-based burn-rate projection helper and unit coverage** - `e9d624d` (test), `e8e9da4` (feat)

**Plan metadata:** pending in working tree

_Note: Task 2 followed TDD with a test commit before the helper implementation._

## Files Created/Modified
- `src-tauri/src/commands/mod.rs` - Added additive snapshot-cache burn-rate history storage, load/save helpers, and Rust regression tests
- `src-tauri/src/state/mod.rs` - Added `BurnRateSample` and quota-dimension `burn_rate_history`
- `src/lib/tauri/contracts.ts` - Added frontend `BurnRateSample` and optional `burnRateHistory`
- `src/lib/tauri/burnRate.ts` - Added pure burn-rate pace and depletion ETA projection logic
- `src/lib/tauri/summary.ts` - Exposed burn-rate helper without changing existing quota normalization rules
- `src/lib/tauri/summary.test.ts` - Added burn-rate math and graceful-degradation coverage

## Decisions Made
- Keyed history as `providerId::rawLabel` so weekly and short windows never share samples even within the same provider
- Kept `SNAPSHOT_CACHE_VERSION` at `1` because the new payload is additive and older cache files should continue to load
- Recorded samples only for fresh successful refreshes so UI-visible minute ticks and failed refreshes cannot create synthetic consumption history
- Left burn-rate output independent from current alert colors so Phase 05 can later evolve severity rules without undoing this foundation

## Deviations from Plan

None - plan executed as written.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `04-02` can now render per-row burn-rate copy directly from `burnRateHistory`, `remainingPercent`, and `resetsAt`
- Phase 05 can reuse the pure helper and persisted sample history when time-aware thresholds replace static color logic
- Verification targets already pass: `cargo test snapshot_cache --manifest-path src-tauri/Cargo.toml` and `npx vitest run src/lib/tauri/summary.test.ts`

## Self-Check: PASSED

All plan artifacts are present. Rust snapshot-cache tests pass, Vitest burn-rate projection coverage passes, and the implementation matches the plan contract for backward-compatible cache loading and silent degradation on invalid inputs.

---
*Phase: 04-burn-rate-engine*
*Completed: 2026-04-02*
