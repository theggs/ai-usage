# AIUsage

AIUsage is a cross-platform tray-first desktop shell for tracking AI service quota usage. This iteration focuses on the runnable shell, demo panel, settings skeleton, notification checks, autostart toggles, and packaging workflow.

## Local Development

1. Run `nvm install` and `nvm use` to enter the project Node.js 20 environment.
2. Install Rust stable.
3. Run `npm install`.
4. Run `npm run dev` for the frontend shell.
5. Run `npm run tauri:dev` for the desktop runtime when Tauri dependencies are available.

## Validation

- `npm test`
- `npm run test:e2e`
- `cargo test --manifest-path src-tauri/Cargo.toml`
- `npm run tauri:build`
- `npm run verify:build-stability ./artifacts/build-metadata/*.json` after collecting three successful CI metadata files
