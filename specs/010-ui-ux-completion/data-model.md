# 数据模型：UI/UX 审查遗留项完成

**特性**：010-ui-ux-completion  
**日期**：2026-03-23  
**规格**：[spec.md](./spec.md)

> 变更说明（回退）：
> 迭代 10 不再交付 tray warning / danger 黄红状态图标。本文档中的菜单栏模型已回退为“标题与 tooltip 同步 + 默认应用图标保持不变”。

## 概述

本特性主要复用现有宿主/前端契约，并在其上增加少量派生 UI 模型。唯一需要扩展的持久化结构，是在现有偏好存储中增加一个可选的“首次引导已关闭”字段，以便用户跳过首次引导后不再重复看到完整覆盖层。

---

## 复用的规范实体

### `UserPreferences`

Rust 与 TypeScript 共享的持久化偏好契约。

本特性相关字段：

| 字段 | 类型 | 在本特性中的用途 |
|------|------|------------------|
| `language` | `"zh-CN" \| "en-US"` | 驱动更短的英文健康摘要和设置/面板文案一致性 |
| `refreshIntervalMinutes` | `number` | 定义自动刷新节奏，并间接决定菜单栏同步频率 |
| `traySummaryMode` | 枚举 | 继续控制 tray 标题摘要文本格式 |
| `menubarService` | `string` | 决定 tray 摘要与 tooltip 所代表的服务 |
| `serviceOrder` | `string[]` | 驱动面板卡片顺序和设置页排序持久化 |
| `networkProxyMode` / `networkProxyUrl` | 枚举 / `string` | 继续保持显式应用路径和较低视觉权重 |

### `PanelPlaceholderItem`

宿主发出、前端消费的规范服务卡片负载。

本特性相关字段：

| 字段 | 类型 | 在本特性中的用途 |
|------|------|------------------|
| `serviceId` | `string` | 服务排序、品牌识别、tray 选中与状态卡片归属的主键 |
| `serviceName` | `string` | 面板、设置状态、tray tooltip 和首次引导中的展示名 |
| `iconKey` | `string` | 保留为服务标识键，供排序、埋点或未来扩展使用；当前版本不用于面板图标渲染 |
| `quotaDimensions` | `QuotaDimension[]` | warning/danger 标签和进度表现的来源 |
| `badgeLabel` | `string?` | 继续用于 stale/failed/offline 等异常状态标签 |
| `lastRefreshedAt` | `string` | 用于 freshness 提示与跨表面同步验证 |

### `QuotaDimension`

额度状态的规范负载。

本特性相关字段：

| 字段 | 类型 | 在本特性中的用途 |
|------|------|------------------|
| `label` | `string` | 映射为更短、更本地化的维度名称 |
| `remainingPercent` | `number?` | 决定进度填充与 warning 文本标签 |
| `remainingAbsolute` | `string` | 作为强调百分比旁的辅助值显示 |
| `resetHint` | `string?` | 继续在额度行中展示刷新/重置提示 |
| `status` | `"healthy" \| "warning" \| "exhausted" \| "unknown"` | 作为面板与菜单栏共用的规范严重程度桶 |
| `progressTone` | `"success" \| "warning" \| "danger" \| "muted"` | 作为填充颜色的规范样式 token |

### `CodexPanelState`

宿主命令返回的单服务组状态。

本特性相关字段：

| 字段 | 类型 | 在本特性中的用途 |
|------|------|------------------|
| `items` | `PanelPlaceholderItem[]` | 用于判断服务是已连接还是应显示占位/引导 |
| `snapshotState` | 类枚举字符串 | 区分 fresh/stale/empty/failed 等状态 |
| `statusMessage` | `string` | 为未连接、未登录等空状态提供上下文文案 |
| `activeSession` | 对象? | 在设置页服务状态卡片中展示 |
| `updatedAt` | `string` | 用于确认刷新完成时点及 tray 同步时效 |

---

## 规范结构扩展

### `UserPreferences.onboardingDismissedAt`

存放在现有偏好文件中的可选持久化字段。

```ts
interface UserPreferences {
  onboardingDismissedAt?: string;
}
```

规则：
- 缺失/`undefined` 表示用户从未关闭首次引导
- 存在时间戳值表示首次引导在后续启动中应保持隐藏
- 该字段必须在 Rust serde 与 TypeScript 归一化中都提供安全默认值
- 不需要单独迁移文件；旧偏好文件缺失该字段时应可直接反序列化

---

## 新增派生视图模型

### `TrayVisualState`

宿主侧派生模型，用于选择 tray 文本与 tooltip；图标固定为默认应用图标。

```ts
interface TrayVisualState {
  serviceId: string;
  serviceName: string;
  summaryText?: string;
  tooltipText: string;
  usesDefaultAppIcon: true;
}
```

派生规则：
- 先按 `preferences.menubarService` 过滤源 item
- 无论 healthy / warning / danger / empty，tray 图标均保持默认应用图标
- 选中服务的最低额度仍可用于面板和文案层派生，但不再用于菜单栏图标切换

### `ServiceCardVisualState`

前端侧派生的面板卡片展示模型。

```ts
type CardAlertLevel = "normal" | "warning" | "danger";

interface ServiceCardVisualState {
  alertLevel: CardAlertLevel;
  accentVisible: boolean;
  severityLabel?: string;
  showBadge: boolean;
}
```

规则：
- 若任一额度维度 `status === "exhausted"`，则 `alertLevel = "danger"`
- 若不存在 danger，但任一维度 `status === "warning"`，则 `alertLevel = "warning"`
- 其余情况为 `normal`
- warning/danger 状态必须提供 `severityLabel`，用于满足“非颜色表达状态”
- `accentVisible` 仅在 warning/danger 卡片上为真

### `EmptyServiceGuidance`

前端侧派生的按服务占位引导模型。

```ts
type EmptyServiceKind = "not-installed" | "signed-out" | "disconnected";

interface EmptyServiceGuidance {
  serviceId: string;
  kind: EmptyServiceKind;
  title: string;
  body: string;
  actionLabel: string;
  actionTarget: "settings";
}
```

规则：
- `not-installed` 与 `signed-out` 必须展示不同的引导文案
- 每张占位卡都必须包含跳转设置页的操作入口
- 该模型只会在首次引导完成或被关闭后显示

### `FirstRunGuideState`

由服务连接状态与持久化关闭标记共同派生的前端覆盖层状态。

```ts
interface FirstRunGuideState {
  visible: boolean;
  stepCount: 2 | 3;
  dismissed: boolean;
  canSkip: boolean;
}
```

可见性规则：
- 当所有服务均未连接/未配置，且 `onboardingDismissedAt` 缺失时显示
- 一旦任一服务连接成功，则隐藏
- 用户显式跳过/关闭后隐藏

### `ServiceStatusCard`

按 Codex / Claude Code 归一化后的设置页状态卡片模型。

```ts
interface ServiceStatusCard {
  serviceId: string;
  serviceName: string;
  connectionState: "connected" | "disconnected" | "empty" | "failed" | "stale";
  dataSource: string;
  primaryMessage: string;
  secondaryMessage?: string;
  sessionLabel?: string;
}
```

规则：
- 每个受支持服务必须恰好对应一张状态卡片
- 单服务场景只展示该服务的有效状态，不显示误导性的无关文案
- 不允许继续出现与当前服务无关的共享 fallback 文案，例如不合时宜的“无活动会话”

### `PointerReorderState`

替代 HTML5 DnD 的设置页临时拖拽状态模型。

```ts
interface PointerReorderState {
  orderedIds: string[];
  draggedId?: string;
  overId?: string;
  pointerOffsetY?: number;
  active: boolean;
}
```

规则：
- `orderedIds` 在归一化后必须恰好包含所有已知服务且不重复
- 放手时立即持久化 `serviceOrder`
- 持久化失败时恢复到上一次确认成功的顺序

### `SettingsHeaderStatus`

设置 header 副文案的状态派生模型。

```ts
type SettingsHeaderStatusKind = "idle" | "saving" | "saved" | "error";

interface SettingsHeaderStatus {
  kind: SettingsHeaderStatusKind;
  message: string;
}
```

规则：
- 进入设置页时初始为 `idle`，副文案显示空或通用提示
- 任一即时保存触发时短暂切换为 `saving`（显示"保存中…"）
- 保存成功后切换为 `saved`（显示"已保存"），持续 2 秒后回到 `idle`
- 保存失败时切换为 `error`（显示"保存失败"），持续到下次成功保存
- 代理"应用"按钮触发的保存也遵循相同状态迁移

---

## 校验规则

- `serviceOrder` 必须继续过滤未知 ID，并以确定性顺序补回缺失的已知服务
- `onboardingDismissedAt` 如存在，必须是 ISO 时间戳文本
- tray 不再使用 warning / danger 图标严重级别切换
- 每个进度行只能渲染一条百分比标签
- warning/danger 卡片必须同时提供文本标签或图标，不能只依赖颜色

---

## 状态迁移

### 菜单栏同步

```text
请求刷新
  -> 宿主加载最新快照
  -> 宿主重建规范 panel items
  -> 宿主根据选中服务应用 tray 标题/tooltip
  -> 面板与菜单栏反映同一轮刷新结果
```

### 首次引导

```text
应用启动，且没有任何已连接服务，并且没有关闭时间戳
  -> 显示首次引导覆盖层
用户点击“前往设置”
  -> 导航到设置页，不记录关闭状态
用户点击“跳过”
  -> 持久化 onboardingDismissedAt
后续再次打开且仍没有已连接服务
  -> 不再显示首次引导，改为显示按服务占位引导
任一服务连接成功
  -> 首次引导保持隐藏
```

### Pointer 排序

```text
按下拖拽手柄
  -> 进入 active 拖拽状态
指针移动到其他行上方
  -> 更新预览顺序
指针释放
  -> 持久化 serviceOrder
     -> 成功：保留新顺序
     -> 失败：回滚到旧顺序并展示保存失败反馈
```
