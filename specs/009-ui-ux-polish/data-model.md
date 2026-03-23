# Data Model: UI/UX 视觉层级与交互优化

**Feature**: 009-ui-ux-polish  
**Date**: 2026-03-23  
**Spec**: [spec.md](./spec.md)

## Overview

This feature does not introduce a new backend persistence schema. Instead, it adds derived frontend view models and interaction states on top of the existing `CodexPanelState`, `PanelPlaceholderItem`, `QuotaDimension`, `UserPreferences`, and `PreferencePatch` contracts. The goal is to make hierarchy, status, and persistence timing explicit before implementation.

---

## Existing Canonical Entities Reused

### `UserPreferences`

Existing persisted preference contract; no schema changes required for this feature.

Relevant fields:

| Field | Type | Purpose in this feature |
|-------|------|-------------------------|
| `language` | `"zh-CN" \| "en-US"` | Drives all panel/settings copy immediately after change |
| `refreshIntervalMinutes` | `number` | Must auto-save and restart polling interval immediately |
| `traySummaryMode` | enum | Must auto-save immediately |
| `autostartEnabled` | `boolean` | Already immediate-save; becomes the reference behavior |
| `menubarService` | `string` | Must auto-save immediately |
| `serviceOrder` | `string[]` | Updated by drag reorder and persisted immediately |
| `networkProxyMode` | `"system" \| "manual" \| "off"` | Remains on explicit apply |
| `networkProxyUrl` | `string` | Validated before explicit apply |

Validation rules already in force:
- `refreshIntervalMinutes >= 5`
- `language` limited to supported locales
- `traySummaryMode` and `networkProxyMode` must match supported enums

---

### `PanelPlaceholderItem`

Existing canonical service-card payload from the host/frontend boundary.

Relevant fields:

| Field | Type | Purpose in this feature |
|-------|------|-------------------------|
| `serviceId` | `string` | Used for ordering and health-summary attribution |
| `serviceName` | `string` | Shown in card and summary text |
| `badgeLabel` | `string?` | Rendered only for abnormal states after this feature |
| `quotaDimensions` | `QuotaDimension[]` | Source of urgency calculation and card emphasis |
| `lastRefreshedAt` | `string` | Input for global relative refresh label |

---

### `QuotaDimension`

Existing quota dimension payload reused as the canonical urgency source.

Relevant fields:

| Field | Type | Purpose in this feature |
|-------|------|-------------------------|
| `label` | `string` | Mapped to user-friendly display labels |
| `remainingPercent` | `number?` | Drives progress width, inline percent text, and urgency ranking |
| `remainingAbsolute` | `string` | Secondary detail kept visible beside or below the emphasized percent |
| `resetHint` | `string?` | Continues to show reset timing |
| `status` | enum | Primary severity bucket for summary and card alert state |
| `progressTone` | enum | Styling token for progress fill and emphasized text |

---

## New Derived View Models

### `PanelHealthSummary`

Derived, frontend-only summary used by the sticky header.

```ts
type PanelHealthTone = "healthy" | "warning" | "danger" | "empty";

interface PanelHealthSummary {
  tone: PanelHealthTone;
  message: string;
  serviceId?: string;
  serviceName?: string;
  dimensionLabel?: string;
  remainingPercent?: number;
}
```

Derivation rules:
- `empty`: no connected service cards available; show setup/disconnected guidance
- `danger`: the visible dimension with the lowest `remainingPercent` below 20
- `warning`: the visible dimension with the lowest `remainingPercent` from 20 to 50
- `healthy`: all visible dimensions above 50, or only unknown/muted values remain

Validation:
- Only one summary is shown at a time
- When multiple dimensions have the same severity, choose the lowest `remainingPercent`
- If all services are disconnected, never emit a healthy summary

---

### `ServiceCardVisualState`

Derived, frontend-only presentation state for each rendered card.

```ts
type CardAlertLevel = "normal" | "warning" | "danger" | "disconnected";

interface ServiceCardVisualState {
  alertLevel: CardAlertLevel;
  showBadge: boolean;
  showGlobalRefreshInsteadOfLocal: boolean;
}
```

Derivation rules:
- `danger`: any dimension on the card has `status === "exhausted"`
- `warning`: no danger dimension exists, but at least one dimension has `status === "warning"`
- `normal`: connected card with only healthy/unknown dimensions
- `disconnected`: placeholder card / no items for that service
- `showBadge` is false for normal connected cards and true for abnormal or recovery states
- `showGlobalRefreshInsteadOfLocal` is true when all rendered connected cards share the same refresh timestamp

---

### `RelativeTimestampViewModel`

Derived value for panel refresh labels.

```ts
interface RelativeTimestampViewModel {
  relativeLabel: string;
  absoluteLabel: string;
  nextRefreshMs: number;
}
```

Rules:
- Relative labels use "刚刚 / N 分钟前 / N 小时前" and localized English equivalents
- Absolute label is preserved for `title`/tooltip
- Recompute every 30 seconds or after new panel data arrives

---

### `PreferenceInteractionState`

Frontend-only state machine for settings persistence feedback.

```ts
type PreferenceInteractionState =
  | "idle"
  | "saving"
  | "saved"
  | "validation-error"
  | "save-error";
```

Rules:
- Non-proxy fields transition `idle -> saving -> saved` per interaction
- Proxy fields remain draft-like until explicit apply
- Any failed persistence returns the specific field or section to `save-error` while preserving truthful messaging

---

### `ServiceOrderDraft`

Ephemeral representation of settings drag ordering.

```ts
interface ServiceOrderDraft {
  orderedIds: string[];
  draggedId?: string;
  overId?: string;
  disabled: boolean;
}
```

Validation:
- `orderedIds` must contain each known service at most once
- Unknown IDs are filtered before render and before persistence
- `disabled` is true when fewer than 2 services are available for reorder

Lifecycle:
- Initialize from `preferences.serviceOrder`
- Update optimistically during drag
- Persist immediately on drop
- Reconcile with returned preferences after save completes

---

## State Transitions

### Panel Health Summary

```text
No connected cards
  -> empty guidance

Connected cards loaded
  -> evaluate each dimension
     -> any <20% => danger summary
     -> else any 20-50% => warning summary
     -> else healthy summary

Refresh failure with cached items
  -> preserve last truthful dimension-derived summary
Refresh failure with no items
  -> empty/disconnected guidance
```

### Settings Persistence

```text
User edits non-proxy field
  -> optimistic UI update
  -> savePreferences(field patch)
     -> success => canonical preferences update + saved feedback
     -> failure => revert or reconcile using returned source-of-truth + error message

User edits proxy mode/url
  -> local draft update
  -> Apply clicked
     -> invalid URL => validation-error
     -> valid save => saved + optional Claude Code refresh
```

### Service Reordering

```text
Drag start
  -> draggedId set
Drag over target
  -> local orderedIds preview updates
Drop
  -> persist { serviceOrder }
     -> success => canonical preferences update
     -> failure => revert to last confirmed order and show error
```
