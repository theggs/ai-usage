# Research: macOS Menu Bar Agent Mode

**Feature**: 003-macos-menubar-agent | **Date**: 2026-03-19

## R1: Why Info.plist LSUIElement alone doesn't hide Dock icon

**Decision**: Use programmatic `NSApplication.setActivationPolicy(.accessory)` as primary mechanism.

**Rationale**:
- `LSUIElement` in Info.plist is only read by macOS when launching a `.app` bundle
- During `tauri dev`, the binary may run without a proper app bundle, so the plist is ignored
- `bundle.active: false` in tauri.conf.json means Tauri doesn't produce a full bundle during development
- The Tauri 2.0 auto-detection of `Info.plist` in `src-tauri/` may only apply during bundle generation, not dev mode

**Alternatives considered**:
- Info.plist only → doesn't work in dev mode
- `bundle.active: true` → changes build behavior, not desirable just for this fix
- Environment variable / launch flag → fragile, user-facing complexity

## R2: Best approach for programmatic Dock hiding in Rust/Tauri

**Decision**: Use `objc2-app-kit` crate with `NSApplication::setActivationPolicy(.Accessory)`.

**Rationale**:
- `objc2` is the modern, safe Rust binding for Apple frameworks (replaces legacy `objc` crate)
- `NSApplicationActivationPolicy::Accessory` is the exact equivalent of `LSUIElement = true`
- Can be called early in app startup, before any window is shown
- Conditional compilation (`#[cfg(target_os = "macos")]`) ensures zero impact on other platforms

**Alternatives considered**:
- Raw `objc` crate FFI → works but `objc2` is safer and more idiomatic
- `cocoa` crate → deprecated in favor of `objc2-app-kit`
- Tauri plugin → none exists for this specific use case

## R3: Correct objc2 crate versions and features

**Decision**: Use `objc2 0.6` + `objc2-app-kit 0.3` with features `["NSApplication", "NSRunningApplication"]`.

**Rationale**:
- These are the latest stable versions as of 2026-03
- `NSApplication` feature provides `sharedApplication()` and `setActivationPolicy()`
- `NSRunningApplication` feature provides the `NSApplicationActivationPolicy` enum
- macOS-only conditional dependency keeps other platform builds clean
