# Quickstart: Claude Code Service Support

**Feature**: 005-claude-code-support
**Date**: 2026-03-20

## Prerequisites

- Node.js 20 LTS (see `.nvmrc`): `nvm use`
- Rust stable (edition 2021): `rustup update stable`
- macOS development: Xcode command-line tools for the `security` CLI
- Optional: a valid Claude Code subscription and active `~/.claude/.credentials.json` for live testing

## Running the Development Environment

```bash
# Full Tauri dev mode (frontend + Rust backend hot-reload)
npm run tauri:dev

# Frontend only (mock mode — Tauri runtime not required)
npm run dev

# Rust backend tests only
cd src-tauri && cargo test

# Frontend tests only
npx vitest run
```

## Testing Claude Code Integration Without a Real Account

The credential read path checks `CLAUDE_CODE_OAUTH_TOKEN` first. Use this to inject a test token:

```bash
# Run with a mock token (API calls will fail with 401 — exercises the "disconnected" state)
CLAUDE_CODE_OAUTH_TOKEN=sk-ant-oat-fake npm run tauri:dev

# Run with no token (exercises the "not connected / empty" state)
npm run tauri:dev
```

To exercise the full happy path, a valid Claude Code Max subscription token is required. Use the real `~/.claude/.credentials.json` populated by the Claude Code CLI.

## Verifying Credential Reading

On macOS, verify the keychain entry exists:

```bash
security find-generic-password -a "$USER" -s "Claude Code-credentials"
```

If `CLAUDE_CONFIG_DIR` is set, the service name will have a hash suffix — verify with:

```bash
echo $CLAUDE_CONFIG_DIR
security find-generic-password -a "$USER" -s "Claude Code-credentials" 2>&1 || echo "Not found with default name"
```

## Key Files to Modify

| File | Change |
|------|--------|
| `src-tauri/Cargo.toml` | Add `ureq`, `chrono`, `sha2` dependencies |
| `src-tauri/src/claude_code/mod.rs` | New module: token read + API call + snapshot build |
| `src-tauri/src/state/mod.rs` | Add `menubar_service`, `service_order` to `UserPreferences` / `PreferencePatch` |
| `src-tauri/src/commands/mod.rs` | Add `get_claude_code_panel_state`, `refresh_claude_code_panel_state`; update `save_preferences` and `apply_display_mode` call sites |
| `src-tauri/src/tray/mod.rs` | Filter items by `menubar_service` before passing to `format_summary` |
| `src-tauri/src/lib.rs` | Register new Tauri commands |
| `src/lib/tauri/contracts.ts` | Add `menubarService`, `serviceOrder` to `UserPreferences` / `PreferencePatch` |
| `src/lib/tauri/client.ts` | Add `getClaudeCodePanelState`, `refreshClaudeCodePanelState`; update `invoke` mock switch |
| `src/app/shared/i18n.ts` | Add new copy keys (menubar service, panel order, Claude Code labels) |
| `src/app/shared/appState.ts` | Include Claude Code panel state alongside Codex state |

## Running Contract Tests

```bash
# All contract and integration tests
npx vitest run tests/

# Watch mode during development
npx vitest tests/contract/
```

## Confirming Tray Behavior

1. Set `menubarService` to `"claude-code"` via Settings
2. Verify the macOS menubar shows Claude Code's quota percentage
3. Set `menubarService` to `"codex"` — verify tray reverts immediately (no restart)
4. Disconnect Claude Code credentials — verify tray shows neutral indicator, not Codex data

## Confirming Panel Order

1. Open Settings → Panel Order
2. Move Claude Code above Codex
3. Reopen the main panel — verify Claude Code card appears first
4. Verify Codex card is still visible in the "not connected" state if disconnected
