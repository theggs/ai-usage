# Implementation Plan: Claude Code Session Recovery

**Branch**: `007-session-recovery` | **Date**: 2026-03-22 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/007-session-recovery/spec.md`

## Summary

When the Claude Code API returns HTTP 401 (expired token), the app currently clears cached quota data and shows a technical error with no automatic recovery path. This feature remodels 401 as a transient "session recovery" state: the cache is preserved, automatic refresh continues unblocked at the existing interval, and the user sees product-language messaging instead of technical jargon. Recovery happens automatically once Claude Code refreshes the local token.

Additionally, snapshot data is now persisted to disk so that restarts (including dev hot-reloads) can reuse recent data without re-fetching. On startup, if the persisted data is within the configured refresh interval, the cached snapshot is returned directly. This prevents unnecessary API calls that can trigger 429 rate limiting during development, and improves cold-start UX by showing data immediately. This rule applies to all AI services.

## Technical Context

**Language/Version**: Rust stable (edition 2021), TypeScript 5.x
**Primary Dependencies**: Tauri 2, React 19, ureq (HTTP), serde (serialization)
**Storage**: In-memory `Mutex<PauseState>` singleton + in-memory stale cache + disk-persisted snapshot cache (`snapshot-cache.json`)
**Testing**: `cargo test` (Rust unit tests), `npm test` / Vitest (frontend)
**Target Platform**: macOS 13+, Windows 10 22H2+
**Project Type**: Desktop app (Tauri menubar agent)
**Performance Goals**: N/A — single-user desktop app, no latency-sensitive paths affected
**Constraints**: No new timers or frontend effects; reuse existing refresh interval as recovery probe and startup cache freshness check
**Scale/Scope**: Single Claude Code integration per app instance; ~4 files modified

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Rationale |
|-----------|--------|-----------|
| I. Host-Boundary Security | PASS | No new credential paths introduced. The change is entirely within the existing host-layer `claude_code/mod.rs`. No secrets cross to the frontend. The trusted boundary is unchanged. |
| II. Contract-First Desktop Surfaces | PASS | The host-to-UI contract (`ClaudeCodeSnapshot` / `CodexPanelState`) is unchanged in shape. Only the *values* within `snapshot_state`, `connection_state`, and `status_message` change for 401 scenarios. No new fields, commands, or payload shapes. |
| III. Test-Gated Integration | PASS | Existing `cargo test` suite covers 401 handling. New/updated unit tests will validate: (a) cache preservation on 401, (b) `PauseState::SessionRecovery` behavior, (c) auto-refresh not blocked. Frontend i18n mapping will be validated via existing Vitest patterns. |
| IV. Truthful User States | PASS | This is the primary motivation. The current behavior violates this principle by showing a blank failed state when the truth is "session is recoverable." The fix introduces a truthful `stale` + recovery-message state that accurately represents the transient condition. |
| V. Local-First Incremental Delivery | PASS | Fully local change. No cloud infrastructure. Independently testable and valuable. Preserves existing settings, contracts, and upgrade paths. |

**Security & Quality Gates:**
- No new credential paths or sensitive data flows — non-goal statement: this feature does NOT handle token refresh; it only changes how the app reacts to an expired token.
- Empty state (no cache + 401) and stale state (cache + 401) are both explicitly defined in the spec.
- No persistent data model changes — PauseState is in-memory only.

## Project Structure

### Documentation (this feature)

```text
specs/007-session-recovery/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
└── tasks.md             # Phase 2 output (created by /speckit.tasks)
```

### Source Code (repository root)

```text
src-tauri/src/
├── commands/
│   └── mod.rs           # Snapshot cache read/write; freshness guard on get_* commands
└── claude_code/
    └── mod.rs           # PauseState enum, 401 handler, snapshot logic

src/app/
├── shared/
│   └── i18n.ts          # New session-recovery localized messages
└── panel/
    └── PanelView.tsx    # Placeholder message detection for recovery state
```

**Structure Decision**: One new file on disk (`snapshot-cache.json` alongside `preferences.json` in the app data directory). All code changes are modifications to existing files. The snapshot cache is managed in `commands/mod.rs` because it is a cross-cutting concern across both Codex and Claude Code services.

## Complexity Tracking

No constitution violations. Table intentionally left empty.
