# Phase 3: New Providers - Context

**Gathered:** 2026-03-31
**Status:** Ready for planning

<domain>
## Phase Boundary

Add Kimi Code and GLM Coding Plan as new providers in the app. Each provider gets a registry entry, a ProviderFetcher implementation, and appears in the panel/tray/settings using existing UI patterns. API endpoints and auth mechanisms must be confirmed through user-provided dashboard traffic captures before implementation begins. If only one provider's API is confirmed, ship that one; the other is deferred.

</domain>

<decisions>
## Implementation Decisions

### API Research Strategy
- **D-01:** Skip until confirmed — do NOT register a provider unless its quota API is verified. No stub fetchers or placeholder providers.
- **D-02:** Research is user-driven: user captures dashboard API traffic (browser DevTools network tab) and provides request/response samples. Researcher agent validates and structures them into specs.
- **D-03:** Both providers have web dashboards showing usage/quota. Research should focus on dashboard API inspection, not VS Code extension internals.

### Credential Discovery
- **D-04:** Auth mechanism is a key research question. User reports browser session/cookies for dashboard auth, but the actual credential flow (API key, OAuth, long-lived token from VS Code extension config) must be determined from captured API traffic.
- **D-05:** If manual token input is required, add a token/credential input field per provider in the Settings page (similar to proxy URL configuration today).
- **D-06:** Manually-entered tokens are stored in preferences.json alongside other settings. Same security posture as existing credential storage.

### Unavailable State UX
- **D-07:** Reuse existing SnapshotStatus-based error cards (NoCredentials, TemporarilyUnavailable, etc.). Same messages, same localization, fully consistent across all providers. No provider-specific error UI.

### Rollout Approach
- **D-08:** Ship what's ready. If only one provider's API is confirmed, ship that provider alone. The other can be added as a follow-up quick task or decimal phase (3.1).

### UI Appearance
- **D-09:** Identical ServiceCard layout as Codex/Claude Code — same progress bar, colors, badge treatment. No visual distinction per provider beyond the name and data.
- **D-10:** Same tray/menubar summary format (e.g., "Kimi: 80%") as existing providers.
- **D-11:** Auto-menubar detection is manual only for new providers initially. Auto-detection (activity-based switching) requires separate research into activity signals and is out of scope for Phase 3.

### Claude's Discretion
- Provider module structure (e.g., `src-tauri/src/kimi/mod.rs` vs inline) — match existing patterns
- Error mapping from provider-specific API errors to SnapshotStatus variants
- Settings UI layout for token input fields — integrate naturally with existing settings flow
- i18n keys for new provider names and messages — follow existing localization patterns

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Provider Registry (Phase 1-2 output)
- `src-tauri/src/registry.rs` — ProviderDescriptor definitions, `get_provider()`, `provider_ids()`
- `src/lib/tauri/registry.ts` — Frontend registry mirror (must stay in sync)

### ProviderFetcher Pipeline (Phase 2 output)
- `src-tauri/src/pipeline/mod.rs` — ProviderFetcher trait, `fetchers()` registration vector
- `src-tauri/src/pipeline/codex.rs` — Example fetcher implementation (Codex)
- `src-tauri/src/pipeline/claude_code.rs` — Example fetcher implementation (Claude Code, with stale cache seeding)

### IPC & Panel State
- `src-tauri/src/commands/mod.rs` — Generic `get_provider_state` / `refresh_provider_state` commands
- `src/lib/tauri/client.ts` — Frontend IPC client (already generic)

### Shared Types
- `src-tauri/src/snapshot.rs` — SnapshotStatus enum (all fetch outcome variants)
- `src-tauri/src/state/mod.rs` — CodexPanelState, QuotaDimension, UserPreferences

### Existing Provider Modules (reference implementations)
- `src-tauri/src/codex/mod.rs` — JSON-RPC via CLI subprocess
- `src-tauri/src/claude_code/mod.rs` — OAuth credential chain, HTTP API via ureq, proxy resolution

### Prior Phase Context
- `.planning/phases/01-provider-registry/01-CONTEXT.md` — Registry shape, state migration decisions
- `.planning/phases/02-fetch-pipeline-migration/02-CONTEXT.md` — Pipeline trait, strategy chain, command surface decisions

### Research (to be created)
- API traffic captures provided by user (Kimi Code dashboard, GLM Coding Plan dashboard)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `ProviderDescriptor` struct: Add new entry to `PROVIDERS` const + frontend mirror — that's all for registration
- `ProviderFetcher` trait: Implement `provider_id()`, `strategy_name()`, `fetch()` — optional `seed_stale_cache()` and `clear_access_pause()`
- `ServiceCard` component: Handles all SnapshotStatus variants already — zero new UI components needed
- `SnapshotStatus` enum: `NoCredentials`, `TemporarilyUnavailable`, `Disabled` cover all error states
- Proxy resolution (`resolve_proxy()`): Shared utility for all outbound HTTP calls
- Preferences normalization: `providerEnabled[provider_id]` map — new providers auto-handled

### Established Patterns
- New provider = ~10 lines registry + ~500 lines provider module + 1 line pipeline registration
- Fetcher modules own their entire credential chain internally (env → config file → manual input)
- All providers map domain errors to SnapshotStatus variants for consistent frontend handling
- Refresh guards (dedup) prevent concurrent fetch requests per provider

### Integration Points
- `src-tauri/src/registry.rs` PROVIDERS array — add entry
- `src/lib/tauri/registry.ts` PROVIDERS array — mirror entry
- `src-tauri/src/pipeline/mod.rs` fetchers() — add Box::new(NewFetcher)
- `src-tauri/src/lib.rs` — module declaration
- Settings UI — add token input field if manual credential input needed
- `src/app/shared/i18n.ts` — add provider name + message translations

</code_context>

<specifics>
## Specific Ideas

- Dashboard API capture as the primary research method — user provides network tab exports
- Token input in Settings follows the same pattern as the existing proxy URL field
- Tray summary includes new providers in the same format as existing ones

</specifics>

<deferred>
## Deferred Ideas

- Auto-menubar activity detection for new providers — requires separate research into file mtimes, process detection, or config file monitoring for Kimi Code / GLM Coding Plan
- Provider-colored accents or custom card styling — decided against for now; revisit if users request visual distinction

</deferred>

---

*Phase: 03-new-providers*
*Context gathered: 2026-03-31*
