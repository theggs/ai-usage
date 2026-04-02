---
phase: 06-about-page
plan: 06
subsystem: ui
tags: [react, i18n, about-page, vitest, documentation]
requires:
  - phase: 06-about-page
    provides: Accepted About page wiring through shared `copy.aboutLicenseLabel`
  - phase: 06-about-page
    provides: Final About navigation and footer label cleanup from plans 03 and 05
provides:
  - Preferred zh-CN About license label copy set to `开源许可证`
  - Regression coverage for the About license label in both supported locales
  - UI spec tables aligned with the shipped zh-CN/About copy contract
affects: [about-page, i18n, uat, design-contract]
tech-stack:
  added: []
  patterns:
    - Shared About labels remain localized in `i18n.ts` with view wiring left untouched
    - UI spec tables are treated as the source of truth for locale-specific About copy
key-files:
  created:
    - .planning/phases/06-about-page/06-06-SUMMARY.md
  modified:
    - src/app/shared/i18n.ts
    - src/app/shared/i18n.test.ts
    - .planning/phases/06-about-page/06-UI-SPEC.md
key-decisions:
  - "The About license row stays view-agnostic and continues to read `copy.aboutLicenseLabel` from the shared copy tree."
  - "The zh-CN wording is enforced in the existing UI-spec tables instead of a side note so future reviews catch regressions at the contract layer."
patterns-established:
  - "Locale tweaks for About content require matching regression coverage in `i18n.test.ts`."
  - "Copy/design contracts should be updated in-place wherever the table is authoritative, not patched with append-only notes."
requirements-completed: [ABOUT-04]
duration: 2min
completed: 2026-04-02
---

# Phase 06 Plan 06: About License Label Contract Summary

**The About page’s zh-CN license row now uses `开源许可证`, with matching locale regression coverage and a UI spec contract that encodes the same wording for future reviews.**

## Performance

- **Duration:** 2min
- **Started:** 2026-04-02T05:03:20Z
- **Completed:** 2026-04-02T05:04:36Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Updated the shared About copy tree so zh-CN renders `开源许可证` while en-US remains `License`.
- Added a focused i18n regression that locks the license row label in both supported locales without changing About view wiring.
- Rewrote the authoritative About UI-spec table rows so the phase contract matches the shipped copy and removes the stale generic wording.

## Task Commits

Each task was committed atomically:

1. **Task 1: Tighten the About license localization contract to the preferred zh-CN wording** - `517e6c7` (fix)
2. **Task 2: Record the preferred zh-CN license wording in the About UI spec** - `f184e44` (docs)

## Files Created/Modified
- `src/app/shared/i18n.ts` - Changes the zh-CN `aboutLicenseLabel` contract to `开源许可证` while preserving the English baseline.
- `src/app/shared/i18n.test.ts` - Adds regression coverage for the About license label in `en-US` and `zh-CN`.
- `.planning/phases/06-about-page/06-UI-SPEC.md` - Aligns the key-value rows and copywriting contract tables with the preferred zh-CN wording.

## Decisions Made
- Kept the About view wiring unchanged so localization remains centralized in `i18n.ts` instead of introducing view-specific branching.
- Treated the UI spec tables as the enforcement point for copy review, which avoids future drift between implementation and design documentation.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 06’s final cosmetic About-page gap is closed at both the implementation and spec layers.
- Future About copy reviews now have explicit regression coverage and an authoritative zh-CN contract to validate against.

## Self-Check: PASSED

- Found `.planning/phases/06-about-page/06-06-SUMMARY.md`
- Found commit `517e6c7`
- Found commit `f184e44`

---
*Phase: 06-about-page*
*Completed: 2026-04-02*
