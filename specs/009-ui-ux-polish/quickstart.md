# Quickstart: UI/UX 视觉层级与交互优化

**Feature**: 009-ui-ux-polish  
**Date**: 2026-03-23

## Prerequisites

- Node.js 20 LTS via `nvm use`
- Rust stable toolchain for Tauri shell verification
- Existing local Codex / Claude Code setup if you want to validate real service states

## Development Workflow

```bash
# Frontend + Tauri shell
npm run tauri:dev

# Frontend unit/integration tests
npx vitest run

# Targeted E2E shell checks
node tests/e2e/tray-panel.spec.mjs
node tests/e2e/screenshot-review.mjs
```

## Implementation Checkpoints

### 1. Panel hierarchy

1. Open the panel with at least one warning-state service.
2. Confirm the header shows a health summary rather than a generic title.
3. Confirm the most urgent card is visually elevated.
4. Confirm progress bars are at least 20px tall and percentage text is emphasized.

### 2. Relative time and redundancy

1. Confirm refresh labels render as relative time.
2. Hover the label and confirm the absolute timestamp is still available.
3. If all services refreshed together, confirm only one global refresh label appears.

### 3. Immediate-save settings

1. Open settings.
2. Change language and confirm copy updates immediately.
3. Change refresh interval and confirm no global save button is required.
4. Change tray summary or menubar service and confirm the update persists without extra action.

### 4. Proxy exception path

1. Switch proxy mode to manual.
2. Enter an invalid URL and press apply.
3. Confirm inline validation is shown and no save occurs.
4. Enter a valid URL, apply, and confirm Claude Code refreshes through the existing flow.

### 5. Drag reorder

1. Drag a service row to a new position in settings.
2. Leave settings and confirm the panel order matches immediately.
3. Reopen the app and confirm the order persisted.

### 6. Micro-interactions

1. Trigger refresh and confirm the icon spins during the request.
2. Force or simulate a refresh failure and confirm the spin stops cleanly.
3. Navigate panel <-> settings and confirm slide transitions render in the correct direction.
4. Scroll panel content and confirm the sticky header gains a separator.

## Files Most Likely to Change

| File | Expected change |
|------|-----------------|
| `src/app/shell/AppShell.tsx` | Header summary slot, view transition state, refresh feedback |
| `src/app/panel/PanelView.tsx` | Health-summary derivation, global refresh label, placeholder handling |
| `src/components/panel/ServiceCard.tsx` | Card alert styling, badge suppression, timestamp rendering |
| `src/components/panel/QuotaSummary.tsx` | Larger progress bars, embedded/emphasized percentage, label mapping |
| `src/app/settings/SettingsView.tsx` | Auto-save flow, grouped sections, drag reorder, proxy-only apply |
| `src/app/shared/i18n.ts` | New summary, label, relative-time, and feedback copy |
| `src/lib/tauri/summary.ts` | Shared urgency helpers / header summary support if colocated here |
| `tests/e2e/tray-panel.spec.mjs` | Transition, refresh, and settings interaction checks |

## Regression Focus

- Normal, stale, failed, and empty states remain visually distinct
- Proxy validation is not accidentally converted to auto-save
- Service order persists correctly through preference storage
- Motion stays subtle and does not break the 360x620 layout
