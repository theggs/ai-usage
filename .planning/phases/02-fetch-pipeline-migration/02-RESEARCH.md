# Phase 02: Fetch Pipeline & Migration - Research

**Researched:** 2026-03-31
**Domain:** Rust trait-based provider fetch pipeline + IPC migration (Tauri 2)
**Confidence:** HIGH

## Summary

This phase lifts the existing Codex (JSON-RPC CLI subprocess) and Claude Code (OAuth HTTP API) fetch implementations behind a unified Rust trait interface (`ProviderFetcher`), adds generic IPC commands (`get_provider_state` / `refresh_provider_state`) that dispatch via registry lookup, and migrates the frontend to call the generic commands. The existing code is well-structured: both providers already produce `ServiceSnapshot` with `SnapshotStatus`, share the same `QuotaDimension` type, and follow consistent patterns (pause states, stale cache, refresh guards). The migration is primarily structural -- lifting module-level functions behind a trait -- with zero behavior change.

The codebase has strong existing test coverage on both sides. Codex has 7 Rust unit tests covering CLI detection, login states, rate limit parsing, and env var fallback. Claude Code has 18 Rust unit tests covering credential chain, proxy resolution, pause state transitions, and stale cache behavior. The frontend has 11 TypeScript test files. The migration must preserve all test assertions while adding trait-level dispatch tests.

**Primary recommendation:** Define a `ProviderFetcher` trait with `fn fetch(&self, preferences: &UserPreferences, refresh_kind: RefreshKind) -> ServiceSnapshot`, implement it for both providers by extracting their existing `load_snapshot()` functions, add generic IPC commands that dispatch via provider ID lookup, then thin-wrap the old commands to call the generic ones. Migrate frontend `tauriClient` to use generic commands. Keep old per-service commands as aliases during this phase.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Use a Rust trait (`ProviderFetcher` or similar) with per-provider implementations. Each provider impl encapsulates its entire fetch logic (credential resolution, API call, response parsing, error mapping to SnapshotStatus). This is idiomatic, extensible for Phase 3 new providers, and testable with mocks.
- **D-02:** Each provider's trait impl defines its own strategy chain internally (e.g., Claude Code: env var -> keychain -> credentials file -> API call). The strategy chain is an implementation detail of the provider, not a registry-level concept. The registry (ProviderDescriptor) stays minimal as decided in Phase 1.
- **D-03:** Refactor `codex/mod.rs` and `claude_code/mod.rs` directly into the pipeline trait -- no adapter wrappers. Both modules already produce `ServiceSnapshot` with `SnapshotStatus`; the refactor lifts this into a uniform trait interface. Existing behavior (pause states, rate limit cooldowns, stale cache seeding) must be preserved exactly.
- **D-04:** Add generic IPC commands `get_provider_state(provider_id)` and `refresh_provider_state(provider_id)` that dispatch via registry lookup to the appropriate trait impl. Keep existing per-service commands as thin wrappers calling the generic versions during transition. Frontend migrates to generic commands in this phase.

### Claude's Discretion
- Pipeline error handling strategy (retry semantics, timeout defaults) -- choose whatever preserves current behavior
- Whether to introduce a `FetchContext` struct bundling AppHandle + preferences + proxy config, or pass individual args -- optimize for ergonomics
- Test structure for the pipeline (unit tests per provider, integration test for dispatch) -- match existing test patterns

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PROV-03 | Existing Codex provider is migrated to the ProviderDescriptor registry with identical behavior | Codex `load_snapshot()` already returns `ServiceSnapshot`; wrap in trait impl. Strategy chain: env var text -> env var file -> CLI app-server. See Architecture Pattern 1. |
| PROV-04 | Existing Claude Code provider is migrated to the ProviderDescriptor registry with identical behavior | Claude Code `load_snapshot()` already returns `ServiceSnapshot`; wrap in trait impl. Strategy chain: env var token -> keychain -> file -> API call. Pause states and stale cache must be preserved. See Architecture Pattern 1. |
| PROV-05 | Provider fetch uses an ordered strategy chain; first success stops the chain | Both providers already implement this internally. Codex: `read_snapshot_source()` tries env vars first, falls back to CLI. Claude Code: `read_oauth_token()` chains env -> keychain -> file. The trait interface formalizes this without changing behavior. |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| tauri | 2.0.0 | IPC command framework | Already in use; `#[tauri::command]` + `State<AppState>` injection |
| serde / serde_json | 1.0 | Serialization for IPC payloads | Already in use; all types derive `Serialize`/`Deserialize` |
| ureq | 2.x | HTTP client (Claude Code API) | Already in use; proxy support built in |
| chrono | 0.4 | ISO timestamp parsing | Already in use for reset hint formatting |
| sha2 | 0.10 | Keychain service name hashing | Already in use in Claude Code credential reading |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| rusqlite | 0.32 | Codex metadata reads (agent_activity) | Not directly used in fetch pipeline but remains a dependency |

**No new dependencies required.** This phase is purely a structural refactor using existing crates.

## Architecture Patterns

### Recommended Project Structure
```
src-tauri/src/
  pipeline/              # NEW: fetch pipeline module
    mod.rs               # ProviderFetcher trait + dispatch + generic commands
    codex.rs             # CodexFetcher impl (extracted from codex/mod.rs)
    claude_code.rs       # ClaudeCodeFetcher impl (extracted from claude_code/mod.rs)
  codex/mod.rs           # KEEP: non-fetch utilities (storage_path, preferences, accounts)
  claude_code/mod.rs     # KEEP: slim shim re-exporting pipeline functions for backward compat
  commands/mod.rs         # MODIFIED: generic commands + thin legacy wrappers
  registry.rs            # UNMODIFIED
  snapshot.rs            # UNMODIFIED
  state/mod.rs           # UNMODIFIED
```

### Pattern 1: ProviderFetcher Trait

**What:** A trait that each provider implements with its complete fetch logic.

**When to use:** Every provider must implement this to be fetchable via the pipeline.

```rust
// src-tauri/src/pipeline/mod.rs

use crate::snapshot::ServiceSnapshot;
use crate::state::UserPreferences;

/// Refresh kind distinguishes user-initiated refreshes from automatic ones.
/// Some providers skip fetch when paused (e.g., 403 AccessDenied) for
/// automatic refreshes but allow manual refreshes to bypass the pause.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum RefreshKind {
    Automatic,
    Manual,
}

/// The core trait every provider implements.
/// Each implementation encapsulates its complete fetch logic:
/// credential resolution, API/CLI call, response parsing, error mapping.
pub trait ProviderFetcher: Send + Sync {
    /// Returns the provider ID (must match ProviderDescriptor.id).
    fn provider_id(&self) -> &str;

    /// Execute the fetch pipeline and return a ServiceSnapshot.
    fn fetch(
        &self,
        preferences: &UserPreferences,
        refresh_kind: RefreshKind,
    ) -> ServiceSnapshot;

    /// Seed stale cache from disk-restored data (optional, no-op default).
    fn seed_stale_cache(&self, _dimensions: Vec<crate::state::QuotaDimension>) {}

    /// Clear any access pause state (optional, no-op default).
    fn clear_access_pause(&self) {}
}
```

### Pattern 2: Provider Registry Integration

**What:** A function that returns a `&dyn ProviderFetcher` given a provider ID, parallel to the existing `get_provider()` for descriptors.

```rust
// src-tauri/src/pipeline/mod.rs

use std::sync::OnceLock;

fn fetchers() -> &'static [Box<dyn ProviderFetcher>] {
    static FETCHERS: OnceLock<Vec<Box<dyn ProviderFetcher>>> = OnceLock::new();
    FETCHERS.get_or_init(|| {
        vec![
            Box::new(codex::CodexFetcher),
            Box::new(claude_code::ClaudeCodeFetcher),
        ]
    })
}

pub fn get_fetcher(provider_id: &str) -> Option<&'static dyn ProviderFetcher> {
    fetchers()
        .iter()
        .find(|f| f.provider_id() == provider_id)
        .map(|f| f.as_ref())
}
```

### Pattern 3: Generic IPC Commands

**What:** Generic `get_provider_state` and `refresh_provider_state` commands that dispatch to the appropriate fetcher.

```rust
#[tauri::command]
pub fn get_provider_state(
    state: State<'_, AppState>,
    provider_id: String,
) -> Result<CodexPanelState, String> {
    let preferences = state.preferences.lock().unwrap().clone();
    // Check if provider is enabled
    let enabled = *preferences.provider_enabled.get(&provider_id).unwrap_or(&false);
    if !enabled && provider_id != "codex" {
        return Ok(disabled_panel_state(&preferences, &provider_id, &now_iso()));
    }
    // Try snapshot cache first
    if let Some(cached) = load_from_snapshot_cache(&provider_id, preferences.refresh_interval_minutes) {
        // Seed stale cache for providers that support it
        if let Some(fetcher) = pipeline::get_fetcher(&provider_id) {
            let dims: Vec<_> = cached.items.iter()
                .flat_map(|item| item.quota_dimensions.clone())
                .collect();
            fetcher.seed_stale_cache(dims);
        }
        return Ok(cached);
    }
    // Live fetch
    let fetcher = pipeline::get_fetcher(&provider_id)
        .ok_or_else(|| format!("Unknown provider: {}", provider_id))?;
    let snapshot = fetcher.fetch(&preferences, pipeline::RefreshKind::Automatic);
    let result = build_panel_state_from_snapshot(&provider_id, &preferences, snapshot, &now_iso());
    save_to_snapshot_cache(&provider_id, &result);
    Ok(result)
}
```

### Pattern 4: FetchContext Struct (Discretionary)

**What:** Bundle common parameters into a context struct for ergonomics.

**Recommendation:** YES, introduce `FetchContext`. It reduces parameter count and makes the trait method signature cleaner.

```rust
pub struct FetchContext<'a> {
    pub preferences: &'a UserPreferences,
    pub refresh_kind: RefreshKind,
}
```

However, keep proxy resolution inside each provider's implementation since only Claude Code currently uses HTTP (Codex uses CLI subprocess). This keeps the trait clean and avoids forcing Codex to deal with proxy config.

### Pattern 5: Panel State Builder Generalization

**What:** Extract the duplicated `build_panel_state` / `build_claude_code_panel_state` logic into a shared `build_provider_panel_state` function.

```rust
fn build_provider_panel_state(
    provider_id: &str,
    display_name: &str,
    icon_key: &str,
    snapshot: ServiceSnapshot,
    preferences: &UserPreferences,
    refreshed_at: &str,
) -> CodexPanelState {
    let effective_refreshed_at = effective_refresh_timestamp(provider_id, &snapshot.status, refreshed_at);
    let items = if snapshot.dimensions.is_empty() {
        Vec::new()
    } else {
        vec![PanelPlaceholderItem {
            service_id: provider_id.into(),
            service_name: display_name.into(),
            account_label: None,
            icon_key: icon_key.into(),
            quota_dimensions: normalize_dimensions(&snapshot.dimensions),
            status_label: "refreshing".into(),
            badge_label: Some(if snapshot.status.is_fresh() { "Live".into() } else { "stale".into() }),
            last_successful_refresh_at: effective_refreshed_at.clone(),
        }]
    };
    // ... rest of CodexPanelState construction
}
```

### Anti-Patterns to Avoid
- **Adapter wrappers around existing modules:** D-03 explicitly forbids this. Refactor directly.
- **Strategy chain as a registry concept:** D-02 says the strategy chain is an implementation detail of each provider. Don't add `strategies: Vec<FetchStrategy>` to `ProviderDescriptor`.
- **Breaking existing test assertions:** Every existing test must continue to pass. The trait extraction must not change any observable behavior.
- **Removing per-service IPC commands:** Keep `get_codex_panel_state`, `refresh_codex_panel_state`, etc. as thin wrappers during transition. They can be removed in a future phase.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Proxy resolution | Custom proxy detection | Existing `resolve_proxy()` from claude_code | Already handles env vars, scutil, Windows registry, manual config -- 100+ lines of tested code |
| Snapshot cache | New caching layer | Existing `SnapshotCache` in commands/mod.rs | Already handles versioning, expiry, per-service storage |
| Panel state construction | New panel builder | Generalized version of existing `build_panel_state` | Same fields, same logic, just parameterized by provider ID |
| Error-to-SnapshotStatus mapping | Generic error mapper | Per-provider mapping in trait impl | Each provider has unique error types (CLI exit codes vs HTTP status codes) |

**Key insight:** Almost everything needed for the pipeline already exists. The work is extraction and generalization, not invention.

## Common Pitfalls

### Pitfall 1: Static Mutex State Isolation During Migration
**What goes wrong:** Both `codex/mod.rs` and `claude_code/mod.rs` use module-level `static` Mutex state (stale cache, pause state). Moving fetch logic to `pipeline/` could orphan these statics.
**Why it happens:** Rust `static` items are tied to their defining module. Moving the function that reads/writes them to a different module without moving the statics creates split state.
**How to avoid:** Move the static state alongside the fetch logic. The `stale_cache()` and `pause_state()` functions must live in the same module as the fetcher implementation that uses them.
**Warning signs:** Tests for pause state transitions or stale cache seeding start failing after file restructuring.

### Pitfall 2: Codex-Specific Panel State Fields
**What goes wrong:** `CodexPanelState` has Codex-specific fields (`configured_account_count`, `enabled_account_count`, `active_session`) that don't apply to Claude Code. A generic builder might incorrectly populate these for non-Codex providers.
**Why it happens:** The type was designed for Codex and later co-opted for Claude Code (which sets these to 0/None).
**How to avoid:** The generic panel state builder should set account counts to 0 and active_session to None for non-Codex providers. Codex's trait impl or the command layer should populate these from AppState.
**Warning signs:** Claude Code panel showing non-zero account counts.

### Pitfall 3: Refresh Cooldown Logic in Commands Layer
**What goes wrong:** The `claude_refresh_cooldown_hit()` and `MIN_CLAUDE_REFRESH_COOLDOWN_SECS` logic lives in commands/mod.rs, not in the Claude Code module. Moving fetch logic to the pipeline without moving cooldown logic breaks the dedup guard.
**Why it happens:** The cooldown reads the snapshot cache (a commands-layer concern) to decide whether to skip the fetch.
**How to avoid:** Either (a) move cooldown logic into the trait impl (making the trait aware of snapshot cache), or (b) keep cooldown as a pre-dispatch check in the generic command layer. Option (b) is cleaner -- the generic `refresh_provider_state` command can check cooldown before dispatching to the fetcher.
**Warning signs:** Claude Code getting rate-limited by Anthropic because the cooldown guard was bypassed.

### Pitfall 4: Frontend Mock Fallback in client.ts
**What goes wrong:** `client.ts` has a per-command mock switch statement for non-Tauri environments (dev mode). Adding generic commands without updating the mock switch causes dev mode to break.
**Why it happens:** The frontend mock layer doesn't dynamically dispatch -- it's a hardcoded switch/case.
**How to avoid:** Add `get_provider_state` and `refresh_provider_state` cases to the mock switch that dispatch to the appropriate mock based on provider_id. Mirror the Tauri-side dispatch logic.
**Warning signs:** `Unsupported command` errors in browser dev mode.

### Pitfall 5: Tray Items Assembly After Migration
**What goes wrong:** `build_tray_items()` in commands/mod.rs directly calls `load_snapshot()` from codex and `load_claude_code_snapshot()` from claude_code. After migration, these function references need updating to use the pipeline.
**Why it happens:** Tray initialization is a separate code path from IPC commands.
**How to avoid:** Update `build_tray_items()` to iterate over enabled providers and dispatch through `get_fetcher()`. This also makes it future-proof for Phase 3 new providers.
**Warning signs:** Tray showing stale data or missing providers after migration.

### Pitfall 6: Send + Sync Trait Bounds
**What goes wrong:** The `ProviderFetcher` trait needs `Send + Sync` bounds because Tauri commands run on the async runtime. Implementations that hold non-Send types in their static state won't compile.
**Why it happens:** `Mutex<T>` is `Send + Sync` when `T: Send`, which is satisfied by current types. But if someone adds a non-Send field, it breaks.
**How to avoid:** Current implementations use `Mutex<Option<Vec<QuotaDimension>>>` and `Mutex<PauseState>` -- both are `Send + Sync`. Just be explicit about the trait bounds.
**Warning signs:** Compiler errors about trait bounds when registering fetchers.

## Code Examples

### Codex Fetch Strategy Chain (Current Implementation)
```rust
// Source: src-tauri/src/codex/mod.rs lines 524-551
// Strategy chain:
// 1. If CLI available -> run app-server JSON-RPC (live fetch)
// 2. If CLI unavailable -> try env var AI_USAGE_CODEX_STATUS_TEXT
// 3. If env var unavailable -> try env var AI_USAGE_CODEX_STATUS_FILE
// 4. If nothing found -> SnapshotStatus::CliNotFound
pub fn load_snapshot() -> ServiceSnapshot {
    let bin = codex_bin();
    if codex_cli_is_available(&bin) {
        return match read_live_snapshot() {
            Ok(snapshot) => snapshot,
            Err(detail) => ServiceSnapshot {
                status: SnapshotStatus::TemporarilyUnavailable { detail },
                dimensions: Vec::new(),
                source: "codex app-server".into(),
            },
        };
    }
    match read_snapshot_source() {
        Ok(Some(snapshot)) => snapshot,
        Ok(None) => ServiceSnapshot {
            status: SnapshotStatus::CliNotFound,
            dimensions: Vec::new(),
            source: "codex-cli".into(),
        },
        Err(detail) => ServiceSnapshot {
            status: SnapshotStatus::TemporarilyUnavailable { detail },
            dimensions: Vec::new(),
            source: "codex-cli".into(),
        },
    }
}
```

### Claude Code Fetch Strategy Chain (Current Implementation)
```rust
// Source: src-tauri/src/claude_code/mod.rs lines 644-751
// Strategy chain:
// 1. Resolve OAuth token (env var -> keychain -> file)
// 2. If no token -> SnapshotStatus::NoCredentials
// 3. Check pause state (AccessDenied blocks auto, RateLimited blocks auto)
// 4. Call Anthropic usage API via ureq with proxy
// 5. Map HTTP status codes to SnapshotStatus variants
// 6. On transient failures, preserve stale cache dimensions
```

### Generic Command Dispatch Pattern
```rust
// Thin wrapper preserving backward compatibility
#[tauri::command]
pub fn get_codex_panel_state(state: State<'_, AppState>) -> CodexPanelState {
    get_provider_state(state, "codex".into())
        .unwrap_or_else(|_| fallback_panel_state("codex"))
}
```

### Frontend Generic Client (Target State)
```typescript
// Source: src/lib/tauri/client.ts (target migration)
export const tauriClient = {
  getProviderPanelState: async (providerId: string) => {
    const [panelState, preferences] = await Promise.all([
      invoke<CodexPanelState>("get_provider_state", { providerId }),
      tauriClient.getPreferences()
    ]);
    return withSummary(panelState, preferences);
  },
  refreshProviderPanelState: async (providerId: string) => {
    const [panelState, preferences] = await Promise.all([
      invoke<CodexPanelState>("refresh_provider_state", { providerId }),
      tauriClient.getPreferences()
    ]);
    return withSummary(panelState, preferences);
  },
  // Legacy aliases
  getCodexPanelState: async () => tauriClient.getProviderPanelState("codex"),
  refreshCodexPanelState: async () => tauriClient.refreshProviderPanelState("codex"),
  getClaudeCodePanelState: async () => tauriClient.getProviderPanelState("claude-code"),
  refreshClaudeCodePanelState: async () => tauriClient.refreshProviderPanelState("claude-code"),
  // ...
};
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Per-service hardcoded IPC commands | Generic dispatch via provider_id | This phase | New providers need only trait impl, not new commands |
| Per-service panel state builders | Shared builder parameterized by metadata | This phase | Eliminates duplicated build logic (~80 lines per provider) |
| Scattered `is_claude_code_usage_enabled` checks | Provider-enabled check in generic command | This phase | Consistent enable/disable behavior for all providers |

## Open Questions

1. **Codex active_session handling in generic builder**
   - What we know: `CodexPanelState.active_session` is populated only for Codex when the fetch is successful. Claude Code always sets it to `None`.
   - What's unclear: Should the generic builder handle active_session, or should Codex override it post-build?
   - Recommendation: Let the generic builder set `active_session: None`. Codex's command handler (or a post-fetch hook) can populate it. This keeps the generic path clean.

2. **build_tray_items migration scope**
   - What we know: `build_tray_items()` is called from both IPC commands and `lib.rs` setup. It directly calls provider-specific fetch functions.
   - What's unclear: Should `build_tray_items` be migrated to use the pipeline in this phase, or deferred?
   - Recommendation: Migrate it. It uses the same fetch path and must work with N providers for Phase 3.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 3.x (TypeScript) + cargo test (Rust) |
| Config file | `vitest.config.ts` (TS), `Cargo.toml` (Rust) |
| Quick run command | `cargo test -p ai_usage --lib && npx vitest run --reporter=verbose` |
| Full suite command | `cargo test -p ai_usage && npx vitest run` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PROV-03 | Codex fetch via pipeline returns same ServiceSnapshot as before | unit | `cargo test -p ai_usage pipeline::codex::tests -x` | Wave 0 |
| PROV-04 | Claude Code fetch via pipeline returns same ServiceSnapshot as before | unit | `cargo test -p ai_usage pipeline::claude_code::tests -x` | Wave 0 |
| PROV-05 | Strategy chain tries next on failure | unit | `cargo test -p ai_usage pipeline::tests -x` | Wave 0 |
| PROV-03/04 | Generic IPC dispatch returns correct provider data | integration | `cargo test -p ai_usage commands::tests -x` | Partial (existing tests cover per-service commands) |
| PROV-03/04 | Frontend generic client calls work in mock mode | unit | `npx vitest run src/lib/tauri/client.test.ts` | Wave 0 |

### Sampling Rate
- **Per task commit:** `cargo test -p ai_usage --lib && npx vitest run`
- **Per wave merge:** Full suite + `cargo clippy`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src-tauri/src/pipeline/mod.rs` -- trait definition + dispatch + tests
- [ ] `src/lib/tauri/client.test.ts` -- verify generic command mock fallback
- [ ] Existing codex and claude_code tests must continue passing after file restructuring

## Sources

### Primary (HIGH confidence)
- Direct code analysis of `src-tauri/src/codex/mod.rs` (892 lines, 7 tests)
- Direct code analysis of `src-tauri/src/claude_code/mod.rs` (1163 lines, 18 tests)
- Direct code analysis of `src-tauri/src/commands/mod.rs` (~1050 lines, 10 tests)
- Direct code analysis of `src-tauri/src/snapshot.rs` (51 lines)
- Direct code analysis of `src-tauri/src/state/mod.rs` (500 lines, 5 tests)
- Direct code analysis of `src-tauri/src/registry.rs` (83 lines, 6 tests)
- Direct code analysis of `src-tauri/src/lib.rs` (165 lines)
- Direct code analysis of `src/lib/tauri/client.ts` (200 lines)
- Direct code analysis of `src/app/shared/appState.ts` (35 lines)
- Phase 2 CONTEXT.md decisions (D-01 through D-04)

### Secondary (MEDIUM confidence)
- Rust trait object patterns -- standard Rust idiom, well-documented

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new dependencies, all existing crates verified in Cargo.toml
- Architecture: HIGH -- trait pattern is standard Rust, both providers already produce the right types
- Pitfalls: HIGH -- identified from direct code analysis of actual module boundaries and state management

**Research date:** 2026-03-31
**Valid until:** 2026-04-30 (stable domain, no external API changes expected)
