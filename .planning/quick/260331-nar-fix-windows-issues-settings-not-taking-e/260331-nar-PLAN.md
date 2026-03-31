---
phase: quick
plan: 260331-nar
type: execute
wave: 1
depends_on: []
files_modified:
  - src-tauri/src/tray/mod.rs
  - src-tauri/src/codex/mod.rs
autonomous: true
must_haves:
  truths:
    - "Popup window is positioned correctly on Windows (not just shown at default coordinates)"
    - "Settings/preferences persist to the correct path on Windows even when APPDATA is unset"
  artifacts:
    - path: "src-tauri/src/tray/mod.rs"
      provides: "Cross-platform popover placement"
      contains: "apply_popover_placement"
    - path: "src-tauri/src/codex/mod.rs"
      provides: "Windows storage path with USERPROFILE fallback"
      contains: "USERPROFILE"
  key_links:
    - from: "src-tauri/src/tray/mod.rs"
      to: "apply_popover_placement"
      via: "function call without cfg gate"
      pattern: "apply_popover_placement\\(app"
---

<objective>
Fix two Windows-specific bugs (GitHub #3):
1. Popup window not positioned on Windows because `apply_popover_placement` is gated behind `#[cfg(target_os = "macos")]`
2. Settings not persisting on Windows when `APPDATA` env var is unset — no `USERPROFILE` fallback

Purpose: Make the app functional on Windows (positioning + persistence)
Output: Two targeted Rust fixes in tray/mod.rs and codex/mod.rs
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@src-tauri/src/tray/mod.rs
@src-tauri/src/codex/mod.rs
</context>

<tasks>

<task type="auto">
  <name>Task 1: Remove macOS-only gate on popover placement</name>
  <files>src-tauri/src/tray/mod.rs</files>
  <action>
In `toggle_main_window_with_event` (around line 961), remove the `#[cfg(target_os = "macos")]` attribute before `apply_popover_placement(app, &window, tray_rect, event_position);`.

The `apply_popover_placement` function (lines 393-421) uses only cross-platform Tauri APIs (`available_monitors`, `set_position`, `PhysicalPosition`) — no macOS-specific calls. It is safe to run on all platforms.

After the change, lines 960-962 should look like:
```rust
        } else {
            apply_popover_placement(app, &window, tray_rect, event_position);
            let _ = window.show();
```
  </action>
  <verify>
    <automated>cd /Users/chasewang/01workspace/projects/ai-usage && cargo check 2>&1 | tail -5</automated>
  </verify>
  <done>The `#[cfg(target_os = "macos")]` gate is removed. `apply_popover_placement` is called unconditionally on all platforms. `cargo check` passes.</done>
</task>

<task type="auto">
  <name>Task 2: Add USERPROFILE fallback for Windows storage path</name>
  <files>src-tauri/src/codex/mod.rs</files>
  <action>
In `storage_path()` (line 553), expand the Windows cfg block to add a `USERPROFILE` fallback after the `APPDATA` check. The Windows block should become:

```rust
#[cfg(target_os = "windows")]
{
    if let Ok(appdata) = env::var("APPDATA") {
        return PathBuf::from(appdata)
            .join("ai-usage")
            .join("codex-accounts.json");
    }
    if let Ok(userprofile) = env::var("USERPROFILE") {
        return PathBuf::from(userprofile)
            .join("AppData")
            .join("Roaming")
            .join("ai-usage")
            .join("codex-accounts.json");
    }
}
```

This ensures that on Windows, if `APPDATA` is not set (uncommon but possible), the function falls back to `USERPROFILE\AppData\Roaming\ai-usage\codex-accounts.json` before falling through to the generic `HOME` fallback (which also doesn't exist on most Windows systems).

No change needed to `preferences_path()` — it derives from `storage_path()` via `set_file_name`, so it automatically benefits from this fix.
  </action>
  <verify>
    <automated>cd /Users/chasewang/01workspace/projects/ai-usage && cargo check 2>&1 | tail -5</automated>
  </verify>
  <done>`storage_path()` Windows block checks APPDATA then USERPROFILE before falling through. `cargo check` passes. `preferences_path()` inherits the fix automatically.</done>
</task>

</tasks>

<verification>
- `cargo check` passes with no errors or warnings on the modified files
- `grep -n "cfg(target_os" src-tauri/src/tray/mod.rs` no longer shows a macOS gate on the `apply_popover_placement` call line
- `grep -n "USERPROFILE" src-tauri/src/codex/mod.rs` shows the new fallback in `storage_path()`
</verification>

<success_criteria>
1. `apply_popover_placement` is called on all platforms (no cfg gate)
2. Windows storage path has APPDATA -> USERPROFILE -> HOME fallback chain
3. `cargo check` passes cleanly
</success_criteria>

<output>
After completion, create `.planning/quick/260331-nar-fix-windows-issues-settings-not-taking-e/260331-nar-SUMMARY.md`
</output>
