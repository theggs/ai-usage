# Tasks: Iteration 1 Desktop Shell

**Input**: Design documents from `/specs/001-desktop-shell/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/, quickstart.md

**Tests**: Include frontend, integration, end-to-end, and CI verification tasks because the specification and quickstart explicitly require automated validation for panel rendering, settings behavior, host-command wiring, and packaging.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Initialize the repository as a Tauri desktop application with the planned directory structure and tooling.

- [x] T001 Initialize the Tauri + React workspace in `package.json`, `Cargo.toml`, `src/`, and `src-tauri/`
- [x] T002 [P] Configure frontend tooling and scripts in `tsconfig.json`, `vite.config.ts`, `vitest.config.ts`, and `tailwind.config.ts`
- [x] T003 [P] Create the implementation directory skeleton in `src/app/`, `src/components/`, `src/features/`, `src/lib/`, `src/styles/`, `src-tauri/src/`, and `tests/`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Build the core desktop shell infrastructure that all user stories depend on.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T004 Create the Tauri app configuration and tray-first window defaults in `src-tauri/tauri.conf.json` and `src-tauri/src/lib.rs`
- [x] T005 [P] Implement shared domain types for desktop surface, demo service cards, quota dimensions, preferences, and notification results in `src/lib/tauri/contracts.ts`
- [x] T006 [P] Seed demo panel data and default preferences in `src/features/demo-services/demoData.ts` and `src/features/preferences/defaultPreferences.ts`
- [x] T007 Implement preference persistence and validation in `src/lib/persistence/preferencesStore.ts`
- [x] T008 Implement Tauri host commands for panel state, preference reads/writes, autostart, and notification checks in `src-tauri/src/commands/mod.rs`, `src-tauri/src/state/mod.rs`, `src-tauri/src/autostart/mod.rs`, and `src-tauri/src/notifications/mod.rs`
- [x] T009 Create the frontend Tauri bridge for invoking host commands in `src/lib/tauri/client.ts`
- [x] T010 Configure shared app shell, routing/state container, and bilingual copy scaffolding in `src/app/shell/AppShell.tsx`, `src/app/shared/appState.ts`, and `src/app/shared/i18n.ts`

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - 从菜单栏或托盘快速查看应用状态 (Priority: P1) 🎯 MVP

**Goal**: Deliver a tray-resident desktop shell that opens a panel with demo service cards, refresh metadata, and a settings entry.

**Independent Test**: Start the app, confirm the tray or menu bar icon appears within 2 seconds, click it, and verify the panel opens within 1 second with labeled demo service cards, refresh information, and a settings entry.

### Tests for User Story 1

- [x] T011 [P] [US1] Add panel rendering and refresh behavior tests in `src/app/panel/PanelView.test.tsx`
- [x] T012 [P] [US1] Add host contract tests for demo panel commands in `tests/contract/demo-panel.contract.test.ts`
- [x] T013 [P] [US1] Add end-to-end tray and panel smoke coverage in `tests/e2e/tray-panel.spec.ts`

### Implementation for User Story 1

- [x] T014 [P] [US1] Implement the tray lifecycle and panel visibility controller in `src-tauri/src/tray/mod.rs`
- [x] T015 [P] [US1] Build demo service card components and quota summary rows in `src/components/panel/ServiceCard.tsx` and `src/components/panel/QuotaSummary.tsx`
- [x] T016 [US1] Implement the panel view with refresh status, demo labeling, and settings entry in `src/app/panel/PanelView.tsx`
- [x] T017 [US1] Wire manual refresh and initial panel loading through the frontend bridge in `src/features/demo-services/panelController.ts`

**Checkpoint**: At this point, User Story 1 should be fully functional and testable independently

---

## Phase 4: User Story 2 - 在设置中完成基础偏好配置 (Priority: P1)

**Goal**: Deliver a settings surface where users can review and save core preferences that persist across app restarts.

**Independent Test**: Open settings from the panel, modify refresh interval, display mode, language, and other supported fields, save them, restart the app, and verify the saved values are restored.

### Tests for User Story 2

- [x] T018 [P] [US2] Add settings form and validation tests in `src/app/settings/SettingsView.test.tsx`
- [x] T019 [P] [US2] Add integration coverage for preference persistence in `tests/integration/preferences-persistence.test.ts`

### Implementation for User Story 2

- [x] T020 [P] [US2] Build reusable settings form sections and controls in `src/components/settings/PreferenceSection.tsx` and `src/components/settings/PreferenceField.tsx`
- [x] T021 [US2] Implement the settings view and save feedback flows in `src/app/settings/SettingsView.tsx`
- [x] T022 [US2] Implement preference loading, patching, validation handling, and restart restore behavior in `src/features/preferences/preferencesController.ts`
- [x] T023 [US2] Connect panel-to-settings navigation and shared app state updates in `src/app/shell/AppShell.tsx`

**Checkpoint**: At this point, User Stories 1 AND 2 should both work independently

---

## Phase 5: User Story 3 - 验证桌面应用集成能力 (Priority: P2)

**Goal**: Validate native desktop integrations for autostart, test notifications, and cross-platform installer builds.

**Independent Test**: From settings, toggle autostart, send a test notification, and confirm the project CI can build macOS and Windows installers with retained artifacts.

### Tests for User Story 3

- [x] T024 [P] [US3] Add integration coverage for autostart and notification command results in `tests/integration/system-integrations.test.ts`
- [x] T025 [P] [US3] Add CI workflow verification coverage in `tests/contract/build-workflow.contract.test.ts`

### Implementation for User Story 3

- [x] T026 [P] [US3] Implement autostart status application and error reporting in `src-tauri/src/autostart/mod.rs`
- [x] T027 [P] [US3] Implement test notification dispatch and permission-aware result mapping in `src-tauri/src/notifications/mod.rs`
- [x] T028 [US3] Expose autostart and notification controls in the settings workflow in `src/features/notifications/notificationController.ts` and `src/app/settings/SettingsView.tsx`
- [x] T029 [US3] Add the cross-platform build workflow and artifact packaging steps in `.github/workflows/desktop-build.yml`

**Checkpoint**: All user stories should now be independently functional

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Tighten quality, documentation, and end-to-end validation across all stories

- [x] T030 [P] Add desktop shell styling polish and responsive layout refinements in `src/styles/globals.css` and `src/app/shell/AppShell.tsx`
- [x] T031 [P] Document local setup and validation commands in `README.md`
- [x] T032 Run the full quickstart validation flow and record any required fixes in `specs/001-desktop-shell/quickstart.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Story 1 (Phase 3)**: Depends on Foundational completion
- **User Story 2 (Phase 4)**: Depends on Foundational completion and reuses shared shell/navigation from US1 only through stable app state
- **User Story 3 (Phase 5)**: Depends on Foundational completion and can proceed after settings surface exists
- **Polish (Phase 6)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - MVP and no dependency on other stories
- **User Story 2 (P1)**: Can start after Foundational (Phase 2), but benefits from US1 panel entry being available for integrated validation
- **User Story 3 (P2)**: Can start after Foundational (Phase 2), but final UI exposure depends on the settings workflow from US2

### Within Each User Story

- Tests should be written before or alongside implementation and fail before the feature work is considered complete
- Shared types and controllers should exist before view wiring
- Native host behavior should be implemented before the frontend assumes success states
- Each story must pass its independent test before moving on

### Parallel Opportunities

- `T002` and `T003` can run in parallel after `T001`
- `T005` and `T006` can run in parallel after `T004`
- `T011`, `T012`, and `T013` can run in parallel for US1
- `T014` and `T015` can run in parallel for US1 before `T016`
- `T018` and `T019` can run in parallel for US2
- `T020` and `T022` can run in parallel for US2 before `T021`
- `T024` and `T025` can run in parallel for US3
- `T026` and `T027` can run in parallel for US3 before `T028`
- `T030` and `T031` can run in parallel in the polish phase

---

## Parallel Example: User Story 1

```bash
# Launch US1 validation work in parallel:
Task: "Add panel rendering and refresh behavior tests in src/app/panel/PanelView.test.tsx"
Task: "Add host contract tests for demo panel commands in tests/contract/demo-panel.contract.test.ts"
Task: "Add end-to-end tray and panel smoke coverage in tests/e2e/tray-panel.spec.ts"

# Launch US1 implementation work in parallel:
Task: "Implement the tray lifecycle and panel visibility controller in src-tauri/src/tray/mod.rs"
Task: "Build demo service card components and quota summary rows in src/components/panel/ServiceCard.tsx and src/components/panel/QuotaSummary.tsx"
```

---

## Parallel Example: User Story 2

```bash
# Launch US2 validation work in parallel:
Task: "Add settings form and validation tests in src/app/settings/SettingsView.test.tsx"
Task: "Add integration coverage for preference persistence in tests/integration/preferences-persistence.test.ts"

# Launch US2 implementation work in parallel:
Task: "Build reusable settings form sections and controls in src/components/settings/PreferenceSection.tsx and src/components/settings/PreferenceField.tsx"
Task: "Implement preference loading, patching, validation handling, and restart restore behavior in src/features/preferences/preferencesController.ts"
```

---

## Parallel Example: User Story 3

```bash
# Launch US3 validation work in parallel:
Task: "Add integration coverage for autostart and notification command results in tests/integration/system-integrations.test.ts"
Task: "Add CI workflow verification coverage in tests/contract/build-workflow.contract.test.ts"

# Launch US3 implementation work in parallel:
Task: "Implement autostart status application and error reporting in src-tauri/src/autostart/mod.rs"
Task: "Implement test notification dispatch and permission-aware result mapping in src-tauri/src/notifications/mod.rs"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational
3. Complete Phase 3: User Story 1
4. Validate tray icon visibility, panel open timing, and demo card rendering
5. Demo the MVP shell before expanding into settings and system integrations

### Incremental Delivery

1. Complete Setup + Foundational to establish the shared desktop shell
2. Add User Story 1 and validate it independently as the MVP
3. Add User Story 2 and validate persisted settings without breaking the tray panel flow
4. Add User Story 3 and validate native integrations plus CI packaging
5. Finish with polish and quickstart verification

### Parallel Team Strategy

1. One developer handles repository/bootstrap setup while another prepares shared domain contracts after `T001`
2. After Foundational is complete:
   - Developer A: User Story 1 panel/tray work
   - Developer B: User Story 2 settings and persistence work
   - Developer C: User Story 3 native integrations and CI workflow
3. Rejoin in Phase 6 for final polish and full validation

---

## Notes

- [P] tasks touch separate files or modules and can be worked on independently
- Story labels map each task back to a specific user story for traceability
- User Story 1 is the recommended MVP scope
- `T032` is the final manual verification gate against the quickstart
