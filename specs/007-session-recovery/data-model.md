# Data Model: Claude Code Session Recovery

**Date**: 2026-03-22
**Feature**: 007-session-recovery

## Entities

### PauseState (modified)

In-memory enum representing the current access condition of the Claude Code integration. Stored in a `Mutex` singleton — not persisted to disk.

| Variant | Description | Blocks Auto-Refresh? | Set By | Cleared By |
|---------|-------------|---------------------|--------|------------|
| None | Normal operation | No | Successful API call (200) | — |
| AccessDenied | API returned 403 | Yes | 401 handler | Manual refresh, proxy change |
| RateLimitedUntil(i64) | API returned 429; blocked until Unix timestamp | Yes (until timestamp) | 429 handler | Timestamp expiry |
| **SessionRecovery** *(new)* | API returned 401; token expired | **No** | 401 handler | Successful API call (200), proxy change |

### State Transition Diagram

```text
         ┌─────────────────────────────────────┐
         │              None                    │
         │        (normal operation)            │
         └──┬────────┬────────┬────────────────┘
            │ 401    │ 429    │ 403
            ▼        ▼        ▼
   ┌────────────┐ ┌──────────────┐ ┌──────────────┐
   │ Session    │ │ RateLimit    │ │ AccessDenied │
   │ Recovery   │ │ Until(ts)    │ │              │
   └──────┬─────┘ └──────┬───────┘ └──────┬───────┘
          │ 200          │ 200            │ 200
          └──────────────┴────────────────┘
                         │
                         ▼
                       None
```

**Cross-state transitions** (any state can transition to any other on the corresponding HTTP status):
- SessionRecovery + 429 → RateLimitedUntil
- SessionRecovery + 403 → AccessDenied
- RateLimitedUntil (expired) + 401 → SessionRecovery
- Any state + 200 → None

### Stale Cache (unchanged)

In-memory `Option<Vec<QuotaDimension>>` holding the last successfully-fetched quota dimensions. Unchanged in structure.

**Behavior change for 401**: Cache is NO LONGER cleared on 401. Previously `*cache = None` on 401; now cache is preserved (read-only).

### ClaudeCodeSnapshot output mapping for 401

| Condition | snapshot_state | connection_state | dimensions | status_message |
|-----------|---------------|-----------------|------------|----------------|
| 401 + cache exists | `"stale"` | `"disconnected"` | cached data | Recovery message (with-cache variant) |
| 401 + no cache | `"empty"` | `"disconnected"` | empty | Recovery message (no-cache variant) |

## Validation Rules

- `PauseState::SessionRecovery` MUST NOT prevent `load_snapshot` from making an API call during automatic refresh (unlike `AccessDenied` which blocks).
- `clear_access_pause()` MUST reset `SessionRecovery` to `None` (already satisfied — function unconditionally sets `None`).
- Proxy setting changes MUST clear `SessionRecovery` (already satisfied — `clear_access_pause()` is called on proxy change).
