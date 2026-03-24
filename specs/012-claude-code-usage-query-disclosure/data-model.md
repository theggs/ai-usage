# Data Model: Claude Code 用度查询告知与启用控制

**Feature**: 012-claude-code-usage-query-disclosure  
**Date**: 2026-03-24  
**Spec**: [spec.md](./spec.md)

## Overview

本特性不引入新的存储层，而是在现有 `UserPreferences`、`PreferencePatch`、`CodexPanelState` 与 snapshot cache 之上，新增两个持久化字段，并定义一组前端/宿主共享的派生可见性规则。目标是把“是否允许 Claude Code 进入查询链路”和“是否还需要展示告知卡片”从隐式逻辑变成明确的数据状态。

---

## Existing Canonical Entities Reused

### `UserPreferences`

现有用户偏好契约，将扩展两个字段。

新增字段：

| Field | Type | Purpose |
|-------|------|---------|
| `claudeCodeUsageEnabled` | `boolean` | 用户是否明确允许 AIUsage 使用本机现有 Claude Code 登录凭证查询官方额度 |
| `claudeCodeDisclosureDismissedAt` | `string?` | 用户是否已经确认过 onboarding 中的 Claude Code 说明卡片 |

既有相关字段：

| Field | Type | Purpose in this feature |
|-------|------|-------------------------|
| `language` | `"zh-CN" \| "en-US"` | 驱动新增界面文案切换 |
| `menubarService` | `string` | 关闭 Claude Code 时需要归一化当前激活态 |
| `serviceOrder` | `string[]` | 决定派生的可见服务顺序 |
| `networkProxyMode` | `"system" \| "manual" \| "off"` | 决定 Claude Code 查询时的代理策略 |
| `onboardingDismissedAt` | `string?` | 继续控制现有 onboarding 是否显示 |

Validation rules:
- `claudeCodeUsageEnabled` 默认值为 `false`
- `claudeCodeDisclosureDismissedAt` 缺失表示“尚未确认说明卡片”
- 旧偏好文件缺失新增字段时，必须安全回落到上述默认值
- 当 `claudeCodeUsageEnabled = false` 且 `menubarService = "claude-code"` 时，当前激活态必须被归一化到可用的其他服务或空状态

---

### `PreferencePatch`

现有偏好补丁契约，需要支持上述两个新字段的增量更新。

Rules:
- `claudeCodeUsageEnabled` 的切换必须能单独保存，不依赖其他字段联动提交
- `claudeCodeDisclosureDismissedAt` 只在用户点击 `我知道了` 时写入
- 空字符串不得被写入为有效时间戳

---

### `CodexPanelState`

现有跨层面板状态对象继续复用，Claude Code 关闭时仍使用该结构表达“空/隐藏前的规范状态”，但关闭状态下不得驱动 UI 展示、tray 汇总或官方请求。

Relevant fields:

| Field | Purpose in this feature |
|-------|-------------------------|
| `items` | 关闭时不得再进入可见服务集合 |
| `snapshotState` | 启用后继续表达 `fresh / stale / empty / failed / pending` 等真实状态 |
| `statusMessage` | 启用但不可用时继续给出真实宿主信息 |
| `lastSuccessfulRefreshAt` | 重新启用时可用于先展示缓存再刷新 |

---

### `SnapshotCache`

现有宿主持久化缓存复用，不变更文件结构。

Rules:
- 关闭 Claude Code 时，`claude-code` 缓存条目允许保留
- 关闭期间，缓存不得被面板、设置或 tray 当作可见状态消费
- 重新启用后，可先读取缓存条目构建快速初始态，再立即触发真实刷新；若命中冷却间隔，则直接复用缓存并跳过本次实际请求

---

## New Runtime Coordination Entity

### `ClaudeCodeRefreshGate`

表示 Claude Code 官方请求的运行时冷却控制，不要求单独持久化文件，但必须在宿主/编排层共享同一事实来源。

```ts
interface ClaudeCodeRefreshGate {
  lastSuccessfulRefreshAt?: number;
  minimumRefreshIntervalMs: number;
  nextEligibleRefreshAt?: number;
}
```

Rules:
- 开关触发、手动刷新、自动刷新共用同一个 `minimumRefreshIntervalMs`
- 只要当前时间早于 `nextEligibleRefreshAt`，就不得再发起新的 Claude 官方请求
- 冷却命中时，可直接复用最近缓存或最近成功结果，不得暴露为错误
- 冷却只抑制“实际请求”，不抑制启用后的可见反馈；UI 仍需进入一次明确的查询中/刷新中状态，然后平滑落到缓存或当前结果

---

## New Derived View Models

### `ClaudeCodeDisclosureState`

表示 onboarding 中 Claude Code 说明卡片是否该出现的派生状态。

```ts
type ClaudeCodeDisclosureState = "visible" | "dismissed";
```

Derivation rules:
- 当 `onboardingDismissedAt` 缺失、当前进入 onboarding、且 `claudeCodeDisclosureDismissedAt` 缺失时 -> `visible`
- 其他情况 -> `dismissed`

Lifecycle:
- 初始为 `visible`
- 点击 `我知道了` 后转为 `dismissed`
- 该状态不反向影响 `claudeCodeUsageEnabled`

---

### `VisibleClaudeCodeState`

描述 Claude Code 在当前交互周期中是否参与可见服务集合与刷新链路。

```ts
type VisibleClaudeCodeState =
  | "disabled-hidden"
  | "enabled-cached"
  | "enabled-refreshing"
  | "enabled-live"
  | "enabled-unavailable";
```

Meaning:
- `disabled-hidden`: 功能关闭，Claude Code 不出现在可见服务集合中
- `enabled-cached`: 功能开启，先显示缓存态，同时准备刷新
- `enabled-cached`: 功能开启，先显示缓存态，并伴随刷新中指示；若命中冷却间隔，则可直接停留在缓存/当前结果而不报错
- `enabled-refreshing`: 功能开启，正在执行首次查询或主动刷新
- `enabled-live`: 功能开启，已有真实可展示数据
- `enabled-unavailable`: 功能开启，但当前没有可用凭证、网络或会话

---

### `VisibleServiceScope`

用于统一派生设置页选项、面板可见顺序和 tray 当前可选服务。

```ts
interface VisibleServiceScope {
  visiblePanelServiceOrder: string[];
  visibleMenubarServices: string[];
  hasVisibleClaudeCode: boolean;
}
```

Derivation rules:
- `visiblePanelServiceOrder` 基于 `serviceOrder` 派生；当 `claudeCodeUsageEnabled = false` 时，隐藏 `claude-code`
- `visibleMenubarServices` 与设置页 `menubarService` 选项保持一致；关闭 Claude Code 时不再提供 `claude-code`
- `hasVisibleClaudeCode` 仅在 `claudeCodeUsageEnabled = true` 时为 `true`

Validation:
- 可见服务集合必须与设置页真实可选项一致
- 可见服务集合必须与面板/托盘的当前显示保持一致

---

## State Transitions

### Claude Code Usage Toggle

```text
默认关闭
  -> 用户开启
     -> 保存 preferences
     -> 允许 Claude Code 重新进入可见服务集合
     -> 若存在缓存，先显示缓存态
     -> 进入 enabled-refreshing
     -> 检查 ClaudeCodeRefreshGate
        -> 命中冷却 => 复用缓存或最近成功结果，回到 enabled-cached / enabled-live
        -> 可发请求 => 立即触发一次真实查询
           -> 成功 => enabled-live
           -> 无凭证/网络失败/恢复中 => enabled-unavailable

已开启
  -> 用户关闭
     -> 保存 preferences
     -> 立即停止 Claude Code 请求链路
     -> Claude Code 退出可见服务集合
     -> 归一化当前 tray/service 选择
     -> 缓存保留但进入 disabled-hidden
```

### Disclosure Card

```text
首次进入 onboarding 且未确认
  -> visible
点击 "我知道了"
  -> 写入 claudeCodeDisclosureDismissedAt
  -> dismissed
再次进入 onboarding
  -> 维持 dismissed
```

### Cache Visibility

```text
Claude Code enabled + cache exists
  -> enabled-cached
  -> 立即刷新或命中冷却后直接复用缓存
     -> live or unavailable or cached

Claude Code disabled
  -> cache retained on disk
  -> never rendered
  -> never used to build tray summary
```

---

## Identity & Uniqueness Rules

- `claudeCodeUsageEnabled` 在单个用户偏好对象中只有一个来源，不允许前端和宿主各自维护独立真值
- `claudeCodeDisclosureDismissedAt` 只记录最新一次确认时间，不需要历史列表
- `serviceOrder` 中同一服务 ID 最多出现一次；是否可见由 `VisibleServiceScope` 决定，而不是通过重复 ID 表达

---

## Data Volume / Scale Assumptions

- 当前服务数量固定为 2（Codex、Claude Code），但派生可见性规则必须保持可扩展，避免未来接入更多服务时重写“启用/隐藏/排序”逻辑
- snapshot cache 只缓存最近一次规范化面板状态，不引入历史版本、多账户或时间序列存储
