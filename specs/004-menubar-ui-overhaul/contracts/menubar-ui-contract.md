# Menubar UI Contract: UI Overhaul

## Purpose

Define the stable interaction boundary for the compact menu bar surface, including host-owned window behavior and the UI-facing expectations for quota/status presentation.

## Host Commands

| Command | Input | Output | Behavior |
|--------|--------|--------|--------|
| `get_codex_panel_state` | None | Compact panel payload | Returns the latest normalized panel state used for initial render, including snapshot status and quota rows. |
| `refresh_codex_panel_state` | None | Updated compact panel payload | Refreshes the local Codex snapshot, keeps the operation single-flight in UI, and returns truthful `fresh`/`stale`/`failed` states. |
| `get_preferences` | None | User preference object | Returns persisted preferences that determine language, refresh cadence, tray summary mode, and autostart state. |
| `save_preferences` | User preference patch | Updated user preference object | Validates and persists preference changes, then returns the normalized saved state. |
| `set_autostart` | `enabled` boolean | Updated user preference object | Applies the requested autostart state and returns the actual persisted result for UI reconciliation. |
| `send_test_notification` | Optional short message override | Notification check result | Sends a local notification test and returns `sent`, `blocked`, or `failed` for inline feedback. |

## Window Behavior Contract

- Tray left-click toggles the `main` window between visible and hidden states.
- Native close requests on the `main` window must be intercepted and converted into `hide()`, not process termination.
- When the `main` window loses focus because the user clicks elsewhere or switches applications, the host hides the window.
- The `main` window is non-resizable and configured to a menu bar popover footprint within the spec range.
- Reopening the window after hide must preserve current panel/settings state and must not require app relaunch.

## Compact Panel Payload Expectations

- `desktopSurface.panelVisible` remains a host-owned fact and must not require frontend inference from CSS visibility.
- `snapshotState` remains one of `fresh`, `pending`, `stale`, `empty`, or `failed`.
- `statusMessage` remains the canonical host-authored explanation for current sync truth.
- `items[]` remain the only quota rows rendered in the compact panel; no synthetic filler cards are introduced when empty.
- Each quota dimension exposed to the UI must provide enough normalized data to render a compact three-line layout:
  - label + remaining percent (shown together in header row)
  - progress bar with color grading based on `progressTone`
  - optional reset hint
  - normalized health/status semantics for color grading (`status` and `progressTone` fields)

## UI Expectations

- The panel must render one compact status line that combines “last refreshed” information with any inline error/disconnected cue.
- The primary scan target is the quota-card list; global status blocks must not visually overpower it.
- Refresh interactions must disable the trigger while loading and show a visible loading affordance.
- The compact panel keeps previously rendered quota rows visible while a refresh is in flight.
- Chinese and English modes must localize all visible panel and settings labels, section titles, helper text, and feedback messages. Backend data strings (badgeLabel, remainingAbsolute, resetHint) are localized on the frontend via utility functions (`localizeRemaining`, `localizeResetHint`, `localizeBadgeLabel`) that parse English backend output and map to the current locale's copy tree.
- The settings view must separate preference persistence actions from notification testing actions.
- All UI containers and cards must use border-radius in the 12-16px range; decorative 28-32px rounding is not permitted.
- Visual nesting must not exceed two layers (outer container > card); dimension rows within cards are flat inline elements.
- Background effects (blur, gradients, shadows) must be lightweight; heavy glassmorphism (`backdrop-blur-xl`, `shadow-2xl`) is not permitted.

## Error Contract

| Scenario | Expected UI Response |
|--------|--------|
| Snapshot refresh is pending | Keep existing quota data if available, disable refresh, and show pending state in the compact status line. |
| Snapshot read fails | Preserve the truthful failed state inline and avoid inventing healthy-looking cards or demo copy. |
| No readable percentage exists for a quota row | Render a neutral/muted progress placeholder rather than a zero-percent danger bar. |
| Autostart application fails | Restore the actual persisted toggle value and show nearby failure feedback. |
| Settings save succeeds | Show adjacent success feedback without requiring the user to scroll to page bottom. |

## Out of Scope

- Redesigning the underlying Codex live-data source or session-discovery workflow
- Multi-window shell behavior beyond the single `main` tray panel
- Cloud sync, remote account linking, or cross-device preference replication
- Visual themes beyond the compact macOS menubar-aligned refinement described in this feature
