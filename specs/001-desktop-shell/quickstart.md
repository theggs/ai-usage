# Quickstart: Iteration 1 Desktop Shell

## Goal

Stand up the first runnable desktop shell and verify the tray, panel, settings, autostart, notification, and packaging flows.

## Prerequisites

- Node.js 20 LTS via `nvm install` and `nvm use`
- Rust stable toolchain
- Tauri build prerequisites for macOS and Windows
- A machine running either macOS 13+ or Windows 10 22H2+

## Setup Flow

1. Initialize the frontend and Tauri desktop shell in this repository.
2. Add the tray, autostart, notification, and persistence dependencies required by the plan.
3. Create the shared UI shell with a hidden-on-launch main window and tray-triggered panel.
4. Seed demo service data and default preferences for first-run behavior.
5. Generate build metadata artifacts and validate three consecutive successful CI runs before release acceptance.

## Local Validation

1. Launch the desktop app in development mode.
2. Confirm the tray or menu bar icon appears within 2 seconds.
3. Open the panel and verify demo service cards, refresh controls, and settings entry.
4. Change settings, save them, restart the app, and confirm values persist.
5. Trigger a test notification and verify success or actionable permission guidance.
6. Toggle autostart and verify the UI reflects the applied state.

## Test Expectations

- Frontend tests cover settings form behavior, panel rendering, and error states.
- Integration tests cover persistence and host-command wiring.
- End-to-end tests cover core desktop shell flows where automation support is practical.
- CI builds produce macOS and Windows installers and retain the artifacts.

## Exit Criteria

- The application can be run locally as a tray-first shell.
- All Iteration 1 user stories can be demonstrated without real API credentials.
- CI produces installable outputs for both target platforms.

## Validation Notes

- Validated on 2026-03-18 with `npm test`, `npm run lint`, `npm run build`, `cargo test --manifest-path src-tauri/Cargo.toml`, and `npm run tauri:build`.
- Dependencies were installed successfully after routing through the local proxy at `127.0.0.1:7897`.
- `npm run test:e2e` currently reports one skipped placeholder test because full desktop-runtime automation is deferred to a dedicated Tauri E2E environment.
- The repository now pins Node.js 20 through `.nvmrc` and `package.json#engines` to avoid local environment drift.
