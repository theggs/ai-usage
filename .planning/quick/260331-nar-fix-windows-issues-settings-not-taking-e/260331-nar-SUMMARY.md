---
phase: quick
plan: 260331-nar
subsystem: desktop-shell
tags: [windows, cross-platform, bug-fix]
dependency_graph:
  requires: []
  provides: [windows-popover-placement, windows-storage-fallback]
  affects: [tray-popover, preferences-persistence]
tech_stack:
  added: []
  patterns: [env-var-fallback-chain]
key_files:
  created: []
  modified:
    - src-tauri/src/tray/mod.rs
    - src-tauri/src/codex/mod.rs
decisions:
  - apply_popover_placement uses only cross-platform Tauri APIs, safe to call unconditionally
  - USERPROFILE fallback mirrors APPDATA/Roaming path convention on Windows
metrics:
  duration: 1m
  completed: "2026-03-31T08:53:15Z"
---

# Quick Task 260331-nar: Fix Windows Issues - Settings Not Taking Effect

Cross-platform popover placement and USERPROFILE storage fallback for Windows

## What Changed

### Task 1: Remove macOS-only gate on popover placement (17f8675)

Removed `#[cfg(target_os = "macos")]` attribute from the `apply_popover_placement` call in `toggle_main_window_with_event`. The function uses only cross-platform Tauri APIs (`available_monitors`, `set_position`, `PhysicalPosition`), so the gate was unnecessarily restricting it to macOS. The popup window will now be correctly positioned on Windows.

**Files modified:** `src-tauri/src/tray/mod.rs`

### Task 2: Add USERPROFILE fallback for Windows storage path (a6c3907)

Added a `USERPROFILE` environment variable fallback in the `storage_path()` function's Windows block. The fallback chain is now: `APPDATA` -> `USERPROFILE\AppData\Roaming` -> `HOME`. This handles the edge case where `APPDATA` is unset on Windows. `preferences_path()` inherits the fix automatically since it derives from `storage_path()` via `set_file_name`.

**Files modified:** `src-tauri/src/codex/mod.rs`

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None.

## Commits

| Task | Commit | Message |
|------|--------|---------|
| 1 | 17f8675 | fix(260331-nar): remove macOS-only gate on popover placement |
| 2 | a6c3907 | fix(260331-nar): add USERPROFILE fallback for Windows storage path |

## Verification

- `cargo check` passes cleanly after both changes
- No `cfg(target_os = "macos")` gate on the `apply_popover_placement` call line
- `USERPROFILE` fallback present in `storage_path()` Windows block
