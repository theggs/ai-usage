# Data Model: 优惠活动提示

**Feature**: 013-promotion-status  
**Date**: 2026-03-25  
**Spec**: [spec.md](./spec.md)

## Overview

本特性不新增用户持久化字段，而是在现有偏好、可见服务范围和头部状态之上，增加一个独立的促销活动目录与一组前端派生实体。目标是把“当前有哪些活动”“当前是否处于优惠时段”“默认该显示哪些服务”“何时显示完整浮层”从散落逻辑变成可测试、可留痕的数据模型。

---

## Existing Canonical Entities Reused

### `UserPreferences`

现有用户偏好契约继续复用，不新增持久化字段。

相关字段：

| Field | Type | Purpose in this feature |
|-------|------|-------------------------|
| `language` | `"zh-CN" \| "en-US"` | 驱动促销提示文案语言 |
| `serviceOrder` | `string[]` | 决定服务间展示顺序 |
| `menubarService` | `string` | 不直接驱动促销结果，但保持与当前“用户关注服务”心智一致 |
| `claudeCodeUsageEnabled` | `boolean` | 决定 Claude Code 是否进入当前可见服务范围 |

Rules:
- 本特性不新增新的促销偏好持久化字段
- 完整浮层的预览/稳定展开状态是即时 UI 状态，不写入偏好

---

### `VisibleServiceScope`

现有派生实体继续复用，用来确定当前哪些服务进入促销判断范围以及显示顺序。

Relevant fields:

| Field | Purpose in this feature |
|-------|-------------------------|
| `visiblePanelServiceOrder` | 决定促销状态的服务顺序 |
| `visibleMenubarServices` | 间接反映当前服务可见性，不新增专用逻辑 |
| `hasVisibleClaudeCode` | 控制 Claude Code 是否参与促销判断 |

Rules:
- 促销判断只针对当前可见服务执行
- 服务顺序必须与现有面板顺序保持一致

---

## New Canonical Entities

### `PromotionCampaign`

表示一个可追溯的促销活动定义。

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | 活动唯一标识，历史版本不可复用 |
| `serviceId` | `string` | 所属服务，如 `codex`、`claude-code` |
| `title` | `string` | 活动名称 |
| `promotionType` | `"time-window" \| "limited-time"` | 活动是否支持“当前是否在优惠时段”的明确判断 |
| `surfaces` | `string[]` | 活动覆盖的产品表面，如 `claude-code`、`codex` |
| `startsAt` | `string` | 活动开始时间 |
| `endsAt?` | `string` | 活动结束时间；若官方未公开则为空 |
| `lifecycle` | `"scheduled" \| "active" \| "ended" \| "archived"` | 生命周期状态 |
| `sourceLabel` | `string` | 来源说明 |
| `sourceUrl` | `string` | 官方来源链接 |
| `eligibility` | `PromotionEligibilityRule` | 资格规则 |
| `windows` | `PromotionWindow[]` | 时间窗口规则，允许为空 |
| `historyNote?` | `string` | 历史修订说明 |

Validation rules:
- `id` 在活动目录中必须唯一
- `ended` 或 `archived` 活动必须保留，不得被删除覆盖
- `promotionType = "time-window"` 时，`windows` 不得为空
- `promotionType = "limited-time"` 时，`windows` 可为空

---

### `PromotionEligibilityRule`

表示促销资格的已知约束。

| Field | Type | Description |
|-------|------|-------------|
| `knownEligiblePlans` | `string[]` | 明确覆盖的计划 |
| `knownIneligiblePlans` | `string[]` | 明确排除的计划 |
| `unknownPolicy` | `"pending"` | 当前项目对未知资格统一采用待确认策略 |

Rules:
- 资格未知时不得派生为已生效
- 明确不适用时不得进入默认胶囊视图

---

### `PromotionWindow`

表示活动在时间上的生效规则。

| Field | Type | Description |
|-------|------|-------------|
| `kind` | `"continuous" \| "recurring-off-peak"` | 连续区间或重复性窗口 |
| `timeZone` | `string` | 规则声明使用的官方时区 |
| `weekdays?` | `number[]` | 适用于重复性窗口的工作日集合 |
| `blockedRanges?` | `Array<{ start: string; end: string }>` | 不享受加成的时间段 |
| `activeRanges?` | `Array<{ start: string; end: string }>` | 明确有效的时间段 |

Rules:
- 所有窗口判断都以 `timeZone` 为准，再换算到用户本地时间
- 重复性窗口必须能表达“当前在窗口内”与“当前不在窗口内”

---

### `PromotionCatalog`

表示当前仓库内维护的促销活动目录。

```ts
interface PromotionCatalog {
  campaigns: PromotionCampaign[];
  lastReviewedAt: string;
}
```

Rules:
- `campaigns` 同时包含当前活动与历史活动
- 历史活动通过 `lifecycle` 和时间字段表达，不单独拆分到其他存储

---

## New Derived View Models

### `PromotionServiceStatus`

表示某一时刻某个服务在促销语义上的最终状态。

```ts
type PromotionServiceStatus =
  | "active-window"
  | "active-general"
  | "inactive-window"
  | "eligibility-unknown"
  | "none";
```

Meaning:
- `active-window`: 当前明确处于优惠时段；当前 Codex 促销也按连续优惠时段落到该状态
- `active-general`: 保留给未来可能存在的“活动有效但不直接映射为优惠时段”的兼容状态
- `inactive-window`: 当前存在时段型活动，但当前不在优惠时段
- `eligibility-unknown`: 存在活动，但当前用户资格未知
- `none`: 当前无优惠活动

Rules:
- `inactive-window` 与 `none` 默认不进入默认胶囊视图
- `eligibility-unknown` 默认进入默认胶囊视图

---

### `PromotionServiceDecision`

表示某个服务在当前时刻的完整促销判断结果。

| Field | Type | Description |
|-------|------|-------------|
| `serviceId` | `string` | 服务 ID |
| `serviceName` | `string` | 服务名称 |
| `status` | `PromotionServiceStatus` | 当前促销状态 |
| `matchedCampaignId?` | `string` | 命中的活动 ID |
| `messageKey` | `string` | 文案键，不直接存展示文案 |
| `inlineLabelKey?` | `string` | 默认胶囊的极短文案键，如 `2x`、`待确认` |
| `benefitLabelKey?` | `string` | 完整浮层中可选的优惠幅度/形式键，如 `2x` |
| `detailTiming` | `PromotionDetailTiming` | 完整浮层第二行所需的时间或时段说明 |
| `isInlineVisible` | `boolean` | 是否进入默认胶囊视图 |

Derivation rules:
- 优先判断资格
- 同一服务多个活动并存时，优先级为：`active-window` > `active-general` > `inactive-window` > `none`
- `eligibility-unknown` 独立于上述时间优先级判断
- `detailTiming` 必须在完整浮层中可直接渲染，避免 UI 层再拼装原始时间规则

---

### `PromotionDetailTiming`

表示完整浮层第二行的标准化时间说明。

```ts
type PromotionDetailTiming =
  | {
      mode: "local-window";
      dateRangeLabel: string;
      localWindowLabel: string;
    }
  | {
      mode: "continuous";
      continuousLabel: string;
    }
  | {
      mode: "none";
    };
```

Meaning:
- `local-window`: 用于 Claude Code 这类既有活动日期范围、又有日内窗口规则的活动；第二行展示为“活动日期范围 + 用户本地优惠窗口”
- `continuous`: 用于 Codex 这类当前按连续优惠时段处理的活动；第二行展示为“当前持续优惠时段”
- `none`: 当前无可展示的第二行时间信息

Rules:
- `local-window` 的 `dateRangeLabel` 与 `localWindowLabel` 都必须是已本地化、可直接渲染的展示字符串
- `continuous` 不得退化为 `00:00-23:59` 这类机械时间串，除非未来产品规格重新定义
- 当 `status = "eligibility-unknown"` 或 `status = "none"` 且当前无可信时间说明时，可使用 `mode: "none"`

---

### `PromotionPresentationMode`

表示促销信息当前展示的是默认视图还是完整视图。

```ts
type PromotionPresentationMode = "focused" | "all";
```

Rules:
- 默认胶囊行使用 `focused`
- 完整浮层使用 `all`
- `all` 不持久化；关闭浮层后回到 `focused`

---

### `PromotionOverlayState`

表示完整浮层的即时交互状态。

```ts
type PromotionOverlayState = "closed" | "preview" | "pinned";
```

Meaning:
- `closed`: 只显示默认胶囊视图
- `preview`: 由 hover 或 focus 打开的临时预览态
- `pinned`: 由 click 打开的稳定展开态

Rules:
- `preview` 在 hover/focus 结束后关闭
- `pinned` 只能通过点击外部区域或按 `Esc` 关闭
- 面板关闭或重新打开时统一回到 `closed`

---

### `PromotionDisplayDecision`

表示头部最终渲染所需的规范结果。

```ts
interface PromotionDisplayDecision {
  inlineServices: PromotionServiceDecision[];
  allServices: PromotionServiceDecision[];
  hiddenServiceCount: number;
  fallbackState: "none" | null;
}
```

Rules:
- `inlineServices` 只包含 `active-window`、`active-general`、`eligibility-unknown`
- `allServices` 包含所有当前可见服务
- `allServices` 中的每一项都必须携带完整浮层所需的 `detailTiming`
- 当 `inlineServices` 为空且无任何促销可呈现时，`fallbackState = "none"`
- 当 `hiddenServiceCount > 0` 时，默认胶囊行必须允许用户进入完整浮层

---

## State Transitions

### Campaign Lifecycle

```text
scheduled
  -> reaches startsAt
  -> active
  -> reaches endsAt or manually reviewed complete
  -> ended
  -> retained in catalog
  -> archived
```

### Overlay Interaction

```text
panel opens
  -> overlay = closed
hover or focus promotion line
  -> overlay = preview
pointer leaves / focus leaves without click pin
  -> overlay = closed
click promotion line
  -> overlay = pinned
outside click or Esc
  -> overlay = closed
panel closes / reopens
  -> overlay = closed
```

### Service Promotion Resolution

```text
service visible
  -> find active campaigns for service
     -> no campaign => none
     -> campaign exists + eligibility unknown => eligibility-unknown
     -> limited-time active => active-general
     -> time-window active + currently in window => active-window
     -> time-window active + currently outside window => inactive-window
```

---

## Identity & Uniqueness Rules

- `PromotionCampaign.id` 在整个目录中唯一，不因活动名称相同而复用
- 同一服务在同一时刻只能产生一个 `PromotionServiceDecision`
- 同一时刻头部只能存在一个 `PromotionOverlayState`

## Scale Assumptions

- 当前设计按 2 个可见服务优化：`codex`、`claude-code`
- 默认胶囊行优先承载“有优惠/待确认”服务；更多服务通过完整浮层承载
- 若后续服务数增长导致默认胶囊承载吃紧，应先压缩服务简称与状态短语，而不是升级成新的独立展示区
