---
phase: 03-new-providers
plan: 05
subsystem: ui
tags: [react, settings, tailwind, vitest, drag-and-drop]
requires:
  - phase: 03-04
    provides: service-order overflow containment and pointer drag persistence baseline
provides:
  - multiline service-order settings block with semantic sortable list rows
  - four-provider service-order coverage for zh-CN and en-US readability
affects: [phase-03-uat, settings-ui]
tech-stack:
  added: []
  patterns:
    - use PreferenceField multiline mode for full-width settings interactions
    - present draggable settings collections as semantic lists with full-row buttons
key-files:
  created: []
  modified:
    - src/app/settings/SettingsView.tsx
    - src/app/settings/SettingsView.test.tsx
key-decisions:
  - Service order now uses PreferenceField multiline mode instead of the compact two-column field layout.
  - Sortable providers render as full-width rows with numbering and a dedicated drag cue instead of wrapped short-label pills.
patterns-established:
  - Preference-heavy controls that exceed the compact settings row should promote themselves into multiline blocks.
  - Readability regressions in the menubar settings surface should be locked with locale-aware component tests.
requirements-completed: [NPROV-03]
duration: 4min
completed: 2026-04-01
---

# Phase 03 Plan 05: Service Order Redesign Summary

**Multiline service-order rows with full provider labels, semantic list structure, and preserved mouse drag reordering on the narrow settings surface**

## Performance

- **Duration:** 4 min
- **Started:** 2026-04-01T12:12:49Z
- **Completed:** 2026-04-01T12:16:25Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Promoted service ordering out of the compact label/value row into a dedicated multiline settings block.
- Replaced wrapped short-label pills with full-width sortable rows that keep all four provider names readable in both locales.
- Preserved pointer drag reordering and drag overlay behavior while adding tests that lock the redesigned structure in place.

## Task Commits

Each task was committed atomically:

1. **Task 1: Promote service order to a multiline full-width settings block** - `287a993` (test), `6248bed` (feat)
2. **Task 2: Polish visual hierarchy for reorder affordance** - `55edd14` (feat)

## Files Created/Modified

- `src/app/settings/SettingsView.tsx` - Converted panel order to a multiline semantic list with full-width draggable rows and clearer drag affordances.
- `src/app/settings/SettingsView.test.tsx` - Replaced wrapped-pill assumptions with multiline layout and locale readability coverage.

## Decisions Made

- Used `PreferenceField` multiline mode for service order so the interaction gets full-row width without changing the base field primitive.
- Kept drag interaction on the entire row button to preserve existing mouse behavior while making the reorder cue visually subordinate.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- A transient `.git/index.lock` blocked both task commits. The lock cleared immediately, each commit was retried, and no manual cleanup was needed.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 03 service-order UAT gap is closed in code and test coverage.
- Phase 04 can start without carrying forward the previous settings layout issue.
