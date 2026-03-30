# Architecture Patterns

**Domain:** Multi-provider AI quota tracker (Tauri 2 desktop app)
**Researched:** 2026-03-31
**Confidence:** HIGH — derived from direct codebase analysis and cross-referenced against CodexBar competitive analysis

---

## Current Architecture (Baseline)

The existing app is a strictly layered desktop application. The React frontend communicates with the Rust backend exclusively through Tauri IPC `invoke()` calls. Backend service integrations (Codex CLI via JSON-RPC subprocess, Claude Code via OAuth HTTP) are implemented as independent Rust modules with no shared abstraction.

```
React (TypeScript)                Rust (Tauri 2)
─────────────────────────────     ──────────────────────────────────
AppShell / PanelView              commands/mod.rs (IPC dispatcher)
    │  invoke("get_codex_*")  →       │
    │  invoke("get_claude_*") →       │── codex/mod.rs        (JSON-RPC CLI)
    │                                 │── claude_code/mod.rs  (OAuth HTTP)
    │  ← CodexPanelState              │── snapshot.rs         (SnapshotStatus)
    │                                 └── state/mod.rs        (AppState Mutex)
summary.ts (threshold logic)
contracts.ts (shared types)
```

**What changes:** This milestone introduces a `ProviderDescriptor` registry that unifies how providers are described and fetched. The layered pattern stays intact — only new abstractions are inserted at the backend service integration layer and frontend summary layer.

---

## Recommended Architecture for This Milestone

### Overview

Three new abstractions slot into the existing architecture without displacing any current code:

1. **Provider Registry** — Rust `ProviderDescriptor` struct (not a trait) that describes each provider's metadata and fetch strategy chain. Registered in a static map at startup.
2. **Fetch Pipeline** — Rust ordered execution loop that tries strategies in sequence, stops on first success, maps errors to `SnapshotStatus` variants.
3. **Burn Rate Engine** — TypeScript pure functions in `src/lib/tauri/burnRate.ts` that compute consumption rate and depletion ETA from `QuotaDimension.remainingPercent` and `resetHint`.

### Component Boundaries

| Component | Location | Responsibility | Communicates With |
|-----------|----------|----------------|-------------------|
| `ProviderRegistry` | `src-tauri/src/providers/registry.rs` | Static map of `provider_id → ProviderDescriptor`; initialize all known providers at startup | `FetchPipeline`, `commands/mod.rs` |
| `ProviderDescriptor` | `src-tauri/src/providers/descriptor.rs` | Immutable struct: metadata (id, display_name, icon_key), fetch strategy chain, reset window type | `ProviderRegistry` |
| `FetchStrategy` enum | `src-tauri/src/providers/strategy.rs` | Enum variants: `OAuthHttp`, `CliJsonRpc`, `HttpToken`, `LocalFile` — each variant holds its config | `FetchPipeline` |
| `FetchPipeline` | `src-tauri/src/providers/pipeline.rs` | Executes strategies in order, returns first `ServiceSnapshot` with `status: Fresh`; maps errors to `SnapshotStatus` | `ProviderRegistry`, `commands/mod.rs` |
| `ServiceSnapshot` | `src-tauri/src/snapshot.rs` (exists) | Unified result: `status`, `dimensions`, `source` — already defined, no changes needed | All Rust service modules |
| `BurnRateEngine` | `src/lib/tauri/burnRate.ts` | Pure TypeScript: compute `burnRate`, `depletionEtaMinutes`, `paceClass` from `remainingPercent` + `resetHint` | `summary.ts`, `ServiceCard.tsx` |
| `AlertThresholdEngine` | `src/lib/tauri/alertThreshold.ts` | Replace absolute `>50% / 20-50% / <20%` with time-relative logic: factor in minutes-until-reset when classifying severity | `summary.ts`, `BurnRateEngine` |
| `codex/mod.rs` (existing) | `src-tauri/src/codex/` | Retains JSON-RPC CLI logic; adapts to return `ServiceSnapshot` via the `CliJsonRpc` strategy | `FetchPipeline` |
| `claude_code/mod.rs` (existing) | `src-tauri/src/claude_code/` | Retains OAuth+HTTP logic; adapts to return `ServiceSnapshot` via the `OAuthHttp` strategy | `FetchPipeline` |
| `kimi_code/mod.rs` (new) | `src-tauri/src/kimi_code/` | Kimi Code HTTP API integration | `FetchPipeline` |
| `glm_coding/mod.rs` (new) | `src-tauri/src/glm_coding/` | GLM Coding Plan HTTP API integration | `FetchPipeline` |
| `commands/mod.rs` (existing) | `src-tauri/src/commands/` | Gains a generic `get_provider_panel_state(provider_id)` command; existing per-service commands kept during migration for backward compatibility | `ProviderRegistry`, `FetchPipeline`, `AppState` |
| `contracts.ts` (existing) | `src/lib/tauri/contracts.ts` | Gains `ProviderDescriptor` TypeScript mirror, `BurnRateResult`, `AlertClassification` types | Frontend features |
| `UserPreferences` / `PreferencePatch` | `state/mod.rs` + `contracts.ts` | Gains `kimi_code_enabled`, `glm_coding_enabled` boolean fields; `service_order` gains new provider IDs | `commands/mod.rs`, `preferencesStore.ts` |

### ProviderDescriptor Shape (Rust)

```rust
// src-tauri/src/providers/descriptor.rs

pub struct ProviderDescriptor {
    pub id: &'static str,           // "codex", "claude-code", "kimi-code", "glm-coding"
    pub display_name: &'static str,
    pub icon_key: &'static str,
    pub fetch_strategies: &'static [FetchStrategy],
    pub reset_window_type: ResetWindowType,  // Rolling5h, Weekly, Monthly, Unknown
    pub dashboard_url: Option<&'static str>,
}

pub enum FetchStrategy {
    OAuthHttp { token_source: TokenSource },
    CliJsonRpc { binary_name: &'static str },
    HttpToken { env_var: &'static str },
    LocalFile { path_template: &'static str },
}

pub enum TokenSource {
    Keychain { service_name: &'static str },
    EnvVar { var_name: &'static str },
    File { path_template: &'static str },
}
```

The registry is a static `HashMap<&str, ProviderDescriptor>` initialized once in `lib.rs::run()` and stored in `AppState`.

### FetchPipeline Execution (Rust)

```
FetchPipeline::execute(descriptor, preferences)
    for each strategy in descriptor.fetch_strategies:
        result = strategy.fetch(preferences)
        match result:
            Ok(snapshot) if snapshot.status.is_fresh() → return snapshot
            Ok(snapshot) → record attempted_status, continue
            Err(e) → map to SnapshotStatus variant, continue
    return last_snapshot (may be non-Fresh with accumulated context)
```

Pipeline returns `ServiceSnapshot` — same type already used by `codex` and `claude_code` modules.

### Burn Rate and Time-Aware Thresholds (TypeScript)

The existing `getQuotaStatus` function in `summary.ts` uses hard-coded absolute thresholds. The new `alertThreshold.ts` module introduces time-relative classification:

```typescript
// src/lib/tauri/alertThreshold.ts

interface TimeAwareInput {
  remainingPercent: number;
  minutesUntilReset: number;       // derived from resetHint
  burnRatePerHour?: number;         // from BurnRateEngine (optional, degrades gracefully)
}

// Core rule: if burn_rate * minutes_until_reset > remaining_percent, it's a warning
// regardless of the absolute remaining level.
// "80% left, 10 min until reset" is fine.
// "10% left, 4 hours until reset, consuming 5%/hr" is a warning.
```

`BurnRateEngine` computes:

```typescript
// src/lib/tauri/burnRate.ts

interface BurnRateResult {
  paceClass: "on-track" | "slightly-ahead" | "ahead" | "far-ahead"
           | "slightly-behind" | "behind" | "far-behind" | "unknown";
  depletionEtaMinutes?: number;   // undefined if burn rate = 0 or unknown
  burnRatePerHour?: number;       // % consumed per hour; undefined if no history
}
```

Both modules are pure functions — no side effects, no IPC, no storage. They take `QuotaDimension` data as inputs and produce classification results. This makes them trivially testable with Vitest.

---

## Data Flow

### Provider Registry Initialization

```
lib.rs::run()
  → ProviderRegistry::new()     // build static descriptor map
  → AppState::new(registry)     // store in Mutex<AppState>
  → commands registered with Tauri
```

### Panel State Load (Generic Path, New)

```
Frontend: panelController.loadPanelState()
  → invoke("get_provider_panel_state", { provider_id: "kimi-code" })
  → commands::get_provider_panel_state(provider_id, state, app_handle)
      → registry.get(provider_id)           // look up ProviderDescriptor
      → load_from_snapshot_cache(provider_id)  // fast path
      → FetchPipeline::execute(descriptor, preferences)
          → strategy[0].fetch()  // e.g., OAuthHttp with kimi keychain
          → strategy[1].fetch()  // fallback: HttpToken with env var
          → returns ServiceSnapshot
      → build_panel_state(descriptor, snapshot)  // → CodexPanelState
      → save_to_snapshot_cache(provider_id, &state)
      → return CodexPanelState (same contract, reused)
```

### Panel State Load (Existing Codex/Claude Code Path, Preserved)

The existing `get_codex_panel_state` and `get_claude_code_panel_state` commands are kept during migration. After migration completes, they become thin wrappers that call the generic pipeline. The frontend continues invoking the same commands; no frontend changes are required for the migration phase.

### Burn Rate Computation (Frontend Only)

```
ServiceCard receives: QuotaDimension { remainingPercent, resetHint }
  → burnRate.compute(dimension, priorSnapshots?)  // pure function
      → returns BurnRateResult { paceClass, depletionEtaMinutes }
  → alertThreshold.classify(remainingPercent, minutesUntilReset, burnRate?)
      → returns AlertClassification { level, reason }
  → replaces existing getQuotaStatus() call in summary.ts
  → ServiceCard renders paceClass badge + ETA hint
```

No new IPC calls. No backend involvement. The frontend has all the data it needs (remainingPercent, resetHint → minutes-until-reset) without any new commands.

---

## Suggested Build Order

Dependencies flow from bottom to top. Build in this order to ensure each component is independently shippable:

### Phase 1: Provider Registry + ProviderDescriptor (Backend Only)
**Builds:** `providers/descriptor.rs`, `providers/registry.rs`
**Why first:** All other components depend on ProviderDescriptor. No frontend changes, no IPC changes. Can be merged safely before any other work starts.
**Dependencies:** None (uses existing `SnapshotStatus`, `FetchStrategy` types)
**Risk:** Low — purely additive, no existing code touched.

### Phase 2: FetchPipeline + Refactor Codex + Claude Code
**Builds:** `providers/pipeline.rs`, `providers/strategy.rs`; adapts `codex/mod.rs` and `claude_code/mod.rs` to implement strategy dispatch
**Why second:** Pipeline is the execution engine. Refactoring existing providers into it validates the abstraction before new providers are added.
**Dependencies:** Phase 1 (ProviderDescriptor, FetchStrategy enum)
**Risk:** Medium — touches existing load paths. Must maintain backward compatibility with existing IPC commands. Existing Codex + Claude Code tests are the safety net.

### Phase 3: New Providers (Kimi Code + GLM Coding Plan)
**Builds:** `kimi_code/mod.rs`, `glm_coding/mod.rs`; registers descriptors; adds `kimi_code_enabled` / `glm_coding_enabled` to preferences; adds IPC commands
**Why third:** New providers are new `FetchStrategy` implementations that plug into the already-validated pipeline.
**Dependencies:** Phase 2 (FetchPipeline operational)
**Risk:** Medium — API details for Kimi Code and GLM need research during this phase. See PITFALLS.md.

### Phase 4: Burn Rate Engine (Frontend, Pure Logic)
**Builds:** `src/lib/tauri/burnRate.ts`, Vitest unit tests
**Why fourth:** Pure TypeScript, no backend dependency. Can be developed in parallel with Phase 3 once Phase 2 has stabilized the data shape.
**Dependencies:** Existing `QuotaDimension` type (no new backend fields needed)
**Risk:** Low — pure functions with clear inputs/outputs. Easily tested.

### Phase 5: Time-Aware Alert Thresholds (Frontend)
**Builds:** `src/lib/tauri/alertThreshold.ts`; replaces `getQuotaStatus()` calls in `summary.ts`
**Why fifth:** Depends on Burn Rate Engine output (`burnRatePerHour`). Alert threshold replaces the existing absolute threshold logic — must be done after burn rate is stable.
**Dependencies:** Phase 4 (BurnRateEngine), existing `resetHint` in QuotaDimension
**Risk:** Low-Medium — changes alarm behavior, which affects tray icon colors and notification triggers. Needs careful regression testing.

### Phase 6: About Page (Frontend)
**Builds:** `src/app/about/AboutView.tsx`; license audit output; new `about_page_data` IPC command
**Why last:** No dependencies on any prior phase. Isolated UI work.
**Dependencies:** None
**Risk:** Low — pure UI addition, no state interaction.

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Rust Trait for Provider Abstraction
**What:** Defining `trait Provider { fn fetch(...) }` with separate impl blocks per provider.
**Why bad:** Rust trait objects require `Box<dyn Provider>` and lifetime complexity. Static dispatch via enum `FetchStrategy` variants is simpler, avoids heap allocation, and plays well with `serde` for serialization.
**Instead:** `ProviderDescriptor` as a plain struct with `fetch_strategies: &[FetchStrategy]`. Pipeline dispatches via enum match.

### Anti-Pattern 2: New IPC Command Per Provider
**What:** Adding `get_kimi_code_panel_state`, `get_glm_coding_panel_state`, etc. as separate commands.
**Why bad:** Multiplies IPC surface area. Frontend must add a new invoke path for each provider. All providers return the same `CodexPanelState` shape — a generic command suffices.
**Instead:** `get_provider_panel_state(provider_id: String)` as the single generic command. Existing per-provider commands are kept only as backward-compatible aliases during migration.

### Anti-Pattern 3: Burn Rate State in Rust Backend
**What:** Storing consumption history in `AppState` or snapshot cache; sending burn rate fields in `CodexPanelState`.
**Why bad:** Burn rate requires a time series of at least two snapshots. The backend only sees one snapshot at a time. Storing history in preferences.json violates the "no new storage layer" constraint.
**Instead:** Frontend derives burn rate from two successive `QuotaDimension` snapshots held in React state. The computation is pure and stateless from the backend's perspective.

### Anti-Pattern 4: Breaking Existing Snapshot Cache Format
**What:** Changing the `SnapshotCache.services` key format or `CodexPanelState` shape during migration.
**Why bad:** Users upgrading from current version will get a deserialization failure, losing their cached state.
**Instead:** Additive changes only. New fields use `#[serde(default)]`. Existing `services` keys ("codex", "claude-code") remain unchanged.

### Anti-Pattern 5: Putting Time-Aware Logic in Rust
**What:** Computing `minutesUntilReset` and burn rate classification in the backend.
**Why bad:** The backend already sends `resetHint` (a string). Time parsing and relative classification is well-handled by TypeScript with built-in `Date`/`Intl` (per project constraints: no new date libraries). Moving this to Rust adds complexity to the IPC contract for no gain.
**Instead:** Frontend parses `resetHint` → absolute timestamp → `minutesUntilReset`. Burn rate engine runs entirely in TypeScript.

---

## Scalability Considerations

| Concern | At 2 providers (now) | At 4 providers (this milestone) | At 10+ providers (future) |
|---------|----------------------|---------------------------------|---------------------------|
| IPC commands | 2 explicit commands | 1 generic + 2 aliases | 1 generic command handles all |
| Preferences schema | 1 boolean flag per provider | 2 new booleans added | Consider dynamic `enabled_providers: [string]` map |
| Service order array | 2-element `serviceOrder` | 4-element array | Same — `serviceOrder` is already a `Vec<String>` |
| Snapshot cache | 2 entries | 4 entries | Linear growth; no concern until 20+ |
| Frontend state | `codexPanelState + claudeCodePanelState` per-service vars | Consider moving to `Map<providerId, PanelState>` | Map pattern required |
| Burn rate history | 2 snapshots in React state | 2 snapshots per provider × N | Consider circular buffer per provider in `AppState` context |

The transition from per-service React state variables (`codexPanelState`, `claudeCodePanelState`) to a `Map<string, CodexPanelState>` in `AppShell` is the single most impactful refactor for future scalability. It should happen in Phase 3 (when the third provider is added) to avoid a later large refactor.

---

## Cross-Cutting Integration Points

**Authentication handling stays provider-local.** Each `FetchStrategy` variant handles its own credential reading. The `TokenSource` enum inside `OAuthHttp` centralizes credential source logic (keychain, env, file) but does not create a shared auth module — each provider's credential schema is too different.

**`SnapshotStatus` is extended, not replaced.** New providers may need new status variants (e.g., `ApiKeyInvalid` for token-auth providers). Add variants to the existing `SnapshotStatus` enum; frontend `contracts.ts` discriminated union gets the new `kind` value. The frontend exhaustive switch in `statusToPrimaryMessage` must be updated to handle new variants.

**Proxy support is transparent.** The existing `ureq` proxy detection (env vars → `scutil --proxy` fallback) applies to all `OAuthHttp` and `HttpToken` strategies automatically. New providers using HTTP get proxy support for free.

**i18n follows existing pattern.** New provider names and status messages are added to `src/app/shared/i18n.ts`. Backend returns English; frontend maps via existing `getCopy` / `localizeDimensionLabel` functions. No new i18n mechanism needed.

---

## Sources

- Direct codebase analysis: `src-tauri/src/snapshot.rs`, `src-tauri/src/state/mod.rs`, `src-tauri/src/commands/mod.rs`, `src-tauri/src/claude_code/mod.rs`, `src/lib/tauri/summary.ts`, `src/lib/tauri/contracts.ts`
- `.planning/codebase/ARCHITECTURE.md` — existing layer documentation
- `.planning/codebase/STRUCTURE.md` — directory layout and naming conventions
- `.planning/research/codexbar-analysis.md` — CodexBar ProviderDescriptor and FetchPipeline patterns (competitive reference)
- `.planning/PROJECT.md` — active requirements and constraints

---

*Architecture research: 2026-03-31*
