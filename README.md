# AIUsage

AIUsage is a cross-platform tray-first desktop shell for tracking AI service quota usage. The current iteration focuses on a host-normalized Codex usage-limits panel and truthful disconnected/failed states driven by the local Codex CLI instead of synthetic demo quota data.

## Local Development

1. Run `nvm install` and `nvm use` to enter the project Node.js 20 environment.
2. Install Rust stable.
3. Run `npm install`.
4. Install the Codex CLI and complete `codex login` in your local shell.
5. Run `npm run dev` for the frontend shell.
6. Run `npm run tauri:dev` for the desktop runtime when Tauri dependencies are available.
7. Optional test-only fallback: export `AI_USAGE_CODEX_STATUS_TEXT` or `AI_USAGE_CODEX_STATUS_FILE` only when you need to simulate host snapshots without a local CLI.

## Validation

- `npm test`
- `npx tsc --noEmit`
- `npm run test:e2e`
- `cargo test --manifest-path src-tauri/Cargo.toml`
- `npm run tauri:build`
- `npm run verify:build-stability ./artifacts/build-metadata/*.json` after collecting three successful CI metadata files

## Codex Validation Notes

- The frontend renders only normalized host payloads; it does not execute or parse Codex CLI output directly.
- The host now prefers `codex app-server` plus `account/rateLimits/read` to fetch live limits from the local logged-in Codex session.
- The settings page explains local Codex CLI sync status and no longer asks users to enter account credentials manually.
- `AI_USAGE_CODEX_STATUS_TEXT` and `AI_USAGE_CODEX_STATUS_FILE` are test/debug fallback only; they are no longer the normal validation path.
