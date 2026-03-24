# Tasks: 优惠活动提示

**Input**: Design documents from `/Users/chasewang/01workspace/projects/ai-usage/specs/013-promotion-status/`  
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: 包含 Vitest/RTL 与真实 Tauri/E2E 验证任务，因为该特性明确要求真实壳层下的一行聚合提示、两行详情块、时区换算、胶囊状态表达与完整浮层交互验证。  
**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this belongs to (e.g. `US1`, `US2`, `US3`)
- Include exact file paths in descriptions

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: 为当前促销域、头部胶囊和两行详情浮层建立共享骨架

- [X] T001 Align promotion feature scaffolding with the latest plan in `/Users/chasewang/01workspace/projects/ai-usage/src/features/promotions/types.ts`, `/Users/chasewang/01workspace/projects/ai-usage/src/features/promotions/catalog.ts`, `/Users/chasewang/01workspace/projects/ai-usage/src/features/promotions/resolver.ts`, `/Users/chasewang/01workspace/projects/ai-usage/src/features/promotions/catalog.test.ts`, and `/Users/chasewang/01workspace/projects/ai-usage/src/features/promotions/resolver.test.ts`
- [X] T002 [P] Align promotion header surface scaffolding for compact capsules plus same-area detail popover in `/Users/chasewang/01workspace/projects/ai-usage/src/components/panel/PromotionStatusLine.tsx`, `/Users/chasewang/01workspace/projects/ai-usage/src/components/panel/PromotionStatusLine.test.tsx`, and `/Users/chasewang/01workspace/projects/ai-usage/src/app/shell/AppShell.test.tsx`
- [X] T003 [P] Align promotion copy, icon, and detail-timing placeholders in `/Users/chasewang/01workspace/projects/ai-usage/src/app/shared/i18n.ts`, `/Users/chasewang/01workspace/projects/ai-usage/src/app/shared/i18n.test.ts`, `/Users/chasewang/01workspace/projects/ai-usage/src/assets/icons/service-claude-code.svg`, and `/Users/chasewang/01workspace/projects/ai-usage/src/assets/icons/service-codex.svg`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: 搭好所有 user story 共享依赖的促销目录、派生模型、时间语义和浮层状态

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T004 Define canonical promotion types, lifecycle fields, `PromotionDetailTiming`, overlay states, and display decision shapes in `/Users/chasewang/01workspace/projects/ai-usage/src/features/promotions/types.ts`
- [X] T005 [P] Implement the source-of-truth promotion catalog with current and historical Claude/Codex campaign entries, source metadata, and lifecycle retention in `/Users/chasewang/01workspace/projects/ai-usage/src/features/promotions/catalog.ts`
- [X] T006 [P] Add catalog validation tests for unique IDs, lifecycle retention, source retention, and current-vs-history coverage in `/Users/chasewang/01workspace/projects/ai-usage/src/features/promotions/catalog.test.ts`
- [X] T007 Implement promotion resolution utilities for time-window, continuous-window, eligibility-unknown, inline vs all-service decisions, and detail-timing output in `/Users/chasewang/01workspace/projects/ai-usage/src/features/promotions/resolver.ts`
- [X] T008 Add resolver tests for time-zone conversion, working-day window checks, Codex continuous-window semantics, Claude local-window derivation, hidden-service counting, and reset-on-open behavior in `/Users/chasewang/01workspace/projects/ai-usage/src/features/promotions/resolver.test.ts`

**Checkpoint**: Foundation ready - user story implementation can now begin

---

## Phase 3: User Story 1 - 一眼判断当前是否处于优惠状态 (Priority: P1) 🎯 MVP

**Goal**: 在主界面标题下方用紧凑小胶囊显示当前值得关注的促销状态，并支持在同一区域内通过 hover/focus 预览与 click 稳定展开，查看每个服务的两行详情块。  
**Independent Test**: 打开主面板，仅通过头部第二行的小胶囊和对应浮层，就能在 1 秒内判断当前值得关注的服务是否有优惠；浮层中的每个服务都以“两行信息块”展示，其中 Claude 第二行显示“活动日期范围 + 用户本地优惠窗口”，Codex 第二行显示“当前持续优惠时段”；click 打开的稳定展开态可通过点击外部或按 `Esc` 关闭。

### Tests for User Story 1

- [X] T009 [P] [US1] Add component tests for capsule rendering, icon plus short-copy semantics, and the rule that color is not the only status signal in `/Users/chasewang/01workspace/projects/ai-usage/src/components/panel/PromotionStatusLine.test.tsx`
- [X] T010 [P] [US1] Add component tests for same-area popover two-line service blocks, including first-line conclusion plus benefit and second-line timing copy for Claude/Codex in `/Users/chasewang/01workspace/projects/ai-usage/src/components/panel/PromotionStatusLine.test.tsx`
- [X] T011 [P] [US1] Add shell-level tests for header two-line layout, hover/focus preview, click-to-pin behavior, outside-click / `Esc` close, and reset-on-reopen flow in `/Users/chasewang/01workspace/projects/ai-usage/src/app/shell/AppShell.test.tsx`

### Implementation for User Story 1

- [X] T012 [US1] Implement compact capsule rendering and same-area popover content with two-line detail blocks in `/Users/chasewang/01workspace/projects/ai-usage/src/components/panel/PromotionStatusLine.tsx`
- [X] T013 [US1] Integrate promotion display decisions, preview/pinned overlay state, and close-on-outside-click / `Esc` behavior into `/Users/chasewang/01workspace/projects/ai-usage/src/app/shell/AppShell.tsx`
- [X] T014 [US1] Add localized capsule-scale promotion copy plus detailed popover copy, including Claude “活动日期范围 + 用户本地优惠窗口” and Codex “当前持续优惠时段”, in `/Users/chasewang/01workspace/projects/ai-usage/src/app/shared/i18n.ts` and `/Users/chasewang/01workspace/projects/ai-usage/src/app/shared/i18n.test.ts`
- [X] T015 [US1] Refine header spacing, capsule styling, two-line block readability, and hover/focus states in `/Users/chasewang/01workspace/projects/ai-usage/src/styles/globals.css`

**Checkpoint**: User Story 1 should now be fully functional and testable independently

---

## Phase 4: User Story 2 - 活动信息可独立维护并保留历史 (Priority: P1)

**Goal**: 用独立促销目录管理当前与历史活动，确保新增、结束、归档和规则修订不会破坏现行展示。  
**Independent Test**: 只修改促销目录数据和维护指南，不改头部组件或现有额度逻辑，也能新增活动、结束活动并保留历史记录，同时维护者能按文档完成一次更新演练。

### Tests for User Story 2

- [X] T016 [P] [US2] Add catalog lifecycle regression tests for ended/archived campaigns, source retention, and version-history safety in `/Users/chasewang/01workspace/projects/ai-usage/src/features/promotions/catalog.test.ts`
- [X] T017 [P] [US2] Add resolver coverage for filtering ended campaigns out of current UI while preserving history, review metadata, and detail-timing compatibility in `/Users/chasewang/01workspace/projects/ai-usage/src/features/promotions/resolver.test.ts`

### Implementation for User Story 2

- [X] T018 [US2] Expand `/Users/chasewang/01workspace/projects/ai-usage/src/features/promotions/catalog.ts` with explicit current/history entries, lifecycle metadata, source labels, and review timestamps
- [X] T019 [US2] Extend `/Users/chasewang/01workspace/projects/ai-usage/src/features/promotions/types.ts` with retention-oriented constraints for versioned campaign history and popover-ready display decisions
- [X] T020 [US2] Update `/Users/chasewang/01workspace/projects/ai-usage/src/features/promotions/resolver.ts` so only active campaigns affect current UI while ended/archived campaigns remain queryable in the catalog
- [X] T021 [US2] Write and align the maintenance flow in `/Users/chasewang/01workspace/projects/ai-usage/specs/013-promotion-status/promotion-update-guide.md` and `/Users/chasewang/01workspace/projects/ai-usage/specs/013-promotion-status/quickstart.md`, covering catalog location, field definitions, add/end/archive/versioning rules, time-zone validation, two-line detail verification, and required test or screenshot checks

**Checkpoint**: User Stories 1 and 2 should both work independently

---

## Phase 5: User Story 3 - 面对多服务与不完整信息时不误导用户 (Priority: P2)

**Goal**: 在多服务并存、资格未知、窗口外和多活动重叠场景下，继续保持真实、保守、可比较的状态表达，同时对当前 Codex 活动稳定落到“连续优惠时段 / 正在优惠时段 2x”的产品语义。  
**Independent Test**: 在“Claude 有明确时段活动 + Codex 按连续优惠时段处理 + 用户计划未知/部分不适用”的组合下，头部不会隐藏未知资格服务；默认胶囊与完整浮层语义保持一致；Codex 在完整浮层中显示“正在优惠时段 2x”，而 Claude 窗口外正确显示“不在优惠时段”。

### Tests for User Story 3

- [X] T022 [P] [US3] Add resolver edge-case tests for unknown eligibility, inactive windows, multi-campaign priority, Codex active-window semantics, and no-promo fallback in `/Users/chasewang/01workspace/projects/ai-usage/src/features/promotions/resolver.test.ts`
- [X] T023 [P] [US3] Add component tests for truthful rendering of inactive, unknown, active-window, and no-promo states across inline capsules and all-state popover content in `/Users/chasewang/01workspace/projects/ai-usage/src/components/panel/PromotionStatusLine.test.tsx`

### Implementation for User Story 3

- [X] T024 [US3] Refine `/Users/chasewang/01workspace/projects/ai-usage/src/features/promotions/resolver.ts` to map eligibility-unknown, inactive-window, and current Codex campaigns to truthful service states with stable service-level priority
- [X] T025 [US3] Update `/Users/chasewang/01workspace/projects/ai-usage/src/components/panel/PromotionStatusLine.tsx` so the default line stays compact while the all-state popover truthfully shows active, inactive, unknown, and no-promo services
- [X] T026 [US3] Refine zh/en promotion wording for active-window, inactive-window, eligibility-unknown, no-promo, and benefit labels in `/Users/chasewang/01workspace/projects/ai-usage/src/app/shared/i18n.ts` and `/Users/chasewang/01workspace/projects/ai-usage/src/app/shared/i18n.test.ts`

**Checkpoint**: All user stories should now be independently functional

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: 真实壳层验证、截图回归与跨故事稳定性检查

- [X] T027 [P] Add screenshot regression coverage for focused capsules, hover/focus preview, click-pinned popover, two-line detail blocks, and close behavior in `/Users/chasewang/01workspace/projects/ai-usage/tests/e2e/screenshot-review.mjs`
- [X] T028 [P] Add real-Tauri interaction coverage for hover/focus preview, click-to-pin, outside-click / `Esc` close, no-overlap header behavior, and detail-line readability in `/Users/chasewang/01workspace/projects/ai-usage/tests/e2e/tray-panel.spec.mjs`
- [X] T029 Run the validation flow documented in `/Users/chasewang/01workspace/projects/ai-usage/specs/013-promotion-status/quickstart.md` and `/Users/chasewang/01workspace/projects/ai-usage/specs/013-promotion-status/promotion-update-guide.md`, then reconcile any visual or copy drift in `/Users/chasewang/01workspace/projects/ai-usage/src/app/shell/AppShell.tsx`, `/Users/chasewang/01workspace/projects/ai-usage/src/components/panel/PromotionStatusLine.tsx`, `/Users/chasewang/01workspace/projects/ai-usage/src/app/shared/i18n.ts`, and `/Users/chasewang/01workspace/projects/ai-usage/src/styles/globals.css`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3+)**: Depend on Foundational completion
- **Polish (Phase 6)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational - delivers MVP
- **User Story 2 (P1)**: Can start after Foundational - independent from US1 UI, but shares the catalog/resolver foundation
- **User Story 3 (P2)**: Can start after Foundational for resolver and wording work; component truthfulness checks depend on the capsule/popover surface from US1

### Within Each User Story

- Tests should be written and fail before implementation
- Promotion types/catalog before resolver refinements
- Resolver output before component rendering
- Component rendering before real-shell verification
- Two-line detail structure and Claude/Codex second-line copy must be treated as one contract family and verified together

### Parallel Opportunities

- T002 and T003 can run in parallel after T001
- T005 and T006 can run in parallel after T004
- T009, T010, and T011 can run in parallel within US1
- T016 and T017 can run in parallel within US2
- T022 and T023 can run in parallel within US3
- T027 and T028 can run in parallel in the polish phase

---

## Parallel Example: User Story 1

```bash
# Launch the capsule/popover tests in parallel:
Task: "Add component tests for capsule rendering, icon plus short-copy semantics, and the rule that color is not the only status signal in /Users/chasewang/01workspace/projects/ai-usage/src/components/panel/PromotionStatusLine.test.tsx"
Task: "Add component tests for same-area popover two-line service blocks, including first-line conclusion plus benefit and second-line timing copy for Claude/Codex in /Users/chasewang/01workspace/projects/ai-usage/src/components/panel/PromotionStatusLine.test.tsx"
Task: "Add shell-level tests for header two-line layout, hover/focus preview, click-to-pin behavior, outside-click / `Esc` close, and reset-on-reopen flow in /Users/chasewang/01workspace/projects/ai-usage/src/app/shell/AppShell.test.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: Run US1 tests and verify the header + popover in the real app width

### Incremental Delivery

1. Complete Setup + Foundational
2. Add User Story 1 → Validate in app shell → MVP
3. Add User Story 2 → Validate catalog/history behavior independently
4. Add User Story 3 → Validate truthful edge cases and Codex active-window semantics
5. Finish with screenshot/E2E regression and quickstart validation

### Parallel Team Strategy

With multiple developers:

1. One developer completes Setup + Foundational
2. Then parallelize where safe:
   - Developer A: User Story 1 UI/header + popover work
   - Developer B: User Story 2 catalog/history hardening and maintenance docs
   - Developer C: User Story 3 edge-case truthfulness and wording
3. Rejoin for real-shell polish and screenshot/E2E validation

---

## Notes

- `[P]` tasks only appear where files do not overlap
- This task list intentionally includes real Tauri verification because repository workflow requires runtime evidence for shell-width-sensitive UI
- The suggested MVP scope is **User Story 1**
