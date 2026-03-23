# 实施计划：设置页面重设计

**分支**：`011-settings-redesign` | **日期**：2026-03-23 | **规格**：[spec.md](./spec.md)
**输入**：来自 `/specs/011-settings-redesign/spec.md` 的功能规格说明，且以 [011-settings-redesign-proposal.md](../../doc/engineering/011-settings-redesign-proposal.md) 作为本次需求的设计出发点

## 摘要

本次工作聚焦把设置页从“多分区表单”重构为“一张统一卡片中的紧凑行列表”，让 7 个设置项在默认窗口高度内一屏可见，并在视觉上与主面板卡片系统完全收敛。技术上优先复用现有 `UserPreferences`、`save_preferences` / `set_autostart` 命令、`AppShell` 头部保存状态与既有 i18n 文案体系，不新增存储层或宿主命令；主要变化集中在 React 设置页布局、控件形态、即时保存交互、行内错误反馈以及 UI 契约更新。

## 技术上下文

**语言/版本**：Rust stable（edition 2021）、TypeScript 5.x、Node.js 20 LTS  
**主要依赖**：Tauri 2、React 19、Tailwind CSS 4、Vitest、React Testing Library、Playwright  
**存储**：沿用现有 `save_preferences` / `preferencesStore` 本地偏好持久化，以及已有 snapshot cache；不新增存储层  
**测试**：`npm test`（Vitest + RTL）、定向 Playwright/Tauri E2E、必要时 `cargo test` 做偏好与命令回归  
**目标平台**：Tauri 桌面应用，主要验收环境为 macOS 菜单栏窗口（默认高度约 780px），同时保持当前 Windows 兼容契约  
**项目类型**：桌面应用（Tauri 2 宿主 + React 前端）  
**性能目标**：设置页首屏在默认窗口高度内无需滚动；设置项切换/选择后保存反馈应在当前 header 状态流中即时可见；拖拽排序应在双服务场景下保持流畅可预期  
**约束**：不得新增凭证路径或改变宿主可信边界；网络代理仍必须沿用现有 URL 校验与 Claude Code 刷新联动；设置页要移除“状态”区且不以别的调试面板替代；未来设置项增多时布局仍需优雅退化到可滚动  
**规模/范围**：单一设置视图重构，覆盖 7 个设置项、1 套 header 状态反馈、1 个服务排序交互，以及相关 i18n / UI contract / 测试更新

## 宪章检查

*门禁：必须在 Phase 0 研究前通过，并在 Phase 1 设计后重新检查。*

### I. 宿主边界安全 —— 通过

本特性不引入任何新的凭证、CLI 读取或操作系统能力路径。所有偏好持久化、开机自启切换、代理生效与 Claude Code 刷新联动仍留在 Tauri 宿主层；前端只调整设置表面的布局、交互节奏与错误展示。

**可信边界声明**：Rust 宿主继续作为偏好写入、代理决策、Claude Code 刷新与系统集成的唯一可信边界。React 继续只消费归一化的 `UserPreferences` 与 panel state。

**明确非目标**：新增设置专用存储、在前端直接解析代理/CLI 逻辑、向前端暴露更底层的代理决策细节。

### II. 契约优先的桌面表面 —— 通过

本计划先定义行为契约，再进入实现：
- [contracts/settings-redesign-ui-contract.md](./contracts/settings-redesign-ui-contract.md) 记录设置页布局、即时保存、代理输入和排序行为。
- [data-model.md](./data-model.md) 明确复用的持久化实体与新增派生 UI 模型。

本次不新增宿主 API，但会显式更新设置页 UI 契约，以覆盖 009/010 中已不再适用的“分组布局”“代理显式应用”“状态区展示”旧约束。

### III. 测试门禁集成 —— 通过

本特性虽以前端为主，但仍跨越设置视图、偏好保存与代理刷新链路，因此必须至少包含：
- RTL：验证统一行卡片布局、预设刷新间隔、代理自动保存/校验、状态区移除与排序表现
- Tauri/E2E 或截图检查：验证默认窗口高度下一屏可见、面板与设置页风格一致、胶囊排序在真实壳层可用
- 必要的现有 Rust/集成回归：确保未改变 `UserPreferences` / `PreferencePatch` 行为与代理生效路径

### IV. 真实用户状态 —— 通过

本次设计是朝“更真实、更少噪音”的方向收敛：
- 删除用户无须理解的“状态”调试区块
- 保留真正会影响用户结果的保存成功/失败反馈与代理校验错误
- 所有设置项改为即时保存，但失败时必须继续显示真实失败状态，不能假装已保存

### V. 本地优先、可增量交付 —— 通过

所有改动都基于现有本地偏好与本地快照体系完成，不依赖云端能力。工作可拆为若干独立切片逐步落地：先统一壳层与布局骨架，再迁移各设置项控件，最后补强测试与视觉细节。

## 项目结构

### 文档（本特性）

```text
specs/011-settings-redesign/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── settings-redesign-ui-contract.md
└── tasks.md
```

### 源码（仓库根目录）

```text
src/
├── app/
│   ├── settings/
│   │   ├── SettingsView.tsx
│   │   └── SettingsView.test.tsx
│   ├── shell/
│   │   └── AppShell.tsx
│   └── shared/
│       └── i18n.ts
├── components/
│   └── settings/
│       ├── PreferenceField.tsx
│       ├── PreferenceSection.tsx
│       └── ...
├── features/
│   └── preferences/
│       └── preferencesController.ts
├── lib/
│   └── tauri/
│       └── contracts.ts
└── styles/
    └── globals.css

src-tauri/
└── src/
    ├── commands/mod.rs
    └── state/mod.rs

tests/
├── contract/
├── integration/
└── e2e/
```

**结构决策**：继续沿用当前单体 Tauri 项目结构。该特性主要是 React 设置页重构，但仍与现有偏好命令、i18n、壳层 header 状态与代理刷新链路相连，因此会跨 `src/app`、`src/components`、`src/features`、`src/lib/tauri` 和少量 `src-tauri` 回归验证。

## 阶段 0：研究 —— 已完成

完整决策见 [research.md](./research.md)。关键结论如下：

| 决策项 | 选择 | 原因 |
|--------|------|------|
| 布局骨架 | 统一为单张设置卡片 + 行分隔，而非多个 section | 与提案一致，信息密度更高，也最容易保证一屏可见 |
| 视觉策略 | 复用主面板卡片 token，而不是单独设计设置页视觉体系 | 减少视觉跳跃，降低实现与维护成本 |
| 持久化路径 | 继续使用现有 `savePreferences` / `setAutostart` | 本次是交互与布局重构，不需要扩展存储或宿主契约 |
| 刷新间隔 | 改为预设 select，持久化字段仍保留 `number` | 只收紧 UI 输入范围，避免影响现有存储与自动刷新逻辑 |
| 代理交互 | 改为选择即保存；手动模式输入在 blur 时校验并保存 | 满足“一步完成”的目标，同时复用现有 URL 校验语义 |
| 排序交互 | 保留 Pointer 驱动思路，但收敛为单行胶囊重排 | 满足紧凑布局目标，避免回退到上下堆叠卡片 |
| 状态区处理 | 直接删除，不引入替代面板 | 与提案和规格一致，避免把调试信息重新带回正式设置页 |

## 阶段 1：设计与契约 —— 已完成

已产出以下设计工件：
- **[data-model.md](./data-model.md)**：复用的持久化实体、行级视图模型、代理草稿与排序状态
- **[contracts/settings-redesign-ui-contract.md](./contracts/settings-redesign-ui-contract.md)**：设置页布局与行为契约
- **[quickstart.md](./quickstart.md)**：本地验证与回归检查流程

## 阶段 2：实现策略

### 切片 1 —— 设置页骨架与视觉语言收敛

范围：
- 去掉 `PreferenceSection` 驱动的分区标题与大容器结构
- 将设置页改为单一统一卡片，内部使用行分隔
- 对齐主面板卡片的圆角、边框、背景、阴影与字体层级
- 保证在默认窗口高度内首屏完整显示全部 7 项设置

主要文件：
- `src/app/settings/SettingsView.tsx`
- `src/components/settings/PreferenceField.tsx`
- `src/components/settings/PreferenceSection.tsx`
- `src/app/shell/AppShell.tsx`
- `src/styles/globals.css`

测试：
- RTL：验证无 section heading / status section，且 7 项按单卡片结构渲染
- 截图/E2E：验证与主面板视觉一致、默认高度下一屏可见

### 切片 2 —— 行内控件与即时保存改造

范围：
- 所有设置项改为“左标签、右控件”行内布局
- 刷新间隔由 `number input` 改为预设 select（5/10/15/30）
- 开机自启切换保持右对齐并复用现有保存状态反馈
- 菜单栏服务、语言、托盘摘要等立即保存路径统一到相同交互节奏
- 即时保存失败时回滚到最近一次成功持久化的值

主要文件：
- `src/app/settings/SettingsView.tsx`
- `src/features/preferences/preferencesController.ts`
- `src/app/shared/i18n.ts`
- `src/app/shell/AppShell.tsx`

测试：
- RTL：验证每个 select/switch 的即时保存、失败回滚与 header 状态反馈
- 集成回归：验证 `refreshIntervalMinutes` 仍以数字持久化

### 切片 3 —— 网络代理自动保存与真实错误反馈

范围：
- 移除“应用”按钮
- 选择 `system` / `off` 时立即保存并触发既有 Claude Code 刷新链路
- 选择 `manual` 时展开行内输入框；失焦或提交时做现有 URL 校验并保存
- 校验错误以内联方式显示在该设置项上下文内，而不是恢复旧式块级按钮流程
- 代理保存失败时回滚到最近一次成功持久化的代理配置

主要文件：
- `src/app/settings/SettingsView.tsx`
- `src/app/shell/AppShell.tsx`
- `src/app/shared/i18n.ts`
- `src-tauri/src/commands/mod.rs`（仅在需要补回归时）

测试：
- RTL：验证代理模式切换、手动模式展开、无效 URL 错误、保存失败反馈
- Tauri/E2E：验证代理变更后 Claude Code 刷新仍被触发

### 切片 4 —— 面板顺序胶囊化与紧凑拖拽

范围：
- 将当前纵向排序块改为单行胶囊标签
- 维持 Pointer 驱动重排与即时持久化
- 单服务时保留展示但禁用拖拽
- 为窄宽度与未来服务增多预留换行策略，保证胶囊溢出时仍可读且可拖拽

主要文件：
- `src/app/settings/SettingsView.tsx`
- `src/app/panel/PanelView.tsx`
- `src/styles/globals.css`

测试：
- RTL：验证双服务重排、单服务禁用态、持久化失败回退以及胶囊溢出换行策略
- 壳层 E2E：验证真实拖拽后面板顺序同步更新

## 风险与缓解

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| 单卡片行布局在英文文案下横向空间不足 | 中 | 为标签和控件设置稳定最小/最大宽度，并用截图覆盖中英文 |
| 代理自动保存让“manual”输入过程过于敏感 | 高 | 仅在模式切换时保存模式，在 URL 输入 blur/明确提交时校验并保存 |
| 胶囊拖拽在一行中命中区域过小 | 中 | 保留明显拖拽 affordance，并在 E2E 中验证真实交互 |
| 删除状态区后丢失调试入口 | 低 | 明确将其视为非目标，不在正式设置页承担诊断职责 |
| 统一卡片后未来新增设置项导致首屏超高 | 中 | 设计上允许自然退化为滚动容器，不把“一屏可见”写死成不可扩展布局假设 |

## 设计后宪章复查

### I. 宿主边界安全 —— 通过

Phase 1 设计确认没有新增宿主边界；代理、持久化、开机自启仍完全由现有 Tauri 命令处理。

### II. 契约优先的桌面表面 —— 通过

新的设置页行为已经在 [contracts/settings-redesign-ui-contract.md](./contracts/settings-redesign-ui-contract.md) 中明确，并显式说明覆盖旧的分组与代理应用约束。

### III. 测试门禁集成 —— 通过

设计已把 RTL、壳层 E2E / 截图与必要回归测试列为实施切片的一部分，没有把 UI 重构视为“可只靠人工目测”的改动。

### IV. 真实用户状态 —— 通过

设计删去无价值调试信息，同时保留保存成功/失败、代理校验错误和拖拽持久化回退等真实状态表达，没有用视觉清爽去换取状态失真。

### V. 本地优先、可增量交付 —— 通过

方案完整建立在既有本地偏好与本地刷新链路之上，可按骨架、控件、代理、排序四个切片递进交付。

## 复杂度跟踪

当前无须记录宪章违规项。
