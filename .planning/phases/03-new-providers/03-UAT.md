---
status: complete
phase: 03-new-providers
source: [03-04-SUMMARY.md, 03-05-SUMMARY.md]
started: 2026-04-01T09:14:06Z
updated: 2026-04-01T13:19:47Z
---

## Current Test

[testing complete]

## Tests

### 1. Service Order Capsules Wrap Cleanly
expected: Open Settings and find the service display order row. With all four providers visible, the capsule list should stay inside the value column instead of overflowing into the row label area. The first capsule should not overlap "Display order" / "显示顺序", and extra capsules should wrap to a new line cleanly if needed.
result: pass
note: "Initial UAT found this visually weak; 03-05 redesigned service order into a multiline full-width sortable list, and the user approved the final result."

### 2. Saving Valid Token Auto-Refreshes Quota Card
expected: Enter a valid Kimi Code or GLM Coding Plan token in Settings, save, and return to the panel. Without clicking manual refresh, the provider card should automatically refresh and show live quota data instead of the previous stale state.
result: pass

### 3. Clearing Token Auto-Refreshes to Token Not Configured
expected: Start from a provider card that currently shows quota data or an auth error. Clear that provider token in Settings, save, and return to the panel. Without clicking manual refresh, the card should automatically change to "Token not configured" / "未配置 Token" instead of keeping the stale status.
result: pass

### 4. Invalid Token Auto-Refreshes Error State
expected: Enter an invalid or expired Kimi Code or GLM Coding Plan token in Settings, save, and return to the panel. Without clicking manual refresh, the provider card should automatically refresh into an error state instead of keeping the previous stale status.
result: pass

### 5. Reset Countdown Uses UI Formatting Instead of Raw ISO
expected: Provider cards show localized relative reset countdowns with useful precision, rather than raw ISO timestamps.
result: pass
note: "Final implementation keeps raw `resetsAt` in data and formats the display in the UI."

### 6. Main Menu Reopens Without Frozen Surface
expected: When the main window is shown again, the panel is immediately interactive and does not require a scroll to repaint.
result: pass

## Summary

total: 6
passed: 6
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps
