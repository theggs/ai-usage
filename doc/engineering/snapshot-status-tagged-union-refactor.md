# Snapshot Status Tagged Union Refactor

## Background

The current snapshot protocol uses three string fields (`snapshot_state`, `connection_state`, `status_message`) to convey ~15 distinct error scenarios across two services. The frontend must reverse-engineer the actual error by matching English substrings in `status_message`, leading to repeated "wrong label" bugs (e.g., 429 rate-limited showing "Sign in required", CLI-not-found showing "CLI installed").

This document defines the refactoring plan to replace the ad-hoc string protocol with a Rust tagged union (`#[serde(tag = "kind")]` enum) that serialises as JSON discriminated unions, giving both Rust and TypeScript exhaustiveness checking.

## Current Protocol

```rust
pub struct CodexSnapshot {          // ClaudeCodeSnapshot has identical shape
    pub snapshot_state: String,     // "fresh" | "stale" | "empty" | "failed" | "pending"
    pub connection_state: String,   // "connected" | "disconnected" | "unavailable" | "failed"
    pub status_message: String,     // free-form English text
    pub dimensions: Vec<QuotaDimension>,
    pub source: String,
}
```

Problems:
- `snapshot_state` has 5 values representing ~15 scenarios (semantic overload)
- `connection_state` exists but the frontend ignores it
- Frontend must `message.includes("rate limited")` to identify 429 (fragile implicit protocol)
- Two services assign different states for analogous conditions (inconsistent)

## Target Protocol

### Rust (backend)

```rust
/// Exhaustive status enum shared by all services.
/// Serialises as `{ "kind": "VariantName", ...variant_fields }`.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(tag = "kind")]
pub enum SnapshotStatus {
    /// Live data successfully fetched.
    Fresh,
    /// CLI binary not found on this device (Codex-specific).
    CliNotFound,
    /// CLI installed but no logged-in session available.
    NotLoggedIn,
    /// No OAuth credentials found (Claude Code-specific).
    NoCredentials,
    /// Session invalid (HTTP 401); attempting automatic recovery.
    SessionRecovery,
    /// HTTP 429; automatic refresh paused.
    RateLimited {
        retry_after_minutes: u32,
    },
    /// HTTP 403; automatic refresh paused.
    AccessDenied,
    /// Proxy configuration is invalid.
    ProxyInvalid,
    /// Transient server/network error.
    TemporarilyUnavailable {
        detail: String,
    },
    /// Connected and authenticated but no quota dimensions returned.
    NoData,
    /// Service query is disabled by user preference.
    Disabled,
}
```

```rust
/// Unified snapshot returned by both Codex and Claude Code modules.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServiceSnapshot {
    pub status: SnapshotStatus,
    pub dimensions: Vec<QuotaDimension>,
    pub source: String,
}
```

### JSON wire format examples

```json
{ "status": { "kind": "Fresh" }, "dimensions": [...], "source": "codex app-server" }
{ "status": { "kind": "RateLimited", "retry_after_minutes": 30 }, "dimensions": [], "source": "keychain" }
{ "status": { "kind": "TemporarilyUnavailable", "detail": "HTTP 502" }, "dimensions": [], "source": "keychain" }
```

### TypeScript (frontend)

```typescript
type SnapshotStatus =
  | { kind: "Fresh" }
  | { kind: "CliNotFound" }
  | { kind: "NotLoggedIn" }
  | { kind: "NoCredentials" }
  | { kind: "SessionRecovery" }
  | { kind: "RateLimited"; retry_after_minutes: number }
  | { kind: "AccessDenied" }
  | { kind: "ProxyInvalid" }
  | { kind: "TemporarilyUnavailable"; detail: string }
  | { kind: "NoData" }
  | { kind: "Disabled" };

interface ServiceSnapshot {
  status: SnapshotStatus;
  dimensions: QuotaDimension[];
  source: string;
}
```

## Variant ↔ Scenario Mapping

### Codex

| Variant | Trigger | Old snapshot_state | Old connection_state |
|---------|---------|-------------------|---------------------|
| `Fresh` | CLI installed, logged in, dimensions available | fresh | connected |
| `CliNotFound` | `codex_cli_is_available()` returns false | stale | unavailable |
| `NotLoggedIn` | CLI installed but `login_message_indicates_logged_in()` false | stale | disconnected |
| `NoData` | Logged in but dimensions empty (rate limits or parsed text) | empty | connected |
| `TemporarilyUnavailable` | app-server request fails while logged in; parse error; snapshot source read error | failed | failed |

### Claude Code

| Variant | Trigger | Old snapshot_state | Old connection_state |
|---------|---------|-------------------|---------------------|
| `Fresh` | API call succeeds, dimensions available | fresh | connected |
| `NoCredentials` | `read_oauth_token()` returns None | empty | unavailable |
| `SessionRecovery` | HTTP 401 (with or without cache) | stale/empty | disconnected |
| `RateLimited` | HTTP 429 | stale | connected |
| `AccessDenied` | HTTP 403 | failed | failed |
| `ProxyInvalid` | Proxy configuration error | failed | failed |
| `TemporarilyUnavailable` | Other HTTP errors; network errors | stale | connected |
| `Disabled` | User has not enabled Claude Code query | empty | — |

## Frontend Display Mapping

One `switch` on `status.kind`, no substring matching, no service-specific branching needed for most cases:

| `status.kind` | title (en) | title (zh) | body (en) | body (zh) |
|---------------|-----------|-----------|----------|----------|
| `CliNotFound` | CLI not installed | CLI 未安装 | Install the CLI first, then come back here to connect it. | 请先安装对应 CLI，安装后再回到这里完成连接。 |
| `NotLoggedIn` | Sign in required | 需要先登录 | The CLI is installed, but there is no readable signed-in session yet. | CLI 已安装，但当前没有可读取的登录会话。 |
| `NoCredentials` | Not connected | 未连接 | Install Claude Code CLI and log in, then come back here to connect it. | 请先安装 Claude Code CLI 并登录，安装后再回到这里完成连接。 |
| `SessionRecovery` | Recovering session | 会话恢复中 | Session is being restored. It usually recovers after you open the CLI. | 会话恢复中，打开对应 CLI 后通常会自动恢复。 |
| `RateLimited` | Rate limited | 请求限流 | Automatic refresh is paused; try a manual refresh later. | 已暂停自动刷新，请稍后手动重试。 |
| `AccessDenied` | Access denied | 访问被拒绝 | Automatic refresh is paused until you retry manually or update proxy settings. | 已暂停自动刷新。请手动重试或更新代理设置。 |
| `ProxyInvalid` | Proxy invalid | 代理无效 | Use a full proxy URL or switch back to system proxy detection. | 请填写完整代理 URL，或切回系统代理检测。 |
| `TemporarilyUnavailable` | Temporarily unavailable | 暂时不可用 | The service is temporarily unavailable. It may recover on the next refresh. | 服务暂时不可用，下次刷新时可能恢复。 |
| `NoData` | No data yet | 暂无数据 | The service is connected but no quota data is available yet. | 服务已连接，但尚无可用的额度数据。 |
| `Disabled` | (hidden by other UI logic) | — | — | — |

## Implementation Steps

### Step 1: Define shared types (backend)

- Create `src-tauri/src/snapshot.rs` with `SnapshotStatus` enum and `ServiceSnapshot` struct.
- Both `codex/mod.rs` and `claude_code/mod.rs` import and return `ServiceSnapshot`.
- `QuotaDimension` stays as-is (it's already shared).

### Step 2: Migrate Codex snapshot construction

- Replace all `CodexSnapshot { snapshot_state: "...", ... }` constructions in `codex/mod.rs` with `ServiceSnapshot { status: SnapshotStatus::Xxx, ... }`.
- Remove the old `CodexSnapshot` struct.
- Update `load_snapshot()` return type.

### Step 3: Migrate Claude Code snapshot construction

- Replace all `ClaudeCodeSnapshot { ... }` constructions in `claude_code/mod.rs`.
- Remove helper functions that only existed to build old-style snapshots (`pause_snapshot`, `rate_limited_snapshot`, `invalid_proxy_snapshot`).
- Remove the old `ClaudeCodeSnapshot` struct.
- Update `load_snapshot()` return type.

### Step 4: Update commands layer

- `commands/mod.rs`: update `build_panel_state()` and `build_claude_code_panel_state_with_kind()` to accept `ServiceSnapshot`.
- `CodexPanelState` struct: replace `snapshot_state: String` + `status_message: String` with `status: SnapshotStatus`.
- Serialisation to frontend changes accordingly.

### Step 5: Update frontend types

- `src/lib/tauri/contracts.ts`: add `SnapshotStatus` discriminated union type, update `PanelState` interface.

### Step 6: Replace frontend mapping logic

- `src/app/shared/i18n.ts`: replace `getServicePlaceholderCopy()` and `getClaudeCodePlaceholderMessage()` with a single `getPlaceholderCopy(status: SnapshotStatus)` that switches on `status.kind`.
- Remove all `message.includes(...)` substring matching.
- Remove `normalizeSnapshotState()` helper.
- Add new copy keys as defined in the display mapping table above.

### Step 7: Update panel rendering

- `src/app/panel/PanelView.tsx`: use `status.kind` instead of `snapshotState` string.
- `src/components/panel/ServiceCard.tsx`: update badge logic if it references `snapshotState`.
- `src/lib/tauri/summary.ts`: update any `snapshotState` references.

### Step 8: Update tests

- Update all test fixtures in `PanelView.test.tsx`, `SettingsView.test.tsx`, and contract tests to use the new `status` shape.

### Step 9: Clean up

- Remove dead copy keys from i18n (old `snapshotFresh`, `snapshotStale`, etc. if no longer referenced).
- Remove dead fields from type definitions.
- Run `cargo clippy`, `npm test`, `npx tsc -b --noEmit` to verify.
