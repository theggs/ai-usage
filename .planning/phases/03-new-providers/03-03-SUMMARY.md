---
phase: 03-new-providers
plan: 03
subsystem: ui
tags: [i18n, react, tailwind, provider-routing]

requires:
  - phase: 03-new-providers-01
    provides: Provider registry with credentialType metadata
  - phase: 03-new-providers-02
    provides: Kimi Code and GLM Coding Plan fetcher integration
provides:
  - Provider-aware i18n copy keys (tokenNotConfigured, refreshingGeneric)
  - getPlaceholderCopy routes NoCredentials by serviceId
  - PanelView uses generic refreshing copy for non-Claude-Code providers
  - Service order capsule spacing fix
affects: [new-providers, ui-polish]

tech-stack:
  added: []
  patterns: [provider-aware-i18n-routing]

key-files:
  created: []
  modified:
    - src/app/shared/i18n.ts
    - src/app/shared/i18n.test.ts
    - src/app/panel/PanelView.tsx
    - src/app/settings/SettingsView.tsx

key-decisions:
  - "Direct serviceId check (kimi-code, glm-coding) instead of registry lookup for NoCredentials routing -- simpler, avoids circular dependency"

patterns-established:
  - "Provider-aware copy routing: getPlaceholderCopy(copy, status, serviceId) pattern for service-specific i18n messages"

requirements-completed: [NPROV-01, NPROV-02, NPROV-04, NPROV-05]

duration: 3min
completed: 2026-04-01
---

# Phase 03 Plan 03: Gap Closure Summary

**Provider-aware i18n routing for NoCredentials/refreshing states plus capsule spacing fix, closing 5 UAT gaps**

## Performance

- **Duration:** 3 min
- **Started:** 2026-04-01T07:51:41Z
- **Completed:** 2026-04-01T07:55:00Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Token-based providers (kimi-code, glm-coding) now show "Token not configured" instead of Claude Code CLI messages when NoCredentials
- PanelView refreshing card uses generic copy for non-Claude-Code providers
- Service order capsule drag handles no longer overlap label text
- All 109 tests pass with zero regressions; 7 new provider-routing tests added

## Task Commits

Each task was committed atomically:

1. **Task 1 (TDD RED): Add failing tests for provider-aware getPlaceholderCopy** - `8a9786c` (test)
2. **Task 1 (TDD GREEN): Provider-aware i18n copy and getPlaceholderCopy routing** - `ade27ca` (feat)
3. **Task 2: Fix service order capsule spacing** - `05c13b6` (fix)

## Files Created/Modified
- `src/app/shared/i18n.ts` - Added tokenNotConfiguredTitle/Body, refreshingGenericTitle/Body to CopyTree (en-US + zh-CN); made getPlaceholderCopy accept optional serviceId
- `src/app/shared/i18n.test.ts` - Added 7 test cases for provider-aware routing in getPlaceholderCopy
- `src/app/panel/PanelView.tsx` - Updated refreshing card to use generic copy for non-Claude-Code; pass serviceId to getPlaceholderCopy
- `src/app/settings/SettingsView.tsx` - Changed capsule classes from gap-1/px-2 to gap-1.5/px-2.5

## Decisions Made
- Used direct serviceId string comparison ("kimi-code", "glm-coding") instead of getProvider() registry lookup for NoCredentials routing. Simpler approach that avoids a circular dependency and keeps the i18n module independent of the registry.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All 5 UAT gaps from Phase 03 are now closed
- Phase 03 (New Providers) is complete -- ready for Phase 04 planning

## Self-Check: PASSED

- All 4 source files exist
- All 3 task commits verified (8a9786c, ade27ca, 05c13b6)
- SUMMARY.md created

---
*Phase: 03-new-providers*
*Completed: 2026-04-01*
