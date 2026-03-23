# 任务清单：设置页面重设计

**输入**：来自 `/specs/011-settings-redesign/` 的设计文档
**前置文档**：plan.md（必需）、spec.md（必需，用于用户故事）、research.md、data-model.md、contracts/、quickstart.md

**测试**：本特性必须包含测试，因为规格中为每个用户故事都定义了独立测试标准，且计划/quickstart 明确要求 RTL、壳层 E2E 或截图回归来覆盖一屏可见、即时保存、胶囊排序和代理自动保存等行为。

**组织方式**：任务按用户故事分组，确保每个故事都可以独立实现与独立验证。

**FR-009 说明**：`FR-009（所有设置项的修改必须自动保存）` 在任务执行上按故事逐步闭环：
- `US1`：建立统一行内布局，并让共享 select/switch 控件采用即时保存与失败回滚
- `US3`：补齐 `serviceOrder` 的即时持久化与失败回滚
- `US4`：补齐 `refreshIntervalMinutes` 预设 select 的即时保存
- `US5`：补齐 `networkProxyMode` / `networkProxyUrl` 的自动保存与失败回滚

因此，`US1` 是 FR-009 的基础交付切片，但不是该需求的最终完成点。

## 格式：`[ID] [P?] [Story] 描述`

- **[P]**：可并行执行（不同文件、无未完成前置依赖）
- **[Story]**：任务所属用户故事（如 US1、US2、US3）
- 描述中必须包含精确文件路径

## 路径约定

- 单体 Tauri 项目，主要目录为 `src/`、`src-tauri/src/`、`tests/`
- 前端 UI 改动主要位于 `src/app/`、`src/components/`、`src/styles/`
- 偏好命令和宿主回归位于 `src-tauri/src/`

## 阶段 1：准备阶段（共享基础准备）

**目的**：建立本特性的任务拆解，并确认后续测试与实现要复用的入口文件。

- [X] T001 在 /Users/chasewang/01workspace/projects/ai-usage/specs/011-settings-redesign/tasks.md 中建立本特性的任务拆解
- [X] T002 [P] 在 /Users/chasewang/01workspace/projects/ai-usage/src/app/settings/SettingsView.test.tsx 和 /Users/chasewang/01workspace/projects/ai-usage/tests/e2e/screenshot-review.mjs 中确认可复用的设置页测试入口与截图入口

---

## 阶段 2：基础阶段（阻塞性前置条件）

**目的**：完成多个用户故事共同依赖的文案、行级骨架和保存反馈约束整理。

**⚠️ 关键说明**：在本阶段完成前，不应开始任何用户故事实现。

- [X] T003 [P] 在 /Users/chasewang/01workspace/projects/ai-usage/src/app/shared/i18n.ts 中补齐设置页重设计所需的统一行内标签、刷新间隔预设、代理自动保存与错误提示文案
- [X] T004 [P] 在 /Users/chasewang/01workspace/projects/ai-usage/src/components/settings/PreferenceField.tsx 中重构共享字段骨架，使其支持“左标签、右控件、行内错误/说明”的单行布局
- [X] T005 [P] 在 /Users/chasewang/01workspace/projects/ai-usage/src/app/shell/AppShell.tsx 中抽离并补齐设置页 header 保存状态回调，使所有即时保存设置共享同一套保存中/成功/失败反馈
- [X] T006 在 /Users/chasewang/01workspace/projects/ai-usage/src/app/settings/SettingsView.test.tsx 中补充基础渲染覆盖，锁定“单卡片列表 + 无 section heading”的共享前置断言

**检查点**：共享文案、字段骨架和保存反馈入口已就绪，可以开始进入用户故事实现。

---

## 阶段 3：用户故事 1 - 一屏查看和修改所有设置（优先级：P1）🎯 MVP

**目标**：把设置页重构为单卡片行列表，让 7 个设置项在默认窗口高度内完整可见，并为全部设置项建立统一的即时保存骨架；其中共享 select/switch 控件必须立即保存且失败回滚到最近一次成功状态。

**独立测试**：打开设置页面，验证 7 个设置项均以行卡片形式可见、无需滚动，且托盘摘要规则、菜单栏服务、语言、开机自启等共享控件修改后自动保存；若保存失败，控件值会回滚到最近一次成功状态。

### 用户故事 1 的测试

- [X] T007 [P] [US1] 在 /Users/chasewang/01workspace/projects/ai-usage/src/app/settings/SettingsView.test.tsx 中增加“7 个设置项一屏可见、单卡片分隔、无分区标题”的渲染回归测试
- [X] T008 [P] [US1] 在 /Users/chasewang/01workspace/projects/ai-usage/src/app/settings/SettingsView.test.tsx 中增加托盘摘要规则、菜单栏服务、语言和开机自启的即时保存与失败回滚交互测试

### 用户故事 1 的实现

- [X] T009 [P] [US1] 在 /Users/chasewang/01workspace/projects/ai-usage/src/app/settings/SettingsView.tsx 中移除对 `PreferenceSection` 的依赖，改为统一设置卡片与行分隔布局，并确保 7 个设置项全部出现在单卡片中
- [X] T010 [P] [US1] 在 /Users/chasewang/01workspace/projects/ai-usage/src/app/settings/SettingsView.tsx 中将托盘摘要规则、菜单栏服务、语言和开机自启改造成右对齐行内控件，并接入共享即时保存与失败回滚逻辑
- [X] T011 [US1] 在 /Users/chasewang/01workspace/projects/ai-usage/src/app/settings/SettingsView.tsx 和 /Users/chasewang/01workspace/projects/ai-usage/src/styles/globals.css 中调整设置页容器高度、行间距和滚动策略，保证默认窗口高度下一屏可见

**检查点**：用户故事 1 完成后，设置页应能独立作为“紧凑可操作设置列表”交付。

---

## 阶段 4：用户故事 2 - 视觉风格与主面板一致（优先级：P1）

**目标**：让设置页在卡片圆角、边框、背景、阴影和字体层级上与主面板使用同一套视觉语言。

**独立测试**：在面板与设置页之间反复切换，确认卡片样式、标签文字和整体层级一致，不再出现 section heading 与大容器嵌套。

### 用户故事 2 的测试

- [X] T012 [P] [US2] 在 /Users/chasewang/01workspace/projects/ai-usage/src/app/settings/SettingsView.test.tsx 中增加“设置页不再渲染旧 section heading 和双层容器 class”的样式结构测试
- [X] T013 [P] [US2] 在 /Users/chasewang/01workspace/projects/ai-usage/tests/e2e/screenshot-review.mjs 中增加面板与设置页视觉一致性的截图回归场景

### 用户故事 2 的实现

- [X] T014 [P] [US2] 在 /Users/chasewang/01workspace/projects/ai-usage/src/components/settings/PreferenceSection.tsx 中将旧 section 组件降级为轻量兼容壳并清理残留 heading/容器样式，避免与 `SettingsView.tsx` 的新布局职责重叠
- [X] T015 [P] [US2] 在 /Users/chasewang/01workspace/projects/ai-usage/src/app/settings/SettingsView.tsx 和 /Users/chasewang/01workspace/projects/ai-usage/src/styles/globals.css 中对齐主面板卡片的圆角、边框、背景、阴影和字体 token
- [X] T016 [US2] 在 /Users/chasewang/01workspace/projects/ai-usage/src/app/shell/AppShell.tsx 中微调设置页内容容器与 header 节奏，消除设置页与主面板之间的视觉跳跃

**检查点**：用户故事 2 完成后，应能独立验证设置页与主面板属于同一视觉系统。

---

## 阶段 5：用户故事 3 - 面板顺序紧凑排序（优先级：P2）

**目标**：把现有纵向拖拽块收敛为单行胶囊排序，并保持即时持久化和失败回退。

**独立测试**：在设置页面拖拽胶囊交换服务顺序，返回面板后顺序立即变化；只有一个服务时胶囊可见但不可拖拽。

### 用户故事 3 的测试

- [X] T017 [P] [US3] 在 /Users/chasewang/01workspace/projects/ai-usage/src/app/settings/SettingsView.test.tsx 中增加单行胶囊渲染、单服务禁用态和排序持久化失败回退测试
- [X] T018 [P] [US3] 在 /Users/chasewang/01workspace/projects/ai-usage/tests/e2e/tray-panel.spec.mjs 中增加胶囊拖拽后面板顺序同步变化的壳层回归测试
- [X] T019 [P] [US3] 在 /Users/chasewang/01workspace/projects/ai-usage/src/app/settings/SettingsView.test.tsx 中增加 serviceOrder 胶囊在标签溢出时保持换行布局且不破坏拖拽命中区的样式回归测试

### 用户故事 3 的实现

- [X] T020 [P] [US3] 在 /Users/chasewang/01workspace/projects/ai-usage/src/app/settings/SettingsView.tsx 中将 `serviceOrder` UI 从纵向块重构为单行胶囊标签布局
- [X] T021 [P] [US3] 在 /Users/chasewang/01workspace/projects/ai-usage/src/app/settings/SettingsView.tsx 中保留 Pointer 驱动的排序逻辑，并适配单行命中区、预览和 drop 持久化
- [X] T022 [P] [US3] 在 /Users/chasewang/01workspace/projects/ai-usage/src/app/settings/SettingsView.tsx 和 /Users/chasewang/01workspace/projects/ai-usage/src/styles/globals.css 中补齐 serviceOrder 胶囊标签在溢出场景下的换行策略，保证多服务时仍可读且可拖拽
- [X] T023 [US3] 在 /Users/chasewang/01workspace/projects/ai-usage/src/app/panel/PanelView.tsx 和 /Users/chasewang/01workspace/projects/ai-usage/src/app/settings/SettingsView.tsx 中校正服务顺序回显，确保设置页与面板读取同一持久化结果

**检查点**：用户故事 3 完成后，应可独立作为“紧凑排序交互”交付。

---

## 阶段 6：用户故事 4 - 刷新间隔改为预设选项（优先级：P2）

**目标**：用固定 select 替换数字输入，让刷新间隔与其它设置控件保持一致。

**独立测试**：打开刷新间隔控件，确认只有 5/10/15/30 分钟预设，选择任一选项后立即保存生效。

### 用户故事 4 的测试

- [X] T024 [P] [US4] 在 /Users/chasewang/01workspace/projects/ai-usage/src/app/settings/SettingsView.test.tsx 中增加刷新间隔预设选项与即时保存行为测试
- [X] T025 [P] [US4] 在 /Users/chasewang/01workspace/projects/ai-usage/tests/integration/preferences-persistence.test.ts 中增加 `refreshIntervalMinutes` 仍以数值持久化的回归测试

### 用户故事 4 的实现

- [X] T026 [P] [US4] 在 /Users/chasewang/01workspace/projects/ai-usage/src/app/settings/SettingsView.tsx 中将刷新间隔从 number input 改为预设 select
- [X] T027 [US4] 在 /Users/chasewang/01workspace/projects/ai-usage/src/app/settings/SettingsView.tsx 和 /Users/chasewang/01workspace/projects/ai-usage/src/app/shared/i18n.ts 中统一刷新间隔选项展示文案、即时保存接线与旧值兼容处理

**检查点**：用户故事 4 完成后，应可独立验证刷新间隔不再需要手工输入。

---

## 阶段 7：用户故事 5 - 网络代理自动保存（优先级：P2）

**目标**：移除“应用”按钮，让代理模式选择与手动 URL 输入都融入自动保存节奏，同时保留真实校验和 Claude Code 联动。

**独立测试**：切换代理模式并输入手动代理地址，确认没有“应用”按钮；选择 system/off 立即保存，manual 模式展开输入框，有效地址失焦后自动保存，无效地址显示行内错误。

### 用户故事 5 的测试

- [X] T028 [P] [US5] 在 /Users/chasewang/01workspace/projects/ai-usage/src/app/settings/SettingsView.test.tsx 中增加 system/off 即时保存回滚、manual 展开输入和无效 URL 行内错误测试
- [X] T029 [P] [US5] 在 /Users/chasewang/01workspace/projects/ai-usage/tests/integration/preferences-persistence.test.ts 和 /Users/chasewang/01workspace/projects/ai-usage/src-tauri/src/commands/mod.rs 中增加代理变更后保存链路与 Claude Code 刷新回归测试

### 用户故事 5 的实现

- [X] T030 [P] [US5] 在 /Users/chasewang/01workspace/projects/ai-usage/src/app/settings/SettingsView.tsx 中移除代理“应用”按钮，并把 `system` / `off` 模式切换改为立即保存且在失败时回滚到最近一次成功状态
- [X] T031 [P] [US5] 在 /Users/chasewang/01workspace/projects/ai-usage/src/app/settings/SettingsView.tsx 中实现 `manual` 模式下的展开输入、blur 校验与自动保存，并在保存失败时恢复已持久化值
- [X] T032 [US5] 在 /Users/chasewang/01workspace/projects/ai-usage/src/app/shell/AppShell.tsx 和 /Users/chasewang/01workspace/projects/ai-usage/src/app/settings/SettingsView.tsx 中串联代理保存成功/失败反馈，确保既有 Claude Code 刷新联动保持生效

**检查点**：用户故事 5 完成后，应可独立作为“代理也遵循自动保存”的交付切片。

---

## 阶段 8：用户故事 6 - 移除状态区（优先级：P3）

**目标**：从正式设置页中删除 data source、active session 等调试信息，让页面只保留用户真正会操作的设置。

**独立测试**：浏览完整设置页，确认不存在“状态”区块及其服务状态明细，同时其它设置功能不受影响。

### 用户故事 6 的测试

- [X] T033 [P] [US6] 在 /Users/chasewang/01workspace/projects/ai-usage/src/app/settings/SettingsView.test.tsx 中增加“状态区不再渲染、调试信息已移除”的回归测试
- [X] T034 [P] [US6] 在 /Users/chasewang/01workspace/projects/ai-usage/tests/e2e/screenshot-review.mjs 中增加移除状态区后的设置页整页截图检查

### 用户故事 6 的实现

- [X] T035 [P] [US6] 在 /Users/chasewang/01workspace/projects/ai-usage/src/app/settings/SettingsView.tsx 中删除 `serviceStatuses` 渲染及相关状态区块
- [X] T036 [US6] 在 /Users/chasewang/01workspace/projects/ai-usage/src/app/settings/SettingsView.tsx 和 /Users/chasewang/01workspace/projects/ai-usage/src/app/shared/i18n.ts 中清理状态区专用文案与残留 UI 依赖

**检查点**：用户故事 6 完成后，应可独立验证设置页不再承担调试信息展示职责。

---

## 阶段 9：收尾与跨切片事项

**目的**：完成全局回归、文档对齐和最终验收。

- [X] T037 [P] 更新 /Users/chasewang/01workspace/projects/ai-usage/specs/011-settings-redesign/quickstart.md 中的最终验证步骤，使其与实现结果一致
- [X] T038 在 /Users/chasewang/01workspace/projects/ai-usage 中运行 `npm test`，完成本特性的前端与集成回归测试
- [X] T039 在 /Users/chasewang/01workspace/projects/ai-usage/src-tauri 中运行 `cargo test`，作为宿主回归门禁验证代理/命令链路未被破坏
- [X] T040 在 /Users/chasewang/01workspace/projects/ai-usage 中运行 `npm run test:e2e:tauri` 与 `npm run test:e2e:screenshots`，完成设置页壳层与截图验证

---

## 依赖与执行顺序

### 阶段依赖

- **阶段 1：准备阶段**：无依赖，可立即开始
- **阶段 2：基础阶段**：依赖阶段 1，且会阻塞全部用户故事
- **阶段 3-8：用户故事阶段**：均依赖阶段 2 完成
- **阶段 9：收尾阶段**：依赖所有目标用户故事完成

### 用户故事依赖

- **US1（P1）**：基础阶段完成后即可开始；是本次 MVP
- **US2（P1）**：基础阶段完成后即可开始；建议紧随 US1，以尽快完成“结构 + 视觉”双核心目标
- **US3（P2）**：基础阶段完成后即可开始；最佳顺序是在 US1 完成后进行，以补齐 `serviceOrder` 的自动持久化与溢出换行策略
- **US4（P2）**：基础阶段完成后即可开始；用于补齐 `refreshIntervalMinutes` 的最终控件形态与自动保存闭环
- **US5（P2）**：基础阶段完成后即可开始；用于补齐代理设置的自动保存与失败回滚闭环
- **US6（P3）**：基础阶段完成后即可开始；建议放在其余设置能力稳定后收尾删除

### 故事内顺序

- 测试任务先写并先失败
- 共享/渲染骨架优先于样式微调
- UI 实现完成后再串联保存/联动链路
- 每个故事完成后都应先按独立测试标准自检，再进入下一故事

### 并行机会

- 阶段 2 中的 i18n、字段骨架与 shell 保存状态整理可并行
- US1 和 US2 的测试任务可并行
- US3、US4、US5 在基础阶段完成后可由不同成员并行推进
- 收尾阶段的文档更新与测试执行前准备可并行

---

## 并行示例：用户故事 1

```bash
# 并行编写 US1 测试
Task: "在 /Users/chasewang/01workspace/projects/ai-usage/src/app/settings/SettingsView.test.tsx 中增加 7 个设置项一屏可见、单卡片分隔、无分区标题的渲染回归测试"
Task: "在 /Users/chasewang/01workspace/projects/ai-usage/src/app/settings/SettingsView.test.tsx 中增加托盘摘要规则、菜单栏服务、语言和开机自启的即时保存交互测试"

# 并行实现 US1 的结构与交互
Task: "在 /Users/chasewang/01workspace/projects/ai-usage/src/app/settings/SettingsView.tsx 中移除 PreferenceSection 分区结构，改为统一设置卡片与行分隔布局"
Task: "在 /Users/chasewang/01workspace/projects/ai-usage/src/app/settings/SettingsView.tsx 中将托盘摘要规则、菜单栏服务、语言和开机自启改造成右对齐行内控件并接入即时保存"
```

---

## 并行示例：用户故事 5

```bash
# 并行编写 US5 测试
Task: "在 /Users/chasewang/01workspace/projects/ai-usage/src/app/settings/SettingsView.test.tsx 中增加 system/off 即时保存、manual 展开输入和无效 URL 行内错误测试"
Task: "在 /Users/chasewang/01workspace/projects/ai-usage/tests/integration/preferences-persistence.test.ts 和 /Users/chasewang/01workspace/projects/ai-usage/src-tauri/src/commands/mod.rs 中增加代理变更后保存链路与 Claude Code 刷新回归测试"

# 并行实现 US5 的前端改造
Task: "在 /Users/chasewang/01workspace/projects/ai-usage/src/app/settings/SettingsView.tsx 中移除代理应用按钮，并把 system/off 模式切换改为立即保存"
Task: "在 /Users/chasewang/01workspace/projects/ai-usage/src/app/settings/SettingsView.tsx 中实现 manual 模式下的展开输入、blur 校验与自动保存"
```

---

## 实施策略

### MVP 优先（仅交付 US1）

1. 完成阶段 1：准备阶段
2. 完成阶段 2：基础阶段
3. 完成阶段 3：US1
4. 停下并验证“设置页一屏可见 + 大多数设置即时保存”
5. 注意：`FR-009` 仍需完成 `US3 + US4 + US5` 后才算全部闭环

### 增量交付

1. 先完成 US1，解决最核心的信息密度问题
2. 再完成 US2，解决视觉跳跃问题
3. 接着并行推进 US3、US4、US5
4. 最后完成 US6 和全量回归

### 多人并行策略

1. 一人处理阶段 2 的字段骨架与 shell 保存反馈
2. 一人推进 US1/US2 的布局与样式
3. 一人推进 US3/US5 的交互与持久化
4. 全部用户故事完成后一起收口测试和截图验收

---

## 说明

- `[P]` 任务表示不同文件、可并行推进
- 每个用户故事都保持独立测试标准，便于分阶段验收
- 本次任务拆解显式以 [011-settings-redesign-proposal.md](/Users/chasewang/01workspace/projects/ai-usage/doc/engineering/011-settings-redesign-proposal.md) 的出发点为准，即优先解决“一屏可见、行内控件、视觉统一、去调试信息”
- 即时保存类任务统一要求：保存失败时回滚到最近一次成功持久化的值；手动代理 URL 校验失败则保留本地草稿并显示行内错误
