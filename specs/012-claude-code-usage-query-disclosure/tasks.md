# Tasks: Claude Code 用度查询告知与启用控制

**Input**: Design documents from `/specs/012-claude-code-usage-query-disclosure/`  
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: 本特性明确要求测试与真实运行态验证，因此任务中包含前端、宿主、契约、集成和 E2E 验证任务。  
**Organization**: 任务按用户故事分组，确保每个故事都能独立实现和验证。

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 可并行执行（不同文件、无未完成前置依赖）
- **[Story]**: 对应的用户故事标签（如 `US1`、`US2`）
- 每条任务都包含明确文件路径

## Phase 1: Setup（共享脚手架）

**Purpose**: 对齐本特性需要的共享默认值、真实场景脚本和测试入口

- [X] T001 更新 Claude Code 新偏好字段、缓存态和冷却场景输入脚手架，涉及 `src/features/preferences/defaultPreferences.ts`、`tests/e2e/screenshot-review.mjs`、`tests/e2e/tray-panel.spec.mjs`、`scripts/dev/run-onboarding-scenario.mjs`
- [X] T002 [P] 创建 Claude Code 启用/关闭、缓存恢复与冷却编排测试入口于 `src/app/shell/AppShell.test.tsx`

---

## Phase 2: Foundational（阻塞性前置）

**Purpose**: 完成所有用户故事都依赖的偏好契约、共享冷却、宿主禁用语义和可见服务归一化

**⚠️ CRITICAL**: 本阶段完成前，不开始任何用户故事实现

- [X] T003 [P] 为 Claude Code 新偏好字段补充前端持久化失败测试于 `tests/integration/preferences-persistence.test.ts`
- [X] T004 [P] 为 Claude Code 新偏好字段补充 Rust 默认值与兼容性失败测试于 `src-tauri/src/state/mod.rs`
- [X] T005 [P] 为 Claude Code 关闭态与共享冷却命令语义补充契约失败测试于 `tests/contract/claude-code-panel-state.test.ts`
- [X] T006 [P] 为关闭后 tray 不再消费 Claude 缓存、menubar service 归一化回退及冷却命中补充 Rust 失败测试于 `src-tauri/src/tray/mod.rs`、`src-tauri/src/commands/mod.rs`
- [X] T007 实现前后端共享偏好字段、时间戳归一化与冷却契约逻辑，涉及 `src/lib/tauri/contracts.ts`、`src/lib/persistence/preferencesStore.ts`、`src-tauri/src/state/mod.rs`、`src-tauri/src/commands/mod.rs`
- [X] T008 实现宿主侧 Claude Code 硬关闭、缓存保留不展示、共享冷却与 tray 回退逻辑于 `src-tauri/src/commands/mod.rs`、`src-tauri/src/tray/mod.rs`
- [X] T009 实现前端可见服务集合、缓存态与禁用态归一化辅助逻辑于 `src/app/shell/AppShell.tsx`、`src/lib/tauri/summary.ts`

**Checkpoint**: 新偏好字段、共享冷却、宿主禁用短路和可见服务归一化已经就位，用户故事可以开始。

---

## Phase 3: User Story 1 - 首次看到清晰可信的 Claude Code 告知 (Priority: P1) 🎯

**Goal**: 在现有 onboarding 中增加独立的 Claude Code 说明卡片，并支持确认后只关闭该卡片且以后不再出现。  
**Independent Test**: 在 `npm run tauri:dev:onboarding` 或对应 RTL 场景下，首次引导会显示 Claude Code 说明卡片；点击 `我知道了` 后仅该卡片消失，再次进入同场景时不重复出现。

### Tests for User Story 1

- [X] T010 [P] [US1] 为 onboarding 中的 Claude Code 说明卡片渲染、关闭持久化与英文文案切换补充失败测试于 `src/app/panel/PanelView.test.tsx`

### Implementation for User Story 1

- [X] T011 [P] [US1] 添加 Claude Code 说明卡片的中英文文案于 `src/app/shared/i18n.ts`
- [X] T012 [US1] 在现有 onboarding 中渲染并持久化 Claude Code 说明卡片关闭行为于 `src/app/panel/PanelView.tsx`

**Checkpoint**: 首次引导中的 Claude Code 独立说明卡片可以独立工作并通过测试。

---

## Phase 4: User Story 2 - 在设置页显式决定是否启用 Claude Code 用度查询 (Priority: P1)

**Goal**: 在设置页末尾新增独立的 Claude Code 查询卡片与启用开关，默认关闭；开启后立即进入查询中状态，并在有缓存时先展示缓存与刷新中指示；命中冷却时复用缓存而不报错。  
**Independent Test**: 打开设置页后，可在页面最底部看到与主设置卡片同级的 Claude Code 查询卡片；标题为 `Claude Code 查询`，右侧开关默认关闭；开启后不弹确认层并立即进入查询中状态；有缓存时先显示缓存并伴随刷新中指示；冷却命中时复用缓存/当前结果；英文界面下新增文案完整翻译。

### Tests for User Story 2

- [X] T013 [P] [US2] 为设置页底部 Claude Code 查询卡片与右侧开关补充失败测试于 `src/app/settings/SettingsView.test.tsx`
- [X] T014 [P] [US2] 为启用后立即触发首次查询、缓存优先恢复、刷新中状态与冷却命中补充失败测试于 `src/app/shell/AppShell.test.tsx`

### Implementation for User Story 2

- [X] T015 [P] [US2] 添加设置页 Claude Code 查询卡片与启用开关的中英文文案于 `src/app/shared/i18n.ts`
- [X] T016 [US2] 在设置页最底部实现 Claude Code 查询卡片与标题右侧开关于 `src/app/settings/SettingsView.tsx`
- [X] T017 [US2] 实现 Claude Code 开关保存、缓存优先恢复、查询中状态与开启即查编排逻辑于 `src/app/shell/AppShell.tsx`、`src/features/demo-services/panelController.ts`

**Checkpoint**: 用户可以在设置页明确开启 Claude Code，用一次操作完成保存、进入查询中状态，并在缓存/冷却条件下得到真实一致反馈。

---

## Phase 5: User Story 3 - 关闭后系统行为真实一致，不再暗中触发 Claude Code 查询 (Priority: P1)

**Goal**: 关闭 Claude Code 后，应用不再读取凭证、不再查询、不再展示为可选或活跃服务；若 Claude Code 是唯一服务，则回退到空状态；初始化、自动刷新、手动刷新和冷却命中路径都保持真实一致。  
**Independent Test**: 在 Claude Code 曾经可用的环境中关闭开关后，主面板、菜单栏、设置项和刷新链路都不再把 Claude Code 视为启用中服务；冷却期内重复触发也不会产生新的官方请求；重新打开应用后仍保持关闭语义。

### Tests for User Story 3

- [X] T018 [P] [US3] 为禁用 Claude Code 后的主面板回退、空状态与缓存不可见补充失败测试于 `src/app/panel/PanelView.test.tsx`
- [X] T019 [P] [US3] 为禁用 Claude Code 后的设置项隐藏、宿主回退与 tray 不再消费缓存补充失败测试于 `src/app/settings/SettingsView.test.tsx`、`src-tauri/src/commands/mod.rs`
- [X] T020 [P] [US3] 为初始化、自动刷新、手动刷新和冷却命中三条路径的 Claude Code 禁用/跳过语义补充失败测试于 `src/app/shell/AppShell.test.tsx`

### Implementation for User Story 3

- [X] T021 [US3] 实现禁用 Claude Code 后的主面板过滤、缓存不可见与空状态回退于 `src/app/panel/PanelView.tsx`、`src/app/shell/AppShell.tsx`
- [X] T022 [US3] 实现禁用 Claude Code 后隐藏 `menubarService` 与 `serviceOrder` 相关入口于 `src/app/settings/SettingsView.tsx`
- [X] T023 [US3] 在 `src/app/shell/AppShell.tsx`、`src/features/demo-services/panelController.ts` 中完成初始化、自动刷新、手动刷新和冷却命中对 Claude Code 的统一短路/复用编排
- [X] T024 [US3] 完成 Claude Code 禁用后的宿主缓存隐藏、重新启用缓存优先、共享冷却和 tray 归一化逻辑于 `src-tauri/src/commands/mod.rs`、`src-tauri/src/tray/mod.rs`

**Checkpoint**: Claude Code 关闭语义在面板、设置、tray、缓存、冷却与宿主命令层全部一致。

---

## Phase 6: User Story 4 - 在 README 中提前看到行为边界说明 (Priority: P2)

**Goal**: 在 README 中增加 Claude Code 查询说明小节，让用户在启动应用前就能了解行为边界。  
**Independent Test**: 打开 README，可以直接看到独立小节，内容覆盖凭证用途、非官方接口边界和代理提示。

### Implementation for User Story 4

- [X] T025 [US4] 在 `README.md` 中新增 Claude Code 查询说明小节并写入定稿文案

**Checkpoint**: README 已承担独立、长期可见的透明告知职责。

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: 完成真实运行态验证、E2E 场景更新和最终回归

- [X] T026 [P] 更新 Claude Code onboarding / 设置 / 禁用态，以及启用后缓存+刷新中状态、冷却命中和菜单栏或 tray 查询中状态的 E2E 断言与截图审查于 `tests/e2e/tray-panel.spec.mjs`、`tests/e2e/screenshot-review.mjs`
- [X] T027 依据 `specs/012-claude-code-usage-query-disclosure/quickstart.md` 运行并修复受影响验证，涉及 `src/app/panel/PanelView.test.tsx`、`src/app/settings/SettingsView.test.tsx`、`src/app/shell/AppShell.test.tsx`、`tests/integration/preferences-persistence.test.ts`、`tests/contract/claude-code-panel-state.test.ts`、`tests/e2e/tray-panel.spec.mjs`、`tests/e2e/screenshot-review.mjs`、`src-tauri/src/state/mod.rs`、`src-tauri/src/commands/mod.rs`、`src-tauri/src/tray/mod.rs`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: 无依赖，可立即开始
- **Foundational (Phase 2)**: 依赖 Setup 完成；阻塞所有用户故事
- **User Stories (Phase 3+)**: 依赖 Foundational 完成
- **Polish (Phase 7)**: 依赖目标用户故事实现完成

### User Story Dependencies

- **US1**: 依赖 Foundational 完成；无需依赖其他故事
- **US2**: 依赖 Foundational 完成；无需依赖其他故事
- **US3**: 依赖 Foundational 与 US2 完成，因为它建立在设置开关、缓存恢复与冷却编排已存在的前提上
- **US4**: 可在 Foundational 完成后独立推进，但建议在 US2 / US3 语义稳定后落 README 文案

### Within Each User Story

- 先写并确认失败测试，再开始实现
- 文案 / 静态资源可先行
- UI 渲染与宿主/编排逻辑分步落地
- 每个故事完成后都要能独立验证，不依赖后续故事补救

### Parallel Opportunities

- Setup 中的 `T001` 与 `T002` 可并行
- Foundational 中的 `T003`、`T004`、`T005`、`T006` 可并行
- US1 中的 `T010` 与 `T011` 可并行
- US2 中的 `T013`、`T014`、`T015` 可并行
- US3 中的 `T018`、`T019`、`T020` 可并行
- Polish 中的 `T026` 可与 `T025` 的 README 复核并行

---

## Parallel Example: User Story 1

```bash
# 并行准备 US1 的失败测试和文案
Task: "T010 [US1] 为 onboarding 中的 Claude Code 说明卡片渲染、关闭持久化与英文文案切换补充失败测试于 src/app/panel/PanelView.test.tsx"
Task: "T011 [US1] 添加 Claude Code 说明卡片的中英文文案于 src/app/shared/i18n.ts"
```

## Parallel Example: User Story 2

```bash
# 并行准备 US2 的设置测试、shell 编排测试和文案
Task: "T013 [US2] 为设置页底部 Claude Code 查询卡片与右侧开关补充失败测试于 src/app/settings/SettingsView.test.tsx"
Task: "T014 [US2] 为启用后立即触发首次查询、缓存优先恢复、刷新中状态与冷却命中补充失败测试于 src/app/shell/AppShell.test.tsx"
Task: "T015 [US2] 添加设置页 Claude Code 查询卡片与启用开关的中英文文案于 src/app/shared/i18n.ts"
```

## Parallel Example: User Story 3

```bash
# 并行准备 US3 的前端、宿主和刷新链路回归测试
Task: "T018 [US3] 为禁用 Claude Code 后的主面板回退、空状态与缓存不可见补充失败测试于 src/app/panel/PanelView.test.tsx"
Task: "T019 [US3] 为禁用 Claude Code 后的设置项隐藏、宿主回退与 tray 不再消费缓存补充失败测试于 src/app/settings/SettingsView.test.tsx、src-tauri/src/commands/mod.rs"
Task: "T020 [US3] 为初始化、自动刷新、手动刷新和冷却命中三条路径的 Claude Code 禁用/跳过语义补充失败测试于 src/app/shell/AppShell.test.tsx"
```

---

## Implementation Strategy

### MVP First

这个特性的最小可交付不是单独的 US1，而是：

1. 完成 Phase 1: Setup
2. 完成 Phase 2: Foundational
3. 完成 Phase 3: US1
4. 完成 Phase 4: US2
5. **STOP and VALIDATE**：确认“看得到说明 + 能显式控制 + 开启即查 + 缓存/冷却反馈真实”闭环成立

### Incremental Delivery

1. 完成 Setup + Foundational，建立安全默认值、共享冷却与宿主硬关闭能力
2. 交付 US1，让用户首次接触时看到透明说明
3. 交付 US2，让用户在设置页显式启用并立即看到缓存/查询中状态与后续真实结果
4. 交付 US3，把禁用后的真实状态、tray 回退、缓存不可见与刷新链路抑制补齐
5. 交付 US4，把透明边界前移到 README
6. 完成 Polish 和真实运行态回归

### Parallel Team Strategy

多人协作时建议：

1. 一人负责 Foundational 中的 Rust/偏好契约、共享冷却与宿主禁用语义
2. 一人负责 US1/US2 的前端文案、onboarding、设置页交互与缓存恢复反馈
3. 一人负责 US3/Polish 的 E2E、真实运行态和 tray/刷新链路回归

---

## Notes

- `[P]` 任务应只在不存在共享文件冲突时并行推进
- `US3` 虽是 P1，但依赖 `US2` 的启用开关、缓存恢复与冷却编排存在，因此应排在 `US2` 之后完成
- `T027` 完成前，不应宣告此特性已完成，因为本特性明确要求真实 Tauri 运行态验证
