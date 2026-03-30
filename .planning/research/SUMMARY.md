# Project Research Summary

**Project:** ai-usage — Provider Architecture & Smart Alerts Milestone
**Domain:** Multi-provider AI coding quota tracker (Tauri 2 desktop menubar app)
**Researched:** 2026-03-31
**Confidence:** HIGH (existing stack/architecture), LOW (Kimi Code and GLM Coding Plan APIs)

## Executive Summary

This milestone extends an already-working two-provider menubar app (Codex CLI + Claude Code OAuth) into a four-provider system with smart alert intelligence. The core architectural challenge is replacing five independent hardcoded service-ID lists with a single `ProviderDescriptor` registry — this is the enabling change for everything else. Research confirms that no new runtime dependencies are needed: the existing Rust + TypeScript + Tauri 2 stack is fully capable of all planned features, and the correct patterns (static enum dispatch, strategy-array credential chains, pure-function frontend logic) already exist in the codebase and simply need to be generalized.

The recommended build order is: registry refactor first, then fetch pipeline generalization, then new providers, then smart alert logic, then the About page. This order is driven by hard dependencies — attempting to add Kimi Code or GLM Coding Plan before the registry is in place will cause silent preference corruption because service ID validation happens in five locations that are not currently synchronized. The burn rate and time-aware threshold features are pure frontend work against existing data and can proceed in parallel once the registry is stable.

The single highest-risk area is the Kimi Code and GLM Coding Plan quota APIs: neither is publicly documented in English, both may require network traffic inspection to identify the actual quota endpoint, and both may use monthly reset windows that the current `inferWindowMinutes` parser does not handle. These two providers are research-gated work items. They must not begin implementation until a confirmed fetch strategy is in hand. A stub `NoData` state is the correct shipping posture for unconfirmed providers, not a broken integration.

## Key Findings

### Recommended Stack

No new runtime crates or npm packages are required for any feature in this milestone. The existing `ureq` 2.x HTTP client, `serde_json`, `chrono`, and `rusqlite` cover all Rust-side needs. The `@tauri-apps/api` package already exposes `getVersion()` for the About page. Built-in `Date` and `Intl` APIs handle all frontend timestamp math for burn rate and time-aware thresholds.

Dev-time additions needed for the About page license section: `cargo-deny` and `cargo-license` for Rust dependency auditing, and `license-checker-rseidelsohn` (4.x) for npm. These are build-step tools only — they generate a static `public/licenses.json` that the About page reads at runtime. Versions should be verified before pinning (`cargo search cargo-deny`; `npm show license-checker-rseidelsohn version`).

**Core technologies:**
- `ureq` 2.x: outbound HTTP for all provider API calls — already proven with proxy detection; no connection pooling needed at polling intervals >1 min
- `serde` / `serde_json`: IPC serialization and snapshot cache — extend with `#[serde(default)]` for additive schema changes
- `chrono` 0.4: Rust-side timestamp math if needed for new providers — already in Cargo.toml
- `@tauri-apps/api` 2.0: frontend Tauri bridge including `getVersion()` for About page
- Built-in `Date` / `Intl`: all frontend time calculations for burn rate and threshold logic

**What not to add:** `reqwest`/`tokio` (async runtime restructuring not worth it), `dyn ProviderFetcher` trait objects (static enum dispatch is simpler and avoids vtable overhead), any new state management library, any new storage layer.

### Expected Features

**Must have (table stakes):**
- Real-time quota display per provider — core product; must survive provider abstraction refactor intact
- Graceful auth-error handling — `SnapshotStatus` enum states must cover all new provider error modes
- Stale cache on transient failure — already exists for Claude Code; must extend to all providers uniformly
- Configurable refresh interval — must not change for existing users during migration
- About page with version number — missing; high-visibility gap that makes the app feel unfinished
- License attribution for dependencies — required for binary distribution; build-time generated

**Should have (differentiators):**
- Provider Descriptor Registry — enables all provider additions with no structural changes
- Multi-strategy fetch pipeline — future maintainability; each provider defines ordered credential fallback
- Kimi Code provider — underserved Chinese AI coding market; no competing tool supports it
- GLM Coding Plan provider — fast-growing Chinese market; no existing menubar tool
- Burn rate / pace forecasting — "quota runs out 2h before reset" prevents user surprise
- Time-aware warning thresholds — eliminates false alarms; 80% with 5min left is fine, not green

**Defer (v2+):**
- Browser-cookie-based auth for any provider
- Cost/token billing tracking
- WidgetKit / desktop widget
- Statuspage.io incident monitoring
- Quota usage history / sparkline (requires persistent history storage)
- Panel read-guard (suppress refresh while panel is open) — low risk, can follow initial release
- Cloud preference sync

### Architecture Approach

The milestone inserts three new abstractions into the existing strictly-layered architecture without displacing current code. The `ProviderDescriptor` registry (Rust static map + TypeScript mirror constant) replaces five hardcoded service-ID lists. The `FetchPipeline` generalizes the existing `or_else` credential chain already present in `claude_code/mod.rs`. The `BurnRateEngine` and `AlertThresholdEngine` are pure TypeScript functions that derive all their inputs from `QuotaDimension` data already returned by the backend — no new IPC commands required for smart alerts.

**Major components:**
1. `providers/registry.rs` — static `ProviderDescriptor` map; single source of truth for all provider IDs, display names, and fetch strategy chains
2. `providers/pipeline.rs` — executes `FetchStrategy` variants in order, returns first successful `ServiceSnapshot`, maps failures to `SnapshotStatus` variants
3. `src/lib/tauri/burnRate.ts` — pure TypeScript; computes `paceClass` and `depletionEtaMinutes` from `remainingPercent` + `resetHint`; no IPC, no storage
4. `src/lib/tauri/alertThreshold.ts` — replaces `getQuotaStatus()` static thresholds with time-relative classification; degrades to static logic when `resetsAt` is absent
5. `kimi_code/mod.rs` + `glm_coding/mod.rs` — new provider modules; stub `NoData` until confirmed API fetch strategy
6. `src/app/about/AboutView.tsx` — standalone About page reading `public/licenses.json` generated at build time

### Critical Pitfalls

1. **Service IDs hardcoded in five places** — adding any provider without the registry in place causes silent preference corruption (new service ID stripped from `serviceOrder` with no error). The registry phase must resolve all five locations before any new provider is added.

2. **Preference normalization duplicated in Rust and TypeScript** — a new per-provider enable flag added to Rust but missed in TypeScript causes the frontend to overwrite it with `undefined` on next save. Fix: update both normalizers in the same commit; add a round-trip integration test. Also: design a generic `providerEnabled: Record<string, boolean>` map now to avoid accumulating `kimiCodeUsageEnabled`, `glmCodingPlanUsageEnabled`, etc. flags.

3. **Backward-compatibility break on registry migration** — existing `snapshot-cache.json` and IPC command names must remain stable during the refactor. Internally restructure Rust without changing what crosses the IPC boundary. Add `schema_version` to snapshot cache. Keep `get_codex_panel_state` and `get_claude_code_panel_state` as backward-compatible aliases.

4. **Chinese provider APIs are undocumented** — Kimi Code and GLM Coding Plan quota endpoints are not publicly documented. Both are research-gated. Do not start implementation until a confirmed fetch strategy is established via network traffic inspection. Stub with `NoData` status and dashboard link.

5. **Time-aware thresholds assume `resetsAt` is available and correct** — `resets_at` is `Option<i64>` in Codex and can be missing or subject to clock skew. Design a three-path fallback: (1) `resetsAt` known → time-aware; (2) only `remainingPercent` known → static absolute; (3) neither → muted unknown state. Burn rate requires 2-3 historical snapshots across restarts — add a small rolling window to snapshot cache.

## Implications for Roadmap

Based on research, a 6-phase structure is recommended. Phases 1-2 are pure backend refactors with no user-visible change. Phases 3-5 deliver user-visible features. Phase 6 is a polish close-out.

### Phase 1: Provider Descriptor Registry
**Rationale:** All other phases depend on this. Five independent hardcoded service-ID lists must become one before any new provider is added. This is the highest-leverage change in the milestone and the highest-risk if deferred.
**Delivers:** Single `ProviderDescriptor` registry in Rust; TypeScript mirror constant; generic `providerEnabled` map in preferences replacing per-service flags; `ProviderRuntimeState` moved into `AppState.HashMap`; existing Codex and Claude Code behavior unchanged from user perspective.
**Addresses:** Table-stakes feature "consistent data across providers"; enables all differentiator features.
**Avoids:** Pitfall 1 (service IDs diverge), Pitfall 2 (normalizer drift), Pitfall 11 (flag proliferation), Pitfall 12 (OnceLock per provider).
**Research flag:** Well-documented pattern — skip `research-phase`. Patterns directly observable in codebase and confirmed via CodexBar analysis.

### Phase 2: Fetch Pipeline + Codex/Claude Code Migration
**Rationale:** Generalizes the credential chain already present in `claude_code/mod.rs` into a shared `FetchPipeline`. Migrating existing providers into the pipeline validates the abstraction before new providers rely on it.
**Delivers:** `providers/pipeline.rs` with `FetchStrategy` enum; proxy resolution extracted to shared `providers/http.rs` with Windows support; existing providers adapted; backward-compatible IPC aliases kept.
**Addresses:** Multi-strategy fetch pipeline (differentiator); proxy correctness on Windows.
**Avoids:** Pitfall 4 (cache/IPC backward-compatibility break), Pitfall 8 (proxy resolution is macOS-only).
**Research flag:** Well-documented pattern — skip `research-phase`. High confidence from direct codebase analysis.

### Phase 3: New Providers (Kimi Code + GLM Coding Plan)
**Rationale:** New providers are `FetchStrategy` implementations that plug into the validated pipeline. Adding them in Phase 3 (not earlier) ensures the registry and pipeline are stable.
**Delivers:** `kimi_code/mod.rs` and `glm_coding/mod.rs` registered in the provider registry; UI shows both providers; preferences schema updated; frontend state migrated from per-service vars to `Map<providerId, PanelState>`.
**Addresses:** Kimi Code and GLM Coding Plan providers (differentiators); service order generalization.
**Avoids:** Pitfall 3 (undocumented APIs — requires confirmed strategy before implementation), Pitfall 9 (monthly reset window handling — extend `inferWindowMinutes` first).
**Research flag:** NEEDS `research-phase` for both providers. Kimi Code and GLM quota API endpoints must be confirmed via network traffic inspection before any implementation starts. Block implementation on confirmed strategy.

### Phase 4: Burn Rate Engine (Frontend)
**Rationale:** Pure TypeScript with no backend dependency. Can be developed in parallel with Phase 3 once Phase 2 has stabilized the `QuotaDimension` data shape. Burn rate is a prerequisite for Phase 5.
**Delivers:** `src/lib/tauri/burnRate.ts` with `paceClass` and `depletionEtaMinutes`; Vitest unit tests covering all edge cases including `resetsAt: null`, zero burn rate, and first-launch state; rolling 2-3 data point window added to snapshot cache for cross-restart burn rate.
**Addresses:** Burn rate / pace forecasting and depletion ETA display (differentiators).
**Avoids:** Pitfall 5 (burn rate NaN/Infinity on fresh launch), Pitfall 9 (monthly window parsing).
**Research flag:** Well-documented pattern — skip `research-phase`. Algorithm is clear from CodexBar analysis; pure function with deterministic inputs.

### Phase 5: Time-Aware Alert Thresholds (Frontend)
**Rationale:** Replaces the single `getQuotaStatus()` function. Depends on burn rate output from Phase 4. Changes tray icon coloring and notification triggers — must be done after burn rate is stable and with careful regression testing.
**Delivers:** `src/lib/tauri/alertThreshold.ts` replacing static `getQuotaStatus()`; three-path fallback for missing/invalid `resetsAt`; updated tray icon logic; updated notification trigger logic; exhaustiveness checks on `SnapshotStatus` switch statements.
**Addresses:** Time-aware warning thresholds (differentiator); eliminates false positive danger alerts.
**Avoids:** Pitfall 5 (fallback when `resetsAt` absent), Pitfall 7 (`SnapshotStatus` new variants unhandled).
**Research flag:** Well-documented pattern — skip `research-phase`. Logic is clear; the calibration of exact thresholds needs real usage data but a reasonable first approximation is defined in STACK.md.

### Phase 6: About Page
**Rationale:** Entirely standalone; no dependencies on prior phases. Good milestone close-out feature — low complexity, high polish signal.
**Delivers:** `src/app/about/AboutView.tsx`; build-time license manifest generation via `cargo-deny`, `cargo-license`, and `license-checker-rseidelsohn`; `public/licenses.json` embedded as static asset; version from `@tauri-apps/api` `getVersion()`.
**Addresses:** About page (table stakes — missing today), license attribution (required for distribution).
**Avoids:** Pitfall 6 (license audit done too late — run baseline `cargo deny check` before Phase 1, re-run after each new crate), Pitfall 10 (license list going stale — build-time generated, not hard-coded).
**Research flag:** Well-documented pattern — skip `research-phase`. All tools are dev-only; runtime behavior is a static file read.

### Phase Ordering Rationale

- Phases 1-2 must precede all others because service ID integrity and the pipeline abstraction are the critical path. Any shortcut here causes silent data corruption (Pitfall 1) or a full rewrite of new provider code (Pitfall 4).
- Phase 3 is gated by provider API research, not code readiness. This is the most likely phase to block or require extended spike work.
- Phases 4 and 5 are pure frontend and can be partially parallelized with Phase 3, but Phase 5 must follow Phase 4.
- Phase 6 can be done in any order after Phase 1 is complete; placing it last treats it as a milestone close-out.

### Research Flags

Phases needing deeper research during planning:
- **Phase 3 (Kimi Code + GLM Coding Plan):** Both provider quota APIs are undocumented. Requires a research sub-task ("confirm fetch strategy via network inspection") before any implementation can start. This is the only phase where research may block the timeline.

Phases with well-documented patterns (skip `research-phase`):
- **Phase 1 (Provider Registry):** Pattern directly observable in codebase; confirmed by CodexBar reference.
- **Phase 2 (Fetch Pipeline):** Direct generalization of existing `claude_code/mod.rs` pattern.
- **Phase 4 (Burn Rate Engine):** Pure math; algorithm documented in CodexBar analysis and STACK.md.
- **Phase 5 (Alert Thresholds):** Clear replacement of a single function; fallback paths well-specified.
- **Phase 6 (About Page):** Static UI with build-time tooling; all tools have established usage patterns.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | No new runtime dependencies; all patterns verified in existing codebase |
| Features | HIGH | Table stakes and differentiators sourced from direct codebase audit + competitive analysis; anti-features explicitly documented |
| Architecture | HIGH | All patterns derived from direct codebase inspection; phase build order confirmed by dependency analysis |
| Pitfalls | HIGH | All pitfalls grounded in actual code locations (file + line cited); no speculative pitfalls |
| Kimi Code API | LOW | No official public quota API documentation found; network inspection required |
| GLM Coding Plan API | LOW | No official public quota API documentation found; network inspection required |
| Burn rate threshold calibration | LOW | Exact ratio values need real usage data; first-pass approximations are reasonable starting points |
| Dev-tool versions (cargo-deny, license-checker) | MEDIUM | Training data; verify with `cargo search` and `npm show` before pinning |

**Overall confidence:** HIGH for execution plan; LOW for Kimi/GLM provider implementation specifics.

### Gaps to Address

- **Kimi Code quota API endpoint and auth:** Requires network traffic inspection of the Kimi Code VS Code extension before Phase 3 begins. If only balance (credit amount) is available rather than a subscription quota counter, the integration must use the balance as a proxy metric and display a caveat in the UI.
- **GLM Coding Plan quota API endpoint and auth:** Same situation as Kimi Code. Also likely uses a monthly reset window — `inferWindowMinutes` must be extended to handle `30d` / `monthly` / `"月"` patterns before this provider is added.
- **Burn rate threshold calibration:** The exact `ratio > 1.2` / `ratio < 0.5` values from STACK.md are first approximations. They should be treated as configurable constants (not hard-coded magic numbers) so they can be tuned after real usage data is collected.
- **`resetsAt` clock skew handling:** No specification currently exists for how large a clock skew is acceptable before falling back to absolute-percentage logic. This needs a concrete decision (e.g., "if calculated minutes-until-reset is negative or >14 days, treat as absent") before Phase 5 implementation begins.
- **Windows proxy detection:** `scutil --proxy` is macOS-only. Phase 2 must implement a Windows equivalent (`netsh winhttp show proxy` or registry read). A concrete decision on the Windows strategy is needed before the pipeline is finalized.

## Sources

### Primary (HIGH confidence)
- Direct codebase inspection: `src-tauri/src/state/mod.rs`, `src-tauri/src/claude_code/mod.rs`, `src-tauri/src/codex/mod.rs`, `src-tauri/src/snapshot.rs`, `src/lib/tauri/summary.ts`, `src/lib/tauri/contracts.ts`, `src/lib/persistence/preferencesStore.ts`
- `.planning/research/codexbar-analysis.md` — CodexBar competitive reference (25-provider Swift app); ProviderDescriptor pattern, burn rate algorithm
- `.planning/PROJECT.md` — authoritative milestone requirements and Out of Scope constraints
- `.planning/codebase/CONCERNS.md` — existing tech debt, fragile areas, scaling limits
- `.planning/codebase/INTEGRATIONS.md` — API endpoints, credential sources, proxy detection
- `.planning/codebase/ARCHITECTURE.md` — existing layer documentation

### Secondary (MEDIUM confidence)
- Training data: `cargo-deny` 0.14.x, `cargo-license` 0.6.x, `license-checker-rseidelsohn` 4.x — versions need verification before pinning
- Training data: Moonshot AI API structure (`api.moonshot.cn/v1`) — confirmed as public API platform, but Kimi Code-specific quota endpoint not confirmed

### Tertiary (LOW confidence)
- Training data: GLM Coding Plan (Zhipu AI `open.bigmodel.cn`) billing endpoint — standard credit balance confirmed; plan quota counter endpoint not confirmed; requires network inspection
- Training data: Kimi Code subscription quota endpoint — not found in official documentation; community investigation required

---
*Research completed: 2026-03-31*
*Ready for roadmap: yes*
