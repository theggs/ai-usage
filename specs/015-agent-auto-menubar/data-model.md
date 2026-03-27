# Data Model：菜单栏自动服务跟随

**特性**：015-agent-auto-menubar  
**日期**：2026-03-27  
**规格**：[spec.md](./spec.md)

## 概览

本特性不新增新的持久化存储层，而是在现有 `UserPreferences`、`PanelPlaceholderItem`、`CodexPanelState` 与 snapshot cache 的基础上，新增一组宿主运行时活动判断模型。目标是把“菜单栏当前应显示哪个服务”从用户手动指定的单一字符串，扩展为“手动模式 + 自动模式”并保持跨宿主、tray 与设置页的一致语义。

---

## 复用并扩展的现有实体

### 1. `UserPreferences`

现有用户偏好实体继续作为唯一持久化配置来源。

本特性中受影响的字段：

| Field | Type | Purpose in this feature |
|-------|------|-------------------------|
| `menubarService` | `"codex" \| "claude-code" \| "auto"` | 决定菜单栏处于手动模式还是自动模式 |
| `traySummaryMode` | existing enum | 决定当前显示服务的数字摘要格式 |
| `serviceOrder` | `string[]` | 继续决定主面板展示顺序，不直接决定自动模式的 tray 选择 |
| `claudeCodeUsageEnabled` | `boolean` | 关闭时将 Claude Code 排除出自动模式候选集合 |

Validation rules:

- `menubarService` 缺失时默认值仍为 `"codex"`，保证旧偏好兼容。
- `menubarService = "auto"` 时必须保留原值，不允许被归一化回固定服务。
- 当 `claudeCodeUsageEnabled = false` 且 `menubarService = "claude-code"` 时，仍按现有规则归一化到可用手动服务。
- 当 `claudeCodeUsageEnabled = false` 且 `menubarService = "auto"` 时，自动模式候选集合中不得包含 `claude-code`，但 `"auto"` 本身仍然合法。

### 2. `PanelPlaceholderItem`

现有归一化服务卡片条目继续作为 tray 数字展示的来源。

Relevant fields:

| Field | Purpose in this feature |
|-------|-------------------------|
| `serviceId` | 与自动模式选出的显示对象对齐 |
| `serviceName` | 用于 tooltip 和当前显示对象命名 |
| `iconKey` | 保持与服务图标资产的语义对齐 |
| `quotaDimensions` | 用于计算当前显示对象的 summary 和 severity |
| `lastSuccessfulRefreshAt` | 与自动模式活动时间不同；只表示额度数据刷新时间 |

Rule:

- 自动模式只能从“当前有可显示余量数据”的服务条目中取 tray summary。
- 活动判断与额度刷新是两条链路；`lastSuccessfulRefreshAt` 不可替代 `lastActivityAt`。

### 3. `CodexPanelState`

现有服务面板状态继续复用，不增加新的跨层字段。

Rule:

- 本特性不改变 `CodexPanelState` 的持久化或接口结构。
- 自动模式只消费其中的 `items` 作为 tray 可显示数据来源，不改变 panel 的排序或内容。

---

## 新增宿主运行时实体

### 4. `MenubarServiceMode`

表示菜单栏服务选择的规范模式。

```ts
type MenubarServiceMode = "codex" | "claude-code" | "auto";
```

Meaning:

- `"codex"` / `"claude-code"`：手动模式，tray 当前显示对象固定为该服务
- `"auto"`：自动模式，由宿主运行时根据活动状态动态决定显示对象

### 5. `ActivitySignalSource`

表示一次服务活动判断所采用的信号来源。

```ts
type ActivitySignalSource =
  | "codex-state-sqlite"
  | "codex-session-index"
  | "codex-logs-sqlite"
  | "codex-session-file"
  | "claude-project-file"
  | "claude-history-file"
  | "claude-session-env"
  | "none";
```

Purpose:

- 让宿主在调试、日志和测试中知道当前判断来自哪一条信号链路
- 让自动模式在多条信号同时存在时能够按主/辅信号做置信度归一

### 6. `ServiceActivitySnapshot`

表示某个服务在当前设备上的最近活动判断结果。

```ts
interface ServiceActivitySnapshot {
  serviceId: "codex" | "claude-code";
  lastActivityAt?: number;
  signalSource: ActivitySignalSource;
  confidence: "high" | "medium" | "low" | "none";
  isEligibleForAuto: boolean;
  lastError?: string;
}
```

Field rules:

- `lastActivityAt` 使用毫秒时间戳；缺失表示当前没有可用活动判断结果
- `confidence = "high"` 仅用于主信号
- `confidence = "medium"` 用于结构化辅助信号
- `confidence = "low"` 用于弱回退信号
- `isEligibleForAuto` 同时取决于：
  - 该服务当前是否在支持范围内
  - 信号是否可用
  - 该服务当前是否有可显示余量数据
  - 对 Claude Code，还要满足 `claudeCodeUsageEnabled = true`

### 7. `AutoMenubarSelectionState`

表示自动模式当前的菜单栏显示决策。

```ts
interface AutoMenubarSelectionState {
  mode: "neutral" | "single" | "rotating";
  currentServiceId?: "codex" | "claude-code";
  rotationServiceIds: ("codex" | "claude-code")[];
  lastResolvedAt: number;
  lastRotatedAt?: number;
  retainedFromPrevious: boolean;
}
```

Meaning:

- `neutral`：当前尚未形成任何可显示对象，tray 回退中性图标
- `single`：当前只显示一个明确服务
- `rotating`：当前在多个近期活跃服务之间低频轮播

Validation rules:

- `mode = "neutral"` 时，`currentServiceId` 必须为空，`rotationServiceIds` 必须为空
- `mode = "single"` 时，`currentServiceId` 必须存在，`rotationServiceIds` 为空
- `mode = "rotating"` 时，`rotationServiceIds.length >= 2`，且 `currentServiceId` 必须属于该集合
- 当“无新的近期活动但已有历史显示结果”时，`retainedFromPrevious = true`

### 8. `TrayDisplayState`

表示本次真正写入系统 tray 的显示结果。

```ts
interface TrayDisplayState {
  iconVariant: "neutral" | "codex" | "claude-code";
  severity: "normal" | "warning" | "danger" | "empty";
  summaryText?: string;
  tooltipServiceName?: string;
}
```

Rules:

- `iconVariant` 必须与当前显示对象一致；无显示对象时为 `neutral`
- `summaryText` 继续由当前显示对象的 `quotaDimensions + traySummaryMode` 派生
- `severity` 仍只来自当前显示对象的 quota 维度，不由活动信号直接决定

---

## 派生关系

- `UserPreferences.menubarService` 决定进入手动模式还是自动模式。
- `ServiceActivitySnapshot` 与当前可见 `PanelPlaceholderItem[]` 共同决定 `AutoMenubarSelectionState`。
- `AutoMenubarSelectionState` 再结合 `traySummaryMode` 派生 `TrayDisplayState`。
- `serviceOrder` 只影响 panel 可见顺序；自动模式不反向修改它。

---

## 状态迁移

### 1. 自动模式进入

```text
manual service
  -> user selects "auto"
     -> host starts using activity snapshots
     -> if one eligible service is clearly active -> single(currentServiceId)
     -> if multiple eligible services are recently active -> rotating(rotationServiceIds)
     -> if none eligible and no previous display exists -> neutral
```

### 2. 单服务自动跟随

```text
single(codex)
  -> claude becomes clearly newer and eligible
     -> single(claude-code)

single(codex)
  -> claude also enters recent-active window while codex remains recent
     -> rotating([codex, claude-code])
```

### 3. 双服务低频轮播

```text
rotating([codex, claude-code])
  -> rotation interval reached
     -> currentServiceId toggles within the rotation set

rotating([codex, claude-code])
  -> one service leaves recent-active window or becomes ineligible
     -> single(remaining service)
```

### 4. 无近期活动

```text
single/rotating with previous display
  -> no new recent activity
     -> keep currentServiceId
     -> retainedFromPrevious = true

auto with no previous display
  -> no eligible activity found
     -> neutral
```

---

## 规模与生命周期假设

- 当前只支持 2 个服务，因此 `rotationServiceIds` 最大为 2，但模型本身保留可扩展空间。
- `ServiceActivitySnapshot` 与 `AutoMenubarSelectionState` 都是宿主内存态，不写入新的磁盘文件。
- 本特性只读取 `~/.codex` 与 `~/.claude` 的元数据，不读取或持久化 prompt 正文。
