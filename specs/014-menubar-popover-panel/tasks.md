# 任务清单：菜单栏吸附式弹出面板

**输入**：来自 `/Users/chasewang/01workspace/projects/ai-usage/specs/014-menubar-popover-panel/` 的设计文档  
**前置文档**：plan.md（必需）、spec.md（必需，用于用户故事）、research.md、data-model.md、contracts/、quickstart.md

**测试**：本特性必须包含测试，因为规格、计划和 quickstart 都明确要求 Rust 定位单测、React/RTL 回归、真实 Tauri/E2E 与截图验证；不能只靠前端静态检查判定完成。

**组织方式**：任务按用户故事分组，确保每个故事都可以独立实现、独立验证，并尽量减少跨故事文件冲突。

## 格式：`[ID] [P?] [Story] 描述`

- **[P]**：可并行执行（不同文件、无未完成前置依赖）
- **[Story]**：任务所属用户故事（如 `US1`、`US2`、`US3`、`US4`）
- 每条任务都包含明确文件路径

## 阶段 1：准备阶段（共享脚手架）

**目的**：确认本特性复用的测试入口、窗口壳层入口与宿主 tray 生命周期入口。

- [X] T002 [P] 在 `/Users/chasewang/01workspace/projects/ai-usage/tests/e2e/tray-panel.spec.mjs`、`/Users/chasewang/01workspace/projects/ai-usage/tests/e2e/screenshot-review.mjs` 和 `/Users/chasewang/01workspace/projects/ai-usage/tests/e2e/tauri-driver.mjs` 中确认可复用的真实窗口验证入口
- [X] T003 [P] 在 `/Users/chasewang/01workspace/projects/ai-usage/src/app/shell/AppShell.tsx`、`/Users/chasewang/01workspace/projects/ai-usage/src/app/shell/AppShell.test.tsx`、`/Users/chasewang/01workspace/projects/ai-usage/src-tauri/src/tray/mod.rs` 与 `/Users/chasewang/01workspace/projects/ai-usage/src-tauri/src/lib.rs` 中确认壳层与宿主生命周期入口

---

## 阶段 2：基础阶段（阻塞性前置条件）

**目的**：建立所有用户故事共享依赖的定位决策、异常回退、测试可观测性与基础壳层约束。

**⚠️ 关键说明**：本阶段完成前，不应开始任何用户故事实现。

- [X] T004 [P] 在 `/Users/chasewang/01workspace/projects/ai-usage/src-tauri/src/tray/mod.rs` 中补充 tray 锚点、中心对齐、边缘收敛和异常回退的失败测试
- [X] T005 [P] 在 `/Users/chasewang/01workspace/projects/ai-usage/src/app/shell/AppShell.test.tsx` 与 `/Users/chasewang/01workspace/projects/ai-usage/src/app/panel/PanelView.test.tsx` 中补充单一面板壳层、重新打开回到 panel、`Esc` 关闭、瞬态状态清理，以及空态/加载态/断开态/陈旧态/失败态不被壳层改造掩盖的失败测试
- [X] T006 [P] 在 `/Users/chasewang/01workspace/projects/ai-usage/tests/e2e/tauri-driver.mjs` 与 `/Users/chasewang/01workspace/projects/ai-usage/tests/e2e/tray-panel.spec.mjs` 中补充窗口位置/窗口会话的测试可观测性入口
- [X] T007 在 `/Users/chasewang/01workspace/projects/ai-usage/src-tauri/src/state/mod.rs` 与 `/Users/chasewang/01workspace/projects/ai-usage/src-tauri/src/tray/mod.rs` 中建立上一次成功弹出位置的宿主内存态与定位决策共享结构
- [X] T008 在 `/Users/chasewang/01workspace/projects/ai-usage/src-tauri/tauri.conf.json` 与 `/Users/chasewang/01workspace/projects/ai-usage/src-tauri/capabilities/default.json` 中收敛主窗口基础 footprint 与权限约束，为菜单栏面板形态做好准备，并确保变更限定于 macOS 目标行为而不破坏其他平台现有窗口契约

**检查点**：宿主定位共享结构、壳层基础测试和 E2E 可观测入口已就绪，后续用户故事可以开始实现。

---

## 阶段 3：用户故事 1 - 从菜单栏图标准确弹出面板（优先级：P1）🎯 MVP

**目标**：点击菜单栏图标后，主面板从当前图标下方弹出，优先按图标水平中心线对齐，并在当前点击所在显示器中正确显示。

**独立测试**：在真实应用中点击菜单栏图标，确认主面板从图标下方弹出；再次点击图标可关闭；在同一显示器内不会出现在任意旧位置。

### 用户故事 1 的测试

- [X] T009 [P] [US1] 在 `/Users/chasewang/01workspace/projects/ai-usage/tests/e2e/tray-panel.spec.mjs` 中增加 tray 点击打开/关闭、图标下方弹出和当前显示器归属的壳层回归测试
- [X] T010 [P] [US1] 在 `/Users/chasewang/01workspace/projects/ai-usage/src-tauri/src/tray/mod.rs` 中增加“图标中心线优先对齐”的宿主单测与回归断言

### 用户故事 1 的实现

- [X] T011 [US1] 在 `/Users/chasewang/01workspace/projects/ai-usage/src-tauri/src/tray/mod.rs` 中将 `toggle_main_window` 重构为“读取 tray 几何信息 -> 计算目标位置 -> 应用位置 -> 显示窗口”的吸附式弹出流程
- [X] T012 [US1] 在 `/Users/chasewang/01workspace/projects/ai-usage/src-tauri/src/lib.rs` 中协调 close/blur hide 与新定位流程，保证窗口生命周期仍由宿主统一处理且不退出进程
- [X] T013 [US1] 在 `/Users/chasewang/01workspace/projects/ai-usage/tests/e2e/tauri-driver.mjs` 与 `/Users/chasewang/01workspace/projects/ai-usage/tests/e2e/tray-panel.spec.mjs` 中接入定位结果验证所需的最小测试观测信息

**检查点**：用户故事 1 完成后，主面板应能独立作为“真正从菜单栏图标下方弹出的吸附式面板”交付。

---

## 阶段 4：用户故事 2 - 视觉上不再像传统窗口（优先级：P1）

**目标**：去掉传统标题栏/交通灯按钮和外层灰色衬底，只保留一个白色面板本体，让主界面看起来是菜单栏弹出面板而不是普通窗口。

**独立测试**：打开主面板，确认不再出现系统标题栏、交通灯按钮或白色卡片外侧的灰色/渐变衬底；截图中只能识别到一个白色面板本体。

### 用户故事 2 的测试

- [X] T014 [P] [US2] 在 `/Users/chasewang/01workspace/projects/ai-usage/src/app/shell/AppShell.test.tsx` 中增加“单一面板壳层、无外层背景容器、无传统窗口感，且不遮蔽真实状态容器”的结构回归测试
- [X] T015 [P] [US2] 在 `/Users/chasewang/01workspace/projects/ai-usage/tests/e2e/screenshot-review.mjs` 中增加“只保留白色面板本体、无灰色外衬底”的截图回归场景

### 用户故事 2 的实现

- [X] T016 [US2] 在 `/Users/chasewang/01workspace/projects/ai-usage/src-tauri/tauri.conf.json` 中将主窗口收敛为无传统装饰的菜单栏面板 footprint
- [X] T017 [US2] 在 `/Users/chasewang/01workspace/projects/ai-usage/src/app/shell/AppShell.tsx` 与 `/Users/chasewang/01workspace/projects/ai-usage/src/styles/globals.css` 中移除外层灰色/渐变衬底和双层窗口容器感，收敛为单一白色面板壳层
- [ ] T018 [US2] 在 `/Users/chasewang/01workspace/projects/ai-usage/src/app/panel/PanelView.tsx` 与 `/Users/chasewang/01workspace/projects/ai-usage/src/app/settings/SettingsView.tsx` 中对齐 panel/settings 的容器背景、留白和滚动表现，使其都服从新的单一面板表面

**检查点**：用户故事 2 完成后，主面板应能独立作为“视觉上只有单一白色面板本体”的结果交付。

---

## 阶段 5：用户故事 3 - 保持菜单栏程序的即时收放体验（优先级：P2）

**目标**：保持点击外部、切换应用、`Esc` 关闭等即时收放体验，并确保重新打开主面板时默认回到 panel 视图。

**独立测试**：打开主面板后进入设置页，关闭再重新打开，确认默认回到 panel；点击外部、切换应用或按 `Esc` 都能隐藏主面板，再次点击托盘图标可立即恢复使用。

### 用户故事 3 的测试

- [X] T019 [P] [US3] 在 `/Users/chasewang/01workspace/projects/ai-usage/src/app/shell/AppShell.test.tsx` 与 `/Users/chasewang/01workspace/projects/ai-usage/src/app/panel/PanelView.test.tsx` 中增加“重新打开回到 panel、清理 overlay/scroll 瞬态状态、Esc 关闭、额度摘要与刷新入口在重开后可立即访问、真实状态文案保持准确”的壳层测试
- [X] T020 [P] [US3] 在 `/Users/chasewang/01workspace/projects/ai-usage/tests/e2e/tray-panel.spec.mjs` 中增加“点击外部关闭、切换应用关闭、从 settings 关闭再打开回到 panel、Esc 关闭后重新打开，以及重开后 1 秒内可直接使用刷新/设置”的真实壳层回归测试

### 用户故事 3 的实现

- [X] T021 [US3] 在 `/Users/chasewang/01workspace/projects/ai-usage/src/app/shell/AppShell.tsx` 中实现主面板重新显示时的 `currentView` 重置逻辑，并默认回到 panel 视图
- [X] T022 [US3] 在 `/Users/chasewang/01workspace/projects/ai-usage/src/app/shell/AppShell.tsx` 与 `/Users/chasewang/01workspace/projects/ai-usage/src/app/panel/PanelView.tsx` 中清理隐藏/重新打开时遗留的 overlay、scroll 和次级界面瞬态状态
- [X] T023 [US3] 在 `/Users/chasewang/01workspace/projects/ai-usage/src/app/shell/AppShell.tsx` 中将 `Esc` 关闭整个主面板的键盘路径落地，并确保与现有 blur/hide 语义一致

**检查点**：用户故事 3 完成后，主面板应能独立作为“像菜单栏工具一样快速收放、重新打开回到主视图”的交付切片。

---

## 阶段 6：用户故事 4 - 在有限屏幕空间内仍然完整可用（优先级：P2）

**目标**：主面板在屏幕边缘、多显示器和内容较长的场景下仍保持在可视工作区内；内容较少时收紧，内容较多时内部滚动；tray 几何不可用时按明确顺序回退。

**独立测试**：在边缘位置和长内容场景打开主面板，确认不越界、不出现随机跳位；当内容超出上限时通过内部滚动访问剩余内容。

### 用户故事 4 的测试

- [X] T024 [P] [US4] 在 `/Users/chasewang/01workspace/projects/ai-usage/src-tauri/src/tray/mod.rs` 中增加工作区边缘收敛、回退到上一次成功位置，以及无缓存时回退到安全默认位的宿主单测
- [ ] T025 [P] [US4] 在 `/Users/chasewang/01workspace/projects/ai-usage/src/app/shell/AppShell.test.tsx` 与 `/Users/chasewang/01workspace/projects/ai-usage/tests/e2e/screenshot-review.mjs` 中增加“内容少时收紧、内容多时内部滚动、不越界”的回归测试与截图场景

### 用户故事 4 的实现

- [X] T026 [US4] 在 `/Users/chasewang/01workspace/projects/ai-usage/src-tauri/src/tray/mod.rs` 与 `/Users/chasewang/01workspace/projects/ai-usage/src-tauri/src/state/mod.rs` 中实现工作区边缘收敛和 `tray 锚点 -> 上一次成功位置 -> 安全默认位` 的回退顺序
- [X] T027 [US4] 在 `/Users/chasewang/01workspace/projects/ai-usage/src/app/shell/AppShell.tsx` 与 `/Users/chasewang/01workspace/projects/ai-usage/src/styles/globals.css` 中落地“内容自适应收紧 + 超出后内部滚动”的高度策略
- [ ] T028 [US4] 在 `/Users/chasewang/01workspace/projects/ai-usage/src/app/panel/PanelView.tsx` 与 `/Users/chasewang/01workspace/projects/ai-usage/src/app/settings/SettingsView.tsx` 中保证 panel/settings 在长内容场景下都能通过内部滚动继续访问

**检查点**：用户故事 4 完成后，主面板应能独立作为“在有限工作区中仍稳定可用”的交付切片。

---

## 阶段 7：收尾与跨切片事项

**目的**：完成文档对齐、全局回归与真实桌面验收。

- [X] T029 [P] 更新 `/Users/chasewang/01workspace/projects/ai-usage/specs/014-menubar-popover-panel/quickstart.md`，使其与最终实现和验证路径保持一致，并补入统一截图检查清单与人工评审口径
- [X] T030 在 `/Users/chasewang/01workspace/projects/ai-usage` 中运行 `npm test`，完成本特性的前端回归测试
- [X] T031 在 `/Users/chasewang/01workspace/projects/ai-usage/src-tauri` 中运行 `cargo test`，完成宿主定位与窗口生命周期回归测试，并确认非 macOS 条件分支未被新的面板策略破坏
- [X] T032 在 `/Users/chasewang/01workspace/projects/ai-usage` 中运行 `npm run test:e2e:tauri` 与 `npm run test:e2e:screenshots`，完成真实 Tauri 面板与截图验证，并按统一截图检查清单执行人工复核

---

## 依赖与执行顺序

### 阶段依赖

- **阶段 1：准备阶段**：无依赖，可立即开始
- **阶段 2：基础阶段**：依赖阶段 1，且会阻塞全部用户故事
- **阶段 3-6：用户故事阶段**：都依赖阶段 2 完成
- **阶段 7：收尾阶段**：依赖所有目标用户故事完成

### 用户故事依赖

- **US1（P1）**：基础阶段完成后即可开始；是本次 MVP
- **US2（P1）**：基础阶段完成后即可开始；建议紧随 US1，以尽快完成“定位正确 + 看起来像菜单栏面板”的双核心目标
- **US3（P2）**：基础阶段完成后即可开始；最佳顺序是在 US1 和 US2 之后，确保新壳层与重新打开生命周期一起闭环
- **US4（P2）**：基础阶段完成后即可开始；建议在 US1 完成后推进，因为工作区收敛与回退顺序会直接作用于已落地的定位逻辑

### 故事内顺序

- 失败测试先写并先失败
- 宿主定位/生命周期实现先于真实桌面验证
- 壳层结构收敛先于视觉微调
- 每个故事完成后都应先按独立测试标准自检，再进入下一个故事

### 并行机会

- 阶段 1 中的测试入口确认任务可并行
- 阶段 2 中的 Rust 失败测试、壳层失败测试与 E2E 可观测性整理可并行
- US1 中的 E2E 和 Rust 单测可并行编写
- US2 中的结构测试与截图回归可并行编写
- US3 中的壳层测试与 E2E 回归可并行编写
- US4 中的宿主单测与壳层/截图回归可并行编写

---

## 并行示例：用户故事 1

```bash
# 并行编写 US1 测试
Task: "在 /Users/chasewang/01workspace/projects/ai-usage/tests/e2e/tray-panel.spec.mjs 中增加 tray 点击打开/关闭、图标下方弹出和当前显示器归属的壳层回归测试"
Task: "在 /Users/chasewang/01workspace/projects/ai-usage/src-tauri/src/tray/mod.rs 中增加图标中心线优先对齐的宿主单测与回归断言"
```

---

## 并行示例：用户故事 4

```bash
# 并行编写 US4 的宿主与壳层验证
Task: "在 /Users/chasewang/01workspace/projects/ai-usage/src-tauri/src/tray/mod.rs 中增加工作区边缘收敛、回退到上一次成功位置和安全默认位的宿主单测"
Task: "在 /Users/chasewang/01workspace/projects/ai-usage/src/app/shell/AppShell.test.tsx 和 /Users/chasewang/01workspace/projects/ai-usage/tests/e2e/screenshot-review.mjs 中增加内容收紧、内部滚动和不越界的回归测试与截图场景"
```

---

## 实施策略

### MVP 优先（仅交付 US1）

1. 完成阶段 1：准备阶段
2. 完成阶段 2：基础阶段
3. 完成阶段 3：US1
4. **停下并验证**：确认主面板已能从菜单栏图标下方稳定弹出，并通过真实壳层验证

### 增量交付

1. 完成准备阶段 + 基础阶段，建立定位共享基础和测试入口
2. 交付 US1，先让主面板真正吸附式弹出
3. 交付 US2，消除传统窗口感并达成“只有白色面板本体”的视觉结果
4. 交付 US3，补齐重新打开回到 panel 与 `Esc` 关闭
5. 交付 US4，补齐边缘收敛、高度策略和回退顺序
6. 完成收尾回归和真实桌面截图验收

### 并行团队策略

多人协作时建议：

1. 一人负责宿主定位与 tray 生命周期（阶段 2、US1、US4）
2. 一人负责前端壳层与视觉收敛（US2、US3）
3. 一人负责真实 Tauri/E2E 与截图回归（阶段 2、各故事测试、阶段 7）

---

## Notes

- `[P]` 任务只在不存在共享文件冲突时并行推进
- 本特性明确要求真实桌面验证，因此在 `T032` 完成前不应宣告任务完成
- 本次建议 MVP 范围为 **User Story 1**
