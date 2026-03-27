# 任务清单：菜单栏自动服务跟随

**输入**：来自 `/Users/chasewang/01workspace/projects/ai-usage/specs/015-agent-auto-menubar/` 的设计文档  
**前置文档**：plan.md（必需）、spec.md（必需，用于用户故事）、research.md、data-model.md、contracts/、quickstart.md

**测试**：本特性必须包含测试，因为规格、计划和 quickstart 都明确要求前后端契约回归、Rust 单元测试、真实 Tauri/E2E 与截图验证；不能只靠静态实现或单侧单测判定完成。

**组织方式**：任务按用户故事分组，确保每个故事都可以独立实现、独立验证，并尽量减少跨故事文件冲突。

## 格式：`[ID] [P?] [Story] 描述`

- **[P]**：可并行执行（不同文件、无未完成前置依赖）
- **[Story]**：任务所属用户故事（如 `US1`、`US2`、`US3`）
- 每条任务都包含明确文件路径

## 阶段 1：准备阶段（共享脚手架）

**目的**：建立自动模式所需的宿主模块、测试入口和 tray 资产目录。

- [X] T001 在 `/Users/chasewang/01workspace/projects/ai-usage/src-tauri/Cargo.toml`、`/Users/chasewang/01workspace/projects/ai-usage/src-tauri/src/lib.rs` 与 `/Users/chasewang/01workspace/projects/ai-usage/src-tauri/src/agent_activity/mod.rs` 中创建宿主活动监测模块脚手架并接入 `rusqlite`
- [X] T002 [P] 在 `/Users/chasewang/01workspace/projects/ai-usage/src-tauri/icons/services/service-codex-tray.png`、`/Users/chasewang/01workspace/projects/ai-usage/src-tauri/icons/services/service-claude-code-tray.png` 与 `/Users/chasewang/01workspace/projects/ai-usage/src-tauri/icons/services/README.md` 中建立 tray 专用服务图标资产目录
- [X] T003 [P] 在 `/Users/chasewang/01workspace/projects/ai-usage/tests/e2e/tray-panel.spec.mjs` 与 `/Users/chasewang/01workspace/projects/ai-usage/tests/e2e/screenshot-review.mjs` 中确认可复用的真实 tray 验证入口与截图场景挂点

---

## 阶段 2：基础阶段（阻塞性前置条件）

**目的**：建立所有用户故事共享的偏好契约、运行时状态模型和基础回归护栏。

**⚠️ 关键说明**：本阶段完成前，不应开始任何用户故事实现。

- [X] T004 [P] 在 `/Users/chasewang/01workspace/projects/ai-usage/src-tauri/src/state/mod.rs` 与 `/Users/chasewang/01workspace/projects/ai-usage/tests/integration/preferences-persistence.test.ts` 中补充 `menubarService = auto` 的偏好兼容性与持久化回归测试
- [X] T005 [P] 在 `/Users/chasewang/01workspace/projects/ai-usage/src/lib/tauri/summary.test.ts` 与 `/Users/chasewang/01workspace/projects/ai-usage/src/app/settings/SettingsView.test.tsx` 中补充 `auto` 可见性、Claude 关闭场景与可见服务范围的前端失败测试
- [X] T006 [P] 在 `/Users/chasewang/01workspace/projects/ai-usage/src-tauri/src/agent_activity/mod.rs` 中补充活动快照、显示决策与无活动保留结果的宿主失败测试骨架
- [X] T007 在 `/Users/chasewang/01workspace/projects/ai-usage/src/lib/tauri/contracts.ts`、`/Users/chasewang/01workspace/projects/ai-usage/src/features/preferences/defaultPreferences.ts` 与 `/Users/chasewang/01workspace/projects/ai-usage/src-tauri/src/state/mod.rs` 中扩展 `menubarService` 契约与默认值，使 `auto` 成为合法模式
- [X] T008 在 `/Users/chasewang/01workspace/projects/ai-usage/src-tauri/src/state/mod.rs` 与 `/Users/chasewang/01workspace/projects/ai-usage/src-tauri/src/agent_activity/mod.rs` 中实现 `ServiceActivitySnapshot`、`AutoMenubarSelectionState` 与共享运行时状态结构

**检查点**：`auto` 模式的偏好契约、运行时状态结构和基础测试护栏已就绪，后续用户故事可以开始实现。

---

## 阶段 3：用户故事 1 - 自动跟随最近活跃服务（优先级：P1）🎯 MVP

**目标**：在用户选择 `自动` 后，菜单栏能根据 Codex 与 Claude Code 的本地活动痕迹自动切换当前显示对象，并在单服务活跃时稳定显示、双服务活跃时进入低频轮播。

**独立测试**：启用 `自动` 后，分别验证“只有一个服务在最近 5 分钟内活跃”和“两个服务都在最近 5 分钟内活跃”两类场景；无需进入设置页修改选项，菜单栏应在前一种场景下稳定显示单一服务，在后一种场景下以不短于 15 秒一次的节奏低频轮播显示两个服务。

### 用户故事 1 的测试

- [X] T009 [P] [US1] 在 `/Users/chasewang/01workspace/projects/ai-usage/src-tauri/src/agent_activity/mod.rs` 中增加 Codex/Claude 主辅信号读取、单服务选择和自动候选集合判定的宿主测试
- [X] T010 [P] [US1] 在 `/Users/chasewang/01workspace/projects/ai-usage/src/app/settings/SettingsView.test.tsx` 中增加“菜单栏服务”包含 `自动` 且能保存恢复的前端回归测试

### 用户故事 1 的实现

- [X] T011 [US1] 在 `/Users/chasewang/01workspace/projects/ai-usage/src-tauri/src/agent_activity/mod.rs` 中实现 Codex 的只读 SQLite + JSONL/mtime 被动活动信号读取链路
- [X] T012 [US1] 在 `/Users/chasewang/01workspace/projects/ai-usage/src-tauri/src/agent_activity/mod.rs` 中实现 Claude Code 的项目会话 JSONL + history 被动活动信号读取链路
- [X] T013 [US1] 在 `/Users/chasewang/01workspace/projects/ai-usage/src-tauri/src/agent_activity/mod.rs` 中实现单服务优先、最近 5 分钟活动窗口判定和不短于 15 秒一次的双服务低频轮播逻辑
- [X] T014 [US1] 在 `/Users/chasewang/01workspace/projects/ai-usage/src-tauri/src/commands/mod.rs` 中将自动模式的当前显示对象接入 tray 数据选择路径，并确保 `save_preferences` 保存 `auto` 后立即生效
- [X] T015 [US1] 在 `/Users/chasewang/01workspace/projects/ai-usage/src/app/settings/SettingsView.tsx` 与 `/Users/chasewang/01workspace/projects/ai-usage/src/app/shared/i18n.ts` 中落地设置页 `自动` 选项和对应文案

**检查点**：用户故事 1 完成后，菜单栏应能独立作为“根据最近活跃服务自动切换”的 MVP 交付。

---

## 阶段 4：用户故事 2 - 通过图标一眼识别当前菜单栏显示对象（优先级：P1）

**目标**：当菜单栏显示某个服务的余量时，图标同步切换成该服务图标；无显示对象时回退中性图标，同时保留既有严重度着色能力。

**独立测试**：分别让菜单栏进入显示 Codex 余量和显示 Claude Code 余量两种状态，直接观察菜单栏图标与数字组合，用户应能立刻识别当前归属服务。

### 用户故事 2 的测试

- [X] T016 [P] [US2] 在 `/Users/chasewang/01workspace/projects/ai-usage/src-tauri/src/tray/mod.rs` 中增加服务图标选择、严重度着色和中性态回退的宿主回归测试
- [X] T017 [P] [US2] 在 `/Users/chasewang/01workspace/projects/ai-usage/tests/e2e/tray-panel.spec.mjs` 与 `/Users/chasewang/01workspace/projects/ai-usage/tests/e2e/screenshot-review.mjs` 中增加真实 tray 图标与数字同步的验证场景

### 用户故事 2 的实现

- [X] T018 [P] [US2] 在 `/Users/chasewang/01workspace/projects/ai-usage/src-tauri/icons/services/service-codex-tray.png`、`/Users/chasewang/01workspace/projects/ai-usage/src-tauri/icons/services/service-claude-code-tray.png` 与 `/Users/chasewang/01workspace/projects/ai-usage/src-tauri/icons/services/README.md` 中补齐实际可用的 tray 服务图标资产
- [X] T019 [US2] 在 `/Users/chasewang/01workspace/projects/ai-usage/src-tauri/src/tray/mod.rs` 中实现按当前显示对象选择服务图标、在中性态回退应用图标，并保留严重度着色能力
- [X] T020 [US2] 在 `/Users/chasewang/01workspace/projects/ai-usage/src-tauri/src/tray/mod.rs` 与 `/Users/chasewang/01workspace/projects/ai-usage/src-tauri/src/commands/mod.rs` 中同步当前显示对象的图标、数字和 tooltip 服务名

**检查点**：用户故事 2 完成后，菜单栏应能独立作为“图标与数字同步表达同一服务”的交付切片。

---

## 阶段 5：用户故事 3 - 自动模式仍然保持可控和可预期（优先级：P2）

**目标**：自动模式在无数据、无新活动、Claude Code 关闭或用户切回手动模式时仍保持稳定，不误切、不抖动，并在应用重启后恢复上一次保存的模式。

**独立测试**：在自动模式下验证服务断开、长期无活动、单服务可用、手动切回固定服务等场景；菜单栏行为应稳定且符合用户预期。

### 用户故事 3 的测试

- [X] T021 [P] [US3] 在 `/Users/chasewang/01workspace/projects/ai-usage/src-tauri/src/agent_activity/mod.rs` 与 `/Users/chasewang/01workspace/projects/ai-usage/src-tauri/src/tray/mod.rs` 中增加双服务轮播退出、无活动保留上次结果、中性态和手动 override 的宿主测试
- [X] T022 [P] [US3] 在 `/Users/chasewang/01workspace/projects/ai-usage/src/app/settings/SettingsView.test.tsx` 与 `/Users/chasewang/01workspace/projects/ai-usage/src/lib/tauri/summary.test.ts` 中增加 Claude 关闭时的选项可见性和手动模式回退回归测试
- [X] T023 [P] [US3] 在 `/Users/chasewang/01workspace/projects/ai-usage/src/app/panel/PanelView.test.tsx` 与 `/Users/chasewang/01workspace/projects/ai-usage/tests/e2e/screenshot-review.mjs` 中增加自动模式不改变主面板卡片顺序、内容和刷新入口的非回归测试
- [X] T024 [P] [US3] 在 `/Users/chasewang/01workspace/projects/ai-usage/tests/integration/preferences-persistence.test.ts` 与 `/Users/chasewang/01workspace/projects/ai-usage/tests/e2e/tray-panel.spec.mjs` 中增加保存 `auto`、重启应用后恢复自动模式并继续生效的验证
- [X] T025 [P] [US3] 在 `/Users/chasewang/01workspace/projects/ai-usage/src-tauri/src/lib.rs` 与 `/Users/chasewang/01workspace/projects/ai-usage/src-tauri/src/commands/mod.rs` 中增加自动扫描/轮播循环不会触发额外远端额度刷新的宿主测试

### 用户故事 3 的实现

- [X] T026 [US3] 在 `/Users/chasewang/01workspace/projects/ai-usage/src-tauri/src/agent_activity/mod.rs` 中实现无新活动保留上次结果、尚未形成显示对象回退中性态，以及轮播退出条件
- [X] T027 [US3] 在 `/Users/chasewang/01workspace/projects/ai-usage/src-tauri/src/lib.rs` 中增加自动模式的宿主后台扫描/轮播循环，并确保应用启动后能恢复 `auto` 模式行为
- [X] T028 [US3] 在 `/Users/chasewang/01workspace/projects/ai-usage/src-tauri/src/commands/mod.rs`、`/Users/chasewang/01workspace/projects/ai-usage/src-tauri/src/state/mod.rs` 与 `/Users/chasewang/01workspace/projects/ai-usage/src/lib/tauri/summary.ts` 中落实手动模式优先、Claude 关闭排除和启动恢复逻辑

**检查点**：用户故事 3 完成后，自动模式应能独立作为“稳定、可预期、可手动回退”的交付切片。

---

## 阶段 6：收尾与跨切片事项

**目的**：完成真实桌面验证、文档对齐和全局回归。

- [X] T029 [P] 更新 `/Users/chasewang/01workspace/projects/ai-usage/specs/015-agent-auto-menubar/quickstart.md`，使其与最终实现、验证命令和人工检查口径保持一致
- [X] T030 在 `/Users/chasewang/01workspace/projects/ai-usage` 中运行 `npm test`，完成前端与契约相关回归，重点检查 `/Users/chasewang/01workspace/projects/ai-usage/src/app/settings/SettingsView.test.tsx`、`/Users/chasewang/01workspace/projects/ai-usage/src/lib/tauri/summary.test.ts`、`/Users/chasewang/01workspace/projects/ai-usage/src/app/panel/PanelView.test.tsx` 与受影响的其他测试
- [X] T031 在 `/Users/chasewang/01workspace/projects/ai-usage/src-tauri` 中运行 `cargo test`，完成 `/Users/chasewang/01workspace/projects/ai-usage/src-tauri/src/agent_activity/mod.rs`、`/Users/chasewang/01workspace/projects/ai-usage/src-tauri/src/state/mod.rs`、`/Users/chasewang/01workspace/projects/ai-usage/src-tauri/src/commands/mod.rs` 与 `/Users/chasewang/01workspace/projects/ai-usage/src-tauri/src/tray/mod.rs` 的宿主回归
- [ ] T032 在 `/Users/chasewang/01workspace/projects/ai-usage` 中运行 `npm run test:e2e:tauri` 与 `npm run test:e2e:screenshots`，完成 `/Users/chasewang/01workspace/projects/ai-usage/tests/e2e/tray-panel.spec.mjs` 和 `/Users/chasewang/01workspace/projects/ai-usage/tests/e2e/screenshot-review.mjs` 的真实桌面验证与截图复核，显式覆盖图标数字同步、面板非回归与重启恢复自动模式

---

## 依赖与执行顺序

### 阶段依赖

- **阶段 1：准备阶段**：无依赖，可立即开始
- **阶段 2：基础阶段**：依赖阶段 1，且会阻塞全部用户故事
- **阶段 3-5：用户故事阶段**：都依赖阶段 2 完成
- **阶段 6：收尾阶段**：依赖所有目标用户故事完成

### 用户故事依赖

- **US1（P1）**：基础阶段完成后即可开始；是本次 MVP
- **US2（P1）**：基础阶段完成后即可开始；建议紧随 US1，使“自动切换 + 图标同步”尽快形成完整用户价值
- **US3（P2）**：基础阶段完成后即可开始；最佳顺序是在 US1 和 US2 之后，用来收敛稳定性、无活动保留和手动回退行为

### 故事内顺序

- 测试任务先写并先失败
- 数据契约与运行时状态先于 tray 展示逻辑
- 宿主自动选择逻辑先于真实桌面验证
- 每个故事完成后都应先按独立测试标准自检，再进入下一个故事

### 并行机会

- 阶段 1 中的 tray 资产目录与 E2E 场景确认可并行
- 阶段 2 中的偏好测试、前端可见性测试和宿主失败测试可并行
- US1 中的宿主测试与设置页回归测试可并行
- US2 中的宿主图标测试与 E2E/截图场景可并行
- US3 中的宿主稳定性测试与前端回退测试可并行

---

## 并行示例：用户故事 1

```bash
# 并行编写 US1 的测试
Task: "在 /Users/chasewang/01workspace/projects/ai-usage/src-tauri/src/agent_activity/mod.rs 中增加 Codex/Claude 主辅信号读取、单服务选择和自动候选集合判定的宿主测试"
Task: "在 /Users/chasewang/01workspace/projects/ai-usage/src/app/settings/SettingsView.test.tsx 中增加菜单栏服务包含 自动 且能保存恢复的前端回归测试"
```

---

## 并行示例：用户故事 2

```bash
# 并行补齐 US2 的宿主回归与真实桌面验证
Task: "在 /Users/chasewang/01workspace/projects/ai-usage/src-tauri/src/tray/mod.rs 中增加服务图标选择、严重度着色和中性态回退的宿主回归测试"
Task: "在 /Users/chasewang/01workspace/projects/ai-usage/tests/e2e/tray-panel.spec.mjs 与 /Users/chasewang/01workspace/projects/ai-usage/tests/e2e/screenshot-review.mjs 中增加真实 tray 图标与数字同步的验证场景"
```

---

## 并行示例：用户故事 3

```bash
# 并行收敛 US3 的宿主与前端稳定性护栏
Task: "在 /Users/chasewang/01workspace/projects/ai-usage/src-tauri/src/agent_activity/mod.rs 与 /Users/chasewang/01workspace/projects/ai-usage/src-tauri/src/tray/mod.rs 中增加双服务轮播退出、无活动保留上次结果、中性态和手动 override 的宿主测试"
Task: "在 /Users/chasewang/01workspace/projects/ai-usage/src/app/settings/SettingsView.test.tsx 与 /Users/chasewang/01workspace/projects/ai-usage/src/lib/tauri/summary.test.ts 中增加 Claude 关闭时的选项可见性和手动模式回退回归测试"
```

---

## 实施策略

### MVP 优先（仅交付 US1）

1. 完成阶段 1：准备阶段
2. 完成阶段 2：基础阶段
3. 完成阶段 3：US1
4. **停下并验证**：确认 `自动` 选项可保存，并且菜单栏能根据本地活动痕迹自动切换当前显示对象

### 增量交付

1. 完成准备阶段 + 基础阶段，建立 `auto` 模式契约与宿主状态基础
2. 交付 US1，先让菜单栏真正能自动跟随最近活跃服务
3. 交付 US2，补齐图标与数字同步表达
4. 交付 US3，补齐稳定性、回退和启动恢复
5. 完成收尾回归和真实桌面验收

### 并行团队策略

多人协作时建议：

1. 一人负责宿主活动信号读取与自动选择状态机（阶段 2、US1、US3）
2. 一人负责 tray 图标与设置页选项（阶段 2、US1、US2）
3. 一人负责真实 Tauri/E2E 与截图回归（阶段 1、US2、阶段 6）

---

## Notes

- `[P]` 任务只在不存在共享文件冲突时并行推进
- 本特性明确要求真实桌面验证，因此在 `T032` 完成前不应宣告任务完成
- 本次建议 MVP 范围为 **User Story 1**
