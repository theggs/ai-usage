---
phase: 03-new-providers
plan: 04
subsystem: ui
tags: [gap-closure, auto-refresh, capsule-layout, token-change]

requires:
  - phase: 03-new-providers-03
    provides: Provider-aware i18n and capsule spacing
provides:
  - Token-change-aware auto-refresh in savePreferences (providerTokens patch detection)
  - Wrapping capsule container for service order display with 4+ providers
affects: [new-providers, ui-polish]

tech-stack:
  added: []
  patterns: [token-change-refresh-trigger]

key-files:
  created: []
  modified:
    - src/app/shell/AppShell.tsx
    - src/app/shell/AppShell.test.tsx
    - src/app/settings/SettingsView.tsx
    - src/app/settings/SettingsView.test.tsx

key-decisions:
  - "Token change detection uses broad 'providerTokens in patch' check -- refreshes all enabled providers since replace-all patch semantics make per-provider diff impractical"

patterns-established:
  - "Token-change refresh: savePreferences detects providerTokens in patch and triggers refreshProviderState for all visible providers"

requirements-completed: [NPROV-01, NPROV-02, NPROV-03, NPROV-04, NPROV-05]

duration: 589s
completed: 2026-04-01
---

# Phase 03 Plan 04: Gap Closure Summary

**Token-change auto-refresh and capsule overflow fix, closing the final 2 UAT gaps from Phase 03**

## Performance

- **Duration:** 589s (~10 min)
- **Started:** 2026-04-01T08:43:59Z
- **Completed:** 2026-04-01T08:53:48Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- Saving or deleting a provider token in Settings now immediately triggers a refresh for all enabled providers -- no manual refresh needed
- Service order capsules wrap to multiple rows when 4+ providers are enabled, preventing overflow into the label column
- 3 new test cases added for token-change auto-refresh behavior (add token, clear token, non-token patch baseline)
- All 130 tests pass with zero regressions

## Task Commits

Each task was committed atomically:

1. **Task 1 (TDD RED): Add failing tests for token-change auto-refresh** - `846dfa0` (test)
2. **Task 1 (TDD GREEN): Implement tokenChanged detection in savePreferences** - `0b5cb90` (feat)
3. **Task 2: Fix service order capsule container from flex-nowrap to flex-wrap** - `584d8c7` (fix)

## Files Created/Modified

- `src/app/shell/AppShell.tsx` - Added `const tokenChanged = "providerTokens" in patch;` and included `tokenChanged` in the refresh condition (line 285-288)
- `src/app/shell/AppShell.test.tsx` - Added 3 test cases: token patch triggers refresh, token clear triggers refresh, non-token patch does not trigger refresh
- `src/app/settings/SettingsView.tsx` - Changed capsule container from `flex-nowrap` to `flex-wrap` (line 496)
- `src/app/settings/SettingsView.test.tsx` - Updated test assertion from `flex-nowrap` to `flex-wrap`

## Decisions Made

- Used broad `"providerTokens" in patch` check instead of per-provider token diff. The `providerTokens` field uses replace-all patch semantics (frontend sends full map on every save), making per-provider diffing impractical. Refreshing all enabled providers is safe because the dedup guard prevents concurrent fetches, and individual fetchers handle missing tokens gracefully (returning NoCredentials).

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## Known Stubs

None - all changes are fully wired and functional.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All UAT gaps from Phase 03 are now closed
- Phase 03 (New Providers) is complete -- ready for Phase 04 planning

## Self-Check: PASSED

- All 4 source files exist and contain expected changes
- All 3 task commits verified (846dfa0, 0b5cb90, 584d8c7)
- SUMMARY.md created

---
*Phase: 03-new-providers*
*Completed: 2026-04-01*
