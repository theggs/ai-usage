# Tauri Command Contracts: Claude Code Service Support

**Feature**: 005-claude-code-support
**Date**: 2026-03-20

These contracts define the stable interface between the Rust host layer and the TypeScript frontend for this feature. All new and modified commands are documented here. Existing commands not listed below are unchanged.

---

## New Commands

### `get_claude_code_panel_state`

Returns the current Claude Code quota snapshot without triggering a new network request. The host caches the last snapshot in memory (within the current process lifetime) and returns it immediately. The next scheduled refresh cycle will update the cached value.

**Signature**:
```
get_claude_code_panel_state() → CodexPanelState
```

**Returns**: `CodexPanelState` (same type as `get_codex_panel_state`)

**Key fields in the response**:

| Field | Value for Claude Code | Notes |
|-------|-----------------------|-------|
| `items[0].serviceId` | `"claude-code"` | Identifies the service |
| `items[0].serviceName` | `"Claude Code"` | Display name |
| `items[0].iconKey` | `"claude-code"` | Icon key for frontend renderer |
| `items[0].quotaDimensions` | 0–4 items | Null API dimensions are omitted |
| `items[0].badgeLabel` | `"Live"` \| snapshot state | `"Live"` when fresh |
| `snapshotState` | `"fresh"` \| `"stale"` \| `"empty"` \| `"failed"` \| `"pending"` | — |
| `statusMessage` | English string | Frontend must not display raw value |

**When `items` is empty** (`snapshotState` is `"empty"` or `"failed"`):
- `items` is `[]`
- Frontend MUST render a "not connected" placeholder card for the Claude Code service

**Error states by `snapshotState`**:
- `"empty"` — no credentials found; user has not installed or logged in to Claude Code
- `"stale"` — transient API failure (429, 5xx, timeout, DNS); cached dimensions shown
- `"failed"` — authentication failure (401/403); credentials are expired or invalid
- `"pending"` — first load in progress; no cached data yet

---

### `refresh_claude_code_panel_state`

Triggers an immediate synchronous fetch of Claude Code quota data from the Anthropic API, bypassing the scheduled interval. Returns the refreshed `CodexPanelState`.

**Signature**:
```
refresh_claude_code_panel_state() → CodexPanelState
```

**Behavior**: Same return shape as `get_claude_code_panel_state`. Reads the OAuth token fresh from the credential store, calls the API, and updates the in-memory snapshot cache.

---

## Modified Commands

### `save_preferences` (extended)

Accepts two new optional fields in `PreferencePatch`. Existing behavior is unchanged when these fields are absent.

**New fields in `PreferencePatch`**:

| Field | Type | Validation | Effect |
|-------|------|------------|--------|
| `menubarService` | `string` | Any string; unknown values fall back to `"codex"` at render time | Sets which service drives the tray indicator |
| `serviceOrder` | `string[]` | Array of service IDs; unknown IDs are ignored at render time | Sets the render order of service cards in the main panel |

**Tray side-effect**: When `menubarService` is updated, `apply_display_mode` is called immediately with items filtered to only the selected service, causing the tray to update within the request-response cycle (satisfies SC-002: <3s).

**`UserPreferences` response includes new fields**:
```typescript
{
  // ...existing fields...
  menubarService: string,   // current value after merge
  serviceOrder: string[]    // current value after merge
}
```

---

## Frontend Integration Notes

### Fetching both services

The frontend fetches both services in parallel and combines them for display:

```typescript
const [codexState, claudeCodeState, preferences] = await Promise.all([
  tauriClient.getCodexPanelState(),
  tauriClient.getClaudeCodePanelState(),
  tauriClient.getPreferences()
]);
```

### Rendering order

The panel renders service cards in `preferences.serviceOrder` order. For each service ID in the list:
- `"codex"` → render from `codexState.items` (or a not-connected placeholder if empty)
- `"claude-code"` → render from `claudeCodeState.items` (or a not-connected placeholder if empty)
- Unknown ID → skip silently

### Menubar service fallback

If `preferences.menubarService` refers to a service whose state is `"empty"` or `"failed"`, the tray shows a neutral indicator (no quota percentage). The tray MUST NOT show quota data from a different service silently.

---

## Unchanged Commands

The following commands are used by this feature but their contracts are not modified:

- `get_codex_panel_state` — unchanged
- `refresh_codex_panel_state` — unchanged
- `get_preferences` — now returns `menubarService` and `serviceOrder` fields (additive, backward-compatible)
