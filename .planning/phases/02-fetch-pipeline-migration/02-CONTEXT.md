# Phase 2: Fetch Pipeline & Migration - Context

**Gathered:** 2026-03-31
**Status:** Ready for planning

<domain>
## Phase Boundary

Create a shared FetchPipeline that executes an ordered strategy chain per provider. Migrate existing Codex (JSON-RPC via CLI subprocess) and Claude Code (OAuth HTTP API) integrations into it with verified behavioral parity. After migration, adding a new provider in Phase 3 requires only a new trait impl and registry entry — no changes to the fetch orchestration, snapshot cache, or IPC layer.

</domain>

<decisions>
## Implementation Decisions

### Pipeline Trait Design
- **D-01:** Use a Rust trait (`ProviderFetcher` or similar) with per-provider implementations. Each provider impl encapsulates its entire fetch logic (credential resolution, API call, response parsing, error mapping to SnapshotStatus). This is idiomatic, extensible for Phase 3 new providers, and testable with mocks.

### Strategy Chain Definition
- **D-02:** Each provider's trait impl defines its own strategy chain internally (e.g., Claude Code: env var → keychain → credentials file → API call). The strategy chain is an implementation detail of the provider, not a registry-level concept. The registry (ProviderDescriptor) stays minimal as decided in Phase 1.

### Migration Scope
- **D-03:** Refactor `codex/mod.rs` and `claude_code/mod.rs` directly into the pipeline trait — no adapter wrappers. Both modules already produce `ServiceSnapshot` with `SnapshotStatus`; the refactor lifts this into a uniform trait interface. Existing behavior (pause states, rate limit cooldowns, stale cache seeding) must be preserved exactly.

### Command Surface
- **D-04:** Add generic IPC commands `get_provider_state(provider_id)` and `refresh_provider_state(provider_id)` that dispatch via registry lookup to the appropriate trait impl. Keep existing per-service commands as thin wrappers calling the generic versions during transition. Frontend migrates to generic commands in this phase.

### Claude's Discretion
- Pipeline error handling strategy (retry semantics, timeout defaults) — choose whatever preserves current behavior
- Whether to introduce a `FetchContext` struct bundling AppHandle + preferences + proxy config, or pass individual args — optimize for ergonomics
- Test structure for the pipeline (unit tests per provider, integration test for dispatch) — match existing test patterns

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Provider Registry (Phase 1 output)
- `src-tauri/src/registry.rs` — ProviderDescriptor definitions, `get_provider()`, `provider_ids()`
- `src/lib/tauri/registry.ts` — Frontend registry mirror

### Current Fetch Implementations (migration sources)
- `src-tauri/src/codex/mod.rs` — JSON-RPC via CLI subprocess, login detection, env var fallback
- `src-tauri/src/claude_code/mod.rs` — OAuth credential chain (env → keychain → file), HTTP API via ureq, pause states, proxy resolution, stale cache seeding

### IPC Command Layer (migration target)
- `src-tauri/src/commands/mod.rs` — Current per-service commands, snapshot cache, merge_preferences
- `src/lib/tauri/client.ts` — Frontend IPC client calling per-service commands

### Shared Types
- `src-tauri/src/snapshot.rs` — SnapshotStatus enum (all fetch outcome variants)
- `src-tauri/src/state/mod.rs` — CodexPanelState, QuotaDimension, AppState, UserPreferences

### Architecture & Integration Context
- `.planning/codebase/ARCHITECTURE.md` — Layer diagram, data flow
- `.planning/codebase/INTEGRATIONS.md` — External API details (Anthropic OAuth, Codex CLI)
- `.planning/phases/01-provider-registry/01-CONTEXT.md` — Phase 1 decisions (registry shape, state migration)

### Research
- `.planning/research/ARCHITECTURE.md` — Provider registry architecture recommendations
- `.planning/research/PITFALLS.md` — Service ID fragmentation pitfall

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `SnapshotStatus` enum: Exhaustive tagged union covering all fetch outcomes — providers must map their errors to these variants
- `ServiceSnapshot` / `CodexPanelState`: Already generic (items: Vec<QuotaDimension>, status: SnapshotStatus) — no per-provider specialization needed
- `seed_stale_cache()`: Claude Code's stale cache pattern should be generalized for all providers
- Proxy resolution: `resolve_proxy()` in claude_code/mod.rs — should be extracted to a shared utility

### Established Patterns
- Rust: `Mutex<T>` in AppState for shared mutable state, serde for all serialization
- IPC: `#[tauri::command]` functions, `State<AppState>` injection
- Error mapping: Each module maps domain errors → SnapshotStatus variants (consistent across providers)
- Refresh guards: Both modules have dedup guards preventing concurrent refreshes — preserve this pattern

### Integration Points
- `src-tauri/src/lib.rs` — App setup registers commands, starts background loops
- `src-tauri/src/tray/mod.rs` — Reads panel state for tray icon/summary
- `src-tauri/src/agent_activity/mod.rs` — Activity detection reads from provider-specific sources
- `src/features/demo-services/panelController.ts` — Frontend refresh orchestration
- `src/app/shell/AppShell.tsx` — State management, auto-refresh interval

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches. The existing codex and claude_code modules are well-structured and produce the right output types; the migration is primarily about lifting them behind a uniform trait interface.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 02-fetch-pipeline-migration*
*Context gathered: 2026-03-31*
