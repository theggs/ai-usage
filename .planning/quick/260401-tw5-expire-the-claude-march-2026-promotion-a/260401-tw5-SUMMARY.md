---
phase: quick
plan: 260401-tw5
subsystem: ui
tags: [react, vitest, promotions, i18n, policy]
requires:
  - phase: 03-new-providers
    provides: promotion header shell, compact popover rendering, localized shared copy
provides:
  - expired Claude March 2026 promo retired from active UI state
  - Claude peak-hours restriction modeled inside the shared promotions catalog/resolver
  - compact localized restriction rendering without stale 2x Claude badges
affects: [promotion-status-line, app-shell-header, quick-task-state]
tech-stack:
  added: []
  patterns:
    - keep positive and negative capacity events inside one promotion catalog with explicit effect metadata
    - only render benefit badges for positive events that actually carry a label
key-files:
  created:
    - .planning/quick/260401-tw5-expire-the-claude-march-2026-promotion-a/260401-tw5-PLAN.md
  modified:
    - src/features/promotions/catalog.ts
    - src/features/promotions/resolver.ts
    - src/features/promotions/types.ts
    - src/components/panel/PromotionStatusLine.tsx
    - src/app/shared/i18n.ts
key-decisions:
  - Use `capacityEffect` on the existing campaign model instead of building a second Claude-only restriction pipeline.
  - Show Claude peak-hours restriction as `restricted-window` and suppress positive benefit badges for that path.
patterns-established:
  - Capacity policy changes can be expressed as campaign effects with shared resolver priority and localization.
  - Compact header pills stay stable by using short status labels for restrictions instead of widening the surface.
requirements-completed: []
duration: 20min
completed: 2026-04-01
---

# Quick Task 260401-tw5 Summary

**Claude promotion status now reflects the expired March bonus and the newer peak-hours restriction without misleading 2x Claude badges**

## Performance

- **Duration:** 20 min
- **Started:** 2026-04-01T13:31:22Z
- **Completed:** 2026-04-01T13:51:00Z
- **Tasks:** 2
- **Files modified:** 10

## Accomplishments

- Retired the stale Claude March 2026 bonus from active circulation and added a shared negative-capacity event for Claude peak hours.
- Extended the resolver and timing model to emit a distinct `restricted-window` state only while the restriction window is active.
- Updated compact panel copy and popover rendering so Claude shows a restriction state, not a stale positive `2x` badge.

## Task Commits

Implementation landed in one cross-cutting feature commit because the new `restricted-window` type had to be introduced across the shared model, resolver, and compact UI together:

1. **Task 1 + Task 2: refresh Claude promotion policy states** - `ca6a52f` (`fix: refresh claude promotion policy states`)

## Files Created/Modified

- `src/features/promotions/catalog.ts` - Retired the March Claude bonus and added the new Claude peak-hours restriction campaign.
- `src/features/promotions/types.ts` - Added `capacityEffect`, `restricted-window`, and active-window timing detail support.
- `src/features/promotions/resolver.ts` - Made campaign resolution effect-aware and fixed local time-range formatting for active restriction windows.
- `src/features/promotions/resolver.test.ts` - Locked the April 1 expired-bonus and active-restriction behaviors.
- `src/components/panel/PromotionStatusLine.tsx` - Rendered the new restriction tone and prevented stale positive compact labels.
- `src/components/panel/PromotionStatusLine.test.tsx` - Updated popover and compact-pill expectations for Claude restriction state.
- `src/app/shared/i18n.ts` - Added localized restriction labels and active-window timing copy.
- `src/app/shared/i18n.test.ts` - Updated promotion string coverage for the new Claude restriction path.
- `src/app/shell/AppShell.test.tsx` - Updated header-level promotion expectations to the new April restriction state.
- `src/styles/globals.css` - Added the restriction pill tone.

## Decisions Made

- Kept the existing promotions subsystem and generalized it with explicit effect metadata instead of inventing a second “restriction” system.
- Made restriction windows active-only in UI; outside peak hours Claude falls back to `none` unless another active campaign applies.

## Deviations from Plan

None - plan executed as intended. The only auto-fix was extending the local time-range helper to read `activeRanges` as well as `blockedRanges`, which was necessary for the new restriction detail text.

## Issues Encountered

- The original local time-range formatter only handled bonus-style blocked windows, so the first restriction test produced an empty local range. This was fixed in `src/features/promotions/resolver.ts` before final verification.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- The promotions surface can now absorb future positive or negative capacity-policy changes without adding a separate subsystem.
- If we want stronger provenance later, the next step would be attaching per-campaign confidence/source notes in the UI or planning docs.

