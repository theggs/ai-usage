# Data Model: Claude Code Service Support

**Feature**: 005-claude-code-support
**Date**: 2026-03-20
**Spec**: [spec.md](./spec.md)

## Overview

This feature extends the existing data model with one new backend module, two new preference fields, and one new frontend contract type. All other types are reused without schema changes.

---

## New: `ClaudeCodeSnapshot` (Rust — `claude_code/mod.rs`)

Type alias for the existing `CodexSnapshot`. Fields are identical; the alias is used to clarify intent within the module.

```rust
// claude_code/mod.rs
pub type ClaudeCodeSnapshot = crate::state::CodexSnapshot;
```

**Field semantics for Claude Code**:

| Field | Type | Values | Notes |
|-------|------|--------|-------|
| `snapshot_state` | `String` | `"fresh"`, `"stale"`, `"empty"`, `"failed"`, `"pending"` | `"stale"` on any transient API error; `"empty"` when no credentials exist yet |
| `connection_state` | `String` | `"connected"`, `"disconnected"`, `"unavailable"` | `"disconnected"` on 401/403; `"unavailable"` when no credentials found |
| `status_message` | `String` | Human-readable English string | Backend-only; frontend uses i18n mapping |
| `dimensions` | `Vec<QuotaDimension>` | 0–4 items | Null API dimensions are omitted; empty on connection failure |
| `source` | `String` | `"env:CLAUDE_CODE_OAUTH_TOKEN"`, `"keychain"`, `"file:~/.claude/.credentials.json"` | Diagnostic; not displayed to user |

---

## New API Response Structure (Rust — internal to `claude_code/mod.rs`)

Deserializes the Claude Code usage API response. Never exposed outside the module.

```rust
struct ClaudeCodeUsageResponse {
    five_hour: Option<UsageDimension>,
    seven_day: Option<UsageDimension>,
    seven_day_sonnet: Option<UsageDimension>,
    seven_day_opus: Option<UsageDimension>,
}

struct UsageDimension {
    utilization: f64,        // 0.0–100.0, percentage already used
    resets_at: String,       // ISO 8601, e.g. "2026-02-08T12:00:00+00:00"
}
```

**Transformation to `QuotaDimension`**:
- `remaining_percent = (100.0 - utilization).round().clamp(0, 100) as u8`
- `label` — static mapping: `five_hour` → `"Claude Code / 5h"`, `seven_day` → `"Claude Code / week"`, `seven_day_sonnet` → `"Claude Code / week (Sonnet)"`, `seven_day_opus` → `"Claude Code / week (Opus)"`
- `reset_hint` — computed from `resets_at` ISO 8601 → relative string: `"Resets in Xh"` / `"Resets in Xm"` / `"Resets in Xd"` / `"Reset due"`
- `remaining_absolute` — `"{remaining_percent}% remaining"` (English; localized by frontend)
- `status` and `progress_tone` — computed by the existing `quota_status()` and `quota_progress_tone()` functions in `commands/mod.rs`

---

## New Credential Structure (Rust — internal to `claude_code/mod.rs`)

Deserializes the credentials JSON. Never persisted or exposed outside the read path.

```rust
struct ClaudeCredentials {
    claude_ai_oauth: OAuthCredential,
}

struct OAuthCredential {
    access_token: String,
    expires_at: Option<String>,   // ISO 8601; checked for expiry detection
}
```

**Validity check**:
- Token absent → `connection_state: "unavailable"`
- Token present but `expires_at` is past → still attempt the API call; if 401/403 returned, then → `connection_state: "disconnected"`
- Token present and not expired → proceed to API call

---

## Extended: `UserPreferences` (Rust — `state/mod.rs`)

Two new fields added with `#[serde(default)]` for backward compatibility with existing saved preference files.

```rust
pub struct UserPreferences {
    // existing fields unchanged
    pub language: String,
    pub refresh_interval_minutes: u16,
    pub tray_summary_mode: String,
    pub autostart_enabled: bool,
    pub notification_test_enabled: bool,
    pub last_saved_at: String,

    // new fields
    #[serde(default = "default_menubar_service")]
    pub menubar_service: String,       // "codex" | "claude-code" | future IDs

    #[serde(default = "default_service_order")]
    pub service_order: Vec<String>,    // ordered list of service IDs for panel display
}
```

**Defaults**:
```rust
fn default_menubar_service() -> String { "codex".into() }
fn default_service_order() -> Vec<String> { vec!["codex".into(), "claude-code".into()] }
```

**Identity & Uniqueness**: `menubar_service` holds a single service ID string; must match a known service ID (`"codex"` or `"claude-code"`). Unknown values fall back to `"codex"` at tray render time (graceful degradation). `service_order` may contain duplicate or unknown service IDs — the renderer ignores unknowns and shows each known service exactly once.

**Lifecycle**: Persisted to the local preferences JSON file on every `save_preferences` call. Backward-compatible deserialize: existing files without these fields produce the defaults above.

---

## Extended: `PreferencePatch` (Rust — `state/mod.rs`)

```rust
pub struct PreferencePatch {
    // existing fields unchanged
    pub language: Option<String>,
    pub refresh_interval_minutes: Option<u16>,
    pub tray_summary_mode: Option<String>,
    pub autostart_enabled: Option<bool>,
    pub notification_test_enabled: Option<bool>,

    // new fields
    pub menubar_service: Option<String>,
    pub service_order: Option<Vec<String>>,
}
```

---

## Extended: `UserPreferences` (TypeScript — `contracts.ts`)

```typescript
export interface UserPreferences {
  language: "zh-CN" | "en-US";
  refreshIntervalMinutes: number;
  traySummaryMode: TraySummaryMode;
  autostartEnabled: boolean;
  notificationTestEnabled: boolean;
  lastSavedAt: string;
  // new
  menubarService: string;    // service ID: "codex" | "claude-code"
  serviceOrder: string[];    // ordered list of service IDs for panel display
}

export interface PreferencePatch {
  language?: UserPreferences["language"];
  refreshIntervalMinutes?: number;
  traySummaryMode?: UserPreferences["traySummaryMode"];
  autostartEnabled?: boolean;
  notificationTestEnabled?: boolean;
  // new
  menubarService?: string;
  serviceOrder?: string[];
}
```

---

## Unchanged Types

These existing types require no schema changes:

- **`QuotaDimension`** (Rust + TypeScript) — used as-is for Claude Code dimensions
- **`PanelPlaceholderItem`** (Rust + TypeScript) — used as-is; Claude Code item uses `serviceId: "claude-code"`, `iconKey: "claude-code"`
- **`CodexPanelState`** (Rust + TypeScript) — returned unchanged by the new `get_claude_code_panel_state` command; the existing `items[]` array holds the Claude Code service card

---

## State Lifecycle: Claude Code Service Card

```
App starts / refresh triggered
  └─ load_claude_code_snapshot()
       ├─ read token (env → keychain → file)
       │    ├─ not found → snapshot_state: "empty", connection_state: "unavailable"
       │    └─ found → call api.anthropic.com/api/oauth/usage
       │         ├─ 401/403 → snapshot_state: "failed", connection_state: "disconnected"
       │         ├─ 429 / 5xx / timeout / DNS → snapshot_state: "stale", last cached dimensions
       │         └─ 200 OK → snapshot_state: "fresh", connection_state: "connected"
       │              └─ filter null dimensions → transform utilization → QuotaDimension[]
       └─ return ClaudeCodeSnapshot
```
