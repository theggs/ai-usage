# Data Model: Menubar UI/UX Overhaul

## Overview

本次迭代不引入新的持久化业务实体，重点是收紧现有 host/UI 状态对象的呈现语义，使窗口行为、主面板信息层级和设置反馈可被稳定实现与测试。

## Entities

### 1. MenubarWindowPolicy

- **Purpose**: 描述主窗口在 tray 点击、关闭按钮、失焦和尺寸方面的宿主行为约束。
- **Fields**:
  - `windowLabel`: string, fixed as `main`
  - `visibilityMode`: enum (`toggle-from-tray`, `hide-on-close`, `hide-on-blur`)
  - `resizable`: boolean, must be `false`
  - `widthPx`: integer, valid range `320-380`
  - `maxHeightPx`: integer, should not exceed `620`
  - `scrollStrategy`: enum (`content-scroll`, `window-fixed`)
- **Validation rules**:
  - Close requests must not terminate the app process.
  - Blur/hide behavior applies only to the popover window, not the tray icon itself.
  - Window width outside `320-380` or max height above `620` violates the spec.

### 2. PanelStatusLine

- **Purpose**: 定义主面板唯一状态行的数据来源与显示方式。
- **Fields**:
  - `lastRefreshedAt`: string, host-provided timestamp
  - `snapshotState`: enum (`fresh`, `pending`, `stale`, `empty`, `failed`)
  - `statusMessage`: localized or localizable explanatory string
  - `inlineErrorText`: optional string, shown only when host state indicates failure/disconnection details
  - `tone`: enum (`neutral`, `success`, `warning`, `danger`)
- **Validation rules**:
  - The status line must always show the refresh timestamp label/value, even when an inline error appears.
  - `inlineErrorText` must not duplicate the base timestamp label verbatim.
  - `tone` must reflect the underlying snapshot state consistently.

### 3. QuotaCardPresentation

- **Purpose**: 表示单个服务卡片在紧凑主面板中的展示模型。
- **Fields**:
  - `serviceId`: string
  - `serviceName`: string
  - `quotaDimensions`: `QuotaDimensionPresentation[]`
  - `badgeLabel`: optional string
  - `lastRefreshedAt`: string
- **Relationships**:
  - One `QuotaCardPresentation` contains one or more `QuotaDimensionPresentation` rows.
- **Validation rules**:
  - Cards remain the deepest container layer; dimension rows cannot introduce a third nested card shell.
  - Empty card collections must fall back to the shared status/empty state rather than placeholder fake rows.

### 4. QuotaDimensionPresentation (extends `QuotaDimension` in `contracts.ts`)

- **Purpose**: 将已有 quota 维度映射到可测试的进度条和颜色等级。实现时通过扩展 `src/lib/tauri/contracts.ts` 中的 `QuotaDimension` 类型落地，不新建独立类型。
- **Fields**:
  - `label`: string
  - `remainingPercent`: optional integer `0-100`
  - `remainingAbsolute`: string
  - `resetHint`: optional string
  - `status`: enum (`healthy`, `warning`, `exhausted`, `unknown`)
  - `progressTone`: enum (`success`, `warning`, `danger`, `muted`)
- **Validation rules**:
  - `remainingPercent > 50` maps to `healthy/success`.
  - `remainingPercent` in `20-50` maps to `warning/warning`.
  - `remainingPercent < 20` maps to `exhausted/danger`.
  - Missing `remainingPercent` maps to `unknown/muted`.
  - `0` remains a valid percent and must render as an empty bar with danger tone, not as missing data.

### 5. SettingsFeedbackState

- **Purpose**: 表示设置页保存和通知测试的局部反馈，而不是全局页面消息堆叠。
- **Fields**:
  - `scope`: enum (`preferences-save`, `notification-test`, `autostart-toggle`)
  - `state`: enum (`idle`, `pending`, `success`, `blocked`, `failed`)
  - `message`: localized string
  - `visible`: boolean
- **Validation rules**:
  - Save feedback must be visible adjacent to the save action without requiring scroll.
  - Notification feedback belongs to the notification section and must not overwrite save feedback state.
  - Autostart toggle failures must revert to the actual persisted value.

## Derived Relationships

- `CodexPanelState.items[]` continue to provide the canonical quota source for `QuotaCardPresentation`.
- `CodexPanelState.snapshotState` and `statusMessage` feed `PanelStatusLine`.
- `UserPreferences.language` selects the locale for all visible labels in both panel and settings surfaces.
- `UserPreferences.autostartEnabled` remains canonical; `SettingsFeedbackState` only reflects interaction progress/result.

## State Transitions

### Menubar visibility

`hidden` -> `visible` on tray click  
`visible` -> `hidden` on tray click, close request, outside click, or app-switch blur  
`hidden` -> `visible` must preserve current panel data without forcing process restart

### Panel refresh

`idle` -> `pending` when manual refresh starts  
`pending` -> `fresh` when host snapshot succeeds  
`pending` -> `stale` or `failed` when host refresh cannot produce a fresh snapshot  
Existing data may remain visible while the status line communicates the latest truth

### Settings feedback

`idle` -> `pending` when user saves preferences or sends a test notification  
`pending` -> `success` on completion  
`pending` -> `blocked` or `failed` for notification issues  
`success` may auto-clear after a short delay but must remain long enough to be noticed in the popover

### Refresh visibility

`stable-data` -> `refreshing-with-stale-visible` when manual refresh starts  
`refreshing-with-stale-visible` -> `stable-data` when a new payload arrives  
`refreshing-with-stale-visible` -> `stable-data + error` when refresh fails after prior content was already visible
