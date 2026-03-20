# Tasks: Claude Code Service Support

**Input**: Design documents from `/specs/005-claude-code-support/`
**Prerequisites**: plan.md ✅ spec.md ✅ research.md ✅ data-model.md ✅ contracts/ ✅ quickstart.md ✅

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Exact file paths are included in each task description

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Add new Rust dependencies and declare the new module. These unblock all Rust implementation tasks.

- [X] T001 Add `ureq = { version = "2", features = ["json"] }`, `chrono = { version = "0.4", features = ["serde"] }`, and `sha2 = "0.10"` to `src-tauri/Cargo.toml`
- [X] T002 Declare `mod claude_code;` in `src-tauri/src/lib.rs` and create the stub file `src-tauri/src/claude_code/mod.rs` (empty module)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Schema and contract changes that US2 and US3 depend on, and i18n keys that all stories need. Must be complete before user story phases begin.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T003 Extend `UserPreferences` and `PreferencePatch` structs in `src-tauri/src/state/mod.rs` — add `menubar_service: String` and `service_order: Vec<String>` fields with `#[serde(default)]` helper functions (`default_menubar_service() → "codex"`, `default_service_order() → ["codex","claude-code"]`) and update `default_preferences()` in the same file; separately update `merge_preferences()` in `src-tauri/src/commands/mod.rs` to apply both new patch fields
- [X] T004 [P] Extend `UserPreferences` and `PreferencePatch` interfaces in `src/lib/tauri/contracts.ts` — add `menubarService: string` and `serviceOrder: string[]` fields; update `defaultPreferences` in `src/features/preferences/defaultPreferences.ts` to include defaults `menubarService: "codex"` and `serviceOrder: ["codex", "claude-code"]`
- [X] T005 [P] Add new copy keys to `CopyTree` type and `baseCopy` / `zhCN` overrides in `src/app/shared/i18n.ts`: `menubarService`, `serviceOrder`, `claudeCodeLabel`, `codexLabel`, `claudeCodeNotConnected` (see research.md Decision 7 for string values)

**Checkpoint**: Rust schema extended with defaults; TypeScript contracts updated; i18n keys available. User story work can now begin.

---

## Phase 3: User Story 1 — Claude Code Quota in Main Panel (Priority: P1) 🎯 MVP

**Goal**: A user with valid Claude Code credentials sees quota dimensions (remaining %, progress bar, reset hint) in the main panel's Claude Code service card.

**Independent Test**: Set `CLAUDE_CODE_OAUTH_TOKEN=<valid-token>` or ensure `~/.claude/.credentials.json` exists; launch app; verify Claude Code service card appears in panel with ≥1 quota dimension, colored progress bar, and reset hint. Without credentials, verify a "not connected" card appears (not a crash).

### Implementation for User Story 1

- [X] T006 [US1] Implement credential reader in `src-tauri/src/claude_code/mod.rs`: check `CLAUDE_CODE_OAUTH_TOKEN` env var first; on macOS run `security find-generic-password` (handling `CLAUDE_CONFIG_DIR` hash suffix via sha2); fall back to reading `~/.claude/.credentials.json`; parse JSON to extract `claudeAiOauth.accessToken`; return `None` with `connection_state: "unavailable"` if all paths yield nothing
- [X] T007 [US1] Implement HTTP API call in `src-tauri/src/claude_code/mod.rs`: use `ureq` to GET `https://api.anthropic.com/api/oauth/usage` with headers `Authorization: Bearer <token>` and `anthropic-beta: oauth-2025-04-20`; deserialize response into `ClaudeCodeUsageResponse` struct (`five_hour`, `seven_day`, `seven_day_sonnet`, `seven_day_opus` — each `Option<UsageDimension { utilization: f64, resets_at: String }>`)
- [X] T008 [US1] Implement dimension transformation and snapshot assembly in `src-tauri/src/claude_code/mod.rs`: for each non-null dimension compute `remaining_percent = (100.0 - utilization).round().clamp(0,100) as u8`; map field name to label string (per research.md Decision 7); parse `resets_at` ISO 8601 with `chrono` and produce `reset_hint` string matching the codex format (`"Resets in Xh"`, `"Resets in Xm"`, `"Resets in Xd"`, `"Reset due"`); classify errors: HTTP 401/403 → set BOTH `snapshot_state: "failed"` AND `connection_state: "disconnected"`; any other transient failure (429, 5xx, timeout) with a cached prior snapshot → `snapshot_state: "stale"` and reuse cached dimensions; no credentials found → `snapshot_state: "empty"`, `connection_state: "unavailable"`; successful response → `snapshot_state: "fresh"`, `connection_state: "connected"`
- [X] T009 [US1] Add `#[cfg(test)]` unit tests in `src-tauri/src/claude_code/mod.rs` covering the transformation and classification logic: (a) hex decode of a known keychain byte sequence produces the expected JSON string; (b) `utilization = 35.0` → `remaining_percent = 65`; (c) `utilization = 100.5` → `remaining_percent = 0` (clamp); (d) ISO 8601 `resets_at` 90 minutes in the future → `"Resets in 1h"`; (e) ISO 8601 `resets_at` in the past → `"Reset due"`; (f) simulated 401 response path → `snapshot_state: "failed"`, `connection_state: "disconnected"`; (g) simulated transient failure with prior cache → `snapshot_state: "stale"`, cached dimensions returned
- [X] T010 [US1] Add `get_claude_code_panel_state` and `refresh_claude_code_panel_state` Tauri commands in `src-tauri/src/commands/mod.rs`, mirroring the existing Codex commands; build `PanelPlaceholderItem` with `service_id: "claude-code"`, `service_name: "Claude Code"`, `icon_key: "claude-code"`; call `normalize_dimensions()` on the snapshot's dimensions; return empty `items` vec (not a panic) when `snapshot_state` is `"empty"` or `"failed"`; extract a reusable `build_claude_code_items()` helper so the merged-items slice can be produced from other command handlers (needed by T017)
- [X] T011 [US1] Register `get_claude_code_panel_state` and `refresh_claude_code_panel_state` in the Tauri command handler in `src-tauri/src/lib.rs`
- [X] T012 [P] [US1] Add `getClaudeCodePanelState` and `refreshClaudeCodePanelState` to `src/lib/tauri/client.ts`: invoke the new Tauri commands; add mock fallback cases in the `invoke` switch (using `createDemoPanelState` for browser mode); apply `withSummary` wrapper consistent with existing pattern
- [X] T013 [P] [US1] Update `src/app/shared/appState.ts` to fetch `claudeCodePanelState` alongside `codexPanelState` using `Promise.all`; expose it in the shared app state context so panel components can consume it
- [X] T014 [US1] Wire `tauriClient.refreshClaudeCodePanelState()` into the same periodic refresh timer in `src/app/shared/appState.ts` that drives `tauriClient.refreshCodexPanelState()`, sharing the `refreshIntervalMinutes` preference — Claude Code API is called no more frequently than the configured interval, satisfying SC-005
- [X] T015 [US1] Update panel rendering in `src/components/panel/PanelView.tsx` to display the Claude Code service card: when `claudeCodePanelState.items` is non-empty render `ServiceCard` with its `QuotaSummary` dimensions (reusing existing components unchanged); when `items` is empty render a "not connected" placeholder card at the Claude Code position using the `claudeCodeNotConnected` i18n copy key

**Checkpoint**: Claude Code quota card visible in the panel with live data or a clear not-connected state. Codex card unchanged. `cargo test` in `src-tauri/` passes.

---

## Phase 4: User Story 2 — Menubar Service Preference (Priority: P2)

**Goal**: A user can select exactly one service (Codex or Claude Code) from Settings to drive the macOS menubar indicator; the tray updates immediately without restart.

**Independent Test**: Open Settings; change menubar service to "Claude Code"; verify tray title/badge updates within 3 seconds to reflect Claude Code quota. Change back to "Codex"; verify tray reverts. Set a service to unavailable; verify tray shows neutral indicator (no stale percentage from the other service).

### Implementation for User Story 2

- [X] T016 [US2] Update `apply_display_mode` in `src-tauri/src/tray/mod.rs` to accept `menubar_service: &str` and filter `items` to only the item whose `service_id` matches before calling `format_summary`; when no matching item is found or the matching item has no dimensions, produce no summary text (neutral indicator)
- [X] T017 [US2] Update all call sites of `apply_display_mode` in `src-tauri/src/commands/mod.rs` (`save_preferences`, `set_autostart`): construct the merged items slice by calling both `build_panel_state(...).items` (Codex) and `build_claude_code_items()` (the helper extracted in T010) then concatenating them; pass `&preferences.menubar_service` and the merged slice to `apply_display_mode` — the filtering now happens inside `apply_display_mode`, not at the call site
- [X] T018 [P] [US2] Add menubar service picker to the settings UI in `src/components/settings/` (check `ls src/components/settings/` to identify the preferences panel file): render a radio group or select using the `menubarService` preference value; list known service IDs with their display labels from i18n (`codexLabel`, `claudeCodeLabel`); on change call `tauriClient.savePreferences({ menubarService: selectedId })`
- [X] T019 [P] [US2] Add Rust unit test in `src-tauri/src/tray/mod.rs` (within the existing `#[cfg(test)]` block): verify that when items from two services are passed and filtered to only `service_id == "claude-code"`, `format_summary` returns Claude Code dimensions only; verify neutral result (`None`) when the filtered items list is empty

**Checkpoint**: Tray shows only the selected service's quota. Preference persists across app restarts.

---

## Phase 5: User Story 3 — Panel Display Order (Priority: P3)

**Goal**: A user can configure the order of AI service cards in the main panel; the configured order persists and is reflected on the next panel open.

**Independent Test**: Open Settings; move Claude Code above Codex in the order control; reopen panel; verify Claude Code card appears first. Move Codex back above Claude Code; verify order reverts.

### Implementation for User Story 3

- [X] T020 [US3] Update panel rendering in `src/components/panel/PanelView.tsx` to iterate `preferences.serviceOrder` and render each service card in that order; for each service ID map to the correct state (`codexPanelState` or `claudeCodePanelState`); unknown service IDs are silently skipped; a service with `items: []` renders its "not connected" card at its configured position
- [X] T021 [P] [US3] Add service order control to the settings UI in `src/components/settings/` (check `ls src/components/settings/` to identify the preferences panel file): render an ordered list of service names (from `serviceOrder` preference) with up/down controls or drag handles; on reorder call `tauriClient.savePreferences({ serviceOrder: newOrder })`
- [X] T022 [P] [US3] Add Rust serde unit test in `src-tauri/src/state/mod.rs` (`#[cfg(test)]`): deserialize a minimal `UserPreferences` JSON string that omits `menubarService` and `serviceOrder` fields; assert the defaults `"codex"` and `["codex","claude-code"]` are applied correctly (backward compatibility gate)

**Checkpoint**: Panel renders in user-configured order. All three user stories are independently functional.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final validation, contract tests, and documentation.

- [X] T023 [P] Add TypeScript contract test in `tests/contract/claude-code-panel-state.test.ts`: invoke `get_claude_code_panel_state` mock via `tauriClient.getClaudeCodePanelState()`; assert the response shape matches `CodexPanelState` (required fields present, `items` is array, `snapshotState` is a known value, `desktopSurface` present)
- [X] T024 [P] Update `AGENTS.md` feature history section to add entry `005-claude-code-support: Claude Code quota display, menubar service selection, panel display order`
- [X] T025 Run `cargo test` in `src-tauri/` and `npx vitest run` at repo root; confirm all tests pass with no regressions to existing Codex behavior

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 (Cargo.toml must be updated before Rust code compiles) — **BLOCKS all user stories**
- **US1 (Phase 3)**: Depends on Phase 2 completion
- **US2 (Phase 4)**: Depends on Phase 2 completion; integrates with Phase 3 (needs `build_claude_code_items()` helper from T010 for merged tray items)
- **US3 (Phase 5)**: Depends on Phase 2 and Phase 3 (needs both service states to order)
- **Polish (Phase 6)**: Depends on all user story phases complete

### User Story Dependencies

- **US1 (P1)**: Can start after Phase 2 — no dependency on US2 or US3
- **US2 (P2)**: Can start after Phase 2 — tray filtering works before US1 completes (neutral tray), but full end-to-end test requires US1; T017 requires the `build_claude_code_items()` helper from T010
- **US3 (P3)**: Depends on US1 for meaningful ordering (both service states must exist)

### Within Each User Story

- T006 → T007 → T008 → T009 → T010 → T011 (sequential Rust chain in US1)
- T012 and T013 can run in parallel once T004 (contracts) is complete
- T014 depends on T013
- T015 depends on T012 + T013
- T016 → T017 (sequential in US2; T017 changes call sites after T016 changes the signature)
- T018 and T019 can run in parallel with T016 + T017

### Parallel Opportunities

- T004, T005 can run in parallel (both in Phase 2, different files)
- T012, T013 can run in parallel (different files within US1)
- T018, T019 can run in parallel (different files within US2)
- T021, T022 can run in parallel (different files within US3)
- T023, T024 can run in parallel (different files in Polish phase)

---

## Parallel Example: User Story 1

```bash
# After T011 (Rust commands registered), launch in parallel:
Task T012: "Add getClaudeCodePanelState to src/lib/tauri/client.ts"
Task T013: "Update src/app/shared/appState.ts to fetch claudeCodePanelState"
# T014 and T015 wait for both T012 and T013 to complete
```

## Parallel Example: User Story 2

```bash
# After T003 (Rust preferences extended), launch in parallel:
Task T018: "Add menubar service picker to src/components/settings/"
Task T019: "Add tray filtering unit test to src-tauri/src/tray/mod.rs"
# Both can proceed while T016 → T017 Rust work is underway
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001–T002)
2. Complete Phase 2: Foundational (T003–T005)
3. Complete Phase 3: User Story 1 (T006–T015)
4. **STOP and VALIDATE**: Claude Code card visible in panel with live data or not-connected state; `cargo test` passes; Codex unaffected
5. Demo/ship if ready

### Incremental Delivery

1. Phase 1 + 2 → Infrastructure ready
2. Phase 3 (US1) → Claude Code quota visible in panel ✅ **MVP**
3. Phase 4 (US2) → User controls which service appears in menubar ✅
4. Phase 5 (US3) → User controls panel display order ✅
5. Phase 6 → All tests pass, docs updated ✅

### Notes

- `[P]` tasks = different files, no blocking dependency on other in-flight tasks
- `[Story]` label maps each task to its user story for traceability
- US1 is the MVP — phases 4 and 5 add no value without it
- Commit after each checkpoint (end of US1, US2, US3 phases)
- Run `cargo test` after T011 and after T019 to catch Rust regressions early
- T009 (Rust unit tests) must pass before T011 registers the commands — constitution Principle III gate
