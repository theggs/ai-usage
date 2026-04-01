---
phase: 05-time-aware-alert-thresholds
plan: 01
subsystem: ui
tags: [typescript, vitest, tauri, alerts, burn-rate, summary]

# Dependency graph
requires:
  - phase: 04-burn-rate-engine
    provides: Whole-window burn-rate pace and ETA classification
provides:
  - Shared quota-health classification above the Phase 4 burn-rate helper
  - Deterministic worst-row selection for service, panel, and tray aggregation
  - Regression coverage for pace, fallback, and aggregate tie-break behavior
affects: [phase-05, tray, panel, service-card]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Pace-derived health overrides static thresholds only when burn-rate input is valid
    - Aggregate severity surfaces pick one worst quota row using deterministic tie-breaks

key-files:
  created: []
  modified:
    - src/lib/tauri/summary.ts
    - src/lib/tauri/summary.test.ts

key-decisions:
  - "Quota health now comes from one summary-layer classifier that prefers Phase 4 pace and falls back to static thresholds"
  - "Service, panel, and selected-service tray severity now share one worst-row selector ordered by severity, source, window length, and appearance"
  - "The Phase 05 far-behind regression fixture was corrected to match the validated Phase 4 burn-rate contract"

patterns-established:
  - "Quota health signals include both effective severity and provenance (`pace`, `fallback`, or `none`)"
  - "Healthy aggregate summaries still expose the selected row metadata for later UI work"

requirements-completed: [ALERT-03, ALERT-04]

# Metrics
duration: 3 min
completed: 2026-04-02
---

# Phase 05 Plan 01: Shared Health Summary

**Pace-aware quota health now drives panel and tray severity through one shared classifier with deterministic worst-row selection**

## Performance

- **Duration:** 3 min
- **Started:** 2026-04-01T19:37:35Z
- **Completed:** 2026-04-01T19:40:30Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Added `getQuotaHealthSignal(...)` and `getMostUrgentQuotaDimension(...)` to make pace-vs-fallback severity a single source of truth.
- Rewired service alert level, panel health summary, and selected-service tray severity to use the shared candidate instead of raw `dimension.status`.
- Extended `summary.test.ts` with focused regressions for pace danger, healthy pace, fallback behavior, missing data, and aggregate tie-break rules.
- Phase 05 consumes the three-bucket pace classifier but ALERT-05 remains satisfied by Phase 4 because the shipped Phase 05 UI intentionally keeps on-track rows visually quiet.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add one summary-layer quota-health classifier above the existing burn-rate helper** - `6114c30` (feat)
2. **Task 2: Lock the classifier and aggregate selection rules with focused summary tests** - `227f9b7` (test, RED)
3. **Task 2: Lock the classifier and aggregate selection rules with focused summary tests** - `323758f` (test, GREEN)

## Files Created/Modified
- `src/lib/tauri/summary.ts` - Added quota health types, classifier, worst-row selector, and aggregate helper rewiring.
- `src/lib/tauri/summary.test.ts` - Added deterministic Phase 05 regression coverage for health mapping and aggregation.

## Decisions Made

- Quota health provenance is explicit in the shared signal so later UI plans can distinguish pace-driven copy from static fallback copy.
- Aggregate helpers now always expose the selected row metadata, even for healthy outcomes, so later UI work can reuse the same choice without recomputing it.
- The pace-danger regression uses a mathematically valid `far-behind` fixture instead of an impossible "80% remaining with 5 minutes left" case.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Corrected the impossible far-behind test fixture**
- **Found during:** Task 2 (Lock the classifier and aggregate selection rules with focused summary tests)
- **Issue:** The planned `5h` case with `remainingPercent: 80` and `resetsAt` 5 minutes ahead cannot become `far-behind` under the validated Phase 4 whole-window burn-rate algorithm.
- **Fix:** Kept the same pace-danger regression goal but changed the fixture to a real `far-behind` case that matches the Phase 4 contract.
- **Files modified:** `src/lib/tauri/summary.test.ts`
- **Verification:** `npx vitest run src/lib/tauri/summary.test.ts`
- **Committed in:** `323758f` (part of task commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** No scope creep. The deviation kept the new tests aligned with the required "reuse Phase 4 pace" rule instead of codifying contradictory math.

## Issues Encountered

- The TDD red phase surfaced a planner inconsistency in one regression example; the implementation itself already matched the intended shared-classifier contract.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 05 plan 02 can now render pace-aware badges and summary copy from the shared `QuotaHealthSignal` / `QuotaHealthCandidate` helpers.
- Tray and panel aggregate selection already agree on the same worst row for selected-service severity.

## Self-Check: PASSED

- Verified `.planning/phases/05-time-aware-alert-thresholds/05-01-SUMMARY.md` exists on disk.
- Verified task commits `6114c30`, `227f9b7`, and `323758f` exist in `git log`.

---
*Phase: 05-time-aware-alert-thresholds*
*Completed: 2026-04-02*
