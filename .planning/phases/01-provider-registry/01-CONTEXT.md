# Phase 1: Provider Registry - Context

**Gathered:** 2026-03-31
**Status:** Ready for planning

<domain>
## Phase Boundary

Establish a single ProviderDescriptor registry as the sole source of truth for all provider IDs, display names, and configuration. Migrate the frontend from per-service state variables to a dynamic map. Existing Codex and Claude Code users must see no behavior change.

</domain>

<decisions>
## Implementation Decisions

### Registry Shape
- **D-01:** Use a static struct array (`const PROVIDERS: &[ProviderDescriptor]`) with compile-time fixed entries and enum dispatch. No trait objects, no heap allocation. Matches CodexBar's approach and existing codebase idioms.

### Registry Fields
- **Claude's Discretion:** Claude picks which fields to include based on the incremental delivery constraint. Start minimal (id, display_name, default_enabled, dashboard_url) and extend as needed in later phases. Fetch strategies and icon config are not needed until Phase 2-3.

### State Migration
- **D-02:** Big bang migration: replace `panelState` + `claudeCodePanelState` with `Map<string, CodexPanelState>` in AppStateValue in this phase. Touches AppShell, PanelView, SettingsView. All consumers switch at once.

### Refresh State
- **Claude's Discretion:** Claude picks how to generalize `isRefreshing` / `isClaudeCodeRefreshing` — either a `Set<string>` of refreshing service IDs or per-entry flags in the map entries. Choose whichever integrates cleanest with the existing AppShell refresh loop.

### Backward Compatibility
- **D-03:** Preferences migration: preserve existing `serviceOrder` entries and append new providers at the end. Unknown IDs are silently stripped on save. Existing users' customization is preserved.

### Snapshot Cache
- **Claude's Discretion:** Claude decides whether to add an explicit `schema_version` field to snapshot-cache.json or continue with best-effort parse + fallback. Either way, old cache data must not crash the app.

### Command Naming
- **Claude's Discretion:** Claude decides whether to introduce generic `get_provider_panel_state(provider_id)` alongside existing commands as aliases, or replace immediately. Minimize blast radius and maintain test coverage either way.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Hardcoded Service ID Lists (all must be replaced)
- `src-tauri/src/state/mod.rs` line 37 — `KNOWN_SERVICE_IDS: [&str; 2]`
- `src-tauri/src/state/mod.rs` line 38 — `KNOWN_MENUBAR_SERVICES: [&str; 3]`
- `src/lib/persistence/preferencesStore.ts` line 37 — `KNOWN_SERVICE_IDS`
- `src/app/panel/PanelView.tsx` line 8 — `SERVICE_DISPLAY_NAMES`
- `src/app/settings/SettingsView.tsx` line 143-144 — hardcoded label switch

### Frontend State (migration targets)
- `src/app/shared/appState.ts` — `AppStateValue` with per-service fields
- `src/app/shell/AppShell.tsx` — manages `panelState` + `claudeCodePanelState` separately
- `src/app/panel/PanelView.tsx` — `stateByServiceId` hardcoded object

### Snapshot Cache
- `src-tauri/src/commands/mod.rs` lines 42-104 — `SnapshotCache` struct, read/write, no schema version

### Research
- `.planning/research/ARCHITECTURE.md` — provider registry architecture recommendations
- `.planning/research/PITFALLS.md` — service ID fragmentation pitfall (#1)
- `.planning/research/codexbar-analysis.md` — CodexBar's ProviderDescriptor pattern

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `SnapshotStatus` enum (`src-tauri/src/snapshot.rs`) — exhaustive tagged union for fetch outcomes; new providers must reuse the same variants
- `CodexPanelState` struct — generic enough for any provider (items, status, desktop_surface)
- `preferencesStore.ts::normalizeServiceOrder` — already filters unknown IDs; can be extended to read from registry

### Established Patterns
- Rust state: `Mutex<T>` in `AppState` for shared mutable state
- Frontend state: React Context via `AppStateContext` with hooks
- IPC: Tauri `#[tauri::command]` functions in `commands/mod.rs`
- Preferences normalization: dual Rust + TypeScript normalizers must stay in sync

### Integration Points
- `src-tauri/src/lib.rs` — app setup, auto-menubar loop startup
- `src-tauri/src/tray/mod.rs` — tray icon reads from panel state
- `src-tauri/src/agent_activity/mod.rs` — activity detection per service
- `src/features/promotions/resolver.ts` — references service IDs for promotion eligibility

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches. The CodexBar competitive analysis provides a reference implementation pattern.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 01-provider-registry*
*Context gathered: 2026-03-31*
