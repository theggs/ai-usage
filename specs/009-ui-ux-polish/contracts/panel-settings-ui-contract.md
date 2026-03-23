# UI Contract: Panel and Settings Polish

**Feature**: 009-ui-ux-polish  
**Date**: 2026-03-23

This document defines the stable UI behavior contract for the polished panel and settings surfaces. The underlying host contracts remain `CodexPanelState`, `PanelPlaceholderItem`, `QuotaDimension`, `UserPreferences`, and `PreferencePatch`.

---

## 1. Panel Header Contract

### Inputs

- Visible service cards derived from `preferences.serviceOrder`
- Each card's `quotaDimensions`
- Service placeholder state when a service has no connected items

### Behavior

- The sticky header MUST show exactly one health summary line instead of the current generic title.
- The summary MUST represent the most urgent visible condition.
- Priority order:
  1. No connected services -> setup/disconnected guidance
  2. Lowest remaining danger dimension (`remainingPercent < 20`)
  3. Lowest remaining warning dimension (`20 <= remainingPercent <= 50`)
  4. Healthy summary when all visible dimensions are above 50

### Output shape

```ts
interface HeaderSummaryRender {
  tone: "healthy" | "warning" | "danger" | "empty";
  text: string;
}
```

### Examples

| Input condition | Output tone | Example text |
|----------------|-------------|--------------|
| No connected services | `empty` | `尚未连接任何服务` |
| Claude Code week at 39% | `warning` | `Claude Code 每周额度偏低` |
| Codex 5h at 12% | `danger` | `Codex 5 小时窗口余量紧张` |
| All dimensions > 50% | `healthy` | `所有服务正常` |

---

## 2. Service Card Contract

### Visual urgency

- Cards with any warning dimension MUST show a warning accent.
- Cards with any danger dimension MUST show a danger accent stronger than warning.
- Cards with only healthy/unknown dimensions MUST use the neutral card style.

### Badge behavior

- Normal connected cards MUST NOT render the current `Live/实时` badge.
- Badges MAY render only for abnormal, stale, failed, recovery, or offline-like states.

### Quota row behavior

- Progress tracks MUST be at least 20px tall.
- Percent values MUST be visually emphasized and remain visible inside the bar or immediately adjacent in a stronger style.
- Warning and danger percentage text MUST use the same severity color family as the progress bar.
- Dimension labels MUST use user-friendly names:
  - `5h` -> `5 小时窗口` / `5-hour window`
  - `week` -> `每周额度` / `Weekly quota`

### Refresh-time behavior

- If all connected service cards share the same refresh timestamp, cards MUST suppress individual "last refreshed" lines and the panel footer MUST show one global refresh label.
- If refresh timestamps differ across cards, each affected card MAY render its own relative refresh label.

---

## 3. Relative Time Contract

### Inputs

- ISO timestamp or seconds-based timestamp from `lastRefreshedAt`

### Render rules

- Primary display MUST be relative time.
- Tooltip/title MUST expose the absolute localized timestamp.
- Refresh cadence MUST be at most every 30 seconds unless new data arrives sooner.

### Example outputs

| Age | zh-CN | en-US |
|-----|-------|-------|
| < 60s | `刚刚` | `Just now` |
| 3 min | `3 分钟前` | `3 minutes ago` |
| 2 hr | `2 小时前` | `2 hours ago` |

---

## 4. Settings Persistence Contract

### Immediate-save fields

The following settings MUST persist immediately when changed:

- `language`
- `refreshIntervalMinutes`
- `traySummaryMode`
- `autostartEnabled`
- `menubarService`
- `serviceOrder`

### Explicit-apply fields

The following settings MUST remain on an explicit apply path:

- `networkProxyMode`
- `networkProxyUrl`

### Error behavior

- Invalid manual proxy URLs MUST block apply and render inline validation feedback.
- Failed immediate-save actions MUST surface an inline error and keep the UI truthful about whether the value was persisted.

### Removed behavior

- The generic "save preferences" action MUST NOT appear once immediate-save is implemented.

---

## 5. Settings Layout Contract

- Settings MUST be grouped by logic, not as one undifferentiated stack.
- The first viewport in a 620px-high panel MUST include the highest-frequency controls.
- The settings back button MUST include a directional arrow icon preceding the text label.
- Codex CLI information MUST render as informational status content, visually distinct from editable settings.
- Notification test action MUST render with lower emphasis than primary/confirm actions.

---

## 6. Service Reorder Contract

### Interaction

- Each service row MUST display a grip affordance.
- With 2 or more services, rows MUST support drag reorder.
- With only 1 service, the grip remains visible but disabled.

### Persistence

- Drop completion MUST trigger immediate persistence of `serviceOrder`.
- Returning to the panel MUST reflect the new order without additional save action.

### Fallback

- Unknown service IDs in persisted order MUST be ignored gracefully.
- Known services missing from persisted order MUST still appear once using a deterministic fallback order.

---

## 7. Motion Contract

- Refresh button MUST animate while refresh is in flight.
- Refresh failure MUST stop the spin and show a brief failure cue before returning to idle styling.
- Panel -> settings transition MUST use a right-to-left slide.
- Settings -> panel transition MUST use a left-to-right slide.
- Sticky header MUST gain a visible separator when content scrolls under it.
- Progress-width changes MUST animate with a visible but short transition.
