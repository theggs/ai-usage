# 实施计划：UI/UX 审查遗留项完成

**分支**：`010-ui-ux-completion` | **日期**：2026-03-23 | **规格**：[spec.md](./spec.md)
**输入**：来自 `/specs/010-ui-ux-completion/spec.md` 的功能规格说明

## 摘要

完成 post-009 UI/UX 审查中遗留的 19 个问题，重点修复面板与菜单栏状态不一致、统一面板与设置页的视觉结构，并补齐无障碍与首次引导体验。本次工作同时覆盖 React/Tailwind 前端层与 Tauri 宿主层：前端需要补强信息层级、Pointer 排序、服务文本识别和首次启动状态；Rust 宿主需要保证菜单栏刷新同步与 tooltip 增强。现有安全边界、快照读取路径与偏好持久化机制保持不变；唯一需要扩展的持久化字段，是存放在现有偏好文件中的可选“首次引导已关闭”标记。

> 变更说明（回退）：
> 迭代 10 中“tray 图标随 warning / danger 切换黄/红状态变体”的需求已放弃，判定为未通过且不纳入交付。本计划仅保留菜单栏标题与 tooltip 的刷新同步，tray 图标回退为默认应用图标。

## 技术上下文

**语言/版本**：Rust stable（edition 2021）、TypeScript 5.x、Node.js 20 LTS  
**主要依赖**：Tauri 2、React 19、Tailwind CSS 4、Vitest、React Testing Library、Playwright  
**存储**：沿用现有 `save_preferences` / `preferencesStore` 本地偏好持久化与快照缓存；不新增存储层  
**测试**：`npm test`（Vitest + RTL）、定向 Playwright/Tauri E2E、`cargo test`（tray/state 归一化）  
**目标平台**：macOS 菜单栏桌面应用（固定 360x620 面板），同时保持当前 Windows 兼容契约  
**项目类型**：桌面应用（Tauri 2 宿主 + React 前端）  
**性能目标**：面板与菜单栏应在 1 秒内保持可扫视性；菜单栏文字与 tooltip 需在同一轮成功刷新内完成同步；Pointer 排序应即时响应；动画与引导覆盖层不得在 360x620 面板中引入明显卡顿  
**约束**：不得新增凭证路径；菜单栏/面板/设置页必须对 fresh/stale/empty/failed/disconnected 状态保持真实表达；不得新增存储后端；tray 图标回退为默认应用图标，不再交付 warning / danger 黄红变体；布局需在 360x620 下避免英文文案被截断  
**规模/范围**：当前支持 2 个服务（Codex、Claude Code），设计需支持扩展至 4-5 个服务；涉及 1 个菜单栏表面、2 个主要视图和 1 个首次引导覆盖层

## 宪章检查

*门禁：必须在 Phase 0 研究前通过，并在 Phase 1 设计后重新检查。*

### I. 宿主边界安全 —— 通过

本特性不引入新的可信边界。快照读取、安全存储访问、CLI 解析、开机自启、通知与菜单栏原生行为仍全部保留在 Rust 宿主层。前端仅做展示、派生视图模型和通过现有命令进行偏好编辑。

**可信边界声明**：Tauri 宿主仍是实时快照解析、tray 标题/tooltip 应用、偏好文件写入的唯一所有者。React 继续消费归一化后的 `CodexPanelState`、`PanelPlaceholderItem` 和 `UserPreferences`，并仅派生告警标签、占位引导、Pointer 拖拽预览等 UI 状态。

**明确非目标**：新增远程埋点、把菜单栏原生逻辑迁到前端、向 React 暴露原始 CLI 负载、或为首次引导状态引入独立存储。

### II. 契约优先的桌面表面 —— 通过

本计划在实现前先定义了桌面表面的行为契约：
- [contracts/ui-surface-completion-contract.md](./contracts/ui-surface-completion-contract.md) 记录了菜单栏、面板、设置页与首次引导的行为契约。
- [data-model.md](./data-model.md) 记录了规范实体与派生实体，包括唯一新增的可选持久化引导关闭字段。
- 现有宿主/UI 契约继续作为规范数据边界；只有在纯视图逻辑无法表达新行为时，才允许极小范围扩展。

### III. 测试门禁集成 —— 通过

实现必须配套以下自动化验证：
- Vitest/RTL：覆盖进度标签渲染、告警强调条、占位引导、设置排序与首次引导显示规则
- `cargo test`：覆盖 tray 摘要、默认应用图标回退策略、偏好默认值及 tooltip 新格式
- 真实壳层 E2E：覆盖面板与菜单栏刷新一致性、macOS Pointer 排序、截图审查与首次引导跳转设置页

任一切片在相关 `npm test` 与 `cargo test` 通过前，以及必要的壳层检查通过前，都不应视为完成。

### IV. 真实用户状态 —— 通过

本特性明确强化了真实状态表达：
- 菜单栏文字与 tooltip 必须与面板最新刷新得到的规范数据保持一致；图标保持默认应用图标
- disconnected、未安装、已安装未登录、stale、failed 与首次启动状态都要有明确区分
- warning/danger 卡片需提供非颜色的辅助提示，避免仅靠色彩表达紧迫度
- 设置页状态区域必须扩展为所有已配置服务，而不是仅展示 Codex

### V. 本地优先、可增量交付 —— 通过

所有改动都建立在现有本地优先模型之上：
1. 修复菜单栏同步与面板卡片准确性
2. 统一面板/设置页视觉结构并清理设置层级
3. 完善服务引导、首次引导与无障碍
4. 完成菜单栏标题/tooltip 同步与英文摘要细节打磨

任一切片都不依赖新增远程基础设施，也不需要重构现有偏好/快照架构。

## 项目结构

### 文档（本特性）

```text
specs/010-ui-ux-completion/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── ui-surface-completion-contract.md
└── tasks.md
```

### 源码（仓库根目录）

```text
src/
├── app/
│   ├── panel/
│   │   ├── PanelView.tsx
│   │   └── PanelView.test.tsx
│   ├── settings/
│   │   ├── SettingsView.tsx
│   │   └── SettingsView.test.tsx
│   └── shared/
│       ├── appState.ts
│       └── i18n.ts
├── components/
│   ├── panel/
│   │   ├── QuotaSummary.tsx
│   │   ├── ServiceCard.tsx
│   │   └── ServiceCard.test.tsx
│   └── settings/
│       ├── PreferenceField.tsx
│       └── PreferenceSection.tsx
├── features/
│   └── preferences/
│       ├── defaultPreferences.ts
│       └── preferencesController.ts
├── lib/
│   ├── persistence/
│   │   └── preferencesStore.ts
│   └── tauri/
│       ├── contracts.ts
│       └── summary.ts
├── styles/
│   └── globals.css
└── assets/
    └── icons/               # 预期新增服务/tray 图标资源

src-tauri/
└── src/
    ├── commands/mod.rs
    ├── state/mod.rs
    ├── tray/mod.rs
    └── lib.rs

tests/
├── contract/
├── integration/
└── e2e/
```

**结构决策**：继续沿用当前单体 Tauri 项目结构。该特性仍属于现有宿主/前端边界上的局部扩展，但需要同时改动 React 视图/组件、共享 i18n/summary helper、Rust tray/state 模块以及 E2E 覆盖。

## 阶段 0：研究 —— 已完成

完整决策见 [research.md](./research.md)。关键结论如下：

| 决策项 | 选择 | 原因 |
|--------|------|------|
| 菜单栏同步路径 | 每次手动或自动刷新成功后重新应用 tray 标题与 tooltip，图标保持默认应用图标 | 在不引入第二条状态来源的前提下修复核心真实状态问题 |
| 告警卡片布局 | 将强调条改为绝对定位的卡片装饰，而非文档流元素 | 直接消除 56px 顶部空白，同时不改变卡片语义 |
| 服务识别方式 | 直接使用服务名文本，不额外交付图形品牌资源 | 避免重复视觉元素与对外发布时的品牌资产风险 |
| 排序实现 | 用 Pointer Events 替换 HTML5 DnD | 兼容 WKWebView，且适合短列表 |
| 首次引导记忆 | 在现有偏好文件中持久化可空的“已关闭引导”时间戳 | 满足“跳过后显示占位引导”，且不新增存储 |
| 状态区域扩展 | 根据所有可见服务状态构建设置页状态卡片，而不是 Codex-only | 恢复多服务场景下的真实状态表达 |
| 英文摘要策略 | 使用更短、更聚焦服务的健康摘要，而非依赖截断 | 避免固定宽度下标题被裁切 |

## 阶段 1：设计与契约 —— 已完成

已产出以下设计工件：
- **[data-model.md](./data-model.md)**：规范实体、派生实体、校验规则与状态迁移
- **[contracts/ui-surface-completion-contract.md](./contracts/ui-surface-completion-contract.md)**：菜单栏/面板/设置页/首次引导的稳定行为契约
- **[quickstart.md](./quickstart.md)**：本地验证与回归检查流程

## 阶段 2：实现策略

### 切片 1 —— 菜单栏与面板状态真实一致

范围：
- 去掉重复进度文案，并保证剩余标签在任意填充比例下可读
- 修复强调条布局，避免 warning/danger 卡片产生额外顶部空白
- 更新宿主刷新流程，使 panel 数据刷新成功后必定同步刷新 tray 标题与 tooltip
- 为 tray tooltip 增加服务名与当前选中服务上下文

主要文件：
- `src/components/panel/QuotaSummary.tsx`
- `src/components/panel/ServiceCard.tsx`
- `src/lib/tauri/summary.ts`
- `src-tauri/src/commands/mod.rs`
- `src-tauri/src/tray/mod.rs`

测试：
- RTL：验证单一标签渲染与 warning/danger 卡片布局
- Rust：验证 tooltip 格式、选中服务过滤与默认图标回退
- Tauri 壳层：验证 panel 刷新后 tray 同步

### 切片 2 —— 面板与设置页视觉收敛

范围：
- 对齐面板与设置页的 header 按钮风格
- 将设置页返回操作改为纯图标圆形按钮
- 在设置页 header 增加保存状态副文案
- 统一两个视图的卡片宽度与底部留白
- 去除伪毛玻璃，改为纯色表面风格

主要文件：
- `src/app/shell/AppShell.tsx`
- `src/app/panel/PanelView.tsx`
- `src/app/settings/SettingsView.tsx`
- `src/components/settings/PreferenceSection.tsx`
- `src/styles/globals.css`

测试：
- RTL/截图：验证 header 结构、宽度对齐和底部间距
- 截图审查：验证背景与表面风格一致性

### 切片 3 —— 设置页层级、真实状态与可靠排序

范围：
- 将高频设置项前置到首屏
- 从正式设置页中移除测试通知按钮
- 将设置状态区域扩展为所有支持服务，并显示来源/会话细节
- 用 Pointer 排序替换 HTML5 drag/drop，并保持即时持久化
- 仅在代理配置未保存时提升“应用”按钮视觉权重

主要文件：
- `src/app/settings/SettingsView.tsx`
- `src/app/shared/appState.ts`
- `src/features/preferences/preferencesController.ts`
- `src/lib/persistence/preferencesStore.ts`
- `src/lib/tauri/contracts.ts`
- `src-tauri/src/state/mod.rs`

测试：
- RTL：验证设置顺序、服务状态渲染、应用按钮强调、排序状态机
- 集成测试：验证新增/默认偏好归一化
- macOS 壳层 E2E：验证 Pointer 排序持久化

### 切片 4 —— 服务引导、首次引导、无障碍与 i18n 打磨

范围：
- 回退服务品牌图标方案，统一以服务名文本作为卡片识别元素
- 增加“未安装”与“已安装未登录”的差异化空状态引导
- 增加首次引导覆盖层与关闭持久化
- 为低额度卡片增加非颜色的 warning/danger 标签或图标
- 缩短英文健康摘要，避免被截断
- 明确回退菜单栏黄/红图标变体，不再交付该需求

主要文件：
- `src/components/panel/ServiceCard.tsx`
- `src/app/panel/PanelView.tsx`
- `src/app/shared/i18n.ts`
- `src/lib/tauri/contracts.ts`
- `src-tauri/src/tray/mod.rs`

测试：
- RTL：验证无重复识别元素、首次引导 gating 与可访问警示标签
- cargo tests：验证 tray 默认图标策略与 tooltip 同步
- 截图审查：验证双语下首次引导与警示状态

## 风险与缓解

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| 菜单栏同步修复只覆盖了一部分刷新路径 | 高 | 将“刷新成功 -> 重算 tray 表面状态”集中到宿主命令 helper 中 |
| Pointer 排序在 React 中变得难以推理 | 中 | 将排序计算与拖拽状态保持为纯 helper，并直接测试 |
| 首次引导状态导致旧版偏好反序列化异常 | 中 | 在 serde 与 TS 归一化中补默认值，保证缺失字段安全 |
| 服务识别元素与服务名文本重复造成视觉噪音 | 低 | 回退为纯服务名文本识别，不交付额外服务图标/徽章 |
| 缩短后的英文文案仍在窄宽度下截断 | 中 | 结合布局测试与 `en-US` 截图审查共同验证 |

## 设计后宪章复查

### I. 宿主边界安全 —— 通过

设计继续将所有宿主可信工作保留在 Rust 中，首次引导关闭标记也仅通过现有偏好通道保存。

### II. 契约优先的桌面表面 —— 通过

菜单栏、面板、设置页与首次引导的行为变化都已在实现前文档化，包括唯一新增的可选偏好字段。

### III. 测试门禁集成 —— 通过

本计划将每个跨层或涉及持久化的变化，都绑定到 Rust、RTL、集成测试和/或壳层测试。

### IV. 真实用户状态 —— 通过

设计明确扩展了菜单栏、面板占位状态、首次引导与设置页状态卡片的真实状态表达。

### V. 本地优先、可增量交付 —— 通过

所有切片仍然离线可用、可独立增量交付，并与当前本地快照/偏好架构兼容。
