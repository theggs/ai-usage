# Data Model: Iteration 1 Desktop Shell

## Desktop Surface

- **Purpose**: Represents the menu bar or system tray entry point and the visibility state of the panel.
- **Fields**:
  - `platform`: `macos` or `windows`
  - `icon_state`: `idle`, `attention`, or `offline-demo`
  - `summary_mode`: `icon-only`, `single-dimension`, or `multi-dimension`
  - `panel_visible`: boolean
  - `last_opened_at`: timestamp, optional
- **Validation Rules**:
  - `summary_mode` must be one of the supported display modes.
  - `panel_visible` changes only through explicit tray interactions or window-close behavior.
- **State Transitions**:
  - `panel_visible: false -> true` when the user clicks the tray icon.
  - `panel_visible: true -> false` when the user clicks outside the panel, closes the panel, or re-clicks the tray icon.

## Panel Placeholder Item

- **Purpose**: Represents a demo service row shown in the panel before real integrations exist.
- **Fields**:
  - `service_id`: stable identifier
  - `service_name`: display name
  - `account_label`: optional account alias
  - `icon_key`: icon reference
  - `quota_dimensions`: one or more displayable quota summaries
  - `status_label`: `demo`, `refreshing`, or `action-needed`
  - `last_refreshed_at`: timestamp
- **Validation Rules**:
  - `service_id` must be unique within the panel.
  - At least one `quota_dimension` must be present.
  - `status_label` must clearly indicate demo data in Iteration 1.
- **Relationships**:
  - Multiple placeholder items are rendered within one desktop surface panel.

## Quota Dimension

- **Purpose**: Represents one quota summary line shown for a service card.
- **Fields**:
  - `label`: short dimension name such as a rolling window label
  - `remaining_percent`: integer from 0 to 100
  - `remaining_absolute`: short text summary
  - `reset_hint`: optional human-readable reset description
- **Validation Rules**:
  - `remaining_percent` must stay within `0..100`.
  - `label` should fit into compact panel UI without truncating critical meaning.

## User Preference

- **Purpose**: Represents user-configurable settings that must persist across app restarts.
- **Fields**:
  - `language`: `zh-CN` or `en-US`
  - `refresh_interval_minutes`: integer, minimum 5
  - `display_mode`: `icon-only`, `icon-plus-percent`, or `multi-dimension`
  - `autostart_enabled`: boolean
  - `notification_test_enabled`: boolean, derived from latest test result availability
  - `last_saved_at`: timestamp
- **Validation Rules**:
  - `refresh_interval_minutes` must be at least 5.
  - `language` defaults to the system locale when supported, else falls back to `en-US`.
  - `display_mode` must map to a supported tray summary format.

## Notification Check

- **Purpose**: Tracks a user-initiated test notification attempt.
- **Fields**:
  - `notification_id`: stable identifier
  - `triggered_at`: timestamp
  - `result`: `sent`, `blocked`, or `failed`
  - `message_preview`: short text displayed to the user
- **Validation Rules**:
  - `message_preview` must be recognizable as a test notification.
  - `result` must be recorded even when the operating system blocks the notification.

## Build Artifact

- **Purpose**: Represents a generated installer from CI or local packaging.
- **Fields**:
  - `platform`: `macos` or `windows`
  - `artifact_type`: installer package type
  - `build_id`: pipeline or local build identifier
  - `created_at`: timestamp
  - `status`: `success` or `failed`
- **Validation Rules**:
  - One build run may produce multiple artifacts, but each artifact must be tied to exactly one platform.
  - `status` must be explicit so partial cross-platform failures can be reported independently.
