# Feature Landscape

**Domain:** AI coding assistant quota tracker — desktop menubar app
**Researched:** 2026-03-31
**Milestone scope:** Provider extensibility, smart alerts, new providers (Kimi Code, GLM Coding Plan), About page

---

## Context: What Already Exists

The app already ships the following — do not re-scope these as active requirements:

| Existing Feature | Implementation Location |
|---|---|
| Codex CLI quota display (5h / weekly windows) | `src-tauri/src/codex/mod.rs` |
| Claude Code OAuth quota display (5h / 7d) | `src-tauri/src/claude_code/mod.rs` |
| Multi-service panel with configurable order | `src/lib/tauri/summary.ts`, `src/app/shared/appState.ts` |
| Menubar service selection (manual + auto) | `src-tauri/src/state/mod.rs`, `src-tauri/src/agent_activity/mod.rs` |
| Threshold-based coloring (>50% green, 20-50% amber, <20% red) | `src/lib/tauri/summary.ts::getQuotaStatus` |
| Session recovery on 401 (stale cache preserved) | `src-tauri/src/claude_code/mod.rs::PauseState::SessionRecovery` |
| System proxy auto-detection (env + scutil fallback) | `src-tauri/src/claude_code/mod.rs::resolve_proxy` |
| Desktop notifications on threshold | `src-tauri/src/notifications/mod.rs` |
| Autostart, snapshot cache, i18n (zh-CN / en-US) | `src-tauri/src/autostart`, `src-tauri/src/snapshot.rs` |

---

## Table Stakes

Features users expect in a quota tracker. Missing any of these causes abandonment or distrust.

| Feature | Why Expected | Complexity | Notes |
|---|---|---|---|
| Real-time quota display per provider | Core product promise | Low | Already exists; must survive provider abstraction refactor intact |
| Consistent data across providers | Users comparing quota across tools expect same visual language | Low | Provider abstraction must normalize `QuotaDimension` shape |
| Threshold-based visual warnings | Users need glanceable danger signals, not raw numbers | Low | Already exists; time-aware upgrade is additive |
| Graceful handling of auth errors | CLI not found, token expired, rate limited — must not show blank panel | Medium | Already exists (SnapshotStatus enum); new providers must reuse same states |
| Configurable refresh interval | Different users have different latency tolerance | Low | Already exists; must not change for existing users during migration |
| Stale cache on transient failure | Better to show old data than an error; users notice blanks immediately | Medium | Already exists for Claude Code; must extend to all providers uniformly |
| About page with version number | Desktop apps without About pages feel unfinished; used in bug reports | Low | Missing; high-visibility gap |
| License attribution for dependencies | Distribution via GitHub or packaging requires clear attribution | Medium | Missing; needed for Rust crates + npm packages; copyleft audit required |

---

## Differentiators

Features that give this app a competitive edge. Not universal expectations, but high value to the target audience.

### Provider Extensibility

| Feature | Value Proposition | Complexity | Dependencies |
|---|---|---|---|
| Provider Descriptor Registry (Rust trait + TS interface) | New providers require no structural changes; one file per provider | High | Requires refactoring Codex + Claude Code into the registry first |
| Multi-strategy fetch pipeline per provider | Each provider defines fallback chain (env → keychain → file → CLI → API); ordered, first-success stops | High | Depends on Provider Descriptor Registry |
| Kimi Code provider | Serves underserved Chinese AI coding market; CodexBar (the main competitor) has no Kimi support | High | Requires provider registry; needs research on Kimi API endpoint and auth |
| GLM Coding Plan provider | GLM (Zhipu AI) is growing fast in China; no existing tool tracks it in a menubar app | High | Requires provider registry; needs research on GLM API/plan model |
| Service order user control | Users with 3+ providers need to prioritize what they see first | Low | Already exists for 2 services; must generalize as provider count grows |

### Smart Alerts

| Feature | Value Proposition | Complexity | Dependencies |
|---|---|---|---|
| Time-aware warning thresholds | "80% remaining with 4h left in window" is safe; "80% remaining with 5 minutes left" is very different; absolute-percent-only alarms are noisy | Medium | Requires `resetsAt` timestamp from provider (already present for Claude Code and Codex) |
| Burn rate / pace forecasting | Tells users "at your current rate, quota runs out 2h before reset" — prevents surprise exhaustion | Medium | Needs `remainingPercent` + `resetsAt` + snapshot timestamp; front-end only (no new backend data) |
| Depletion ETA display | Shows predicted exhaustion time in human-readable form ("runs out in ~3h") | Low | Depends on burn rate calculation |
| Pace classification labels | 7 levels (on track / slightly ahead / slightly behind / ahead / behind / far ahead / far behind) as seen in CodexBar — surfaces urgency without raw numbers | Low | Depends on burn rate calculation |
| Suppress noisy alerts during panel open | Do not refresh or rebuild UI while user is reading the panel (prevents content jumping mid-read) | Low | Panel visibility state already tracked; add read-guard to auto-refresh loop |

### About Page

| Feature | Value Proposition | Complexity | Dependencies |
|---|---|---|---|
| Version + build info | Essential for bug reports ("what version are you on?") | Low | None; read from Tauri package.json at build time |
| GitHub URL | Makes the project feel open and trustworthy | Low | None |
| Dependency license summary | Required if distributing binary; prevents GPL contamination surprises | Medium | Requires `cargo license` audit + `license-checker` for npm; output to static file at build time |
| Extensible about layout | Future fields (author email, website, Discord) added without layout changes | Low | Design the component with a key-value list, not hard-coded layout |

---

## Anti-Features

Features to explicitly NOT build in this milestone. Each has a clear reason.

| Anti-Feature | Why Avoid | What to Do Instead |
|---|---|---|
| Browser cookie-based auth for providers | Requires invasive browser automation; privacy model is hostile to users; CodexBar's `SweetCookieKit` is macOS-only and fragile | Only support OAuth, env var, keychain, CLI, or file-based credentials |
| Cost / token billing tracking | Requires per-provider billing API; most providers (especially newer Chinese ones) do not expose cost data; out of scope per PROJECT.md | Display quota/limit data only; note "billing not supported" in provider descriptor |
| WidgetKit / desktop widget | Tauri 2 does not support WidgetKit natively; requires Swift helper process out of scope for Rust/Tauri codebase | Defer; document as future milestone candidate |
| Statuspage.io incident monitoring | Adds network dependency on a third-party service for each provider; scope too large for this milestone | Defer; note in provider descriptor as optional future field (`statuspageId`) so it's easy to add |
| Custom icon rendering per provider (animated, bitmapped) | High rendering complexity for questionable marginal benefit; CodexBar's `IconRenderer` with LRU cache is complex code | Use color-coded tray icon (green/amber/red); defer provider-specific icons |
| CLI tool bundled with desktop app | Nice to have but separate release artifact with its own maintenance surface; no user demand validated yet | Defer to a dedicated CLI milestone |
| Cloud preference sync | Requires auth provider, remote storage, conflict resolution; high complexity; no demand signal | Keep preferences local; users can manually copy `preferences.json` across devices |
| Quota usage history / sparkline | Requires persistent history storage; schema versioning; migration; not requested in this milestone | Store `resetsAt` in snapshot cache; enable history as a future milestone |
| Statusbar text > 5 characters on macOS | macOS menubar space is scarce; long text truncates or pushes other icons; users get used to icon-only or short % | Keep tray summary short; use tooltip for full provider name |

---

## Feature Dependencies

```
Provider Descriptor Registry
  └── Multi-Strategy Fetch Pipeline
        ├── Kimi Code Provider
        └── GLM Coding Plan Provider

Burn Rate Calculation (front-end, from existing data)
  ├── Pace Classification Labels
  ├── Depletion ETA Display
  └── Time-Aware Warning Thresholds (replaces static getQuotaStatus)

About Page (standalone, no other dependencies)
  └── Dependency License Audit (build-time prerequisite for license section)

Suppress Alerts During Panel Open (standalone, low risk)
```

### Ordering Constraints

1. Provider Descriptor Registry must precede adding any new provider. Kimi Code and GLM cannot be implemented correctly without the registry — adding them to the current hardcoded structure (`KNOWN_SERVICE_IDS`) makes the tech debt worse, not better.

2. Multi-Strategy Fetch Pipeline depends on the registry shape being stable. This is the second abstraction layer and must follow the registry, not precede it.

3. Burn rate calculation depends only on data that already exists (`remainingPercent` + `resetsAt`). It can be implemented in parallel with the provider registry work, against the existing Claude Code and Codex data.

4. About page is entirely standalone. It can be done in any phase.

5. Time-aware threshold replacement depends on burn rate calculation being complete (needs elapsed time and pace classification).

---

## MVP Recommendation

For this milestone, prioritize in this order:

1. **Provider Descriptor Registry + Codex/Claude Code migration** — unlocks everything else; must be backward-compatible so existing users see no change
2. **Burn rate forecasting + time-aware thresholds** — highest user value relative to complexity; pure front-end change against existing data
3. **Kimi Code provider** — highest market signal (Chinese AI coding market); validate the registry abstraction against a real new provider
4. **GLM Coding Plan provider** — second new provider; validates multi-provider scaling; follows Kimi Code pattern
5. **Multi-Strategy Fetch Pipeline** — important for long-term maintainability but lower user-facing urgency; can follow first new provider
6. **About page** — low complexity, high polish signal; good milestone "closure" feature

**Defer within this milestone if time-constrained:**

- Panel read-guard (suppress refresh during panel open) — useful UX polish but not blocking
- Pace classification labels — nice to have after basic ETA is working
- Dependency license full audit — can ship About page with version/GitHub link and add license section in a follow-up commit

---

## Implementation Notes

### Burn Rate Algorithm

Based on CodexBar's `UsagePace` approach and existing codebase data:

```
elapsed_fraction = elapsed_since_window_start / window_duration
consumed_fraction = 1 - (remainingPercent / 100)
pace_ratio = consumed_fraction / elapsed_fraction   // >1 = burning faster than expected

eta_seconds = (remainingPercent / 100) / (consumed_fraction / elapsed_seconds)
// eta_seconds = time until quota exhaustion at current burn rate
```

The `resetsAt` timestamp is already returned by both Claude Code and Codex. The window duration can be inferred from the dimension label using the existing `inferWindowMinutes` function in `src/lib/tauri/summary.ts`. No backend changes needed.

### Time-Aware Threshold Logic

Replace the current static `getQuotaStatus(remainingPercent)` function:

```
// Current (static):
remaining > 50% → healthy
remaining 20-50% → warning
remaining < 20% → exhausted

// Time-aware (proposed):
time_fraction = elapsed / total_window
if remaining > time_fraction + 20%  → healthy  (ahead of pace)
if remaining > time_fraction - 10%  → warning   (on pace or slightly behind)
if remaining < time_fraction - 10%  → exhausted (significantly behind)
```

Edge case: if `resetsAt` is not available, fall back to the existing static thresholds. This preserves behavior for providers that don't expose reset time.

### Provider Descriptor Shape (Recommended Minimum)

```rust
pub struct ProviderDescriptor {
    pub id: &'static str,            // "kimi-code", "glm-coding-plan", etc.
    pub display_name: &'static str,  // "Kimi Code"
    pub icon_key: &'static str,      // maps to frontend icon component
    pub fetch_strategies: Vec<FetchStrategy>,  // ordered; first success wins
    pub reset_window_hint: Option<&'static str>, // "weekly", "monthly", etc.
    pub dashboard_url: Option<&'static str>,
    // NOT included in this milestone:
    //   statuspage_id: skipped (Statuspage monitoring is deferred)
    //   cost_config: skipped (cost tracking is out of scope)
    //   branding_color: skipped (custom icon rendering is out of scope)
}
```

### Kimi Code and GLM — Research Gap

The quota/usage API endpoints and authentication mechanisms for Kimi Code and GLM Coding Plan are not yet confirmed from official documentation. This is a **LOW confidence area** that needs dedicated research during the Kimi/GLM provider phase:

- Kimi Code: Likely `api.moonshot.cn` or a developer portal endpoint; auth probably API key or OAuth
- GLM Coding Plan: Likely `open.bigmodel.cn` or Zhipu AI developer platform; plan quota may be exposed via account API
- Both providers are Chinese-market tools; their quota APIs may require VPN or be region-locked
- Browser-based authentication or scraping is explicitly excluded per project values

Until API endpoints are confirmed during implementation, the provider descriptors for these two services should be stubbed with `FetchStrategy::NotImplemented` and the UI should show a "Coming soon" placeholder.

### About Page — License Audit

The dependency license section requires a build-time audit step before it can display accurate information:

- Rust side: `cargo install cargo-license && cargo license --json` — filters for GPL/LGPL/AGPL
- npm side: `npx license-checker --json --onlyAllow "MIT;Apache-2.0;BSD-2-Clause;BSD-3-Clause;ISC;0BSD;CC0-1.0;Unlicense"` — fails build if non-permissive license found
- Output: Static JSON file embedded at build time; About page reads from it; never fetches at runtime

---

## Sources

| Source | Confidence | Notes |
|---|---|---|
| Codebase analysis: `src/lib/tauri/contracts.ts`, `src/lib/tauri/summary.ts`, `src-tauri/src/state/mod.rs`, `src-tauri/src/claude_code/mod.rs` | HIGH | Direct read of production code; reflects current behavior exactly |
| `.planning/research/codexbar-analysis.md` | HIGH | First-party competitive analysis of CodexBar (Swift, 25 providers); burn rate algorithm sourced from this |
| `.planning/PROJECT.md` | HIGH | Authoritative milestone requirements including explicit Out of Scope items |
| `.planning/codebase/INTEGRATIONS.md` | HIGH | Precise API endpoints, auth sources, and data flow |
| `.planning/codebase/CONCERNS.md` | HIGH | Tech debt, scaling limits, and missing features from codebase audit |
| Kimi Code API endpoint and auth | LOW | Not confirmed from official documentation; requires phase-specific research |
| GLM Coding Plan API endpoint and auth | LOW | Not confirmed from official documentation; requires phase-specific research |
