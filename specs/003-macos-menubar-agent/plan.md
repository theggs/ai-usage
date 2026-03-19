# Implementation Plan: macOS Menu Bar Agent Mode

**Branch**: `003-macos-menubar-agent` | **Date**: 2026-03-19 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/003-macos-menubar-agent/spec.md`

## Summary

AIUsage 在 dev 模式下 Dock 图标仍然出现，这是因为 `tauri dev` 不走完整的 app bundle 流程，Info.plist 不会被 macOS 读取。用户确认 **dev 模式下 Dock 图标可以接受**，只需确保生产构建正确隐藏即可。方案：在 `tauri.conf.json` 中显式引用 `Info.plist` 路径，确保生产 bundle 合并 `LSUIElement=true`。

## Technical Context

**Language/Version**: Rust (edition 2021), TypeScript/React 19
**Primary Dependencies**: Tauri 2.0.0, tauri-build 2.0.0
**Storage**: N/A
**Testing**: Vitest (frontend), cargo test (Rust)
**Target Platform**: macOS (primary), Linux/Windows (no regression)
**Project Type**: Desktop tray-first app
**Performance Goals**: N/A (configuration change)
**Constraints**: 仅需在生产构建中生效，dev 模式下 Dock 图标可接受
**Scale/Scope**: 1 file modified, 0 new dependencies

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Host-Boundary Security | ✅ PASS | Dock hiding is an OS-level host operation, no frontend involvement |
| II. Contract-First Desktop Surfaces | ✅ PASS | No new host-to-UI contract needed; tray behavior unchanged |
| III. Test-Gated Integration | ✅ PASS | Configuration-only change; existing tests cover tray behavior |
| IV. Truthful User States | ✅ PASS | No user state affected |
| V. Local-First Incremental Delivery | ✅ PASS | Standalone change, no cloud dependency |

## Implementation

### Step 1: Explicitly reference Info.plist in tauri.conf.json

**File**: `src-tauri/tauri.conf.json`

Add `macOS.infoPlist` path to `bundle` section to ensure Tauri merges the custom plist into the production `.app` bundle:

```json
"bundle": {
  "active": false,
  "targets": "all",
  "macOS": {
    "infoPlist": "Info.plist"
  }
}
```

Tauri 2.0 的 `infoPlist` 接受一个文件路径字符串，会将该 plist 与默认生成的 Info.plist 合并。虽然文档称会自动检测同目录的 `Info.plist`，但显式配置更可靠。

### Step 2: 保留已有 Info.plist

**File**: `src-tauri/Info.plist` (已存在，无需修改)

已包含 `LSUIElement: true`，在生产构建时会被合并到 app bundle 的 Info.plist 中，使 macOS 将应用视为后台 UI Element Agent。

## Project Structure

### Source Code (modified files)

```text
src-tauri/
├── tauri.conf.json     # Step 1: add bundle.macOS.infoPlist path
└── Info.plist           # Already exists, no change
```

## Verification

1. `cargo test` — all 11 Rust tests pass (no regression)
2. `npm test` — all 21 frontend tests pass (no regression)
3. `npm run tauri build` on macOS — 检查生成的 `.app` bundle:
   - 打开 `target/release/bundle/macos/AIUsage.app/Contents/Info.plist`，确认包含 `LSUIElement: true`
   - 双击运行 `.app`，确认无 Dock 图标、无终端窗口
   - 确认 tray 交互正常

## Complexity Tracking

No constitution violations to justify.
