# Quickstart: Iteration 2 Codex Usage Limits

## Goal

Extend the tray-first desktop shell so it can show real Codex usage-limit data from the local Codex CLI without requiring users to enter Codex account aliases or credential placeholders manually.

## Prerequisites

- Node.js 20 LTS via `nvm install` and `nvm use`
- Rust stable toolchain
- Tauri build prerequisites for macOS and Windows
- A machine running macOS 13+ or Windows 10 22H2+
- A locally installed Codex CLI
- A completed local `codex login`

## Setup Flow

1. Keep the Iteration 1 tray shell, settings view, and preference persistence intact.
2. Add shared contract types for active sessions and normalized limit dimensions.
3. Implement a host-side Codex reader that invokes `codex app-server`, requests `account/rateLimits/read`, and normalizes the structured response.
4. Update the Tauri command layer so the frontend requests one consolidated Codex panel payload.
5. Update settings so users can inspect local Codex CLI sync state and understand that live data comes from one active local session.
6. Update the panel so it can render active-session limit dimensions, disconnected states, and parse failures.

## Local Validation

1. Run `codex login status` locally and confirm the CLI reports an authenticated session.
2. Launch the desktop app in development mode.
3. Open settings and confirm the app explains that this iteration syncs from the local Codex CLI only, without any manual account or credential form.
4. Return to the panel and confirm the sync-status card reflects the current local Codex CLI state.
5. Refresh the panel and confirm that at least one normalized limit dimension is rendered for the active local session when the local CLI exposes readable rate limits.
6. Sign out of Codex CLI or make the local session unreadable and confirm the panel shows an explicit disconnected or failed state instead of demo content.
7. Optional test/debug fallback: export `AI_USAGE_CODEX_STATUS_TEXT` or `AI_USAGE_CODEX_STATUS_FILE` only when you need to simulate host snapshots without a local CLI.
8. Run `npm test -- --run`, `npx tsc --noEmit`, and `cargo test --manifest-path src-tauri/Cargo.toml`.

## Test Expectations

- Frontend tests cover settings CLI-guidance behavior, panel disconnected/live states, and localized status messaging.
- Rust tests cover direct Codex CLI invocation, structured rate-limit normalization, disconnected login handling, and fallback snapshot parsing behavior.
- Contract or integration tests cover Tauri command payload shapes and fallback behavior when the CLI session is unavailable.
- Validation completed during implementation:
  - `npm test -- --run`
  - `npx tsc --noEmit`
  - `cargo test --manifest-path src-tauri/Cargo.toml`

## Exit Criteria

- The panel can display live limits for one active local Codex session.
- Pending, disconnected, and parse-failure states are distinguishable and actionable.
- No frontend code directly executes or parses Codex CLI output.
