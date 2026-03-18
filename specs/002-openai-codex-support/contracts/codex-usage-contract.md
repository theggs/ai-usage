# Codex Usage Contract: Iteration 2

## Purpose

Define the stable interaction boundary between the Tauri host and the UI layer for real Codex usage-limit reads.

## Host Commands

| Command | Input | Output | Behavior |
|--------|--------|--------|--------|
| `get_codex_panel_state` | None | Codex panel state payload | Returns active-session metadata and the latest available CLI snapshot for initial render. |
| `refresh_codex_panel_state` | None | Updated Codex panel state payload | Re-reads the local Codex CLI via `codex app-server` and `account/rateLimits/read`, normalizes the latest snapshot, and returns explicit disconnected or failure states when live data is unavailable. |

## Panel Payload Shape

- `configuredAccountCount`: reserved for future multi-account support; not used by the Iteration 2 UI flow
- `enabledAccountCount`: reserved for future multi-account support; not used by the Iteration 2 UI flow
- `snapshotState`: one of `fresh`, `pending`, `stale`, `empty`, or `failed`
- `statusMessage`: host-authored explanation for the current snapshot state
- `activeSession`: omitted when no live local session is available; otherwise exposes one local session label and normalized connection state
- `items[]`: normalized Codex limit rows only; raw CLI text never crosses the boundary

## Snapshot Sources

- The host prefers a real local Codex CLI read through `codex app-server`.
- The host sends `initialize`, `initialized`, and `account/rateLimits/read` over stdio JSON-RPC and normalizes the returned `RateLimitSnapshot` windows into quota rows.
- If the Codex CLI is installed but no readable logged-in session is available, the host returns `snapshotState = stale` and `connectionState = disconnected`.
- If the Codex CLI is unavailable locally, the host returns `snapshotState = stale` and `connectionState = unavailable`.
- If the live read fails while the CLI appears logged in, the host returns `snapshotState = failed` and no limit rows.
- `AI_USAGE_CODEX_STATUS_TEXT` and `AI_USAGE_CODEX_STATUS_FILE` are test/debug fallback only, used only when the Codex CLI is unavailable locally.

## UI Expectations

- The panel must render from one host payload centered on the local Codex CLI snapshot state.
- The settings view must explain local Codex CLI sync behavior instead of asking the user for manual Codex credentials.
- The UI must show clear pending, disconnected, and failed states when no readable active CLI session is available.
- The tray summary must use the active snapshot summary when available and a neutral fallback when not connected.

## Error Contract

| Scenario | Expected UI Response |
|--------|--------|
| No readable active Codex CLI session exists yet | Show a disconnected-style message based on host state, rather than synthetic demo content. |
| CLI output cannot be parsed or read | Show a failed host state and no limit rows. |
| The active session cannot be mapped to any future saved account metadata | Keep the live session standalone instead of assigning it incorrectly. |

## Out of Scope

- Supporting more than one live local Codex session in the same refresh cycle
- Remote scraping of the Codex usage dashboard
- Generic OpenAI API usage/cost tracking
- Automatic budget calculations derived from pricing tables
