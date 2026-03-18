# Desktop Shell Contract: Iteration 1

## Purpose

Define the stable interaction boundary between the desktop host layer and the UI layer for the first iteration.

## Host Commands

| Command | Input | Output | Behavior |
|--------|--------|--------|--------|
| `get_demo_panel_state` | None | Desktop surface state plus ordered placeholder items | Returns the panel payload used on first render and after manual refresh. |
| `refresh_demo_panel_state` | None | Updated panel payload | Refreshes demo timestamps and returns the latest placeholder state without calling any external service. |
| `get_preferences` | None | User preference object | Returns persisted preferences or defaults when no saved values exist. |
| `save_preferences` | User preference patch | Updated user preference object | Validates and persists supported settings, then returns the normalized result. |
| `set_autostart` | `enabled` boolean | Current autostart status | Enables or disables startup behavior and returns the applied status. |
| `send_test_notification` | Optional short message override | Notification check result | Sends one local test notification and reports whether the attempt was sent, blocked, or failed. |

## UI Expectations

- The panel must be renderable from a single payload returned by `get_demo_panel_state`.
- The settings view must initialize from `get_preferences` and write changes through `save_preferences`.
- The UI must show explicit demo labeling on every placeholder service item.
- A failed notification attempt must surface user-readable guidance instead of silently succeeding.
- UI copy must support both Chinese and English, even if some placeholder text falls back to the default language.

## Error Contract

| Scenario | Expected UI Response |
|--------|--------|
| Preferences fail validation | Show an inline error next to the affected control and preserve the last valid value. |
| Panel refresh fails unexpectedly | Keep the previous panel state visible and show a non-blocking error message. |
| Notification blocked by OS permission | Show a descriptive message that tells the user to check system notification permissions. |
| Autostart toggle cannot be applied | Revert the toggle in UI and show the current actual status. |

## Out of Scope

- Any command that reads real quota data from external AI services
- Any cloud sync or account-sharing contract
- Any low-quota alert throttling logic beyond a manually triggered test notification
