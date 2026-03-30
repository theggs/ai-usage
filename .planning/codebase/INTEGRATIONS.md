# External Integrations

**Analysis Date:** 2026-03-31

## APIs & External Services

**Anthropic Claude Code OAuth API:**
- Service: `https://api.anthropic.com/api/oauth/usage` (Anthropic usage quota API)
- What it's used for: Fetch Claude Code usage metrics (5-hour and 7-day rolling windows, model-specific breakdowns)
- SDK/Client: `ureq` 2.x (custom Rust HTTP client)
- Auth: OAuth bearer token (read from env, macOS Keychain, or `~/.claude/.credentials.json`)
- Implementation: `src-tauri/src/claude_code/mod.rs`
- Error handling: 401 (session recovery), 403 (access denied), 429 (rate limit), other HTTP errors
- Beta header: `anthropic-beta: oauth-2025-04-20` (experimental API version pinning)

**Codex CLI App-Server:**
- Service: Local `codex` CLI binary (Anthropic's code completions CLI)
- What it's used for: Query local Codex account rate limits via JSON-RPC
- Protocol: JSON-RPC 2.0 over stdin/stdout
- Implementation: `src-tauri/src/codex/mod.rs`
- Startup: `codex app-server` subprocess with JSON-RPC request/response streaming
- Fallback: Environment variables `AI_USAGE_CODEX_STATUS_TEXT` or `AI_USAGE_CODEX_STATUS_FILE` for offline/dev testing

## Data Storage

**Databases:**
- **SQLite (read-only):**
  - Codex metadata: `~/.codex/state.db` (via rusqlite 0.32 with bundled SQLite)
  - Claude metadata: `~/.claude/*` (local SQLite databases for activity signals)
  - Purpose: Auto-menubar service selection based on recent activity timestamps
  - Access mode: Read-only (`OpenFlags::SQLITE_OPEN_READ_ONLY`)
  - Client: `rusqlite` 0.32
  - Implementation: `src-tauri/src/agent_activity/mod.rs`

**File Storage:**
- **Local JSON files (read/write):**
  - Preferences: `~/.config/ai-usage/preferences.json` (or platform-specific path via `XDG_CONFIG_HOME` / `APPDATA`)
  - Codex accounts: `~/.config/ai-usage/codex-accounts.json`
  - Snapshot cache: `~/.config/ai-usage/snapshot-cache.json` (stale quota data for UI fallback)
  - Implementation: `src-tauri/src/codex/mod.rs` (load/save functions)

**Caching:**
- In-memory stale cache (Rust static Mutex): Last-known quota dimensions preserved across transient API failures
- Disk cache: `snapshot-cache.json` for persistence across app restarts
- Seed mechanism: `seed_stale_cache()` in `src-tauri/src/claude_code/mod.rs`

## Authentication & Identity

**Auth Provider:**
- Custom multi-source approach (no third-party OAuth provider)
- Source priority:
  1. Environment variable `CLAUDE_CODE_OAUTH_TOKEN`
  2. macOS Keychain (service: `Claude Code-credentials` or hash-derived name)
  3. File: `~/.claude/.credentials.json` (read-only fallback)
- Token storage: Never persisted in app memory between refresh cycles
- Credentials format: JSON with `claudeAiOauth.accessToken` field (plaintext or hex-encoded legacy format)

**Codex Auth:**
- CLI-based: `codex login status` subprocess check
- Logged-in detection: Checks stdout/stderr for "Logged in" prefix
- Implementation: `src-tauri/src/codex/mod.rs` functions `login_state_message()`, `login_message_indicates_logged_in()`

## Monitoring & Observability

**Error Tracking:**
- None (no external error tracking service)
- Local error logging: Snapshot status enums capture errors (SnapshotStatus::TemporarilyUnavailable, SnapshotStatus::SessionRecovery)
- Implementation: `src-tauri/src/snapshot.rs` status definition

**Logs:**
- Approach: Console/debug output only (no persistent log file in production)
- E2E testing: Control file approach (`AI_USAGE_E2E_CONTROL_FILE`) for test orchestration
- Implementation: `src-tauri/src/lib.rs` `start_e2e_control_loop()`

## CI/CD & Deployment

**Hosting:**
- Desktop (packaged Tauri app): macOS .app bundles, Windows .msi/.exe
- No remote backend; all integrations are outbound API calls

**CI Pipeline:**
- None detected (no `.github/workflows` or CI config)
- Build verification: `scripts/ci/verify-build-stability.mjs` (local/manual only)

**Build Process:**
- Frontend: Vite build (`npm run build` → `dist/`)
- Backend: Cargo build in `src-tauri/`
- Combined: `npm run tauri:build` (Tauri CLI orchestrates Vite + Cargo)

## Environment Configuration

**Required env vars (optional; have defaults):**
- `CLAUDE_CODE_OAUTH_TOKEN` - Claude Code OAuth token (if not in Keychain or file)
- `CLAUDE_CONFIG_DIR` - Override Claude config dir (default: `~/.claude`)
- `AI_USAGE_CODEX_HOME` - Override Codex home (default: `~/.codex`)
- `AI_USAGE_CODEX_BIN` - Override Codex CLI path (default: search PATH)
- `AI_USAGE_PREFERENCES_FILE` - Override preferences JSON path
- `AI_USAGE_CODEX_ACCOUNTS_FILE` - Override accounts JSON path
- `AI_USAGE_CODEX_STATUS_TEXT` or `AI_USAGE_CODEX_STATUS_FILE` - Fallback snapshot data for offline testing

**Secrets location:**
- macOS Keychain (primary): `security find-generic-password` via CLI
- File: `~/.claude/.credentials.json` (NOT versioned; read-only)
- Environment: `CLAUDE_CODE_OAUTH_TOKEN` env var (for CI/automation)
- No `.env` file in repository; secrets never committed

## Network Configuration

**Proxy Support:**
- Detection strategy:
  1. User manual override via preferences (`network_proxy_mode: "manual"`, `network_proxy_url`)
  2. System proxy via environment variables (`HTTPS_PROXY`, `HTTP_PROXY`, `ALL_PROXY`)
  3. macOS system proxy via `scutil --proxy` (fallback for GUI apps that don't inherit env)
- Implementation: `src-tauri/src/claude_code/mod.rs` functions `resolve_proxy()`, `get_macos_system_proxy()`
- HTTP client: `ureq` with proxy configuration applied per-request

## Webhooks & Callbacks

**Incoming:**
- None detected (app is read-only consumer of external APIs)

**Outgoing:**
- Tauri notifications: Native OS notifications (macOS/Windows)
- Implementation: `tauri-plugin-notification` 2.0.0
- Usage: `src-tauri/src/notifications/mod.rs`

## Data Flow

**Claude Code Quota Fetch:**

1. Frontend requests refresh via Tauri command `get_panel_state()`
2. Backend calls `claude_code::load_snapshot()` with UserPreferences
3. Claude Code module:
   - Reads OAuth token (env → keychain → file)
   - Resolves proxy settings
   - Calls `https://api.anthropic.com/api/oauth/usage` with Bearer token
   - Parses JSON response (five_hour, seven_day, model-specific breakdowns)
   - Transforms to QuotaDimension array with reset hints
   - Seeds in-memory stale cache for next transient failure
   - Returns ServiceSnapshot with Fresh/SessionRecovery/RateLimited status
4. Frontend renders quota dimensions with progress bars

**Codex Status Fetch:**

1. Backend calls `codex::load_snapshot()`
2. Codex module:
   - Checks if `codex` CLI exists (--version test)
   - Spawns `codex app-server` subprocess
   - Sends JSON-RPC requests via stdin (initialize, initialized, account/rateLimits/read)
   - Reads JSON-RPC responses from stdout with timeout (5 seconds)
   - Parses rate limit window data and formats reset hints
   - Returns ServiceSnapshot with status
3. Fallback: If CLI unavailable, reads `AI_USAGE_CODEX_STATUS_TEXT` env or file

**Activity Signal Fetch (Auto-Menubar Mode):**

1. Backend polls Codex/Claude activity directories every 15 seconds
2. Checks SQLite databases (read-only): state.db, logs, session metadata
3. Extracts last activity timestamp and confidence level
4. Routes to highest-activity service for menubar display rotation

## Rate Limiting & Backoff

**Claude Code API:**
- 429 response triggers 30-minute cooldown via PauseState::RateLimitedUntil
- Auto-refresh skipped during cooldown; manual refresh shows cached data with retry hint
- 401 enters session-recovery state (no pause); auto-refresh continues to probe for token recovery

**Codex CLI:**
- No explicit rate limiting; subprocess timeouts at 5 seconds

---

*Integration audit: 2026-03-31*
