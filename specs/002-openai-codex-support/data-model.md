# Data Model: Iteration 2 Codex Usage Limits

## Reserved Codex Account Metadata

- **Purpose**: Represents optional host-owned metadata reserved for future multi-account support. It is not part of the Iteration 2 user-facing setup flow.
- **Fields**:
  - `account_id`: stable identifier
  - `alias`: optional user-facing account name
  - `credential_label`: optional placeholder reference for a future secure storage slot
  - `organization_label`: optional grouping label
  - `enabled`: boolean
  - `created_at`: timestamp
  - `updated_at`: timestamp
- **Validation Rules**:
  - `account_id` must be unique across saved metadata entries.
  - Iteration 2 UI must not require any of these fields before showing Codex CLI sync status.
- **Relationships**:
  - Reserved metadata, when present, may later map to one active local session, but that mapping is out of the Iteration 2 UI path.

## Active Codex Session

- **Purpose**: Represents the single local Codex CLI session that currently provides live limit data.
- **Fields**:
  - `session_id`: stable host-generated identifier
  - `account_id`: optional mapping to reserved Codex account metadata
  - `session_label`: display name for the active local session
  - `connection_state`: `connected`, `disconnected`, `unavailable`, or `failed`
  - `last_checked_at`: timestamp
  - `source`: fixed value referencing local Codex CLI status reads
- **Validation Rules**:
  - At most one active session can be `connected` at a time in Iteration 2.
  - `account_id` may be absent when no saved account can be confidently matched.
  - `connection_state` must be explicit even when no live data exists.

## Codex Limit Dimension

- **Purpose**: Represents one displayable usage-limit row returned by the active Codex session.
- **Fields**:
  - `dimension_id`: stable identifier derived from dimension label and reset cadence
  - `label`: short dimension label such as `Local Messages / 5h`
  - `remaining_percent`: integer from 0 to 100, optional when only qualitative status is available
  - `remaining_text`: short human-readable summary
  - `reset_hint`: optional human-readable reset timing
  - `window_kind`: `rolling-hours`, `weekly`, or `other`
  - `status`: `healthy`, `warning`, `exhausted`, or `unknown`
- **Validation Rules**:
  - `dimension_id` must be unique within one snapshot.
  - A dimension must provide either `remaining_percent` or `remaining_text`.
  - `status` must match the currently known data quality.

## CLI Limit Snapshot

- **Purpose**: Represents one normalized read of the local Codex CLI `/status` output.
- **Fields**:
  - `snapshot_id`: stable identifier
  - `session_id`: foreign key to the active session
  - `captured_at`: timestamp
  - `dimensions`: ordered list of Codex limit dimensions
  - `raw_summary`: short normalized summary string for tray display
  - `snapshot_state`: `fresh`, `stale`, `empty`, or `failed`
  - `failure_reason`: optional user-facing error hint
- **Validation Rules**:
  - `captured_at` must update on every attempted refresh, including failures.
  - `snapshot_state = failed` requires `failure_reason`.
  - `snapshot_state = fresh` requires at least one dimension.

## Codex Panel State

- **Purpose**: Represents the full payload rendered by the tray panel in Iteration 2.
- **Fields**:
  - `desktop_surface`: inherited tray/window metadata
  - `configured_account_count`: integer, reserved for future expansion
  - `enabled_account_count`: integer, reserved for future expansion
  - `active_session`: optional active Codex session
  - `snapshot`: optional CLI limit snapshot
  - `status_message`: localized, user-facing summary of the current live-data state
  - `updated_at`: timestamp
- **Validation Rules**:
  - `enabled_account_count` cannot exceed `configured_account_count`.
  - `snapshot` should be absent only when no attempt has been made or no session is available.
  - `status_message` must distinguish among pending, disconnected, stale, and failed states.
