# Data Model：菜单栏吸附式弹出面板

## 概览

本次迭代不引入新的持久化业务实体，重点是为宿主定位、异常回退、壳层视图重置和单一面板视觉结果建立可测试的运行时模型。新增状态以宿主内存态和前端瞬态为主，不新增磁盘持久化文件。

## 实体

### 1. TrayAnchorSnapshot

- **Purpose**：表示一次 tray 点击可提供的几何信息，用于作为主面板弹出的首选锚点。
- **Fields**：
  - `displayId`: string，当前触发所在显示器标识
  - `rectX`: number，tray 图标矩形左上角 X
  - `rectY`: number，tray 图标矩形左上角 Y
  - `rectWidth`: number，tray 图标宽度
  - `rectHeight`: number，tray 图标高度
  - `centerX`: number，由 rect 派生出的水平中心线
  - `bottomY`: number，由 rect 派生出的底边位置
  - `source`: enum (`tray-event`, `unavailable`)
- **Validation rules**：
  - 当 `source = tray-event` 时，`rectWidth` 与 `rectHeight` 必须为正数。
  - `centerX` 必须由 `rectX + rectWidth / 2` 派生，而不是单独输入。
  - `displayId` 必须与当前弹出目标显示器一致。

### 2. PopoverPlacementDecision

- **Purpose**：描述一次显示主面板时最终使用的弹出定位决策。
- **Fields**：
  - `displayId`: string
  - `originX`: number，主面板左上角最终 X
  - `originY`: number，主面板左上角最终 Y
  - `panelWidthPx`: number
  - `panelHeightPx`: number
  - `horizontalAlignment`: enum (`centered-to-anchor`, `clamped-within-workarea`, `safe-default`)
  - `fallbackSource`: enum (`tray-anchor`, `last-successful-placement`, `safe-default`)
  - `workAreaX`: number
  - `workAreaY`: number
  - `workAreaWidth`: number
  - `workAreaHeight`: number
- **Validation rules**：
  - `originX` 与 `originY` 必须保证主面板完整位于当前显示器可视工作区内。
  - 在 `fallbackSource = tray-anchor` 且空间充足时，`horizontalAlignment` 必须为 `centered-to-anchor`。
  - 当原始中心对齐结果越界时，`horizontalAlignment` 必须切换为 `clamped-within-workarea`，但 `displayId` 不得改变。

### 3. LastSuccessfulPopoverPlacement

- **Purpose**：表示宿主层保存的“上一次成功弹出位置”内存态缓存，用于 tray 锚点不可用时回退。
- **Fields**：
  - `displayId`: string
  - `originX`: number
  - `originY`: number
  - `panelWidthPx`: number
  - `panelHeightPx`: number
  - `capturedAt`: string，ISO 时间戳
- **Lifecycle**：
  - 当一次主面板成功显示并完成最终位置应用后更新
  - 应用退出后丢失，不写入磁盘
- **Validation rules**：
  - 仅在主面板真实成功显示后更新，不能用失败尝试覆盖。
  - 回退时必须优先验证该缓存仍处于某个可见工作区内；若失效则进入安全默认位。

### 4. MenubarPopoverWindowPolicy

- **Purpose**：描述主窗口在菜单栏模式下的宿主生命周期与视觉边界规则。
- **Fields**：
  - `windowLabel`: string，固定为 `main`
  - `decorations`: boolean，必须为 `false`
  - `resizable`: boolean，必须为 `false`
  - `visibilityMode`: enum (`toggle-from-tray`, `hide-on-close`, `hide-on-blur`, `hide-on-esc`)
  - `surfaceMode`: enum (`single-panel-surface`)
  - `heightStrategy`: enum (`content-fit-with-max-clamp`)
  - `dragMode`: enum (`no-user-drag`)
- **Validation rules**：
  - 主面板显示时不得暴露传统窗口标题栏和交通灯按钮。
  - `surfaceMode` 必须保证视觉上只有单一面板本体。
  - `dragMode` 在本特性中固定为 `no-user-drag`。

### 5. PanelShellViewState

- **Purpose**：描述前端壳层在 panel/settings 双视图之间的显示状态，以及重新打开时的默认重置行为。
- **Fields**：
  - `currentView`: enum (`panel`, `settings`)
  - `isVisibleSession`: boolean，表示窗口当前是否处于一次可见会话中
  - `resetToPanelOnShow`: boolean，固定为 `true`
  - `promotionOverlayState`: enum (`closed`, `preview`, `pinned`)
  - `isScrolled`: boolean
- **State transitions**：
  - `hidden -> visible` 时，`currentView` 必须重置为 `panel`
  - `visible(panel) -> visible(settings)` 由用户进入设置触发
  - `visible(any) -> hidden` 时，次级浮层状态应被清理
- **Validation rules**：
  - 重新打开主面板时，`currentView` 不得保留为 `settings`。
  - `promotionOverlayState` 不得跨隐藏/重新打开遗留为打开状态。

### 6. PopoverContentHeightState

- **Purpose**：描述主面板内容高度与内部滚动策略。
- **Fields**：
  - `contentHeightPx`: number，内容自然高度
  - `appliedHeightPx`: number，主面板实际高度
  - `maxAllowedHeightPx`: number，当前工作区允许的最大高度
  - `scrollMode`: enum (`no-scroll`, `internal-scroll`)
- **Validation rules**：
  - 当 `contentHeightPx <= maxAllowedHeightPx` 时，`appliedHeightPx` 必须接近内容自然高度，`scrollMode = no-scroll`。
  - 当 `contentHeightPx > maxAllowedHeightPx` 时，`appliedHeightPx` 必须停止增高，`scrollMode = internal-scroll`。
  - 不得通过扩大窗口超出工作区来避免内部滚动。

## 派生关系

- `TrayAnchorSnapshot` 与当前显示器工作区共同决定 `PopoverPlacementDecision`。
- `LastSuccessfulPopoverPlacement` 仅在 `TrayAnchorSnapshot` 不可用时参与决策。
- `MenubarPopoverWindowPolicy` 约束 `PopoverPlacementDecision` 的可应用范围与前端壳层的可见结果。
- `PanelShellViewState` 与 `PopoverContentHeightState` 共同决定重新打开后的默认视图与滚动表现。

## 状态迁移

### 主面板可见性

`hidden` -> `positioning`：用户点击菜单栏图标  
`positioning` -> `visible`：定位决策完成并应用窗口位置  
`visible` -> `hidden`：再次点击菜单栏图标 / 失焦 / 原生关闭请求 / `Esc`

### 定位回退

`tray-anchor` -> `last-successful-placement`：本次无法获取 tray 几何信息  
`last-successful-placement` -> `safe-default`：没有有效历史缓存或缓存已不再位于可见工作区  
`safe-default` -> `tray-anchor`：后续任一次成功获取 tray 几何信息并正常弹出

### 前端视图

`visible(settings)` -> `hidden`：用户关闭或失焦  
`hidden` -> `visible(panel)`：主面板再次显示  
`visible(panel)` -> `visible(settings)`：用户主动进入设置  

## 非持久化说明

- `LastSuccessfulPopoverPlacement` 和 `PopoverContentHeightState` 都是运行时态，不写入偏好文件。
- 本特性不新增任何用户可编辑数据模型，也不改变现有 `UserPreferences`、`CodexPanelState` 或 snapshot cache 结构。
