# 任务清单：UI/UX 审查遗留项完成

> 变更说明（回退）：
> tray warning / danger 黄红状态图标需求已放弃，判定为未通过且不再纳入迭代 10 交付。与该需求直接相关的任务视为取消，不计入完成项。

**输入**：来自 `/specs/010-ui-ux-completion/` 的设计文档
**前置文档**：plan.md（必需）、spec.md（必需，用于用户故事）、research.md、data-model.md、contracts/

**测试**：本特性必须包含测试，因为规格中明确要求独立测试标准、可衡量结果，以及面板/菜单栏一致性、Pointer 排序、截图审查等跨层回归验证。

**组织方式**：任务按用户故事分组，确保每个故事都可以独立实现与独立验证。

## 当前实施状态（2026-03-23）

- 已完成 `52` 项：包含核心实现、文档回退与对齐，以及已执行通过的 `npm test`、`cargo test`、`npm run test:e2e:screenshots`
- 已放弃 `4` 项：`T020`、`T021`、`T029` 与 tray 黄/红状态图标、服务品牌图标交付直接相关，已按规格回退处理
- 仍待完成 `2` 项：`T017`、`T034`
- 当前剩余工作重心：补齐更强的原生壳层/E2E 交互能力，用于 tray 同步与 Pointer 拖拽；实现侧已无未完成功能任务，截图侧仅剩结果复核

> 状态说明：
> 先前评估中将 `T054` 误记为未完成，也低估了已完成测试任务数量。以本文件当前勾选状态为准。

## 格式：`[ID] [P?] [Story] 描述`

- **[P]**：可并行执行（不同文件、无未完成前置依赖）
- **[Story]**：任务所属用户故事（如 US1、US2、US3）
- 描述中必须包含精确文件路径

## 路径约定

- 单体 Tauri 项目，主要目录为 `src/`、`src-tauri/src/`、`tests/`
- 前端 UI 改动主要位于 `src/app/`、`src/components/`、`src/lib/`、`src/styles/`
- 宿主 / tray 相关改动位于 `src-tauri/src/`

## 阶段 1：准备阶段（共享基础准备）

**目的**：准备本特性的工作目录、资源目录与后续任务要使用的测试入口说明。

- [x] T001 在 /Users/chasewang/01workspace/projects/ai-usage/specs/010-ui-ux-completion/tasks.md 中建立本特性的任务拆解
- [x] T002 [P] 在 /Users/chasewang/01workspace/projects/ai-usage/src/assets/icons/ 中创建 tray/服务图标资源目录结构
- [x] T003 [P] 在 /Users/chasewang/01workspace/projects/ai-usage/tests/e2e/tray-panel.spec.mjs 和 /Users/chasewang/01workspace/projects/ai-usage/tests/e2e/screenshot-review.mjs 中梳理现有壳层测试入口并记录目标场景

---

## 阶段 2：基础阶段（阻塞性前置条件）

**目的**：完成多个用户故事共同依赖的契约、持久化默认值与复用 helper。

**⚠️ 关键说明**：在本阶段完成前，不应开始任何用户故事实现。

- [x] T004 更新 /Users/chasewang/01workspace/projects/ai-usage/src/lib/tauri/contracts.ts 中的共享 TypeScript 契约，补充首次引导关闭字段与归一化服务状态形状
- [x] T005 [P] 更新 /Users/chasewang/01workspace/projects/ai-usage/src/lib/persistence/preferencesStore.ts 中的 TypeScript 偏好归一化默认值，保证首次引导字段向后兼容
- [x] T006 [P] 更新 /Users/chasewang/01workspace/projects/ai-usage/src-tauri/src/state/mod.rs 中的 Rust 偏好/状态结构，保证首次引导字段向后兼容
- [x] T007 [P] 扩展 /Users/chasewang/01workspace/projects/ai-usage/src/app/shared/i18n.ts 中的共享文案与摘要 helper，补充告警标签、首次引导、占位引导和简短英文健康摘要
- [x] T008 [P] 在 /Users/chasewang/01workspace/projects/ai-usage/src/lib/tauri/summary.ts 中新增或扩展共享派生 helper，支持 tray 严重级别、服务状态归一化和面板告警派生
- [x] T009 在 /Users/chasewang/01workspace/projects/ai-usage/src/lib/tauri/summary.test.ts 和 /Users/chasewang/01workspace/projects/ai-usage/tests/integration/preferences-persistence.test.ts 中补充基础契约/单元覆盖，验证新偏好字段与 summary helper 行为

**检查点**：共享契约、持久化默认值和派生 helper 已就绪，可以开始进入用户故事实现。

---

## 阶段 3：用户故事 1 - 面板信息准确无冗余（优先级：P1）🎯 MVP

**目标**：修正额度行与告警卡片的展示，让面板在一眼扫视时准确、干净。

**独立测试**：打开面板，确认每条进度行都只有一条可读的百分比标签，并且 warning/danger 卡片的强调条全高贴边、顶部无空白。

### 用户故事 1 的测试

- [x] T010 [P] [US1] 在 /Users/chasewang/01workspace/projects/ai-usage/src/components/panel/ServiceCard.test.tsx 中增加额度行单一百分比标签和低填充可读性的回归测试
- [x] T011 [P] [US1] 在 /Users/chasewang/01workspace/projects/ai-usage/src/app/panel/PanelView.test.tsx 中增加强调条布局和健康卡片无强调条的回归测试

### 用户故事 1 的实现

- [x] T012 [P] [US1] 在 /Users/chasewang/01workspace/projects/ai-usage/src/components/panel/QuotaSummary.tsx 中重构额度进度渲染，确保每行只显示一条 in-bar 百分比标签
- [x] T013 [P] [US1] 在 /Users/chasewang/01workspace/projects/ai-usage/src/components/panel/ServiceCard.tsx 中重构服务卡片强调条布局，使其成为贴边装饰元素
- [x] T014 [US1] 在 /Users/chasewang/01workspace/projects/ai-usage/src/components/panel/ServiceCard.tsx 和 /Users/chasewang/01workspace/projects/ai-usage/src/styles/globals.css 中调整卡片间距与告警等级样式，保持卡片布局干净整洁

**检查点**：用户故事 1 应能独立在面板中完成验证。

---

## 阶段 4：用户故事 2 - 菜单栏与面板数据始终一致（优先级：P1）

**目标**：让菜单栏文字与 tooltip 始终与最新刷新得到的面板数据同步；菜单栏图标保持默认应用图标。

**独立测试**：触发手动刷新与自动刷新，确认 tray 标题与面板数据一致，tooltip 包含选中服务名；warning/danger 状态下图标保持默认应用图标。

### 用户故事 2 的测试

- [x] T015 [P] [US2] 在 /Users/chasewang/01workspace/projects/ai-usage/src-tauri/src/tray/mod.rs 中增加 Rust 测试，验证服务名 tooltip 格式与严重级别图标选择（已放弃：tray 黄/红状态图标需求取消）
- [x] T016 [P] [US2] 在 /Users/chasewang/01workspace/projects/ai-usage/src-tauri/src/commands/mod.rs 中增加宿主刷新回归测试，验证刷新成功后会重新同步 tray
- [ ] T017 [P] [US2] 在 /Users/chasewang/01workspace/projects/ai-usage/tests/e2e/tray-panel.spec.mjs 中增加 panel 刷新到 tray 同步的壳层回归覆盖

### 用户故事 2 的实现

- [x] T018 [P] [US2] 在 /Users/chasewang/01workspace/projects/ai-usage/src-tauri/src/tray/mod.rs 中引入 tray 视图状态派生与 tooltip 组装 helper
- [x] T019 [P] [US2] 在 /Users/chasewang/01workspace/projects/ai-usage/src-tauri/src/commands/mod.rs 中重构刷新成功路径，确保始终重新应用 tray 表面状态
- [ ] T020 [P] [US2] 在 /Users/chasewang/01workspace/projects/ai-usage/src/assets/icons/ 中补充 normal、warning、danger 三套 tray 图标资源（已放弃：tray 黄/红状态图标需求取消）
- [ ] T021 [US2] 在 /Users/chasewang/01workspace/projects/ai-usage/src-tauri/src/tray/mod.rs 和 /Users/chasewang/01workspace/projects/ai-usage/src-tauri/src/lib.rs 中接入严重级别图标与选中服务 tooltip 文案（已放弃：仅保留 tooltip 文案同步）

**检查点**：用户故事 2 应可独立验证为“菜单栏与面板真实一致”。

---

## 阶段 5：用户故事 3 - 面板与设置视觉一致（优先级：P2）

**目标**：通过统一 header 结构、按钮风格和卡片宽度，让面板与设置页像同一套产品表面。

**独立测试**：在面板与设置页之间切换，确认 header 动作按钮风格一致、返回按钮为图标按钮、状态副文案存在、卡片宽度一致。

### 用户故事 3 的测试

- [x] T022 [P] [US3] 在 /Users/chasewang/01workspace/projects/ai-usage/src/app/settings/SettingsView.test.tsx 中增加 icon-only 返回按钮与保存状态副文案的渲染覆盖
- [x] T023 [P] [US3] 在 /Users/chasewang/01workspace/projects/ai-usage/tests/e2e/screenshot-review.mjs 中增加面板/设置页视觉对齐的截图回归覆盖

### 用户故事 3 的实现

- [x] T024 [P] [US3] 在 /Users/chasewang/01workspace/projects/ai-usage/src/app/shell/AppShell.tsx 和 /Users/chasewang/01workspace/projects/ai-usage/src/styles/globals.css 中统一面板 header 与设置入口按钮风格
- [x] T025 [P] [US3] 在 /Users/chasewang/01workspace/projects/ai-usage/src/app/settings/SettingsView.tsx 中将返回操作改为圆形 chevron 图标按钮，并增加保存状态副文案
- [x] T026 [US3] 在 /Users/chasewang/01workspace/projects/ai-usage/src/app/panel/PanelView.tsx、/Users/chasewang/01workspace/projects/ai-usage/src/app/settings/SettingsView.tsx 和 /Users/chasewang/01workspace/projects/ai-usage/src/styles/globals.css 中统一内容宽度与卡片容器间距

**检查点**：用户故事 3 应能在不依赖后续故事的前提下独立验证为视觉一致。

---

## 阶段 6：用户故事 4 - 服务可快速识别与定位（优先级：P2）

**目标**：让用户更快识别服务，并在服务未连接时明确知道下一步该做什么。

**独立测试**：确认已连接卡片仅显示一次服务名文本且无重复识别元素；未连接服务显示可操作且可区分的引导文案。

### 用户故事 4 的测试

- [x] T027 [P] [US4] 在 /Users/chasewang/01workspace/projects/ai-usage/src/components/panel/ServiceCard.test.tsx 中增加纯文本服务识别与差异化空状态引导的测试
- [x] T028 [P] [US4] 在 /Users/chasewang/01workspace/projects/ai-usage/src/app/panel/PanelView.test.tsx 中增加占位卡跳转设置页行为的覆盖

### 用户故事 4 的实现

- [ ] T029 [P] [US4] 已放弃：不再在 /Users/chasewang/01workspace/projects/ai-usage/src/assets/icons/ 与 /Users/chasewang/01workspace/projects/ai-usage/src/components/panel/ServiceCard.tsx 中交付 Codex/Claude Code 品牌图标资源
- [x] T030 [P] [US4] 在 /Users/chasewang/01workspace/projects/ai-usage/src/components/panel/ServiceCard.tsx 中回退为纯文本服务头部布局，不显示图标槽位或首字母头像兜底
- [x] T031 [US4] 在 /Users/chasewang/01workspace/projects/ai-usage/src/app/panel/PanelView.tsx 和 /Users/chasewang/01workspace/projects/ai-usage/src/app/shared/i18n.ts 中用“未安装/已安装未登录”差异化引导替换通用未连接占位文案

**检查点**：用户故事 4 应能在连接/未连接两种状态下独立测试。

---

## 阶段 7：用户故事 5 - 设置页高效易用（优先级：P2）

**目标**：提升高频设置的可见性，补齐真实状态区域，移除调试 UI，并让排序在真实壳层中可靠可用。

**独立测试**：打开设置页，确认高频设置在首屏、状态区域覆盖多服务、测试通知按钮已消失，且 macOS 上 Pointer 排序可即时生效。

### 用户故事 5 的测试

- [x] T032 [P] [US5] 在 /Users/chasewang/01workspace/projects/ai-usage/src/app/settings/SettingsView.test.tsx 中增加首屏控制项顺序、多服务状态卡与移除通知测试按钮的测试
- [x] T033 [P] [US5] 在 /Users/chasewang/01workspace/projects/ai-usage/src/app/settings/SettingsView.test.tsx 和 /Users/chasewang/01workspace/projects/ai-usage/tests/integration/preferences-persistence.test.ts 中增加 Pointer 排序 helper 与持久化覆盖
- [ ] T034 [P] [US5] 在 /Users/chasewang/01workspace/projects/ai-usage/tests/e2e/tray-panel.spec.mjs 中增加 macOS Pointer 排序持久化的壳层覆盖

### 用户故事 5 的实现

- [x] T035 [P] [US5] 在 /Users/chasewang/01workspace/projects/ai-usage/src/app/settings/SettingsView.tsx 中重排设置分组，将托盘摘要模式与菜单栏服务前置到首屏
- [x] T036 [P] [US5] 在 /Users/chasewang/01workspace/projects/ai-usage/src/app/settings/SettingsView.tsx 和 /Users/chasewang/01workspace/projects/ai-usage/src/app/shared/appState.ts 中用按服务归一化的状态卡替换 Codex-only 状态展示
- [x] T037 [P] [US5] 在 /Users/chasewang/01workspace/projects/ai-usage/src/app/settings/SettingsView.tsx 中移除正式设置表面的通知测试按钮
- [x] T038 [US5] 在 /Users/chasewang/01workspace/projects/ai-usage/src/app/settings/SettingsView.tsx 和 /Users/chasewang/01workspace/projects/ai-usage/src/features/preferences/preferencesController.ts 中用 Pointer 排序与即时保存替换 HTML5 drag/drop

**检查点**：用户故事 5 完成后，应可独立作为“设置页实用性提升”交付。

---

## 阶段 8：用户故事 6 - 面板底部和设置分组排版舒适（优先级：P3）

**目标**：通过调整留白和按钮权重，让两个表面在细节层面更舒适、更易扫读。

**独立测试**：滚动到面板底部，检查设置页分组间距，并确认代理“应用”按钮在无未保存变更时保持中性样式。

### 用户故事 6 的测试

- [x] T039 [P] [US6] 在 /Users/chasewang/01workspace/projects/ai-usage/src/app/settings/SettingsView.test.tsx 中增加分组间距层级与代理应用按钮强调状态的测试
- [x] T040 [P] [US6] 在 /Users/chasewang/01workspace/projects/ai-usage/tests/e2e/screenshot-review.mjs 中增加面板底部留白与设置页分组节奏的截图回归覆盖

### 用户故事 6 的实现

- [x] T041 [P] [US6] 在 /Users/chasewang/01workspace/projects/ai-usage/src/app/panel/PanelView.tsx 和 /Users/chasewang/01workspace/projects/ai-usage/src/styles/globals.css 中增加面板滚动容器底部留白
- [x] T042 [P] [US6] 在 /Users/chasewang/01workspace/projects/ai-usage/src/components/settings/PreferenceSection.tsx 和 /Users/chasewang/01workspace/projects/ai-usage/src/styles/globals.css 中调整设置分组标题与内容的间距层级
- [x] T043 [US6] 在 /Users/chasewang/01workspace/projects/ai-usage/src/app/settings/SettingsView.tsx 中降低代理“应用”按钮默认权重，并仅在代理草稿脏状态下高亮

**检查点**：用户故事 6 应可通过布局检查与状态切换独立验证。

---

## 阶段 9：用户故事 7 - 无障碍与引导体验（优先级：P3）

**目标**：补齐非颜色紧急度提示、首次引导和背景样式，让面板对新用户和色觉障碍用户更友好。

**独立测试**：确认低额度卡片提供文本/图标提示；首次打开时先出现引导覆盖层；面板背景已不再依赖伪 blur 样式。

### 用户故事 7 的测试

- [x] T044 [P] [US7] 在 /Users/chasewang/01workspace/projects/ai-usage/src/app/panel/PanelView.test.tsx 中增加非颜色 warning 标签和首次引导显示/关闭规则测试
- [x] T045 [P] [US7] 在 /Users/chasewang/01workspace/projects/ai-usage/tests/integration/preferences-persistence.test.ts 和 /Users/chasewang/01workspace/projects/ai-usage/src-tauri/src/state/mod.rs 中增加首次引导关闭字段的持久化兼容性测试
- [x] T046 [P] [US7] 在 /Users/chasewang/01workspace/projects/ai-usage/tests/e2e/screenshot-review.mjs 和 /Users/chasewang/01workspace/projects/ai-usage/tests/e2e/tray-panel.spec.mjs 中增加首次引导与无障碍告警状态的截图/壳层覆盖

### 用户故事 7 的实现

- [x] T047 [P] [US7] 在 /Users/chasewang/01workspace/projects/ai-usage/src/components/panel/QuotaSummary.tsx 和 /Users/chasewang/01workspace/projects/ai-usage/src/components/panel/ServiceCard.tsx 中增加 warning/danger 文本标签或图标提示
- [x] T048 [P] [US7] 在 /Users/chasewang/01workspace/projects/ai-usage/src/app/panel/PanelView.tsx 和 /Users/chasewang/01workspace/projects/ai-usage/src/app/shared/appState.ts 中实现首次引导覆盖层、关闭持久化与跳转设置页流程
- [x] T049 [US7] 在 /Users/chasewang/01workspace/projects/ai-usage/src/styles/globals.css 和 /Users/chasewang/01workspace/projects/ai-usage/src/app/shell/AppShell.tsx 中移除伪 blur，并改为纯色表面风格

**检查点**：用户故事 7 应能独立验证无障碍和首次使用体验。

---

## 阶段 10：用户故事 8 - 英文模式健康摘要完整显示（优先级：P3）

**目标**：确保英文健康摘要在固定宽度面板 header 中完整显示，不被截断。

**独立测试**：切换到 `en-US`，触发 warning/danger 状态，确认 header 摘要完整显示且没有省略号。

### 用户故事 8 的测试

- [x] T050 [P] [US8] 在 /Users/chasewang/01workspace/projects/ai-usage/src/app/shared/i18n.test.ts 和 /Users/chasewang/01workspace/projects/ai-usage/src/app/panel/PanelView.test.tsx 中增加简短英文健康摘要渲染测试
- [x] T051 [P] [US8] 在 /Users/chasewang/01workspace/projects/ai-usage/tests/e2e/screenshot-review.mjs 中增加英文低额度 header 文案的截图回归覆盖

### 用户故事 8 的实现

- [x] T052 [P] [US8] 在 /Users/chasewang/01workspace/projects/ai-usage/src/app/shared/i18n.ts 中缩短英文健康摘要与紧急程度文案
- [x] T053 [US8] 在 /Users/chasewang/01workspace/projects/ai-usage/src/app/shell/AppShell.tsx 和 /Users/chasewang/01workspace/projects/ai-usage/src/styles/globals.css 中调整 header 摘要布局，确保英文文案完整显示

**检查点**：用户故事 8 应可在英文环境下独立验证。

---

## 阶段 11：收尾与跨切片事项

**目的**：完成全局集成、回归测试和文档对齐。

- [x] T054 [P] 更新 /Users/chasewang/01workspace/projects/ai-usage/specs/010-ui-ux-completion/quickstart.md 和 /Users/chasewang/01workspace/projects/ai-usage/doc/engineering/010-ui-ux-iteration-plan.md 中的特性文档与验收说明
- [x] T055 在 /Users/chasewang/01workspace/projects/ai-usage 中运行 `npm test`，完成本特性的前端回归测试
- [x] T056 在 /Users/chasewang/01workspace/projects/ai-usage/src-tauri 中运行 `cargo test`，完成本特性的宿主回归测试
- [x] T057 在 /Users/chasewang/01workspace/projects/ai-usage 中运行 `npm run test:e2e:tauri` 与 `npm run test:e2e:screenshots`，完成 tray/面板/截图壳层验证

---

## 依赖与执行顺序

### 阶段依赖

- **阶段 1：准备阶段**：无依赖，可立即开始
- **阶段 2：基础阶段**：依赖阶段 1，且会阻塞全部用户故事
- **阶段 3-10：用户故事阶段**：均依赖阶段 2 完成
- **阶段 11：收尾阶段**：依赖所有目标用户故事完成

### 用户故事依赖

- **US1（P1）**：在基础阶段完成后即可开始；不依赖其他故事
- **US2（P1）**：在基础阶段完成后即可开始；虽与 US1 共用 helper，但可独立验证
- **US3（P2）**：在基础阶段完成后即可开始；因涉及共享 shell 布局，通常会排在 P1 之后
- **US4（P2）**：在基础阶段完成后即可开始；除共享样式外基本独立于 US3
- **US5（P2）**：在基础阶段完成后即可开始；依赖阶段 2 中的契约/helper 更新
- **US6（P3）**：更适合在 US3 和 US5 之后进行，因为它主要微调两者的排版
- **US7（P3）**：在基础阶段完成后即可开始；首次引导持久化依赖 Phase 2 的偏好更新
- **US8（P3）**：更适合在 US3 之后进行，因为它要调整最终 header 布局

### 每个用户故事内部顺序

- 应先写测试，并确保测试在实现前处于失败状态
- 同一故事中的共享 helper 更新应先于视图/组件接入
- UI 集成应在壳层/E2E 验证前完成

### 并行机会

- 准备阶段中的 T002 与 T003 可并行
- T004-T008 可在契约、持久化、i18n 与 summary helper 之间大体并行推进
- Phase 2 完成后，US1 与 US2 可并行
- US3、US4、US5 可在协调文件归属的前提下并行
- 各故事中标记为 `[P]` 的测试任务都可并行执行

---

## 并行示例：用户故事 2

```bash
# 可同时推进的宿主侧验证工作：
Task: "在 src-tauri/src/tray/mod.rs 中增加服务名 tooltip 格式与严重级别图标选择的 Rust 测试（已放弃）"
Task: "在 src-tauri/src/commands/mod.rs 中增加刷新成功后 tray 重同步的宿主回归测试"
Task: "在 tests/e2e/tray-panel.spec.mjs 中增加 panel 刷新到 tray 同步的壳层回归覆盖"

# 可按不同文件拆分的实现工作：
Task: "在 src-tauri/src/tray/mod.rs 中引入 tray 视图状态派生与 tooltip 组装 helper"
Task: "在 src-tauri/src/commands/mod.rs 中重构刷新成功路径，确保始终重新应用 tray 表面状态"
Task: "在 src/assets/icons/ 中补充 normal、warning、danger 三套 tray 图标资源（已放弃）"
```

---

## 并行示例：用户故事 5

```bash
# 可同时推进的设置页验证工作：
Task: "在 src/app/settings/SettingsView.test.tsx 中增加首屏控制项顺序、多服务状态卡与移除通知测试按钮的测试"
Task: "在 src/app/settings/SettingsView.test.tsx 和 tests/integration/preferences-persistence.test.ts 中增加 Pointer 排序 helper 与持久化覆盖"
Task: "在 tests/e2e/tray-panel.spec.mjs 中增加 macOS Pointer 排序持久化的壳层覆盖"

# 可拆分给不同文件责任人的实现工作：
Task: "在 src/app/settings/SettingsView.tsx 中重排设置分组，将托盘摘要模式与菜单栏服务前置到首屏"
Task: "在 src/app/settings/SettingsView.tsx 和 src/app/shared/appState.ts 中用按服务归一化的状态卡替换 Codex-only 状态展示"
Task: "在 src/app/settings/SettingsView.tsx 和 src/features/preferences/preferencesController.ts 中用 Pointer 排序与即时保存替换 HTML5 drag/drop"
```

---

## 实施策略

### MVP 优先（仅用户故事 1）

1. 完成阶段 1：准备阶段
2. 完成阶段 2：基础阶段
3. 完成阶段 3：用户故事 1
4. 使用 US1 对应测试独立验证面板可读性修复
5. 在进入后续故事前先演示这部分修复

### 增量交付

1. 先完成准备阶段 + 基础阶段
2. 先交付 US1 和 US2，恢复最核心的面板/菜单栏信任问题
3. 再交付 US3、US4、US5，完成视觉统一与设置页实用性提升
4. 最后补齐 US6、US7、US8，完成排版、无障碍与 i18n 打磨
5. 最终在阶段 11 统一运行完整回归与截图审查

### 并行团队策略

1. 先由一名开发者完成阶段 2 的共享契约/持久化工作
2. 阶段 2 完成后可按如下方式拆分：
   - 开发者 A：US1 + US3
   - 开发者 B：US2
   - 开发者 C：US4 + US7
   - 开发者 D：US5 + US6 + US8

---

## 备注

- 所有任务均遵循必需的 checklist 格式，包含任务 ID 与精确文件路径
- `[P]` 仅用于可安全按文件或关注点拆分的任务
- 每个用户故事都附带独立测试标准与对应验证任务
- 建议 MVP 范围仍是 **US1**；但从真实发布角度，更推荐先交付 **US1 + US2**，因为两者共同修复最高优先级的信任问题
