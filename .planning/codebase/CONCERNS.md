# Codebase Concerns

**Analysis Date:** 2026-03-31

## Tech Debt

**Mutex lock error handling:**
- Issue: Code uses `.unwrap()` on Mutex locks which will panic if a lock is poisoned
- Files: `src-tauri/src/lib.rs` (lines 56, 99-100, 106), `src-tauri/src/commands/mod.rs` (multiple places)
- Impact: App crash in thread contention scenarios; no graceful recovery
- Fix approach: Replace `.unwrap()` with `.ok()` or explicit error handling; consider using `expect()` with clear error messages only in setup code that runs on main thread

**Proxy resolution lacks dedicated testing:**
- Issue: Network proxy detection via `ureq` and `scutil --proxy` fallback is complex but has minimal test coverage
- Files: `src-tauri/src/claude_code/mod.rs` (proxy decision logic)
- Impact: Users behind non-standard proxies may experience silent failures without clear error reporting
- Fix approach: Add integration tests for proxy resolution; improve `ProxyInvalid` error messages to include actual proxy URL attempted

**Credential reading priority order:**
- Issue: Reads credentials from three sources (env var, keychain, file) but fallback behavior is implicit
- Files: `src-tauri/src/claude_code/mod.rs` (lines 251-255)
- Impact: User confusion if credentials exist in multiple locations; no logging of which source was used (breaking for debugging)
- Fix approach: Add debug logging indicating which credential source was used; document priority in comments; consider adding a preference to override

**Module-level hex decoding helper:**
- Issue: Hex decoding for macOS keychain is a private module function, difficult to test independently
- Files: `src-tauri/src/claude_code/mod.rs` (lines 261-272)
- Impact: If hex-encoded keychain storage format changes, regression is hard to catch
- Fix approach: Extract to testable utility; add unit tests for both plain JSON and hex-encoded variants

## Known Bugs

**Session recovery state not fully tested:**
- Symptoms: 401 errors trigger session recovery mode but auto-refresh may not properly probe for token recovery
- Files: `src-tauri/src/claude_code/mod.rs` (lines 121-130, session recovery pause state)
- Trigger: Claude Code OAuth token expires; app enters `SessionRecovery` state
- Workaround: Manual refresh button still works; auto-refresh continues at normal interval
- Risk: User may not realize session is stale if they don't look at status badge

**Snapshot cache timestamp parsing fragile:**
- Symptoms: Cached panel states might use inconsistent timestamp formats (unix seconds vs ISO strings)
- Files: `src-tauri/src/commands/mod.rs` (lines 131-135, 151-153); `src-tauri/src/agent_activity/mod.rs` (lines 76-98)
- Trigger: App restarts after version upgrade that changes timestamp format
- Current mitigation: Code attempts multiple parse formats; falls back to 0
- Risk: Cached data silently discarded if timestamp format unrecognized

**Auto menubar rotation not tested with real service activity:**
- Symptoms: Auto rotation logic may not correctly detect which service is active
- Files: `src-tauri/src/agent_activity/mod.rs` (entire module); `src-tauri/src/state/mod.rs` (AutoMenubarSelectionState)
- Trigger: Both Codex and Claude Code are active; rotation should follow most recent activity
- Current mitigation: Falls back to "neutral" mode if activity signals are ambiguous
- Risk: End-to-end test coverage is via Playwright but activity signal parsing is not fully unit-tested

## Security Considerations

**Keychain access falls back to plaintext file:**
- Risk: If macOS keychain is unavailable, credentials fall back to `~/.claude/.credentials.json` which is world-readable depending on umask
- Files: `src-tauri/src/claude_code/mod.rs` (lines 240-249)
- Current mitigation: File is marked read-only in AGENTS.md; relies on user's home directory permissions
- Recommendations:
  - Add explicit permission check on file before reading (warn if 644 or worse)
  - Document in README that file must be chmod 600
  - Consider refusing to read if permissions are too loose

**OAuth token in memory across request cycle:**
- Risk: Token is loaded, used for API call, then discarded—but Python crash or signal could dump memory
- Files: `src-tauri/src/claude_code/mod.rs` (lines 251-255)
- Current mitigation: Token is ephemeral within function scope; not persisted in app state
- Recommendations: Verify token is not accidentally stored in error logs or panic messages; consider clearing sensitive strings from memory (though Rust ownership helps)

**Credential source ambiguity in logs:**
- Risk: If error occurs, user/support cannot determine which credential source was attempted
- Files: `src-tauri/src/claude_code/mod.rs` (no logging of credential source)
- Current mitigation: Source label is returned from `read_oauth_token()` but not logged on success
- Recommendations: Log credential source on successful read (at debug level); include in error messages

**Proxy configuration stored as plaintext in preferences:**
- Risk: Manual proxy URL with embedded password would be stored in `~/.config/ai-usage/preferences.json`
- Files: `src-tauri/src/state/mod.rs` (UserPreferences.networkProxyUrl)
- Current mitigation: URL is only stored when proxy mode is "manual"; typically used for corporate proxies without auth
- Recommendations: Document that proxy URLs should not contain credentials; consider using env vars for sensitive proxy auth

## Performance Bottlenecks

**Snapshot cache file I/O on every refresh:**
- Problem: Cache is read and written synchronously on every panel refresh
- Files: `src-tauri/src/commands/mod.rs` (lines 66-82, 100-104)
- Cause: No in-memory cache layer; every `read_snapshot_cache()` is a disk read
- Improvement path:
  - Cache the parsed SnapshotCache in memory (Mutex<Option<SnapshotCache>>)
  - Only write to disk on changes, not every refresh
  - Invalidate in-memory cache only when new data arrives

**Auto menubar scanning runs every 15 seconds:**
- Problem: Continuously probes Codex/Claude activity directories even if no auto mode is enabled
- Files: `src-tauri/src/lib.rs` (lines 52-73); `src-tauri/src/agent_activity/mod.rs` (entire module)
- Cause: Auto menubar loop always runs; only checks mode inside loop
- Improvement path: Only spawn auto menubar thread if mode is "auto"; stop thread when mode changes to fixed

**Activity signal probing reads multiple files per scan:**
- Problem: `collect_service_activity_snapshots()` reads from 7+ file sources per service per scan
- Files: `src-tauri/src/agent_activity/mod.rs` (signal collection logic)
- Cause: Breadth-first approach tries all signals in parallel
- Improvement path: Use file watching (if OS supports) instead of polling; prioritize most recent signal source

**No connection pooling for ureq HTTP client:**
- Problem: Every API call creates a fresh HTTP session
- Files: `src-tauri/src/claude_code/mod.rs` (HTTP request logic)
- Cause: `ureq` agent is created per request
- Improvement path: Create a single static agent pool; reuse across refresh cycles

## Fragile Areas

**Preference normalization duplicated across Rust and TypeScript:**
- Files: `src-tauri/src/state/mod.rs` (lines 290-309); `src/lib/persistence/preferencesStore.ts` (lines 77-129)
- Why fragile: Schema migrations must be applied in two places; inconsistency between front/back leads to silent bugs
- Safe modification:
  - Never change preference schema without updating both normalizers
  - Add integration tests that verify both sides accept/reject same inputs
  - Consider removing TypeScript normalizer and always rely on Rust side
- Test coverage: State tests check Rust side (line 335-404); no cross-platform contract test

**SnapshotStatus enum is serialized with serde(tag):**
- Files: `src-tauri/src/snapshot.rs` (lines 6-8)
- Why fragile: Adding variants requires understanding serde tag format; breaking change if variant order changes
- Safe modification: All new variants must go at the end; document variant serialization in comment
- Test coverage: No serialization round-trip tests

**Service ID hardcoding across codebase:**
- Files: Multiple—`src-tauri/src/state/mod.rs` (KNOWN_SERVICE_IDS), `src/lib/tauri/summary.ts` (SERVICE_IDS), `src-tauri/src/agent_activity/mod.rs` (SUPPORTED_SERVICES)
- Why fragile: Adding a new service requires changes in 5+ files
- Safe modification: Add new service ID to all three constants simultaneously; run full test suite
- Test coverage: No schema validation test

**Panel state serialization for caching:**
- Files: `src-tauri/src/commands/mod.rs` (snapshot cache read/write)
- Why fragile: `CodexPanelState` has optional fields that must deserialize with defaults
- Safe modification: Always add new optional fields with `#[serde(default = "...")]`
- Test coverage: Integration test at `tests/integration/system-integrations.test.ts` (line 25-35) checks shape but not all variants

## Scaling Limits

**Single-threaded E2E test control loop:**
- Current capacity: Control file polling runs every 150ms; can handle ~6 actions/sec
- Limit: If E2E test sends commands faster than 150ms apart, commands may be dropped
- Scaling path: Replace polling with file watcher API (fsnotify on Linux, FSEvents on macOS)

**Mutex contention on AppState:**
- Current capacity: Currently 4 Mutex fields; no measured contention
- Limit: If new features add more state mutations, lock contention could cause UI lag
- Scaling path: Replace with atomic types where possible; consider parking_lot::Mutex for lower-contention alternatives

**Activity scanning disk I/O:**
- Current capacity: Scanning 7 file sources × 2 services × scan interval (15s) = ~2 stat calls/sec per desktop
- Limit: Scales poorly if activity sources multiply or scan interval decreases
- Scaling path: Implement file watching instead of polling; batch I/O operations

## Dependencies at Risk

**ureq HTTP client is minimal:**
- Risk: No built-in connection pooling, HTTP/2 support, or advanced retry logic
- Impact: May hit limits with high-frequency API calls or through complex proxies
- Migration plan: `reqwest` as drop-in with better async support; requires Tokio runtime integration

**rusqlite for Codex metadata:**
- Risk: Bundled SQLite adds build complexity; no automatic schema migration
- Impact: If Codex changes schema, reader breaks
- Migration plan: Version detection; store known schema versions; add explicit migration logic

**chrono for timestamp parsing:**
- Risk: Heavy dependency; multiple timestamp formats creates parsing complexity
- Impact: Inconsistent parsing across Rust/TypeScript side
- Migration plan: Reduce to ISO8601-only; use `time` crate (lighter) if duration support needed

## Missing Critical Features

**No retry logic for transient API failures:**
- Problem: Single HTTP 500 fails the entire refresh cycle
- Blocks: Users on flaky networks must manually refresh repeatedly
- Fix: Add exponential backoff with jitter; respect Retry-After headers

**No user-facing credential validation:**
- Problem: Invalid OAuth token only discovered during refresh
- Blocks: Users cannot test credentials before enabling Claude Code usage
- Fix: Add "test connection" button in settings; validate token before saving preference

**No preference sync across devices:**
- Problem: User installs on laptop and desktop but gets different configs
- Blocks: Team use cases where consistent monitoring across machines is needed
- Fix: Store preferences in cloud (GitHub gist, private GitHub repo, user's cloud service)

**No notification when quota exhausted:**
- Problem: App shows exhausted badge but doesn't notify
- Blocks: User discovers quota is gone only when they check panel
- Fix: Implement threshold-based notifications (trigger at <5% remaining)

**No quota usage history/trending:**
- Problem: Only current window displayed; no way to see if usage is accelerating
- Blocks: Users cannot predict when they'll hit limits
- Fix: Store daily snapshots; show sparkline of 7-day trend

## Test Coverage Gaps

**Claude Code credential reading:**
- What's not tested: Hex-encoded keychain values, file fallback, credential decoding
- Files: `src-tauri/src/claude_code/mod.rs` (lines 208-255)
- Risk: Regression in keychain parsing or file handling goes undetected
- Priority: High—credentials are sensitive

**Proxy resolution error cases:**
- What's not tested: Invalid proxy URLs, unreachable proxies, scutil parsing failures
- Files: `src-tauri/src/claude_code/mod.rs` (proxy decision logic)
- Risk: Users on corporate networks hit ProxyInvalid but don't understand why
- Priority: High—affects enterprise users

**Activity signal collection:**
- What's not tested: Multiple signal sources with conflicting timestamps, missing files, corrupted JSON/SQLite
- Files: `src-tauri/src/agent_activity/mod.rs` (entire module)
- Risk: Auto menubar selection fails silently if any signal source is malformed
- Priority: Medium—fallback to neutral mode masks issues

**Preference migration across app versions:**
- What's not tested: Old preference files with missing fields → new schema
- Files: `src-tauri/src/state/mod.rs` (deserialize test at line 335-360), `src/lib/persistence/preferencesStore.ts`
- Risk: Preference corruption on app upgrade
- Priority: High—affects all users

**Rate limit retry logic:**
- What's not tested: RateLimitedUntil state expiration, retry-after header parsing, cooldown calculation
- Files: `src-tauri/src/claude_code/mod.rs` (lines 132-147, 157-174)
- Risk: App may retry too early or ignore Retry-After headers
- Priority: Medium—affects rate-limited API users

**Snapshot cache invalidation:**
- What's not tested: Cache age calculation, timezone handling in timestamps, cache invalidation after preference changes
- Files: `src-tauri/src/commands/mod.rs` (lines 124-145)
- Risk: Stale cached data displayed if age calculation is wrong
- Priority: Medium—affects perceived freshness of data

---

*Concerns audit: 2026-03-31*
