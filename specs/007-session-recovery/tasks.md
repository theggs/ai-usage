# Tasks: Claude Code Session Recovery

**Input**: Design documents from `/specs/007-session-recovery/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, quickstart.md

**Tests**: Required by Constitution Principle III (Test-Gated Integration). Changes to host commands and cross-layer state mapping MUST ship with automated validation.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Phase 1: Setup

**Purpose**: No new project setup needed. This feature modifies 3 existing files in an established project.

*Phase skipped — no setup tasks required.*

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Extend the `PauseState` enum with `SessionRecovery` variant — all user stories depend on this.

- [x] T001 Add `SessionRecovery` variant to `PauseState` enum in `src-tauri/src/claude_code/mod.rs` (line ~57). The new variant MUST NOT carry any data (unlike `RateLimitedUntil(i64)`). Verify `clear_access_pause()` (line ~101) already resets any state to `None` — no change needed there.
- [x] T002 Add `is_session_recovery()` helper function in `src-tauri/src/claude_code/mod.rs` (after `is_access_paused()` at line ~107). Pattern: check `pause_state().lock()` for `PauseState::SessionRecovery`. This helper is used in Phase 3 to control snapshot output but NOT to block auto-refresh.

**Checkpoint**: `cargo test` passes — no behavior change yet, just new enum variant and helper.

---

## Phase 3: User Story 1 — Seamless Session Recovery After Token Expiry (Priority: P1) MVP

**Goal**: When 401 is received and cached data exists, preserve cache and show stale data with recovery message. Auto-refresh continues unblocked; recovery happens automatically on next successful fetch.

**Independent Test**: Simulate 401 with existing cache → panel shows stale data + recovery message. Simulate subsequent 200 → panel returns to fresh.

### Tests for User Story 1

- [x] T003 [US1] Add unit test `session_recovery_preserves_cache` in `src-tauri/src/claude_code/mod.rs` tests module. Test: after a successful fetch populates stale cache, a 401 response MUST NOT clear the cache (assert cache still contains dimensions).
- [x] T004 [US1] Add unit test `session_recovery_sets_pause_state` in `src-tauri/src/claude_code/mod.rs` tests module. Test: after a 401 response, `pause_state()` MUST be `PauseState::SessionRecovery`.
- [x] T005 [US1] Add unit test `session_recovery_does_not_block_auto_refresh` in `src-tauri/src/claude_code/mod.rs` tests module. Test: when `PauseState::SessionRecovery` is active and `refresh_kind == Automatic`, `load_snapshot` MUST still proceed to call the API (not return early with a pause snapshot).
- [x] T006 [US1] Add unit test `session_recovery_cleared_on_success` in `src-tauri/src/claude_code/mod.rs` tests module. Test: after entering `SessionRecovery`, a subsequent 200 response MUST set pause state back to `None`.

### Implementation for User Story 1

- [x] T007 [US1] Rewrite the `Err(ApiError::Status(401))` handler (line ~708) in `src-tauri/src/claude_code/mod.rs`. Changes: (a) remove `clear_access_pause()` call — replace with setting `PauseState::SessionRecovery`, (b) remove cache clearing (`*cache = None`), (c) read stale cache and return snapshot with `snapshot_state: "stale"`, `connection_state: "disconnected"`, cached dimensions, and a product-language status message. Use message: `"Claude Code session is being restored. It usually recovers after you open Claude Code."`.
- [x] T008 [US1] Verify the auto-refresh path in `load_snapshot` (line ~679). The existing check `is_access_paused()` blocks on `AccessDenied` only. Confirm that `SessionRecovery` does NOT match `is_access_paused()` (it shouldn't, since `is_access_paused` checks for `AccessDenied` specifically). No code change needed if confirmed — add a code comment clarifying this intentional design.

**Checkpoint**: `cargo test` passes with all new tests. Core 401 behavior changed: cache preserved, stale snapshot returned, auto-refresh unblocked.

---

## Phase 4: User Story 2 — First-Time 401 Without Cached Data (Priority: P2)

**Goal**: When 401 is received and NO cached data exists, show a friendly empty state with recovery guidance instead of a technical error.

**Independent Test**: Start with empty cache, simulate 401 → panel shows empty state with recovery message (not technical error).

### Tests for User Story 2

- [x] T009 [US2] Add unit test `session_recovery_empty_cache_returns_empty_snapshot` in `src-tauri/src/claude_code/mod.rs` tests module. Test: with no stale cache, a 401 response returns `snapshot_state: "empty"`, `connection_state: "disconnected"`, empty dimensions, and a user-friendly message (not containing "token", "keychain", "401", or "credentials").

### Implementation for User Story 2

- [x] T010 [US2] Extend the 401 handler in `src-tauri/src/claude_code/mod.rs` (from T007) to branch on cache availability. If cache is `None`: return snapshot with `snapshot_state: "empty"`, `connection_state: "disconnected"`, empty dimensions, and message: `"Claude Code session is being restored. Open Claude Code to restore the session."`. If cache exists: use the stale snapshot from T007.

**Checkpoint**: `cargo test` passes. Both cache-present and cache-absent 401 scenarios produce correct, user-friendly snapshots.

---

## Phase 5: User Story 3 — No Regression on 429/403 Handling (Priority: P2)

**Goal**: Ensure session-recovery state transitions correctly to/from rate-limit and access-denied states without interference.

**Independent Test**: Transition between SessionRecovery and RateLimitedUntil/AccessDenied states → each behaves according to its own rules.

### Tests for User Story 3

- [x] T011 [P] [US3] Add unit test `session_recovery_then_429_enters_rate_limit` in `src-tauri/src/claude_code/mod.rs` tests module. Test: from `SessionRecovery` state, a 429 response sets `PauseState::RateLimitedUntil` (not `SessionRecovery`).
- [x] T012 [P] [US3] Add unit test `session_recovery_then_403_enters_access_denied` in `src-tauri/src/claude_code/mod.rs` tests module. Test: from `SessionRecovery` state, a 403 response sets `PauseState::AccessDenied`.
- [x] T013 [P] [US3] Add unit test `rate_limit_expired_then_401_enters_session_recovery` in `src-tauri/src/claude_code/mod.rs` tests module. Test: from expired `RateLimitedUntil` state, a 401 response sets `PauseState::SessionRecovery`.

### Implementation for User Story 3

- [x] T014 [US3] Review all state-setting code paths in `load_snapshot` in `src-tauri/src/claude_code/mod.rs` to confirm state transitions are correct. The 429 handler (line ~729) sets `RateLimitedUntil` unconditionally; the 403 handler (line ~723) sets `AccessDenied` unconditionally; the 200 handler calls `clear_access_pause()` which resets to `None`. All of these correctly override `SessionRecovery`. Verify no code change needed — add clarifying comments if helpful.

**Checkpoint**: `cargo test` passes. State transitions between all four states (None, SessionRecovery, RateLimitedUntil, AccessDenied) are verified.

---

## Phase 6: User Story 4 — Localized Messaging (Priority: P3)

**Goal**: All session-recovery messages are localized in English and Chinese with product-oriented language.

**Independent Test**: Switch language setting → all recovery messages display correctly in both languages without technical jargon.

### Implementation for User Story 4

- [x] T015 [P] [US4] Add `claudeCodeSessionRecovery` copy string to `src/app/shared/i18n.ts`. English: "Claude Code session is being restored. It usually recovers after you open Claude Code." Chinese: "Claude Code 会话恢复中，打开 Claude Code 后通常会自动恢复". Add `claudeCodeSessionRecoveryEmpty` copy string. English: "Claude Code session is being restored. Open Claude Code to restore the session." Chinese: "Claude Code 会话恢复中，请打开 Claude Code 以恢复会话".
- [x] T016 [P] [US4] Update `getClaudeCodePlaceholderMessage()` in `src/app/panel/PanelView.tsx` to detect the new backend recovery messages. Add detection for "session is being restored" (with-cache variant) → map to `claudeCodeSessionRecovery` i18n key. Add detection for "Open Claude Code to restore" (no-cache variant) → map to `claudeCodeSessionRecoveryEmpty` i18n key.
- [x] T017 [US4] Verify that the backend status messages in T007 and T010 contain the substring patterns that T016 detects. Ensure the frontend detection strings match the backend output exactly.

**Checkpoint**: `npm test` passes. Both languages display correct recovery messages for both cache-present and cache-absent scenarios.

---

## Phase 7: Polish & Cross-Cutting Concerns

- [x] T018 Run `cargo test` and `npm test` — verify all existing tests pass with no regressions.
- [x] T019 Run `cargo clippy` — verify no new warnings introduced.
- [x] T020 Follow quickstart.md manual test scenario: start app → trigger 401 → verify stale data shown → restore token → verify auto-recovery on next refresh cycle.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 2 (Foundational)**: No dependencies — start immediately
- **Phase 3 (US1)**: Depends on Phase 2 (needs `SessionRecovery` variant)
- **Phase 4 (US2)**: Depends on Phase 3 T007 (extends the 401 handler written in US1)
- **Phase 5 (US3)**: Depends on Phase 2 only (tests state transitions independent of US1/US2 implementation details)
- **Phase 6 (US4)**: Depends on Phase 3 T007 and Phase 4 T010 (needs final backend message strings to match)
- **Phase 7 (Polish)**: Depends on all previous phases

### User Story Dependencies

- **US1 (P1)**: Depends on Foundational only → **MVP**
- **US2 (P2)**: Depends on US1 (extends same handler)
- **US3 (P2)**: Depends on Foundational only — can run **in parallel** with US1
- **US4 (P3)**: Depends on US1 + US2 (needs final message strings)

### Parallel Opportunities

- T011, T012, T013 (US3 tests) can all run in parallel
- T015, T016 (US4 i18n + frontend) can run in parallel
- US3 (Phase 5) can run in parallel with US1 (Phase 3) since US3 only tests state transitions

---

## Parallel Example: User Story 3

```bash
# Launch all US3 regression tests together:
Task: "T011 — test session_recovery_then_429"
Task: "T012 — test session_recovery_then_403"
Task: "T013 — test rate_limit_expired_then_401"
```

## Parallel Example: User Story 4

```bash
# Launch i18n and frontend detection together:
Task: "T015 — add i18n copy strings in i18n.ts"
Task: "T016 — update placeholder detection in PanelView.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 2: Foundational (T001-T002)
2. Complete Phase 3: User Story 1 (T003-T008)
3. **STOP and VALIDATE**: `cargo test` passes, 401 with cache produces stale snapshot
4. This alone resolves the primary user pain point

### Incremental Delivery

1. Foundational → US1 → **MVP shipped** (cache preserved, auto-recovery works)
2. Add US2 → empty-state variant covered
3. Add US3 → state transition regressions verified
4. Add US4 → localized messages in both languages
5. Polish → full validation pass

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Total: 20 tasks across 7 phases
- Constitution Principle III requires tests — test tasks are included for US1, US2, and US3
- All Rust changes are in a single file (`claude_code/mod.rs`); frontend changes span 2 files (`i18n.ts`, `PanelView.tsx`)
- Commit after each phase checkpoint
