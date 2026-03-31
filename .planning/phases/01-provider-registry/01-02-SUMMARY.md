---
phase: 01-provider-registry
plan: 02
subsystem: ui
tags: [react, typescript, provider-registry, state-management, dynamic-map]

requires:
  - phase: 01-provider-registry plan 01
    provides: ProviderDescriptor registry (registry.ts), providerEnabled preference field, normalized preferences

provides:
  - Dynamic provider state map (providerStates Record) replacing per-service state variables
  - Generic panelController with Map-based dedup for N providers
  - Generic tauriClient methods (getProviderPanelState/refreshProviderPanelState)
  - Registry-based display name lookups in all view components
  - Zero hardcoded service-ID arrays or display-name records in src/

affects: [02-fetch-pipeline, 03-new-providers, 04-smart-alerts]

tech-stack:
  added: []
  patterns:
    - "Record<string, CodexPanelState | null> for N-provider state map"
    - "Set<string> for tracking per-provider refresh status"
    - "Map-based dedup guard in panelController"
    - "getVisibleServiceScope() as single source of truth for enabled providers"

key-files:
  modified:
    - src/app/shared/appState.ts
    - src/app/shell/AppShell.tsx
    - src/app/panel/PanelView.tsx
    - src/app/settings/SettingsView.tsx
    - src/features/demo-services/panelController.ts
    - src/lib/tauri/client.ts
    - src/lib/tauri/summary.ts
    - src/features/promotions/resolver.ts

key-decisions:
  - "Legacy claudeCodeUsageEnabled takes priority over providerEnabled for claude-code during transition period"
  - "getVisibleServiceScope() is the single source of truth for which providers are enabled, used by both initial load and refresh"
  - "Old tauriClient per-service methods kept as thin wrappers for backward compatibility with E2E tests"

patterns-established:
  - "Dynamic provider iteration: all consumers iterate providerIds/getVisibleServiceScope instead of hardcoded lists"
  - "Map-based dedup: panelController uses Map<string, Promise> for per-provider concurrency control"

requirements-completed: [PROV-02, PROV-06]

duration: 12min
completed: 2026-03-31
---

# Phase 01 Plan 02: Frontend Provider Map Migration Summary

**Big-bang migration of all frontend state, views, and utilities from per-service variables to a dynamic provider map backed by the registry**

## Performance

- **Duration:** 12 min
- **Started:** 2026-03-31T03:14:34Z
- **Completed:** 2026-03-31T03:26:45Z
- **Tasks:** 2
- **Files modified:** 12 (8 source + 4 test files)

## Accomplishments
- Replaced AppStateValue per-service fields (panelState, claudeCodePanelState, isRefreshing, isClaudeCodeRefreshing) with dynamic providerStates Record and refreshingProviders Set
- All view components (AppShell, PanelView, SettingsView) and utilities (summary.ts, promotions/resolver.ts) now use registry for display names and provider state map for data
- panelController uses generic Map-based dedup supporting N providers with single loadProviderState/refreshProviderState API
- Zero hardcoded service-ID arrays or display-name records remain in src/

## Task Commits

Each task was committed atomically:

1. **Task 1: Migrate state layer** - `bcbd48b` (feat)
2. **Task 2: Migrate view layer** - `914fc57` (feat)

## Files Created/Modified
- `src/app/shared/appState.ts` - Dynamic provider map interface (providerStates, refreshingProviders)
- `src/features/demo-services/panelController.ts` - Generic Map-based dedup controller
- `src/lib/tauri/client.ts` - Generic getProviderPanelState/refreshProviderPanelState with old methods as wrappers
- `src/app/shell/AppShell.tsx` - Full state migration to provider map with generic refresh loop
- `src/app/panel/PanelView.tsx` - Registry-based display names, dynamic state lookup
- `src/app/settings/SettingsView.tsx` - Registry-based labels, providerEnabled toggle
- `src/lib/tauri/summary.ts` - providerIds() replaces SERVICE_IDS, getProvider for display names
- `src/features/promotions/resolver.ts` - getProvider replaces DEFAULT_SERVICE_NAMES
- `src/app/panel/PanelView.test.tsx` - Updated to new provider map interface
- `src/app/settings/SettingsView.test.tsx` - Updated to new provider map interface
- `src/app/shell/AppShell.test.tsx` - Updated mocks to use loadProviderState/refreshProviderState
- `tests/integration/performance-thresholds.test.ts` - Updated to use generic provider methods

## Decisions Made
- Legacy `claudeCodeUsageEnabled` takes priority over `providerEnabled["claude-code"]` in `getVisibleServiceScope()` to maintain backward compatibility during transition -- this ensures existing tests and preferences work without requiring all consumers to simultaneously adopt providerEnabled
- Used `getVisibleServiceScope()` as the single source of truth for determining enabled providers in AppShell init, refresh, and save flows, avoiding duplicated logic
- Kept old tauriClient per-service methods (getCodexPanelState etc.) as thin wrappers to avoid breaking E2E tests

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated all test files to match new state interface**
- **Found during:** Task 2 (view layer migration)
- **Issue:** 44 tests failed because test helpers created state with old per-service field names
- **Fix:** Updated createState helpers in PanelView.test.tsx, SettingsView.test.tsx, AppShell.test.tsx, and performance-thresholds.test.ts to use providerStates/refreshingProviders
- **Files modified:** 4 test files
- **Verification:** All 114 tests pass
- **Committed in:** 914fc57 (Task 2 commit)

**2. [Rule 1 - Bug] Fixed providerEnabled vs claudeCodeUsageEnabled precedence**
- **Found during:** Task 2 (view layer migration)
- **Issue:** getVisibleServiceScope checked providerEnabled first, but defaultPreferences sets claude-code to false in providerEnabled. Tests setting claudeCodeUsageEnabled: true expected claude-code to be visible, but providerEnabled took priority.
- **Fix:** Changed getVisibleServiceScope to check claudeCodeUsageEnabled first for claude-code as a legacy override during transition
- **Files modified:** src/lib/tauri/summary.ts
- **Verification:** All tests pass including visibility tests with both enabled/disabled claude-code
- **Committed in:** 914fc57 (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (2 bugs)
**Impact on plan:** Both fixes necessary for correctness. No scope creep.

## Issues Encountered
None

## Known Stubs
None - all provider state is fully wired from registry through to UI display.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Provider registry fully operational on frontend with dynamic N-provider support
- Adding a new provider requires only: (1) add entry to PROVIDERS in registry.ts, (2) add Tauri command mapping in client.ts
- Ready for Phase 02 (fetch pipeline) to add strategy-based data fetching per provider

---
*Phase: 01-provider-registry*
*Completed: 2026-03-31*
