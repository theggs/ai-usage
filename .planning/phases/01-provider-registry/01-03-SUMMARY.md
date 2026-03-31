---
phase: 01-provider-registry
plan: 03
subsystem: api, ui
tags: [preferences, provider-toggle, gap-closure, providerEnabled]

# Dependency graph
requires:
  - phase: 01-provider-registry plan 01
    provides: ProviderDescriptor registry, providerEnabled HashMap in UserPreferences
  - phase: 01-provider-registry plan 02
    provides: getVisibleServiceScope, frontend dynamic provider map, SettingsView toggle

provides:
  - "Working Claude Code enable/disable toggle using providerEnabled as sole source of truth"
  - "PreferencePatch with provider_enabled field for direct provider toggle patches"
  - "getVisibleServiceScope free of legacy claudeCodeUsageEnabled priority"

affects: [02-fetch-pipeline, 03-new-providers]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "providerEnabled is the single source of truth for toggle state across Rust backend and React frontend"
    - "Legacy claudeCodeUsageEnabled kept for deserialization only; never read in app logic"

key-files:
  modified:
    - src-tauri/src/state/mod.rs
    - src-tauri/src/commands/mod.rs
    - src/app/settings/SettingsView.tsx
    - src/lib/tauri/summary.ts
    - src/lib/tauri/summary.test.ts
    - src/app/settings/SettingsView.test.tsx
    - src/app/panel/PanelView.test.tsx
    - src/app/shell/AppShell.test.tsx

key-decisions:
  - "providerEnabled is now the sole source of truth for all provider toggle logic; claudeCodeUsageEnabled legacy priority block removed"
  - "PreferencePatch.provider_enabled merged BEFORE claude_code_usage_enabled so legacy field can still override for backward compat"

patterns-established:
  - "All new provider toggles must use providerEnabled map, never individual boolean fields"

requirements-completed: [PROV-02, PROV-06]

# Metrics
duration: 7min
completed: 2026-03-31
---

# Phase 01 Plan 03: Claude Code Toggle Gap Closure Summary

**Fix broken Claude Code toggle by wiring SettingsView and getVisibleServiceScope to providerEnabled, adding provider_enabled to Rust PreferencePatch**

## Performance

- **Duration:** 7 min
- **Started:** 2026-03-31T04:22:29Z
- **Completed:** 2026-03-31T04:29:20Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments
- Claude Code toggle in Settings now reads/writes providerEnabled["claude-code"] instead of the legacy claudeCodeUsageEnabled field
- Rust PreferencePatch accepts provider_enabled patches so toggle changes persist to preferences.json
- getVisibleServiceScope uses providerEnabled as sole source of truth, removing the legacy priority block that always returned false
- All 83 Rust tests and 115 TypeScript tests pass

## Task Commits

Each task was committed atomically:

1. **Task 1: Fix Rust PreferencePatch and merge_preferences** - `dfade9e` (fix)
2. **Task 2: Fix SettingsView toggle and getVisibleServiceScope** - `e73a20f` (fix)

## Files Created/Modified
- `src-tauri/src/state/mod.rs` - Added provider_enabled: Option<HashMap<String, bool>> to PreferencePatch
- `src-tauri/src/commands/mod.rs` - Added provider_enabled merge handler before legacy field handler
- `src/app/settings/SettingsView.tsx` - Toggle reads/writes providerEnabled["claude-code"]
- `src/lib/tauri/summary.ts` - Removed legacy claudeCodeUsageEnabled priority block from getVisibleServiceScope
- `src/lib/tauri/summary.test.ts` - Updated test to use providerEnabled, added new positive test case
- `src/app/settings/SettingsView.test.tsx` - Updated 8 test fixtures to use providerEnabled
- `src/app/panel/PanelView.test.tsx` - Updated 4 test fixtures to use providerEnabled
- `src/app/shell/AppShell.test.tsx` - Updated makePreferences helper and toggle assertion

## Decisions Made
- providerEnabled is now the single source of truth for toggle visibility; the legacy claudeCodeUsageEnabled field is read-only for deserialization backward compatibility
- PreferencePatch merges provider_enabled before claude_code_usage_enabled so legacy callers still work

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated PanelView and AppShell test fixtures**
- **Found during:** Task 2 (frontend fix)
- **Issue:** Plan only mentioned summary.test.ts and SettingsView.test.tsx, but PanelView.test.tsx and AppShell.test.tsx also had fixtures relying on claudeCodeUsageEnabled for visibility
- **Fix:** Added providerEnabled to 4 PanelView and 4 AppShell test fixtures
- **Files modified:** src/app/panel/PanelView.test.tsx, src/app/shell/AppShell.test.tsx
- **Verification:** All 115 tests pass
- **Committed in:** e73a20f (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug - additional test fixtures needed updating)
**Impact on plan:** Necessary for correctness. No scope creep.

## Issues Encountered
None

## Known Stubs
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 01 (Provider Registry) is now fully complete with gap closure
- All provider toggle logic uses providerEnabled as single source of truth
- Ready for Phase 02 (Fetch Pipeline) and Phase 03 (New Providers)

---
*Phase: 01-provider-registry*
*Completed: 2026-03-31*
