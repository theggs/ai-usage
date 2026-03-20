# Tasks: Menubar UI/UX Overhaul

**Input**: Design documents from `/specs/004-menubar-ui-overhaul/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/, quickstart.md

**Tests**: Include frontend, contract, integration, Rust host-behavior, and E2E validation because the specification, quickstart, and constitution require automated coverage for quota thresholds, window hide lifecycle, bilingual copy, compact layout, and visible interaction feedback.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Prepare the workspace and test fixtures for the menubar UI overhaul.

- [X] T001 Refresh feature execution notes for the overhaul in `specs/004-menubar-ui-overhaul/quickstart.md`
- [X] T002 [P] Add quota-threshold test fixtures in `src/components/panel/ServiceCard.test.tsx`
- [X] T003 [P] Add localized compact-panel test fixtures in `src/app/panel/PanelView.test.tsx`
- [X] T004 [P] Add tray popover test scaffolding in `tests/e2e/tray-panel.spec.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Build the shared host/UI plumbing required before any user story can deliver the final menubar behavior.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T005 Extend quota presentation contracts with `status` and `progressTone` fields in `src/lib/tauri/contracts.ts`
- [X] T006 [P] Implement quota threshold mapping utilities in `src/lib/tauri/summary.ts`
- [X] T007 [P] Keep existing quota cards visible during refresh by retaining prior panel state in React until new data arrives, in `src/app/shared/appState.ts`
- [X] T008 [P] Prevent concurrent refresh calls with a single-flight guard in `src/features/demo-services/panelController.ts`
- [X] T009 [P] Register host-side close and focus lifecycle hooks during app startup in `src-tauri/src/lib.rs`
- [X] T010 Consolidate remaining panel and settings copy keys in `src/app/shared/i18n.ts`

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - 快速查看额度剩余 (Priority: P1) 🎯 MVP

**Goal**: Make the main panel quota-first so users can immediately see the most constrained dimension with clear progress and reset context.

**Independent Test**: Click the tray icon and confirm the panel shows only header, quota cards, one compact status line, and refresh control, with color-coded progress bars for 0%, 2%, 20%, 50%, 80%, 100%, and muted styling for undefined percentages.

### Tests for User Story 1

- [X] T011 [P] [US1] Add compact panel layout coverage in `src/app/panel/PanelView.test.tsx`
- [X] T012 [P] [US1] Add quota-threshold coverage for 0%, 2%, 20%, 50%, 80%, 100%, and undefined values in `src/components/panel/ServiceCard.test.tsx`
- [X] T013 [P] [US1] Add contract assertions for normalized quota presentation fields in `tests/contract/demo-panel.contract.test.ts`

### Implementation for User Story 1

- [X] T014 [P] [US1] Map normalized quota status into host panel rows in `src-tauri/src/commands/mod.rs`
- [X] T015 [P] [US1] Extend host quota state serialization for compact presentation in `src-tauri/src/state/mod.rs`
- [X] T016 [P] [US1] Render progress fill, reset hints, and muted unknown states in `src/components/panel/QuotaSummary.tsx`
- [X] T017 [P] [US1] Simplify quota-card information hierarchy in `src/components/panel/ServiceCard.tsx`
- [X] T018 [US1] Collapse the panel layout to header, quota cards, inline status row, and refresh control in `src/app/panel/PanelView.tsx`; remove the green summary bar and blue sync card while preserving the existing Codex CLI section in `SettingsView.tsx` unchanged (FR-014)
- [X] T019 [US1] Finalize compact panel copy and status-line wording in `src/app/shared/i18n.ts`

**Checkpoint**: At this point, User Story 1 should be fully functional and testable independently

---

## Phase 4: User Story 2 - 关闭弹出窗口后程序继续运行 (Priority: P1)

**Goal**: Make the tray panel behave like a true menu bar popover that hides on close or blur without quitting the process.

**Independent Test**: Open the tray panel, close it with the red close button, reopen it from the tray, then blur it by clicking outside or switching apps; the process must stay alive and the same panel state must return.

### Tests for User Story 2

- [X] T020 [P] [US2] Add Rust toggle and hide lifecycle tests in `src-tauri/src/tray/mod.rs`
- [X] T021 [P] [US2] Add preserved-state integration coverage for hide and reopen flows in `tests/integration/system-integrations.test.ts`
- [X] T022 [P] [US2] Add end-to-end tray popover behavior coverage in `tests/e2e/tray-panel.spec.ts`

### Implementation for User Story 2

- [X] T023 [P] [US2] Intercept native close requests and convert them into hide behavior in `src-tauri/src/lib.rs`
- [X] T024 [P] [US2] Implement blur-driven auto-hide and tray-click toggle behavior in `src-tauri/src/tray/mod.rs`
- [X] T025 [US2] Configure the main Tauri window as a non-resizable popover shell in `src-tauri/tauri.conf.json`
- [X] T026 [US2] Preserve rendered panel data across hide and reopen cycles in `src/app/shell/AppShell.tsx`

**Checkpoint**: At this point, User Stories 1 AND 2 should both work independently

---

## Phase 5: User Story 3 - 使用中文界面无英文残留 (Priority: P2)

**Goal**: Ensure all user-visible panel and settings copy fully switches between Chinese and English with no hard-coded leftovers. Backend data strings (badgeLabel, remainingAbsolute, resetHint) are localized on the frontend via `localizeRemaining`, `localizeResetHint`, `localizeBadgeLabel` utility functions in `i18n.ts`.

**Independent Test**: Switch language to `zh-CN` and verify every visible label, helper text, button, and quota time string is Chinese; switch back to `en-US` and verify all visible text is English.

### Tests for User Story 3

- [X] T027 [P] [US3] Add bilingual settings coverage in `src/app/settings/SettingsView.test.tsx`
- [X] T028 [P] [US3] Add bilingual panel coverage in `src/app/panel/PanelView.test.tsx`
- [X] T029 [P] [US3] Add localization dictionary coverage for new copy keys in `src/app/shared/i18n.test.ts`

### Implementation for User Story 3

- [X] T030 [P] [US3] Replace hard-coded settings section and field labels with localized copy keys in `src/app/settings/SettingsView.tsx`
- [X] T031 [P] [US3] Localize quota-card time labels in `src/components/panel/ServiceCard.tsx`
- [X] T033 [US3] Expand the bilingual copy tree for settings, actions, feedback, and quota labels in `src/app/shared/i18n.ts`

**Checkpoint**: At this point, User Stories 1, 2, AND 3 should all work independently

---

## Phase 6: User Story 4 - 视觉风格贴合 macOS 菜单栏应用 (Priority: P2)

**Goal**: Tighten the shell, card hierarchy, rounding, and background treatment so the app feels like a compact macOS menubar utility instead of a standalone glassmorphic window.

**Independent Test**: Open the panel and confirm the width is 360px, height stays within 620px with scrolling when needed, all major containers use 12-16px radii, nesting stays within two visual layers, and heavy blur/shadow treatments are gone.

### Tests for User Story 4

- [X] T034 [P] [US4] Add compact shell and rounded-corner regression coverage in `src/app/panel/PanelView.test.tsx`
- [X] T035 [P] [US4] Add flat visual hierarchy coverage in `src/components/panel/ServiceCard.test.tsx`
- [X] T036 [P] [US4] Add shell-size and overflow assertions in `tests/e2e/tray-panel.spec.ts`

### Implementation for User Story 4

- [X] T037 [P] [US4] Reduce background gradient, blur, and shadow density in `src/styles/globals.css`
- [X] T038 [P] [US4] Simplify shell chrome and overflow behavior in `src/app/shell/AppShell.tsx`
- [X] T039 [P] [US4] Normalize panel container and control radii to the 12-16px range in `src/app/panel/PanelView.tsx`
- [X] T040 [P] [US4] Normalize service-card and dimension radii to the 12-16px range in `src/components/panel/ServiceCard.tsx`
- [X] T041 [US4] Flatten settings and panel visual nesting to two layers in `src/app/settings/SettingsView.tsx`

**Checkpoint**: At this point, User Stories 1 through 4 should be independently functional

---

## Phase 7: User Story 5 - 交互反馈清晰及时 (Priority: P3)

**Goal**: Make refresh, save, notification, and autostart interactions immediately visible and locally scoped inside the compact settings/panel experience.

**Independent Test**: Trigger refresh, save preferences, test notification, and autostart toggle interactions; each action must show an obvious nearby pending/success/failure signal without requiring scroll.

### Tests for User Story 5

- [X] T042 [P] [US5] Add refresh-button loading and disabled-state coverage in `src/app/panel/PanelView.test.tsx`
- [X] T043 [P] [US5] Add local save and notification feedback coverage in `src/app/settings/SettingsView.test.tsx`
- [X] T044 [P] [US5] Add autostart result reconciliation coverage in `tests/integration/preferences-persistence.test.ts`

### Implementation for User Story 5

- [X] T045 [P] [US5] Implement visible refresh pending state and button disabling in `src/app/panel/PanelView.tsx`
- [X] T046 [P] [US5] Introduce local `SettingsFeedbackState` handling for save actions in `src/app/settings/SettingsView.tsx`
- [X] T047 [US5] Introduce local notification feedback handling in `src/app/settings/SettingsView.tsx` (sequential after T046, same file)
- [X] T048 [P] [US5] Replace the raw checkbox with a switch-style autostart control in `src/components/settings/PreferenceField.tsx`
- [X] T049 [US5] Separate preference-save and notification-test sections with adjacent feedback messaging in `src/components/settings/PreferenceSection.tsx`

**Checkpoint**: All user stories should now be independently functional

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Finish acceptance validation and cross-story documentation updates.

- [X] T050 [P] Update the feature contract with final field names and UI constraints in `specs/004-menubar-ui-overhaul/contracts/menubar-ui-contract.md`
- [X] T051 [P] Update the data model with final UI state names and transitions in `specs/004-menubar-ui-overhaul/data-model.md`
- [X] T052 [P] Update implementation notes and validation steps based on final UI behavior in `specs/004-menubar-ui-overhaul/plan.md`
- [X] T053 Run full validation for `npm test`, `cargo test`, and the quickstart checklist, then record follow-up fixes in `specs/004-menubar-ui-overhaul/tasks.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Story 1 (Phase 3)**: Depends on Foundational completion
- **User Story 2 (Phase 4)**: Depends on Foundational completion
- **User Story 3 (Phase 5)**: Depends on Foundational completion and benefits from US1 compact panel content stabilizing
- **User Story 4 (Phase 6)**: Depends on Foundational completion and benefits from US1/US2 structure stabilizing
- **User Story 5 (Phase 7)**: Depends on Foundational completion and benefits from US3/US4 settings and layout stabilization
- **Polish (Phase 8)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - no dependency on other stories
- **User Story 2 (P1)**: Can start after Foundational (Phase 2) - no dependency on other stories
- **User Story 3 (P2)**: Can start after Foundational (Phase 2), but final review is easier after US1 compact panel content exists
- **User Story 4 (P2)**: Can start after Foundational (Phase 2), but final polish should follow the core panel and tray behavior from US1/US2
- **User Story 5 (P3)**: Can start after Foundational (Phase 2), but final feedback placement benefits from US3 localized sections and US4 compact styling

### Within Each User Story

- Tests should be written before or alongside implementation and must fail before the feature work is considered complete
- Shared contracts and state plumbing should exist before component rendering assumes the final payload shape
- Host window lifecycle wiring should be implemented before E2E tray behavior is considered complete
- Each story must pass its independent test before moving on

### Parallel Opportunities

- `T002`, `T003`, and `T004` can run in parallel after `T001`
- `T006`, `T007`, `T008`, and `T009` can run in parallel after `T005`
- `T011`, `T012`, and `T013` can run in parallel for US1
- `T014`, `T015`, `T016`, and `T017` can run in parallel for US1 before `T018`
- `T020`, `T021`, and `T022` can run in parallel for US2
- `T023`, `T024`, and `T025` can run in parallel for US2 before `T026`
- `T027`, `T028`, and `T029` can run in parallel for US3
- `T030` and `T031` can run in parallel for US3 before `T033`
- `T034`, `T035`, and `T036` can run in parallel for US4
- `T037`, `T038`, `T039`, and `T040` can run in parallel for US4 before `T041`
- `T042`, `T043`, and `T044` can run in parallel for US5
- `T045`, `T046`, and `T048` can run in parallel for US5; `T047` must follow `T046` (same file); all before `T049`
- `T050`, `T051`, and `T052` can run in parallel in the polish phase

---

## Parallel Example: User Story 1

```bash
# Launch US1 validation work in parallel:
Task: "Add compact panel layout coverage in src/app/panel/PanelView.test.tsx"
Task: "Add quota-threshold coverage for 0%, 2%, 20%, 50%, 80%, 100%, and undefined values in src/components/panel/ServiceCard.test.tsx"
Task: "Add contract assertions for normalized quota presentation fields in tests/contract/demo-panel.contract.test.ts"

# Launch US1 implementation work in parallel:
Task: "Map normalized quota status into host panel rows in src-tauri/src/commands/mod.rs"
Task: "Extend host quota state serialization for compact presentation in src-tauri/src/state/mod.rs"
Task: "Render progress fill, reset hints, and muted unknown states in src/components/panel/QuotaSummary.tsx"
Task: "Simplify quota-card information hierarchy in src/components/panel/ServiceCard.tsx"
```

---

## Parallel Example: User Story 2

```bash
# Launch US2 validation work in parallel:
Task: "Add Rust toggle and hide lifecycle tests in src-tauri/src/tray/mod.rs"
Task: "Add preserved-state integration coverage for hide and reopen flows in tests/integration/system-integrations.test.ts"
Task: "Add end-to-end tray popover behavior coverage in tests/e2e/tray-panel.spec.ts"

# Launch US2 implementation work in parallel:
Task: "Intercept native close requests and convert them into hide behavior in src-tauri/src/lib.rs"
Task: "Implement blur-driven auto-hide and tray-click toggle behavior in src-tauri/src/tray/mod.rs"
Task: "Configure the main Tauri window as a non-resizable popover shell in src-tauri/tauri.conf.json"
```

---

## Parallel Example: User Story 5

```bash
# Launch US5 validation work in parallel:
Task: "Add refresh-button loading and disabled-state coverage in src/app/panel/PanelView.test.tsx"
Task: "Add local save and notification feedback coverage in src/app/settings/SettingsView.test.tsx"
Task: "Add autostart result reconciliation coverage in tests/integration/preferences-persistence.test.ts"

# Launch US5 implementation work in parallel:
Task: "Implement visible refresh pending state and button disabling in src/app/panel/PanelView.tsx"
Task: "Introduce local SettingsFeedbackState handling for save actions in src/app/settings/SettingsView.tsx"
Task: "Introduce local notification feedback handling in src/app/settings/SettingsView.tsx"
Task: "Replace the raw checkbox with a switch-style autostart control in src/components/settings/PreferenceField.tsx"
```

---

## Implementation Strategy

### MVP First (User Stories 1 + 2)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational
3. Complete Phase 3: User Story 1
4. Complete Phase 4: User Story 2
5. **STOP and VALIDATE**: Confirm compact quota readability and true popover hide behavior before moving on

### Incremental Delivery

1. Complete Setup + Foundational to stabilize contracts, loading state, and localization scaffolding
2. Add User Story 1 and validate compact quota scanning independently
3. Add User Story 2 and validate close/blur hide behavior independently
4. Add User Story 3 and validate bilingual completeness independently
5. Add User Story 4 and validate compact visual polish independently
6. Add User Story 5 and validate local feedback interactions independently
7. Finish with polish, documentation, and full validation

### Parallel Team Strategy

1. One developer handles host lifecycle wiring while another prepares compact panel rendering after the foundational phase
2. Once Foundational is complete:
   - Developer A: User Story 1 quota-first panel
   - Developer B: User Story 2 tray/popover lifecycle
   - Developer C: User Story 3 localization completeness
3. After the P1/P2 stories stabilize:
   - Developer A: User Story 4 visual density and shell polish
   - Developer B: User Story 5 interaction feedback and settings controls
4. Rejoin in Phase 8 for final validation and doc alignment

---

## Notes

- [P] tasks touch separate files or modules and can be worked on independently
- Story labels map each task back to a specific user story for traceability
- Each user story is independently testable against its spec acceptance criteria
- The suggested MVP scope is User Stories 1 and 2 together because the feature’s core value requires both readable quota information and correct menubar lifecycle behavior
- All tasks above follow the required checklist format with checkbox, task ID, optional `[P]`, required story labels for story phases, and explicit file paths
