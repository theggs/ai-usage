---
phase: 05-time-aware-alert-thresholds
plan: 02
subsystem: ui
tags: [typescript, react, vitest, i18n, panel, summary]
requires:
  - phase: 05-01
    provides: "Shared pace-aware quota-health classification and deterministic worst-row selection"
provides:
  - "Compact quota-row badges that show pace or fallback severity without restoring the old inline ETA block"
  - "Service-card header badge and accent that follow the same worst-row health signal as quota rows"
  - "Panel summary wording that distinguishes pace-driven warnings from static fallback alerts"
  - "Exhaustive frontend SnapshotStatus helpers for the paths touched by the panel migration"
affects: [panel, service-card, i18n, snapshot-status]
tech-stack:
  added: []
  patterns:
    - "Risky pace rows disclose ETA through badge metadata instead of a permanent second body line"
    - "Aggregate panel copy and service-card severity reuse the shared worst-row health candidate"
key-files:
  created: []
  modified:
    - src/app/shared/i18n.ts
    - src/app/shared/i18n.test.ts
    - src/components/panel/QuotaSummary.tsx
    - src/components/panel/ServiceCard.tsx
    - src/components/panel/ServiceCard.test.tsx
    - src/app/panel/PanelView.test.tsx
    - src/app/shell/AppShell.tsx
    - src/app/shell/AppShell.test.tsx
    - src/lib/tauri/summary.ts
key-decisions:
  - "Pace-warning and pace-danger rows stay compact by moving ETA disclosure into badge `title` and `aria-label` metadata."
  - "Fallback warning rows keep the legacy static labels so missing burn-rate input does not erase severity feedback."
  - "The live checkpoint was auto-approved after automated verification; the missing live hover observation is recorded rather than implied."
patterns-established:
  - "UI severity badges map pace and fallback health through the shared summary-layer classifier instead of ad hoc row logic."
  - "Touched SnapshotStatus helpers use explicit exhaustiveness guards rather than silent default branches."
requirements-completed: [ALERT-03, ALERT-04]
duration: 10 min
completed: 2026-04-02
---

# Phase 05 Plan 02: Pace-Aware Panel Migration Summary

**Quota rows, service cards, and panel summary now present one pace-aware warning model with compact badge disclosure and fallback-safe wording**

## Performance

- **Duration:** 10 min
- **Started:** 2026-04-01T19:50:01Z
- **Completed:** 2026-04-01T19:59:52Z
- **Tasks:** 3
- **Files modified:** 9

## Accomplishments
- Replaced the old row-level inline burn-rate block with compact pace/fallback severity badges while keeping reset hints in place.
- Aligned service-card accenting and header severity with the shared worst-row health candidate and updated top-summary wording for pace vs fallback states.
- Reran the Task 3 automated checkpoint suite successfully and closed the human-verify gate under `workflow.auto_advance=true`.

## Task Commits

Each task was committed atomically:

1. **Task 1: Replace row and card severity surfaces with pace-aware badges and compact hover-only ETA disclosure** - `139aea4` (feat)
2. **Task 2: Update top-summary wording and make touched frontend SnapshotStatus switches exhaustive** - `138560e` (fix, boundary commit)
3. **Task 3: Verify compact badge disclosure and aggregate consistency in the live panel** - No code changes; checkpoint auto-approved after rerunning the plan's automated verification command

## Files Created/Modified
- `src/app/shared/i18n.ts` - Added pace-specific panel summary copy and exhaustiveness helpers for touched SnapshotStatus localization paths.
- `src/components/panel/QuotaSummary.tsx` - Switched row severity rendering to `getQuotaHealthSignal(...)` and moved ETA disclosure into badge metadata.
- `src/components/panel/ServiceCard.tsx` - Derived card accent and header badge from `getMostUrgentQuotaDimension(...)`.
- `src/app/shell/AppShell.tsx` - Routed panel summary copy through pace-aware vs fallback wording.
- `src/app/shared/i18n.test.ts`, `src/components/panel/ServiceCard.test.tsx`, `src/app/panel/PanelView.test.tsx`, `src/app/shell/AppShell.test.tsx` - Locked the compact badge and aggregate wording regressions.
- `src/lib/tauri/summary.ts` - Preserved explicit exhaustiveness in the touched SnapshotStatus helper paths used by the updated UI.

## Decisions Made

- Pace-driven urgency stays discoverable without re-expanding row height: hover metadata is sufficient for ETA detail.
- Fallback severity remains visible with the legacy warning labels whenever burn-rate inputs are unusable.
- The checkpoint record must call out that live UI hover verification was approved by workflow automation, not observed directly in this continuation.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- Task 2's commit was preserved as an explicit task-boundary commit after concurrent work had already landed the relevant code changes on the branch, so the commit itself does not carry a file diff.
- The Task 3 live panel check was not re-observed in-session because the human-verify checkpoint was auto-approved by `workflow.auto_advance=true`; only the automated verification command was rerun here.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 05 now has all three plan summaries in place and is ready for phase-level closure or downstream verification.
- If a later verifier wants stronger evidence on the UI contract, the remaining gap is a real menubar hover pass confirming the badge `title` disclosure in both `zh-CN` and `en-US`.

## Self-Check: PASSED

- Verified `.planning/phases/05-time-aware-alert-thresholds/05-02-SUMMARY.md` exists on disk.
- Verified task commits `139aea4` and `138560e` exist in git history.
- Scanned the touched source files for placeholder or stub markers; none were found in the plan-owned implementation files.

---
*Phase: 05-time-aware-alert-thresholds*
*Completed: 2026-04-02*
