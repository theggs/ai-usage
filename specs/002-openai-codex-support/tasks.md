# Tasks: Iteration 2 Codex Usage Limits

**Input**: Design documents from `/specs/002-openai-codex-support/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/, quickstart.md

**Tests**: Include frontend, contract, integration, and Rust parsing tests because the specification, quickstart, and constitution require automated validation for host/UI contracts, CLI snapshot parsing, account persistence, and truthful state rendering.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Prepare the Iteration 2 workspace, contracts, and feature modules for Codex usage-limit integration.

- [X] T001 Extend shared TypeScript contracts for Codex accounts, active sessions, snapshots, and panel states in `src/lib/tauri/contracts.ts`
- [X] T002 [P] Create frontend persistence helpers for saved Codex accounts in `src/lib/persistence/codexAccountStore.ts`
- [X] T003 [P] Create the Rust Codex feature module skeleton in `src-tauri/src/codex/mod.rs`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Build the shared host/UI plumbing required before any user story can deliver real Codex usage data.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T004 Implement Rust-side Codex state models for active sessions, snapshots, and connection states in `src-tauri/src/state/mod.rs`
- [X] T005 [P] Add host command definitions for Codex panel state and Codex account CRUD in `src-tauri/src/commands/mod.rs`
- [X] T006 [P] Add frontend Tauri bridge methods for Codex panel state and Codex account commands in `src/lib/tauri/client.ts`
- [X] T007 Wire Codex panel state and saved-account state into shared app state in `src/app/shared/appState.ts` and `src/app/shell/AppShell.tsx`
- [X] T008 Update localized copy for Codex account, session, and disconnected-state messaging in `src/app/shared/i18n.ts`

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - 在设置页理解本地 Codex CLI 同步方式 (Priority: P1) 🎯 MVP

**Goal**: Let users understand that Iteration 2 reads usage only from one local Codex CLI session and does not require manual account or credential entry.

**Independent Test**: Open settings and confirm the page explains the local Codex CLI sync path, shows current session state, and does not ask for manual Codex account or credential input.

### Tests for User Story 1

- [X] T009 [P] [US1] Add settings interaction coverage for local Codex CLI guidance and session-state hints in `src/app/settings/SettingsView.test.tsx`
- [X] T010 [P] [US1] Keep host-owned reserved Codex account persistence covered outside the primary UI flow in `tests/integration/preferences-persistence.test.ts`

### Implementation for User Story 1

- [X] T011 [P] [US1] Keep reserved Codex account normalization isolated in host-facing persistence helpers in `src/lib/persistence/codexAccountStore.ts`
- [X] T012 [P] [US1] Keep reserved Codex account persistence out of the primary preferences flow in `src/features/preferences/preferencesController.ts`
- [X] T013 [US1] Implement the settings view as a Codex CLI guidance workflow in `src/app/settings/SettingsView.tsx`
- [X] T014 [US1] Update reusable settings components for local session hints and CLI setup guidance in `src/components/settings/PreferenceSection.tsx` and `src/components/settings/PreferenceField.tsx`

**Checkpoint**: At this point, User Story 1 should be fully functional and testable independently

---

## Phase 4: User Story 2 - 在面板中看到 Codex 额度状态 (Priority: P1)

**Goal**: Show real Codex usage-limit state for one active local Codex session while truthfully distinguishing empty, disconnected, stale, and failed states.

**Independent Test**: With a readable local Codex CLI snapshot source, refresh the panel and verify that live limit dimensions render; when no session is available, verify the panel shows an explicit disconnected state instead of demo data.

### Tests for User Story 2

- [X] T015 [P] [US2] Add panel rendering coverage for empty, disconnected, and live Codex session states in `src/app/panel/PanelView.test.tsx`
- [X] T016 [P] [US2] Add contract coverage for Codex panel host commands in `tests/contract/demo-panel.contract.test.ts`
- [X] T017 [P] [US2] Add Rust parsing coverage for healthy, empty, and failed Codex CLI snapshots in `src-tauri/src/codex/mod.rs`

### Implementation for User Story 2

- [X] T018 [P] [US2] Implement Codex CLI structured rate-limit invocation and snapshot normalization in `src-tauri/src/codex/mod.rs`
- [X] T019 [P] [US2] Map Codex snapshot state into tray summary and panel payload behavior in `src-tauri/src/tray/mod.rs` and `src-tauri/src/commands/mod.rs`
- [X] T020 [P] [US2] Replace demo panel loading with Codex panel-state loading and refresh flows in `src/features/demo-services/panelController.ts`
- [X] T021 [US2] Render active-session limit dimensions, reserved-account summaries, and disconnected/error states in `src/app/panel/PanelView.tsx`
- [X] T022 [US2] Update service-card style components to support live Codex limit rows and state badges in `src/components/panel/ServiceCard.tsx` and `src/components/panel/QuotaSummary.tsx`

**Checkpoint**: At this point, User Stories 1 AND 2 should both work independently

---

## Phase 5: User Story 3 - 为真实 Codex 额度接入建立正确的业务边界 (Priority: P2)

**Goal**: Enforce the host-boundary and truthful-state rules so future Codex expansion does not leak CLI execution or collapse distinct failure states.

**Independent Test**: Review the code and docs to confirm the frontend does not execute or parse Codex CLI output directly, host/UI contracts are documented, and disconnected/failure states remain explicit.

### Tests for User Story 3

- [X] T023 [P] [US3] Add integration coverage for host-command fallback behavior when the Codex CLI session is unavailable in `tests/integration/system-integrations.test.ts`
- [X] T024 [P] [US3] Add contract assertions for reserved-account versus active-session separation in `tests/contract/demo-panel.contract.test.ts`

### Implementation for User Story 3

- [X] T025 [P] [US3] Update Iteration 2 research and quickstart guidance to reflect actual host-boundary implementation details in `specs/002-openai-codex-support/research.md` and `specs/002-openai-codex-support/quickstart.md`
- [X] T026 [P] [US3] Refine the Codex usage contract to match final command payloads and failure modes in `specs/002-openai-codex-support/contracts/codex-usage-contract.md`
- [X] T027 [US3] Ensure frontend state management consumes normalized Codex payloads only and never raw CLI text in `src/app/shell/AppShell.tsx` and `src/lib/tauri/client.ts`
- [X] T028 [US3] Add user-facing fallback messaging for pending, stale, disconnected, and parse-failure states in `src/app/panel/PanelView.tsx` and `src/app/shared/i18n.ts`

**Checkpoint**: All user stories should now be independently functional

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Tighten cross-story quality, documentation, and acceptance validation.

- [X] T029 [P] Update README validation guidance for Codex CLI prerequisites and real session checks in `README.md`
- [X] T030 [P] Validate final traceability across `spec.md`, `plan.md`, and `tasks.md` for Codex-limit constraints and sequencing in `specs/002-openai-codex-support/tasks.md`
- [X] T031 Run the Iteration 2 quickstart validation flow and record fixes in `specs/002-openai-codex-support/quickstart.md`

---

## Phase 7: Real CLI Read Remediation

**Purpose**: Close the remaining gap between the Iteration 2 goal and the current implementation by replacing snapshot-env fallback as the primary path with a real host-side Codex CLI read from an already logged-in local session.

- [X] T032 Audit the installed Codex CLI for a stable non-interactive status/usage read path and document the chosen invocation contract in `specs/002-openai-codex-support/research.md`
- [X] T033 [P] Add Rust tests for direct Codex CLI invocation success, disconnected output, and execution failure in `src-tauri/src/codex/mod.rs`
- [ ] T034 [P] Add contract coverage for real-host-read precedence over env/file fallback in `tests/contract/demo-panel.contract.test.ts`

### Implementation for Real CLI Read

- [X] T035 Implement a real host-side Codex CLI reader that prefers local logged-in session reads and uses env/file only as fallback in `src-tauri/src/codex/mod.rs`
- [X] T036 [P] Thread the real CLI read result through `src-tauri/src/commands/mod.rs` so active-session presence and snapshot state reflect actual local session availability
- [X] T037 [P] Update panel and settings guidance for the real local-session flow, including actionable “how to connect” messaging when CLI login/session state is missing, in `src/app/panel/PanelView.tsx`, `src/app/settings/SettingsView.tsx`, and `src/app/shared/i18n.ts`
- [X] T038 Update the Codex host/UI contract and quickstart to describe the real invocation path, troubleshooting steps, and env/file fallback as test-only support in `specs/002-openai-codex-support/contracts/codex-usage-contract.md` and `specs/002-openai-codex-support/quickstart.md`
- [X] T039 Update README local validation guidance to prioritize real logged-in Codex CLI checks over manual snapshot env vars in `README.md`
- [ ] T040 Run end-to-end validation for the real local CLI path and record any required follow-up fixes in `specs/002-openai-codex-support/tasks.md`
- [X] T041 Add tray-summary rule support for lowest remaining, 5h, week, multi-dimension, and icon-only modes in `src/lib/tauri/summary.ts`, `src-tauri/src/tray/mod.rs`, and `src/app/settings/SettingsView.tsx`
- [X] T042 Persist tray-summary preferences across app restarts in `src-tauri/src/codex/mod.rs`, `src-tauri/src/lib.rs`, `src-tauri/src/commands/mod.rs`, and `src/lib/persistence/preferencesStore.ts`
- [X] T043 Update settings and persistence tests to verify tray-summary rule saving in `src/app/settings/SettingsView.test.tsx`, `src/lib/tauri/summary.test.ts`, `src/components/panel/ServiceCard.test.tsx`, and `tests/integration/preferences-persistence.test.ts`
- [X] T044 Update `spec.md`, `tasks.md`, and `doc/ai-usage-prd` so Iteration 2 reflects the clarified Codex CLI scope, tray-summary rules, and persisted settings behavior

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Story 1 (Phase 3)**: Depends on Foundational completion
- **User Story 2 (Phase 4)**: Depends on Foundational completion and benefits from User Story 1 account-management flows for integrated validation
- **User Story 3 (Phase 5)**: Depends on Foundational completion and should finalize after the host/UI contracts from User Story 2 stabilize
- **Polish (Phase 6)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - no dependency on other stories
- **User Story 2 (P1)**: Can start after Foundational (Phase 2), but final integrated validation depends on User Story 1 account setup existing
- **User Story 3 (P2)**: Can start after Foundational (Phase 2), but its final validation depends on User Story 2 host/UI payloads being implemented

### Within Each User Story

- Tests should be written before or alongside implementation and fail before the feature work is considered complete
- Shared state and contracts should exist before view wiring assumes the final payload shape
- Rust parsing and host command behavior should exist before the frontend expects live Codex session data
- Each story must pass its independent test before moving on

### Parallel Opportunities

- `T002` and `T003` can run in parallel after `T001`
- `T005` and `T006` can run in parallel after `T004`
- `T009` and `T010` can run in parallel for US1
- `T011` and `T012` can run in parallel for US1 before `T013`
- `T015`, `T016`, and `T017` can run in parallel for US2
- `T018`, `T019`, and `T020` can run in parallel for US2 before `T021`
- `T023` and `T024` can run in parallel for US3
- `T025` and `T026` can run in parallel for US3
- `T029` and `T030` can run in parallel in the polish phase
- `T033` and `T034` can run in parallel before `T035`
- `T036`, `T037`, and `T038` can run in parallel after `T035`

---

## Parallel Example: User Story 1

```bash
# Launch US1 validation work in parallel:
Task: "Add settings interaction coverage for saved Codex account creation, enable/disable, and removal in src/app/settings/SettingsView.test.tsx"
Task: "Add persistence integration coverage for saved Codex account recovery in tests/integration/preferences-persistence.test.ts"

# Launch US1 implementation work in parallel:
Task: "Implement saved Codex account validation and normalization in src/lib/persistence/codexAccountStore.ts"
Task: "Expose saved Codex account load/save/toggle flows through the preferences feature in src/features/preferences/preferencesController.ts"
```

---

## Parallel Example: User Story 2

```bash
# Launch US2 validation work in parallel:
Task: "Add panel rendering coverage for empty, disconnected, and live Codex session states in src/app/panel/PanelView.test.tsx"
Task: "Add contract coverage for Codex panel host commands in tests/contract/demo-panel.contract.test.ts"
Task: "Add Rust parsing coverage for healthy, empty, and failed Codex CLI snapshots in src-tauri/src/codex/mod.rs"

# Launch US2 implementation work in parallel:
Task: "Implement Codex CLI structured rate-limit invocation and snapshot normalization in src-tauri/src/codex/mod.rs"
Task: "Map Codex snapshot state into tray summary and panel payload behavior in src-tauri/src/tray/mod.rs and src-tauri/src/commands/mod.rs"
Task: "Replace demo panel loading with Codex panel-state loading and refresh flows in src/features/demo-services/panelController.ts"
```

---

## Parallel Example: User Story 3

```bash
# Launch US3 validation work in parallel:
Task: "Add integration coverage for host-command fallback behavior when the Codex CLI session is unavailable in tests/integration/system-integrations.test.ts"
Task: "Add contract assertions for reserved-account versus active-session separation in tests/contract/demo-panel.contract.test.ts"

# Launch US3 implementation work in parallel:
Task: "Update Iteration 2 research and quickstart guidance to reflect actual host-boundary implementation details in specs/002-openai-codex-support/research.md and specs/002-openai-codex-support/quickstart.md"
Task: "Refine the Codex usage contract to match final command payloads and failure modes in specs/002-openai-codex-support/contracts/codex-usage-contract.md"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational
3. Complete Phase 3: User Story 1
4. Validate saved Codex account management and restart persistence
5. Demo the settings-side groundwork before wiring live CLI data

### Incremental Delivery

1. Complete Setup + Foundational to establish Codex account and command plumbing
2. Add User Story 1 and validate saved-account management independently
3. Add User Story 2 and validate live local-session limit rendering without breaking the saved-account flows
4. Add User Story 3 and validate host-boundary discipline plus truthful fallback states
5. Finish with polish and quickstart verification
6. Complete Phase 7 to replace test-only snapshot injection with the real logged-in Codex CLI read path

### Parallel Team Strategy

1. One developer handles shared contracts and host-state plumbing while another prepares settings persistence updates after setup
2. After Foundational is complete:
   - Developer A: User Story 1 account-management flow
   - Developer B: User Story 2 Codex CLI parsing and panel rendering
   - Developer C: User Story 3 contract hardening and fallback-state validation
3. Rejoin in Phase 6 for README updates, traceability cleanup, and full validation

---

## Notes

- [P] tasks touch separate files or modules and can be worked on independently
- Story labels map each task back to a specific user story for traceability
- User Story 1 is the recommended MVP scope because it establishes the future-proof account model required by later live-session work
- The planned persistence module uses a Codex-specific filename to avoid terminology drift with the clarified Codex-only scope
- The task list reflects constitution requirements for host-boundary security, contract-first design, test-gated integration, and truthful user states
- Traceability validation completed: `spec.md` requirements now map to local Codex CLI guidance, host-normalized Codex payloads, truthful state rendering, and documentation-backed validation commands recorded in this task list and `quickstart.md`
- Phase 7 is the remaining delta required to satisfy the original Iteration 2 promise of reading real usage from a locally logged-in Codex CLI session instead of showing host-controlled “pending sync” fallback indefinitely
