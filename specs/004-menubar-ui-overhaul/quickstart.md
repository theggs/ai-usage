# Quickstart: Menubar UI/UX Overhaul

## Goal

Validate the menubar popover behavior, compact quota-focused panel layout, complete localization, and visible action feedback introduced by feature `004-menubar-ui-overhaul`.

## Prerequisites

- Node.js 20 LTS installed
- Rust stable toolchain installed
- Tauri desktop dependencies available for local development
- A readable local Codex CLI session is optional but helpful for validating fresh-state rendering

## Implementation Flow

1. Start the frontend and Tauri shell in development mode.
2. Verify tray-click toggle, close-to-hide, and blur-to-hide behavior on macOS.
3. Validate the compact panel layout with representative fresh, stale, failed, and empty states.
4. Switch between `zh-CN` and `en-US` to confirm all visible copy changes together.
5. Exercise settings save, autostart toggle, and notification test flows to confirm inline feedback placement.

## Commands

```bash
npm test
cargo test
npm run tauri:dev
```

## Manual Verification Checklist

### Panel behavior

1. Click the tray icon and confirm the window opens in a compact popover-sized layout.
2. Click the tray icon again and confirm the same window hides without quitting the app.
3. Reopen the panel, click the red close button, and confirm the process remains alive and the tray icon stays visible.
4. Reopen the panel, click outside the window or switch apps, and confirm the panel hides automatically.
5. Reopen the panel and confirm the previous panel content is still available without restarting the app.

### Main panel readability

1. Confirm the main panel shows only header, quota cards, one status row, and refresh action.
2. Confirm a `0%` quota row renders an empty bar with danger color (not muted/unknown).
3. Confirm a `2%` quota row renders a danger-colored progress bar.
4. Confirm a `20%` quota row renders at the warning/danger boundary (warning color).
5. Confirm a `35%` quota row renders a warning-colored progress bar.
6. Confirm a `50%` quota row renders at the warning/healthy boundary (warning color).
7. Confirm an `80%` quota row renders a healthy-colored progress bar.
8. Confirm a `100%` quota row renders a fully filled healthy-colored progress bar.
9. Confirm a missing `remainingPercent` renders a muted placeholder instead of a red empty bar.
10. Confirm all card corners use consistent border-radius (12-16px), no oversized decorative rounding.

### Settings and localization

1. Switch language to Chinese and confirm there is no English text in settings sections, labels, helper copy, or quota labels.
2. Switch language back to English and confirm no Chinese text remains.
3. Save preferences and confirm success feedback appears next to the save area without scrolling.
4. Trigger a notification test and confirm feedback appears in its own action section.
5. Toggle autostart and confirm the control uses switch styling rather than a plain checkbox.
6. Confirm the settings view keeps the Codex CLI metadata section while the main panel no longer shows those extra metadata blocks.

## Regression Focus

- Tray summary text still updates from the current quota items
- Existing panel data remains visible during refresh rather than flashing empty
- Panel content scrolls vertically instead of overflowing when settings content grows
- Existing `npm test` and `cargo test` suites continue to pass after the layout and host-window changes
