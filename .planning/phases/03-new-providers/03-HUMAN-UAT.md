---
status: complete
phase: 03-new-providers
source: [03-VERIFICATION.md]
started: 2026-04-01T12:32:52Z
updated: 2026-04-01T13:19:47Z
---

## Current Test

[testing complete]

## Tests

### 1. Service-Order Redesign On Real Menubar Surface
expected: The service-order block reads as a deliberate sortable list, with no label overlap, clipped rows, or cramped wrapped-chip appearance, in both zh-CN and en-US.
result: pass

### 2. Kimi Live Runtime
expected: The panel shows quota cards or a clear placeholder state, never a blank Kimi section.
result: pass

### 3. GLM Live Runtime
expected: The panel shows quota cards or a clear placeholder state, never a blank GLM section; remaining percentage is sensible.
result: pass

### 4. Token Save/Clear Refresh Loop
expected: The provider refreshes immediately after each change and the panel moves between live data and token-not-configured placeholder without manual refresh.
result: pass

### 5. Reset Countdown Presentation
expected: Kimi/GLM and the existing providers show the same relative reset style, with precise countdowns like `2h 08m` or `2d 05h` instead of raw ISO strings.
result: pass

### 6. Main Menu Reopen Responsiveness
expected: Reopening the main menu is immediately interactive; no scroll is required to unfreeze the surface.
result: pass

## Summary

total: 6
passed: 6
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps
