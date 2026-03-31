---
phase: 01-provider-registry
plan: 01
subsystem: api
tags: [registry, provider-abstraction, preferences-migration, snapshot-cache]

# Dependency graph
requires: []
provides:
  - "ProviderDescriptor registry (Rust + TypeScript) as single source of truth for provider metadata"
  - "provider_enabled HashMap in UserPreferences replacing individual boolean flags"
  - "schema_version field on SnapshotCache for graceful cache invalidation"
  - "Registry helper functions: providerIds(), menubarServiceIds(), getProvider()"
affects: [01-02-PLAN, 02-frontend-migration, 03-new-providers]

# Tech tracking
tech-stack:
  added: []
  patterns: ["Static registry pattern for provider metadata", "Schema-versioned cache with automatic discard on mismatch", "Legacy field migration via skip_serializing + providerEnabled map seeding"]

key-files:
  created:
    - "src-tauri/src/registry.rs"
    - "src/lib/tauri/registry.ts"
    - "src/lib/tauri/registry.test.ts"
    - "src/lib/persistence/preferencesStore.test.ts"
  modified:
    - "src-tauri/src/lib.rs"
    - "src-tauri/src/state/mod.rs"
    - "src-tauri/src/commands/mod.rs"
    - "src-tauri/src/tray/mod.rs"
    - "src-tauri/src/agent_activity/mod.rs"
    - "src/lib/tauri/contracts.ts"
    - "src/lib/persistence/preferencesStore.ts"
    - "src/features/preferences/defaultPreferences.ts"

key-decisions:
  - "Used static struct array (not trait) for ProviderDescriptor per D-01 decision from research phase"
  - "MenubarService type changed from union literal to string to support dynamic providers"
  - "claude_code_usage_enabled marked skip_serializing to read legacy data but never write it back"
  - "provider_enabled uses HashMap<String, bool> seeded from registry defaults on first normalization"

patterns-established:
  - "Registry pattern: all provider metadata in registry.rs / registry.ts, no hardcoded lists elsewhere"
  - "Cache versioning: SNAPSHOT_CACHE_VERSION constant, mismatch discards entire cache"
  - "Legacy migration: keep old field for deserialization, use new field for all logic, never serialize old field"

requirements-completed: [PROV-01, PROV-07, PROV-08]

# Metrics
duration: 9min
completed: 2026-03-31
---

# Phase 01 Plan 01: Provider Registry Summary

**ProviderDescriptor registry in Rust and TypeScript as single source of truth, with schema-versioned snapshot cache and providerEnabled preferences migration**

## Performance

- **Duration:** 9 min
- **Started:** 2026-03-31T03:03:04Z
- **Completed:** 2026-03-31T03:12:41Z
- **Tasks:** 2
- **Files modified:** 12

## Accomplishments
- Created ProviderDescriptor registry in both Rust (static slice) and TypeScript (frozen array) with identical provider data for codex and claude-code
- Added schema_version to SnapshotCache with automatic discard on version mismatch, preventing crashes from incompatible cache formats
- Migrated UserPreferences from individual boolean flags to a dynamic providerEnabled map seeded from registry defaults
- Removed all KNOWN_SERVICE_IDS and KNOWN_MENUBAR_SERVICES hardcoded constants from state/mod.rs and preferencesStore.ts

## Task Commits

Each task was committed atomically:

1. **Task 1: Create ProviderDescriptor registries (Rust + TypeScript) and tests** - `f86435f` (feat)
2. **Task 2: Add schema_version to SnapshotCache and migrate preferences to providerEnabled map** - `3e7514b` (feat)

## Files Created/Modified
- `src-tauri/src/registry.rs` - ProviderDescriptor struct, PROVIDERS static slice, helper functions
- `src/lib/tauri/registry.ts` - TypeScript mirror of Rust registry with identical data
- `src/lib/tauri/registry.test.ts` - 6 Vitest tests for registry exports
- `src/lib/persistence/preferencesStore.test.ts` - 6 Vitest tests for preferences normalization with providerEnabled
- `src-tauri/src/lib.rs` - Added mod registry declaration
- `src-tauri/src/state/mod.rs` - Removed hardcoded constants, added provider_enabled field, updated normalize_preferences
- `src-tauri/src/commands/mod.rs` - Added SNAPSHOT_CACHE_VERSION, schema_version field, updated is_claude_code_usage_enabled
- `src-tauri/src/tray/mod.rs` - Updated menubar service resolution to use provider_enabled
- `src-tauri/src/agent_activity/mod.rs` - Updated eligibility check to use provider_enabled
- `src/lib/tauri/contracts.ts` - Added providerEnabled to UserPreferences/PreferencePatch, changed MenubarService to string
- `src/lib/persistence/preferencesStore.ts` - Replaced hardcoded constants with registry imports, updated normalizers
- `src/features/preferences/defaultPreferences.ts` - Added providerEnabled seeded from registry

## Decisions Made
- Used static struct array (not trait) for ProviderDescriptor per D-01 decision from research phase
- Changed MenubarService from union literal type to string to support future dynamic providers
- Marked claude_code_usage_enabled as skip_serializing: read old data for migration but never persist it
- Updated all production code paths (tray, agent_activity, commands) to read from provider_enabled with fallback to legacy field

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated tray/mod.rs and agent_activity/mod.rs to use provider_enabled**
- **Found during:** Task 2 (preferences migration)
- **Issue:** Production code in tray/mod.rs and agent_activity/mod.rs still read claude_code_usage_enabled directly, which would be inconsistent after migration since the field is now skip_serializing
- **Fix:** Updated resolve_effective_menubar_service in tray/mod.rs and collect_service_activity_snapshots in agent_activity/mod.rs to read from provider_enabled with fallback
- **Files modified:** src-tauri/src/tray/mod.rs, src-tauri/src/agent_activity/mod.rs
- **Verification:** All 83 Rust tests pass including tray and agent_activity tests
- **Committed in:** 3e7514b (Task 2 commit)

**2. [Rule 1 - Bug] Updated save_preferences command to sync provider_enabled on claude_code_usage_enabled patch**
- **Found during:** Task 2 (preferences migration)
- **Issue:** save_preferences command patched claude_code_usage_enabled without updating provider_enabled map
- **Fix:** Added provider_enabled insert when claude_code_usage_enabled is patched
- **Files modified:** src-tauri/src/commands/mod.rs
- **Verification:** All Rust tests pass
- **Committed in:** 3e7514b (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (2 bugs)
**Impact on plan:** Both fixes required for consistency between old and new preferences model. No scope creep.

## Issues Encountered
- Rust test PoisonError cascade: tests sharing env_lock mutex all failed when one test panicked due to inconsistent provider_enabled state. Fixed by updating all test fixtures to include provider_enabled alongside claude_code_usage_enabled.

## Known Stubs
None - all data paths are fully wired.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Registry modules ready for consumption by Plan 02 (frontend migration to use registry throughout UI)
- All existing tests updated and passing (83 Rust, 114 TypeScript)
- Legacy preferences backward compatible: old files deserialize cleanly, new providerEnabled map seeded automatically

---
*Phase: 01-provider-registry*
*Completed: 2026-03-31*
