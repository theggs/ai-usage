---
status: complete
phase: 03-new-providers
source: [03-04-SUMMARY.md]
started: 2026-04-01T09:14:06Z
updated: 2026-04-01T12:04:12Z
---

## Current Test

[testing complete]

## Tests

### 1. Service Order Capsules Wrap Cleanly
expected: Open Settings and find the service display order row. With all four providers visible, the capsule list should stay inside the value column instead of overflowing into the row label area. The first capsule should not overlap "Display order" / "显示顺序", and extra capsules should wrap to a new line cleanly if needed.
result: issue
reported: "passed. But it looks ugly. It need a redesign."
severity: cosmetic

### 2. Saving Valid Token Auto-Refreshes Quota Card
expected: Enter a valid Kimi Code or GLM Coding Plan token in Settings, save, and return to the panel. Without clicking manual refresh, the provider card should automatically refresh and show live quota data instead of the previous stale state.
result: pass

### 3. Clearing Token Auto-Refreshes to Token Not Configured
expected: Start from a provider card that currently shows quota data or an auth error. Clear that provider token in Settings, save, and return to the panel. Without clicking manual refresh, the card should automatically change to "Token not configured" / "未配置 Token" instead of keeping the stale status.
result: pass

### 4. Invalid Token Auto-Refreshes Error State
expected: Enter an invalid or expired Kimi Code or GLM Coding Plan token in Settings, save, and return to the panel. Without clicking manual refresh, the provider card should automatically refresh into an error state instead of keeping the previous stale status.
result: pass

## Summary

total: 4
passed: 3
issues: 1
pending: 0
skipped: 0
blocked: 0

## Gaps
- truth: "Open Settings and find the service display order row. With all four providers visible, the capsule list should stay inside the value column instead of overflowing into the row label area. The first capsule should not overlap \"Display order\" / \"显示顺序\", and extra capsules should wrap to a new line cleanly if needed."
  status: failed
  reason: "User reported: passed. But it looks ugly. It need a redesign."
  severity: cosmetic
  test: 1
  artifacts: []
  missing: []
