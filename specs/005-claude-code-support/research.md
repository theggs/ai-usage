# Research: Claude Code Service Support

**Phase**: 0 — Research & Decision Log
**Feature**: 005-claude-code-support
**Date**: 2026-03-20

## Decision 1 — HTTP Client for Rust Backend

**Decision**: Use `ureq` (v2, sync/blocking, TLS via `native-tls` or `rustls`)

**Rationale**: The existing Rust backend (`codex/mod.rs`) is fully synchronous — it uses `std::thread`, `std::process::Command`, and blocking I/O with no async runtime. `ureq` is a lightweight synchronous HTTP client that fits this pattern. It adds minimal dependencies compared to `reqwest`'s blocking feature, which still pulls in tokio internals. `ureq` supports JSON deserialization via `serde_json` (already in Cargo.toml).

**Alternatives considered**:
- `reqwest` with `blocking` feature: works but adds significant transitive dependencies (tokio runtime for internal use even in blocking mode)
- `tauri-plugin-http`: designed for frontend invocations via Tauri commands, not for direct backend use from Rust code
- `std::net::TcpStream` with manual TLS: too low-level and fragile for production HTTPS

**Cargo.toml addition**:
```toml
ureq = { version = "2", features = ["json"] }
```

---

## Decision 2 — ISO 8601 → Relative Reset Hint

**Decision**: Add `chrono` crate for parsing ISO 8601 datetime strings from the Claude Code API.

**Rationale**: The Claude Code API returns `resets_at` as an ISO 8601 string (e.g., `"2026-02-08T12:00:00+00:00"`). The existing Codex integration uses Unix timestamps (`i64`) and has bespoke formatting. `chrono` is the standard Rust datetime crate, handles timezone-aware ISO 8601 parsing cleanly, and is small. The relative-time formatting ("Resets in 2h") must produce the same string format as Codex so that the existing `localizeResetHint()` i18n function in the frontend works without changes.

**Shared reset-hint format** (must match for i18n compatibility):
- `"Resets in Xm"` — for < 1 hour
- `"Resets in Xh"` — for < 24 hours
- `"Resets in Xd"` — for ≥ 24 hours
- `"Reset due"` — when `resets_at` is in the past

**Cargo.toml addition**:
```toml
chrono = { version = "0.4", features = ["serde"] }
```

---

## Decision 3 — macOS Keychain Token Read

**Decision**: Use `std::process::Command` to invoke `security find-generic-password`, matching the existing pattern in `codex/mod.rs`. Decode hex output in pure Rust (no extra crate needed).

**Rationale**: `codex/mod.rs` already uses `std::process::Command` for `codex --version` and `codex app-server`. Consistency is preferable. Hex decoding is trivial: iterate chars in pairs, `u8::from_str_radix(pair, 16)`.

**Service name construction**:
- Default (no `CLAUDE_CONFIG_DIR`): `"Claude Code-credentials"`
- With `CLAUDE_CONFIG_DIR` set: `"Claude Code-credentials-<sha256_first_8_chars>"`
- SHA-256 requires either `sha2` crate or minimal inline implementation. **Decision**: add `sha2` crate for correctness; it is small with no transitive I/O dependencies.

```toml
sha2 = "0.10"
```

**Full credential priority order** (evaluated each refresh cycle):
1. `CLAUDE_CODE_OAUTH_TOKEN` env var → use directly
2. macOS Keychain → `security find-generic-password` → hex decode → JSON parse → `claudeAiOauth.accessToken`
3. `~/.claude/.credentials.json` file → JSON parse → `claudeAiOauth.accessToken`
4. No token found → `connection_state: "unavailable"`

---

## Decision 4 — Preferences Backward Compatibility

**Decision**: Add `menubar_service` and `service_order` as new fields with `#[serde(default)]` to `UserPreferences`. Existing saved preferences files will deserialize without errors; new fields get their defaults.

**Defaults**:
- `menubar_service`: `"codex"` — preserves existing behavior for users who upgrade
- `service_order`: `["codex", "claude-code"]` — Codex first (backward-compatible rendering order)

**Serde approach**:
```rust
fn default_menubar_service() -> String { "codex".into() }
fn default_service_order() -> Vec<String> { vec!["codex".into(), "claude-code".into()] }
```

---

## Decision 5 — Multi-Service Panel Architecture

**Decision**: Keep separate Tauri commands per service (`get_codex_panel_state`, `get_claude_code_panel_state`). Frontend fetches both, reads `serviceOrder` from preferences, and renders cards in configured order.

**Rationale**: This preserves the existing Codex command as-is (zero regression risk). Each service refreshes and fails independently. The frontend already combines items for display. A future unified `get_panel_state` command can be added when more than 2 services exist.

**Tray filtering**: `apply_display_mode` currently pools all items' dimensions. With `menubar_service` preference, the caller (in `commands/mod.rs`) must pass only the items belonging to the selected service. The `format_summary` function in `tray/mod.rs` remains unchanged — it operates on whatever items it receives.

---

## Decision 6 — `ClaudeCodeSnapshot` Type

**Decision**: Use a type alias `type ClaudeCodeSnapshot = CodexSnapshot` in `claude_code/mod.rs`. Both have identical fields (`snapshot_state`, `connection_state`, `status_message`, `dimensions`, `source`).

**Rationale**: Avoids code duplication. If the two snapshot types diverge in the future, the alias can be replaced with a distinct type. `CodexSnapshot` will eventually be renamed `ServiceSnapshot` as part of a broader generalization (out of scope for this feature).

---

## Decision 7 — i18n New Copy Keys

New keys required in `CopyTree` / `baseCopy` (English) and `zhCN` override (Chinese):

| Key | English | Chinese |
|-----|---------|---------|
| `menubarService` | "Menubar service" | "菜单栏服务" |
| `serviceOrder` | "Panel order" | "面板顺序" |
| `claudeCodeLabel` | "Claude Code" | "Claude Code" |
| `codexLabel` | "Codex" | "Codex" |
| `claudeCodeNotConnected` | "Log in to Claude Code to see quota" | "请登录 Claude Code 以查看额度" |

No changes to `localizeResetHint` — it already handles the `"Resets in Xh/Xm/Xd"` and `"Reset due"` strings produced by the new Rust module.
