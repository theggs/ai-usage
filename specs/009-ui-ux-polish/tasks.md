# Tasks: UI/UX 视觉层级与交互优化

**Input**: Design documents from `/specs/009-ui-ux-polish/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Include Vitest/RTL and E2E tasks because the specification requires independent testing and screenshot-based verification.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g. `US1`, `US2`)
- Include exact file paths in descriptions

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Prepare shared fixtures and task scaffolding for the UI polish pass

- [ ] T001 Audit and expand UI test fixtures for warning/danger/empty service states in `src/features/demo-services/demoData.ts`
- [X] T002 [P] Create reusable screenshot assertions notes for the polish scenarios in `tests/e2e/screenshot-review.mjs`
- [X] T003 [P] Add any missing i18n copy placeholders needed by planned panel/settings polish in `src/app/shared/i18n.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core helpers and shared state updates that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T004 Create shared quota-urgency and health-summary derivation helpers in `src/lib/tauri/summary.ts`
- [X] T005 [P] Create shared relative-time and dimension-label formatting helpers in `src/app/shared/i18n.ts`
- [X] T006 [P] Refactor shared shell/view state contracts for panel/settings transitions and inline save feedback in `src/app/shared/appState.ts`
- [X] T007 Wire shared panel shell structure for sticky header/footer slots in `src/app/shell/AppShell.tsx`

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - 一眼扫视余量状态 (Priority: P1) 🎯 MVP

**Goal**: Make low quota states visually scannable from the service cards without reading line-by-line text

**Independent Test**: Open the panel with mixed healthy/warning states and confirm thick progress bars, emphasized percentages, and warning card accents are visible without entering settings.

### Tests for User Story 1

- [X] T008 [P] [US1] Extend quota visual regression assertions for progress height and warning/danger fills in `src/components/panel/ServiceCard.test.tsx`
- [X] T009 [P] [US1] Add panel screenshot review checks for visually distinct low-quota cards in `tests/e2e/screenshot-review.mjs`

### Implementation for User Story 1

- [X] T010 [P] [US1] Redesign quota progress rows with embedded/emphasized percentage text in `src/components/panel/QuotaSummary.tsx`
- [X] T011 [P] [US1] Add card-level warning/danger visual treatments and neutral healthy styling in `src/components/panel/ServiceCard.tsx`
- [X] T012 [US1] Update panel composition to render the upgraded service-card hierarchy in `src/app/panel/PanelView.tsx`

**Checkpoint**: User Story 1 should show glanceable quota state directly from the panel cards

---

## Phase 4: User Story 2 - 面板头部传达整体健康度 (Priority: P1)

**Goal**: Surface one clear panel-header health summary that reflects the most urgent visible quota state

**Independent Test**: Open the panel with healthy, warning, and danger data sets and confirm the header text/tone changes to the most urgent visible condition.

### Tests for User Story 2

- [X] T013 [P] [US2] Add health-summary selector coverage for healthy/warning/danger/empty states in `src/lib/tauri/summary.test.ts`
- [ ] T014 [P] [US2] Extend panel rendering tests for header summary priority and empty guidance in `src/app/panel/PanelView.test.tsx`

### Implementation for User Story 2

- [X] T015 [P] [US2] Add localized panel health summary copy and severity labels in `src/app/shared/i18n.ts`
- [X] T016 [US2] Render derived header summary tone and message in `src/app/shell/AppShell.tsx`
- [X] T017 [US2] Connect visible service data to the shared header-summary derivation in `src/app/panel/PanelView.tsx`

**Checkpoint**: User Story 2 should let the user understand overall quota health from the sticky header alone

---

## Phase 5: User Story 3 - 设置即时生效 (Priority: P1)

**Goal**: Make every non-proxy preference apply immediately and remove the mixed save interaction model

**Independent Test**: Change language, refresh interval, tray summary mode, and menubar service in settings and confirm each takes effect immediately without a global save button; proxy remains explicit-apply.

### Tests for User Story 3

- [X] T018 [P] [US3] Rewrite settings interaction tests for immediate-save behavior and proxy-only apply in `src/app/settings/SettingsView.test.tsx`
- [X] T019 [P] [US3] Extend preferences persistence coverage for immediate-save fields and proxy exception handling in `tests/integration/preferences-persistence.test.ts`

### Implementation for User Story 3

- [X] T020 [P] [US3] Implement shared field-level save helpers and optimistic feedback states in `src/app/settings/SettingsView.tsx`
- [X] T021 [P] [US3] Update shell preference persistence handling for immediate settings application and refresh interval restarts in `src/app/shell/AppShell.tsx`
- [X] T022 [US3] Remove the generic save button flow while preserving explicit proxy apply validation in `src/app/settings/SettingsView.tsx`

**Checkpoint**: User Story 3 should provide a consistent immediate-save settings experience with proxy as the lone explicit exception

---

## Phase 6: User Story 4 - 信息精简与一致性 (Priority: P2)

**Goal**: Remove redundant panel information and unify labels, timestamps, and badge rules

**Independent Test**: Open the panel and confirm relative refresh time, single global refresh label when timestamps match, friendly dimension labels, and no redundant normal-state badge.

### Tests for User Story 4

- [X] T023 [P] [US4] Add relative-time, label-mapping, and badge-suppression assertions in `src/components/panel/ServiceCard.test.tsx`
- [X] T024 [P] [US4] Extend panel tests for single global refresh label behavior in `src/app/panel/PanelView.test.tsx`

### Implementation for User Story 4

- [X] T025 [P] [US4] Implement relative refresh display and abnormal-only badge rendering in `src/components/panel/ServiceCard.tsx`
- [X] T026 [P] [US4] Apply friendly dimension labels and shared time formatting in `src/components/panel/QuotaSummary.tsx`
- [X] T027 [US4] Add global refresh footer rendering and duplicate suppression logic in `src/app/panel/PanelView.tsx`

**Checkpoint**: User Story 4 should reduce panel noise and make all time/label patterns consistent

---

## Phase 7: User Story 5 - 服务拖拽排序 (Priority: P2)

**Goal**: Replace up/down ordering controls with drag-based service sorting that persists immediately

**Independent Test**: Drag one service above the other in settings, return to the panel, and confirm the order updates and remains after reopening the app.

### Tests for User Story 5

- [X] T028 [P] [US5] Add settings tests for disabled single-item grip and reordered `serviceOrder` persistence in `src/app/settings/SettingsView.test.tsx`
- [ ] T029 [P] [US5] Extend real-shell reorder verification in `tests/e2e/tray-panel.spec.mjs`

### Implementation for User Story 5

- [X] T030 [P] [US5] Implement draggable service-order rows with grip affordance in `src/app/settings/SettingsView.tsx`
- [X] T031 [P] [US5] Reconcile and sanitize persisted service order values in `src/lib/persistence/preferencesStore.ts`
- [X] T032 [US5] Ensure panel rendering follows the persisted drag order in `src/app/panel/PanelView.tsx`

**Checkpoint**: User Story 5 should allow intuitive drag reorder without reverting to text buttons

---

## Phase 8: User Story 6 - 微交互反馈 (Priority: P2)

**Goal**: Add clear visual feedback for refresh, navigation, scrolling, and quota-width changes

**Independent Test**: Trigger refresh and view transitions in the Tauri shell and confirm spin, slide, header separator, progress animation, and arrowed back button are all visible.

### Tests for User Story 6

- [ ] T033 [P] [US6] Extend shell interaction tests for animated refresh and directional navigation cues in `tests/e2e/tray-panel.spec.mjs`
- [ ] T034 [P] [US6] Add component/shell assertions for back-button arrow and transition classes in `src/app/settings/SettingsView.test.tsx`

### Implementation for User Story 6

- [X] T035 [P] [US6] Add refresh spin/error feedback, view slide transitions, and sticky-header separation behavior in `src/app/shell/AppShell.tsx`
- [ ] T036 [P] [US6] Add directional back button icon and progress-width transition tuning in `src/app/settings/SettingsView.tsx`
- [X] T037 [US6] Add shared motion and scroll-separator styles in `src/styles/globals.css`

**Checkpoint**: User Story 6 should make key interactions feel responsive and directional rather than abrupt

---

## Phase 9: User Story 7 - 设置页信息层级优化 (Priority: P3)

**Goal**: Reorganize settings into clearer groups with high-value controls above the fold and lower-priority content visually de-emphasized

**Independent Test**: Open settings in the 360x620 panel and confirm common controls are in the first viewport, grouped logically, while CLI info and notification test appear as lower-priority content.

### Tests for User Story 7

- [X] T038 [P] [US7] Add grouped-layout and low-priority action assertions in `src/app/settings/SettingsView.test.tsx`
- [X] T039 [P] [US7] Extend screenshot review coverage for first-viewport settings hierarchy in `tests/e2e/screenshot-review.mjs`

### Implementation for User Story 7

- [X] T040 [P] [US7] Reorganize settings into general/display/connection groups in `src/app/settings/SettingsView.tsx`
- [X] T041 [P] [US7] Restyle Codex CLI information as a light informational block in `src/app/settings/SettingsView.tsx`
- [ ] T042 [US7] Restyle notification test and supporting section chrome for lower visual weight in `src/components/settings/PreferenceSection.tsx`

**Checkpoint**: User Story 7 should make settings easier to scan and prioritize within the fixed-height window

---

## Phase 10: Polish & Cross-Cutting Concerns

**Purpose**: Final verification and cleanup that touches multiple stories

- [X] T043 [P] Run and fix the feature-focused Vitest suite for updated panel/settings behavior in `src/app/panel/PanelView.test.tsx`
- [ ] T044 [P] Run and fix the feature-focused real-shell checks in `tests/e2e/tray-panel.spec.mjs`
- [ ] T045 Validate the end-to-end quickstart checklist and update any mismatches in `specs/009-ui-ux-polish/quickstart.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3+)**: Depend on Foundational completion
- **Polish (Phase 10)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Starts after Foundational - no dependency on other stories
- **User Story 2 (P1)**: Starts after Foundational, but benefits from US1 card hierarchy work already landing
- **User Story 3 (P1)**: Starts after Foundational - no dependency on panel stories
- **User Story 4 (P2)**: Starts after Foundational and should build on the shared formatting helpers from US1/US2
- **User Story 5 (P2)**: Starts after Foundational and can proceed independently of panel visual polish
- **User Story 6 (P2)**: Starts after Foundational; coordinate with US3 and US5 because it touches shell/settings transitions
- **User Story 7 (P3)**: Starts after Foundational and should layer on top of US3’s immediate-save settings structure

### Within Each User Story

- Tests should be written or updated before implementation is considered complete
- Shared helpers before component wiring
- Component implementation before E2E verification
- Each story must satisfy its independent test before moving on

### Parallel Opportunities

- T002 and T003 can run in parallel during Setup
- T004-T006 can proceed in parallel once fixture scope is agreed
- After Phase 2, US1/US3 can start in parallel because they touch different surfaces first
- US5 and US7 can overlap once the settings auto-save structure from US3 is stable
- Story-level test tasks marked `[P]` can run in parallel with other tasks in the same phase when file ownership does not conflict

---

## Parallel Example: User Story 1

```bash
# Launch User Story 1 test preparation together:
Task: "Extend quota visual regression assertions in src/components/panel/ServiceCard.test.tsx"
Task: "Add panel screenshot review checks in tests/e2e/screenshot-review.mjs"

# Launch User Story 1 component work together:
Task: "Redesign quota progress rows in src/components/panel/QuotaSummary.tsx"
Task: "Add card-level warning/danger visual treatments in src/components/panel/ServiceCard.tsx"
```

## Parallel Example: User Story 3

```bash
# Launch User Story 3 verification together:
Task: "Rewrite settings interaction tests in src/app/settings/SettingsView.test.tsx"
Task: "Extend preferences persistence coverage in tests/integration/preferences-persistence.test.ts"

# Then implement the two main surfaces in parallel:
Task: "Implement shared field-level save helpers in src/app/settings/SettingsView.tsx"
Task: "Update shell preference persistence handling in src/app/shell/AppShell.tsx"
```

## Parallel Example: User Story 5

```bash
# Run these together once US3 settings scaffolding is stable:
Task: "Implement draggable service-order rows in src/app/settings/SettingsView.tsx"
Task: "Reconcile persisted service order values in src/lib/persistence/preferencesStore.ts"
Task: "Extend real-shell reorder verification in tests/e2e/tray-panel.spec.mjs"
```

---

## Implementation Strategy

### MVP First (User Stories 1 + 2 + 3)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational
3. Complete Phase 3: User Story 1
4. Complete Phase 4: User Story 2
5. Complete Phase 5: User Story 3
6. **STOP and VALIDATE**: Confirm the panel is glanceable and settings are immediately effective

### Incremental Delivery

1. Ship the panel scanability improvements first (US1 + US2)
2. Ship settings interaction consistency next (US3)
3. Add density cleanup and drag ordering (US4 + US5)
4. Finish with micro-interactions and settings hierarchy (US6 + US7)
5. Run final polish verification and screenshot review

### Parallel Team Strategy

1. One developer completes Setup + Foundational
2. Then split:
   - Developer A: US1 + US2
   - Developer B: US3 + US7
   - Developer C: US5 + US6
3. Rejoin for US4 cleanup and final polish verification

---

## Notes

- [P] tasks target separate files or cleanly separable work
- Story labels map directly to the specification’s user stories for traceability
- Every task includes an exact file path and is actionable without extra planning context
- MVP scope is **US1 + US2 + US3**, though **US1** alone is still the narrowest demo slice
