# Research: Claude Code Session Recovery

**Date**: 2026-03-22
**Feature**: 007-session-recovery

## Research Questions

### R1: Can 401 be safely treated as transient (not terminal)?

**Decision**: Yes. HTTP 401 from the Claude Code usage API means the local access token has expired, not that the user's account is banned or the credential source is corrupted.

**Rationale**: The Claude Code CLI manages its own OAuth lifecycle. When the user opens Claude Code, it refreshes the token automatically. AIUsage is a read-only consumer of this token — it never performs token refresh. Therefore, 401 is always a "wait for upstream to fix itself" scenario, which is the definition of a transient state.

**Alternatives considered**:
- Treat 401 as terminal failure (current behavior) — rejected because it creates a dead-end UX requiring manual refresh.
- Attempt token refresh from AIUsage — rejected because AIUsage is not an OAuth participant; it reads credentials read-only from keychain/file.
- Pre-check `expiresAt` before API call — rejected because (a) the credential struct doesn't reliably contain `expiresAt` across all token sources, (b) Claude Code may have already refreshed the token while the local `expiresAt` is stale, creating false negatives, and (c) the API call itself is the most authoritative check.

### R2: Should 401 block automatic refresh (like 403 does)?

**Decision**: No. Automatic refresh MUST continue unblocked during session recovery.

**Rationale**: The existing refresh interval (default 15 min, min 5 min) is already a reasonable recovery probe frequency. Blocking auto-refresh would require a separate recovery timer (adding frontend complexity) and would delay recovery. Since the token source is external (Claude Code CLI), there's no risk of "hammering" — the API call is lightweight and infrequent.

**Alternatives considered**:
- Block auto-refresh and add a dedicated 60-second recovery timer (original doc proposal) — rejected because it adds frontend complexity (new `useEffect`, new timer state) for no user-visible benefit over the existing interval.
- Block auto-refresh entirely, require manual retry — rejected because it violates the PRD goal of zero-interruption awareness.

### R3: Should 401 clear the stale cache?

**Decision**: No. The cache MUST be preserved.

**Rationale**: The cache holds the user's last-known quota data, which retains informational value during recovery. Clearing it (current behavior) leaves the user with a blank panel — the worst possible UX for a transient condition. Both 429 and network errors already preserve the cache; 401 should be consistent.

**Alternatives considered**:
- Clear cache on 401 (current behavior) — rejected because it destroys useful information and creates asymmetry with other transient error handling.

### R4: What `snapshot_state` / `connection_state` values should 401 produce?

**Decision**: `snapshot_state: "stale"` (with cache) or `"empty"` (without cache), `connection_state: "disconnected"`.

**Rationale**:
- `"stale"` correctly signals that displayed data is not live but still informative. This is consistent with how 429 and network errors are handled.
- `"empty"` for the no-cache case avoids misleading the user about data freshness.
- `"disconnected"` for connection_state accurately reflects that the session link to Claude's API is broken (unlike 429 where the connection is fine but rate-limited, which uses `"connected"`).

**Alternatives considered**:
- `snapshot_state: "failed"` (current behavior) — rejected because "failed" implies a terminal condition in the UI, which is misleading for a recoverable state.

### R5: What PauseState variant to use?

**Decision**: Add `PauseState::SessionRecovery` to the existing enum.

**Rationale**: The existing `PauseState` already models 403 (`AccessDenied`) and 429 (`RateLimitedUntil`). Adding `SessionRecovery` keeps all access-condition logic in one place. Unlike `AccessDenied` (which blocks auto-refresh) and `RateLimitedUntil` (which blocks until timestamp), `SessionRecovery` does NOT block auto-refresh — it only changes the snapshot output.

**Alternatives considered**:
- Create a separate `ClaudeAccessState` enum (original doc proposal) — rejected as over-engineering; the existing `PauseState` is sufficient.
- No new enum variant, just change the 401 handler output — considered but rejected because having an explicit state makes it easier to test state transitions and reason about behavior in the `load_snapshot` function.

### R6: How to prevent 429 from dev hot-reloads triggering repeated API calls?

**Decision**: Persist snapshot cache to disk. On startup, if the cached data's refresh timestamp is within the configured refresh interval, return cached data without fetching. This rule applies to all AI services universally.

**Rationale**: During `tauri:dev`, Rust code changes cause full process restarts which zero all in-memory state (`stale_cache`, `PauseState`). Each restart triggers a fresh API call from both the tray initialization and the frontend mount effect. With a 15-minute refresh interval, this is wasteful and can trigger 429s during active Rust development. Persisting the cache + timestamp to disk lets restarts reuse recent data.

**Alternatives considered**:
- Add a hardcoded minimum fetch interval (e.g., 60s) with a persisted timestamp — rejected because (a) it introduces a second interval concept separate from the user-configurable `refreshIntervalMinutes`, (b) on restart it still shows an empty panel since in-memory cache is gone, and (c) it only applies to one service at a time. The chosen approach solves both the rate-limiting problem and the restart UX problem in one mechanism.
- Frontend-level debounce — rejected because the tray initialization in `lib.rs` also triggers fetches before the frontend loads.
