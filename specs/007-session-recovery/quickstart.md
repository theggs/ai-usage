# Quickstart: Claude Code Session Recovery

**Date**: 2026-03-22
**Feature**: 007-session-recovery

## What This Feature Does

Changes how AIUsage handles expired Claude Code sessions (HTTP 401). Instead of showing a blank error panel, the app preserves cached quota data, shows a friendly recovery message, and automatically recovers when the user reopens Claude Code.

## Files to Modify

| File | Change Summary |
|------|---------------|
| `src-tauri/src/claude_code/mod.rs` | Add `SessionRecovery` variant to `PauseState`; rewrite 401 handler to preserve cache and return stale/empty snapshot; add `is_session_recovery()` helper |
| `src/app/shared/i18n.ts` | Add `claudeCodeSessionRecovery` and `claudeCodeSessionRecoveryEmpty` copy strings (en + zh-CN) |
| `src/app/panel/PanelView.tsx` | Add detection for new recovery message in `getClaudeCodePlaceholderMessage()` |

## How to Test Locally

### Simulate 401 (Rust unit tests)

```bash
cargo test
```

Existing tests cover 401 handling. New/updated tests should verify:
1. Cache is NOT cleared on 401
2. `PauseState::SessionRecovery` is set on 401
3. Automatic refresh is NOT blocked during `SessionRecovery`
4. Successful API call clears `SessionRecovery`

### Simulate in dev mode

```bash
npm run tauri:dev
```

To trigger a 401 scenario:
1. Start the app with a valid Claude Code session
2. Wait for a successful quota fetch (cache populated)
3. Invalidate the token (e.g., set `CLAUDE_CODE_OAUTH_TOKEN` env var to a dummy value)
4. Wait for the next auto-refresh cycle
5. Verify: panel shows stale data + recovery message (not blank + error)
6. Restore valid token (unset the env var)
7. Wait for next auto-refresh
8. Verify: panel returns to fresh data

### Frontend tests

```bash
npm test
```

Verify i18n mapping for the new recovery message strings in both languages.

## Key Design Decisions

- **No new timers**: The existing refresh interval (default 15 min) serves as the recovery probe. No new `useEffect` or timer logic needed in the frontend.
- **No expiresAt pre-check**: The API call is the authoritative check. Local expiry timestamps can be stale or missing.
- **Cache preserved on 401**: Consistent with 429/network error behavior. Users see stale data instead of a blank panel.
- **SessionRecovery does not block auto-refresh**: Unlike AccessDenied (403) which blocks, and RateLimitedUntil (429) which delays, SessionRecovery allows normal refresh to proceed.
