---
status: diagnosed
phase: 01-provider-registry
source: [01-01-SUMMARY.md, 01-02-SUMMARY.md]
started: 2026-03-31T04:00:00Z
updated: 2026-03-31T04:25:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Codex Quota Display Unchanged
expected: Launch the app. Codex panel shows quota dimensions with progress bars, remaining percentages, reset hints, and threshold-based coloring (green/amber/red) — identical to before the refactor.
result: pass

### 2. Claude Code Quota Display Unchanged
expected: With Claude Code enabled, its panel shows quota dimensions with progress bars and remaining percentages — identical to before the refactor.
result: pass

### 3. Service Enable/Disable Toggle
expected: In Settings, toggle Claude Code usage on/off. The panel immediately reflects the change — toggling off removes Claude Code from the panel; toggling on brings it back with cached or refreshed data.
result: issue
reported: "the claude code on/off button is clicked, but still shown as off. but claude code usage is always shown on the panel."
severity: major
root_cause: |
  Three interconnected defects:
  1. SettingsView toggle reads/writes legacy `claudeCodeUsageEnabled` instead of `providerEnabled["claude-code"]`
  2. `claudeCodeUsageEnabled` has `skip_serializing` — never persisted, always defaults to `false` on restart
  3. `getVisibleServiceScope()` gives legacy field unconditional priority over `providerEnabled`
  4. Rust `PreferencePatch` struct missing `provider_enabled` field — patches are silently dropped
  5. Backend uses `providerEnabled` (persisted) for data serving, creating inconsistency with frontend
artifacts:
  - src/app/settings/SettingsView.tsx (line 676-682)
  - src-tauri/src/state/mod.rs (line 188, lines 196-212)
  - src/lib/tauri/summary.ts (lines 47-49)
  - src-tauri/src/commands/mod.rs (lines 161-165)

### 4. Menubar Tray Summary
expected: The menubar tray icon and summary text show the correct service status. If "auto" mode is selected, the tray reflects the most recently active service. Manual service selection still works.
result: pass

### 5. Service Order Preserved
expected: If you previously customized the panel display order (e.g., Claude Code before Codex), that order is preserved after the update. The settings panel shows the same order you configured before.
result: pass

### 6. App Builds and Starts Without Errors
expected: Run `npm run tauri:dev`. The app starts without Rust compilation errors or TypeScript type errors. The main window opens and shows the panel view.
result: pass

## Summary

total: 6
passed: 5
issues: 1
pending: 0
skipped: 0
blocked: 0

## Gaps

- truth: "Toggle Claude Code usage on/off in Settings. The panel immediately reflects the change."
  status: failed
  reason: "User reported: the claude code on/off button is clicked, but still shown as off. but claude code usage is always shown on the panel."
  severity: major
  test: 3
  root_cause: "SettingsView writes legacy claudeCodeUsageEnabled (skip_serializing, never persisted); getVisibleServiceScope gives legacy field priority; PreferencePatch missing provider_enabled field"
  artifacts:
    - src/app/settings/SettingsView.tsx
    - src-tauri/src/state/mod.rs
    - src/lib/tauri/summary.ts
    - src-tauri/src/commands/mod.rs
  missing:
    - "provider_enabled field in PreferencePatch struct"
    - "providerEnabled read/write in SettingsView toggle"
    - "providerEnabled priority in getVisibleServiceScope"
