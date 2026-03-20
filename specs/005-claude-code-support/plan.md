# Implementation Plan: Claude Code Service Support

**Branch**: `005-claude-code-support` | **Date**: 2026-03-20 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/005-claude-code-support/spec.md`

## Summary

Add Claude Code (Max plan) quota display to the existing AIUsage desktop app, alongside the existing Codex integration. This requires a new Rust module that reads OAuth credentials from the host system and calls the Anthropic usage API, two new Tauri commands, two new user preference fields (menubar service selector and panel display order), and corresponding frontend updates for Settings UI and panel rendering order. All data flow remains host-only for credentials; the frontend receives only normalized quota state.

## Technical Context

**Language/Version**: Rust stable (edition 2021), TypeScript 5.x, Node.js 20 LTS
**Primary Dependencies**: Tauri 2, React 19, Tailwind CSS 4; `serde`, `serde_json` (existing); `ureq` + `chrono` + `sha2` (new additions)
**Storage**: Local preferences JSON file (extended with 2 new fields); macOS Keychain (read-only, via `security` CLI); `~/.claude/.credentials.json` (read-only)
**Testing**: Vitest + React Testing Library (frontend), `cargo test` (Rust unit tests)
**Target Platform**: macOS primary; Linux/Windows via file-based credential fallback
**Project Type**: Desktop app (macOS menu-bar agent, Tauri 2)
**Performance Goals**: Tray update < 3 seconds after preference change (SC-002); API calls no more frequent than configured refresh interval (default 15 min, SC-005)
**Constraints**: OAuth token re-read from host on every refresh (no in-app caching, FR-001); token never forwarded to frontend; HTTPS calls only from Rust backend
**Scale/Scope**: Single-user local app; 2 AI services after this feature (Codex + Claude Code)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### I. Host-Boundary Security — PASS

All credential reads (macOS Keychain via `security` CLI subprocess, `~/.claude/.credentials.json` file read) and the HTTPS call to `api.anthropic.com` are executed exclusively in `src-tauri/src/claude_code/mod.rs`. The OAuth token is never stored in app memory between refresh cycles, never logged, and never forwarded to the frontend. The frontend receives only normalized `CodexPanelState` (renamed `QuotaDimension` values with no raw credential data).

**Trusted boundary statement**: Rust backend → `load_claude_code_snapshot()` → normalized `ClaudeCodeSnapshot` → Tauri command serialization → TypeScript frontend.

**Explicit non-goals**: token refresh, re-authentication, token storage, transmission of raw OAuth tokens to any endpoint other than `api.anthropic.com`.

### II. Contract-First Desktop Surfaces — PASS

Contracts are defined in this plan before implementation begins:
- New commands `get_claude_code_panel_state` and `refresh_claude_code_panel_state` — documented in `contracts/tauri-commands.md`
- Two new `UserPreferences` fields (`menubarService`, `serviceOrder`) — documented in `data-model.md` and `contracts/tauri-commands.md`
- All panel, tray, and settings changes flow through the stable `CodexPanelState` / `UserPreferences` contract types

### III. Test-Gated Integration — PASS

Required tests before the new host payload shape is treated as stable:
- Rust unit tests in `claude_code/mod.rs`: token read path (env var, file), `utilization → remaining_percent` conversion, ISO 8601 → relative hint, null dimension filtering, auth-error vs transient-error state classification
- TypeScript contract test: `get_claude_code_panel_state` returns valid `CodexPanelState` shape
- Tray unit tests: `format_summary` with filtered items (menubar service selection)
- Preference backward-compatibility test: deserialize existing preferences JSON (without new fields) → defaults applied correctly

### IV. Truthful User States — PASS

Four distinct states are specified and must be rendered distinctly:
- `"fresh"` (connected, live data) — quota dimensions shown with green/amber/red progress bars
- `"stale"` (transient failure: 429, 5xx, timeout, DNS) — cached dimensions shown with stale indicator
- `"failed"` (auth failure: 401/403) — "not connected" card with login hint
- `"empty"` (no credentials found) — "not connected" card with setup hint

The tray never silently shows stale data when the selected menubar service is unavailable (FR-010).

### V. Local-First Incremental Delivery — PASS

Three independently shippable slices (aligned with spec user stories):
1. **P1** — Claude Code quota reading and panel display (new Rust module + Tauri command + frontend card). No preference changes needed. Delivers value standalone.
2. **P2** — Menubar service selector (2 new preference fields + settings UI + tray filter). Layered on top of P1.
3. **P3** — Panel display order (uses same `serviceOrder` preference from P2). Layered on top of P2.

New preference fields use `#[serde(default)]` — existing users' saved preferences deserialize cleanly.

## Project Structure

### Documentation (this feature)

```text
specs/005-claude-code-support/
├── spec.md                         # Feature specification
├── plan.md                         # This file
├── research.md                     # Phase 0 decisions
├── data-model.md                   # Entity definitions and state lifecycle
├── quickstart.md                   # Development and testing guide
├── contracts/
│   └── tauri-commands.md           # Tauri command contracts
├── checklists/
│   └── requirements.md             # Spec quality checklist
└── tasks.md                        # Task breakdown (output of /speckit.tasks)
```

### Source Code (repository root)

```text
src-tauri/
├── Cargo.toml                      # MODIFIED: add ureq, chrono, sha2
└── src/
    ├── claude_code/
    │   └── mod.rs                  # NEW: token reader, API client, snapshot builder
    ├── state/
    │   └── mod.rs                  # MODIFIED: add menubar_service, service_order to UserPreferences/PreferencePatch
    ├── commands/
    │   └── mod.rs                  # MODIFIED: add get/refresh_claude_code_panel_state; update save_preferences; update apply_display_mode call sites
    ├── tray/
    │   └── mod.rs                  # MODIFIED: filter items by menubar_service before format_summary
    └── lib.rs                      # MODIFIED: register new Tauri commands; declare claude_code module

src/
├── lib/tauri/
│   ├── contracts.ts                # MODIFIED: add menubarService, serviceOrder to UserPreferences/PreferencePatch
│   ├── client.ts                   # MODIFIED: add getClaudeCodePanelState, refreshClaudeCodePanelState; update mock switch
│   └── summary.ts                  # UNCHANGED (tray filtering handled in Rust)
├── app/shared/
│   ├── i18n.ts                     # MODIFIED: add menubarService, serviceOrder, claudeCode copy keys
│   └── appState.ts                 # MODIFIED: include claudeCodePanelState; combine for panel render
└── components/
    ├── settings/                   # MODIFIED: add menubar service picker + service order control
    └── panel/                      # MODIFIED: render service cards in serviceOrder, handle Claude Code not-connected state

tests/
├── contract/
│   └── claude-code-panel-state.test.ts   # NEW: contract test for get_claude_code_panel_state shape
└── unit/
    └── (existing tray/format-summary tests extended for menubar_service filtering)
```

**Structure Decision**: Single-project Tauri app. New functionality is additive — one new Rust module (`claude_code/`), extensions to existing modules, and frontend component updates. No new top-level packages or workspaces introduced.

## Phase 0: Research — Complete

See [research.md](./research.md) for full decision log. Summary of key decisions:

| Decision | Choice | Rationale |
|----------|--------|-----------|
| HTTP client (Rust) | `ureq` v2 (sync, lightweight) | Matches existing synchronous backend pattern; avoids tokio dependency |
| ISO 8601 parsing | `chrono` 0.4 | Standard crate; produces same relative-time strings as Codex path for i18n compatibility |
| macOS Keychain read | `std::process::Command` → `security` CLI | Consistent with existing `codex/mod.rs` pattern |
| Config dir hash | `sha2` 0.10 | Needed for non-default `CLAUDE_CONFIG_DIR` keychain service name suffix |
| `ClaudeCodeSnapshot` type | Type alias for `CodexSnapshot` | Identical fields; avoids code duplication |
| Multi-service architecture | Separate commands per service | Preserves existing Codex command intact; frontend composes display |
| Preference backward-compat | `#[serde(default)]` on new fields | Existing preference files deserialize cleanly; defaults: `"codex"` / `["codex","claude-code"]` |

## Phase 1: Design & Contracts — Complete

Artifacts produced:
- **[data-model.md](./data-model.md)**: All entity definitions, field semantics, state lifecycle diagram
- **[contracts/tauri-commands.md](./contracts/tauri-commands.md)**: Full contract for 2 new commands + `save_preferences` extension
- **[quickstart.md](./quickstart.md)**: Development, testing, and verification guide
