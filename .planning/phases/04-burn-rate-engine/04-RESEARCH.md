# Phase 4: Burn Rate Engine - Research

**Researched:** 2026-04-01
**Domain:** Burn-rate forecasting and depletion ETA for quota dimensions in an existing Tauri + React app
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
## Implementation Decisions

### Burn-Rate History
- **D-01:** Store a tiny rolling burn-rate history in the existing `snapshot-cache.json`, not only in React session state.
- **D-02:** Key history by `provider + quota dimension`, so weekly and short rolling windows for the same provider never share a rate sample stream.
- **D-03:** Record new history points only on successful provider snapshot refreshes. Visible-window minute ticks must never create synthetic history points.

### Pace Model
- **D-04:** Phase 4 uses a simple 3-level pace model: `on track`, `behind`, `far behind`.
- **D-05:** Healthy cases are collapsed into a single `on track` label; do not distinguish `ahead` vs `on track` in this first version.
- **D-06:** Visible pace labels use short, explicit wording. Recommended Chinese copy is `进度正常`, `消耗偏快`, and `消耗过快`.

### Panel Presentation
- **D-07:** Burn-rate output appears inside each quota dimension block, not only once at the provider-card level.
- **D-08:** Each quota dimension shows a compact two-line treatment: a short pace label plus one short second line for depletion ETA or positive confirmation.
- **D-09:** Every visible quota dimension gets its own burn-rate output; do not collapse multiple windows into one provider-level burn-rate summary in this phase.

### Graceful Degradation
- **D-10:** When history is insufficient, show no burn-rate line yet. Do not show placeholder copy such as `Calculating…`.
- **D-11:** When `resetsAt` is missing, hide burn-rate output for that quota dimension rather than inferring from the label.
- **D-12:** When `resetsAt` is clearly invalid, treat it as unavailable and hide burn-rate output for that quota dimension.

### the agent's Discretion
- Exact burn-rate math and smoothing strategy, as long as it remains explainable, deterministic, and consistent with the three-level pace model.
- Exact English copy for the positive/negative second line, as long as it stays compact and pairs naturally with the chosen pace labels.
- Exact cache payload shape for the rolling history, as long as it is additive and backward-compatible with the existing snapshot cache.
- Exact heuristics for “clearly invalid” reset timestamps, as long as they fail safe and never show misleading ETA output.

### Deferred Ideas (OUT OF SCOPE)
- Distinguishing `ahead` from `on track` — defer until a later iteration proves the extra healthy-state nuance is worth the UI space.
- Provider-level aggregate burn-rate header summary — defer unless users later ask for a higher-level “worst window” rollup.
- Any change to warning colors, tray severity, or notification triggers — explicitly Phase 5 scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ALERT-01 | Burn rate is calculated from `remainingPercent` + `resetsAt` + snapshot timestamp, showing consumption pace relative to window progress | Use persisted successful-refresh samples plus current `resetsAt` to compute depletion ETA and compare ETA vs time-until-reset; keep math in pure TypeScript |
| ALERT-02 | Depletion ETA is displayed in human-readable form | Reuse frontend i18n/time formatting patterns for compact ETA/confirmation copy in each `QuotaSummary` row |
</phase_requirements>

## Summary

Phase 4 should stay mostly frontend-facing, but it is not frontend-only in the storage sense. The correct shape is: persist a tiny successful-refresh history in Rust alongside the existing snapshot cache, pass that raw history through the existing panel-state contract, and compute pace classification plus ETA in a new pure TypeScript helper used by `summary.ts` and `QuotaSummary.tsx`.

The key implementation choice is to classify pace by comparing **projected depletion time** against **time until reset**, not by reconstructing full window progress from label text. That avoids unnecessary contract churn like `windowDurationMinutes`, avoids label-parsing bugs for Kimi/GLM windows, and still satisfies the phase goal: tell the user whether the current burn rate will exhaust quota before reset.

**Primary recommendation:** Add a rolling 2-3 point history per `providerId + raw dimension label`, compute ETA from the oldest and newest valid points, and render compact per-dimension burn-rate copy only when both history and a valid future `resetsAt` exist.

## Project Constraints (from CLAUDE.md)

- Read and follow `AGENTS.md` project rules before planning implementation.
- Do not add new runtime dependencies.
- Keep the phase cross-platform on macOS and Windows.
- Preserve backward compatibility for existing Codex and Claude Code users.
- Keep delivery incremental and independently shippable.
- Do not introduce a new storage layer; continue using `preferences.json` and `snapshot-cache.json`.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| TypeScript | repo pin `^5.8.2` | Burn-rate math, contract decoration, UI derivation | Existing pure-helper pattern already lives in `src/lib/tauri/summary.ts`; no reason to move math into Rust |
| React | repo pin `^19.0.0` | Render per-dimension pace label and ETA in existing panel cards | Existing panel state flow and visible-window ticker already support time-derived UI |
| `@tauri-apps/api` | repo pin `^2.0.0` | Existing IPC bridge only; no new commands beyond additive payloads | Burn-rate data should ride the same provider-state contract rather than a new bridge |
| Rust `serde` / `serde_json` | repo pin `1.0` | Add additive history field in snapshot cache | Existing cache schema already uses serde defaults for graceful upgrades |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Built-in `Date.parse` / `Date.now` | Web standard | Parse `resetsAt`, compare future timestamps, reject invalid dates | Use for all reset-time validation and ETA math |
| Built-in `Intl.RelativeTimeFormat` or existing compact i18n helpers | Web standard | Human-readable ETA copy without a date library | Use only if it matches current compact UI; otherwise keep existing template-based formatting |
| Vitest | local CLI `3.2.4`, repo pin `^3.0.8` | Unit tests for burn-rate math and i18n formatting | Fast feedback for the deterministic helper and UI rendering |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| TS burn-rate helper + additive cache history | Compute everything in Rust | Unnecessary backend coupling; current project pattern prefers pure frontend derivation for display logic |
| Existing snapshot cache with additive history | New DB/file/history store | Violates locked storage constraint and creates migration work for a 2-3 sample problem |
| ETA-vs-reset projection | Full window-duration metadata and elapsed-window reconstruction | More contract churn and label-duration edge cases without improving Phase 4 UX |
| Built-in `Date` / `Intl` | `date-fns` / `dayjs` | Violates project guidance and adds runtime surface for a small formatting need |

**Installation:**
```bash
# None. Phase 4 should not add packages.
```

**Version verification:** Repository pins and local executables were verified from this workspace on 2026-04-01: `node v24.14.1`, `npm 11.11.0`, `vitest 3.2.4`, `playwright 1.58.2`, `tauri-cli 2.10.1`. Official docs confirm built-in `Intl.RelativeTimeFormat` and `Date.parse` are widely available and sufficient for locale-aware relative time plus invalid-date detection. npm package pages also show the project stack remains on current major lines (`react` 19.x, `vite` 6.x, `vitest` 3.x, `@tauri-apps/api` 2.x). Sources are listed below.

## Architecture Patterns

### Recommended Project Structure
```text
src/
├── lib/tauri/
│   ├── burnRate.ts        # new pure math + formatting-adjacent helper
│   ├── contracts.ts       # optional additive history/display fields
│   └── summary.ts         # compose burn-rate decoration into existing dimension flow
├── components/panel/
│   └── QuotaSummary.tsx   # render pace label + ETA/confirmation line
└── app/shared/
    └── i18n.ts            # compact localized burn-rate strings / ETA formatter

src-tauri/src/
└── commands/mod.rs        # additive snapshot-cache history persistence + attachment
```

### Pattern 1: Persist Only Raw Successful-Refresh Samples
**What:** Store at most 2-3 raw samples per `providerId + raw dimension label`: `{ capturedAt, remainingPercent }`.
**When to use:** On fresh provider refresh only, inside the existing snapshot-cache write path.
**Example:**
```rust
// Source pattern: src-tauri/src/commands/mod.rs snapshot-cache helpers
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct BurnRateSample {
    captured_at: String,
    remaining_percent: u8,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
struct SnapshotCache {
    #[serde(default)]
    schema_version: u32,
    services: HashMap<String, CodexPanelState>,
    #[serde(default)]
    burn_rate_history: HashMap<String, Vec<BurnRateSample>>,
}
```

### Pattern 2: Compute Pace From ETA vs Reset, Not From Label-Inferred Window Progress
**What:** Use the oldest and newest valid samples to estimate burn rate, then compare projected depletion time against `resetsAt`.
**When to use:** In a new pure helper called from `summary.ts` after dimensions are normalized.
**Example:**
```typescript
// Source: inference from existing pure-helper pattern in src/lib/tauri/summary.ts
export const classifyBurnRate = (
  currentRemainingPercent: number,
  resetAtIso: string,
  samples: readonly { capturedAt: string; remainingPercent: number }[],
  nowMs: number
) => {
  const resetMs = Date.parse(resetAtIso);
  if (!Number.isFinite(resetMs) || resetMs <= nowMs) return null;

  const valid = samples
    .map((sample) => ({ t: Date.parse(sample.capturedAt), p: sample.remainingPercent }))
    .filter((sample) => Number.isFinite(sample.t))
    .sort((a, b) => a.t - b.t);

  if (valid.length < 2) return null;

  const first = valid[0]!;
  const last = valid[valid.length - 1]!;
  const consumed = first.p - last.p;
  const elapsedMs = last.t - first.t;
  if (elapsedMs <= 0) return null;

  const ratePerMs = Math.max(0, consumed / elapsedMs);
  if (ratePerMs === 0) {
    return { pace: "on-track", willLastUntilReset: true, depletionEtaMs: null };
  }

  const depletionEtaMs = currentRemainingPercent / ratePerMs;
  const timeUntilResetMs = resetMs - nowMs;
  const coverage = depletionEtaMs / timeUntilResetMs;

  return {
    pace: coverage >= 1 ? "on-track" : coverage >= 0.5 ? "behind" : "far-behind",
    willLastUntilReset: coverage >= 1,
    depletionEtaMs
  };
};
```

### Pattern 3: Decorate Quota Rows, Do Not Rebuild ServiceCard Layout
**What:** Attach optional burn-rate display fields to each dimension and render them inside `QuotaSummary`.
**When to use:** After existing status/progress tone decoration, before render.
**Example:**
```typescript
// Source pattern: src/components/panel/QuotaSummary.tsx + src/lib/tauri/summary.ts
type BurnRateDisplay = {
  paceLabelKey?: "burnRateOnTrack" | "burnRateBehind" | "burnRateFarBehind";
  secondaryLineKey?: "burnRateRunsOutSoon" | "burnRateWillLastUntilReset";
  depletionEtaMinutes?: number;
};
```

### Anti-Patterns to Avoid
- **Synthetic minute-tick history:** `displayNowMs` exists only for visible UI recompute. Do not append samples from that timer.
- **Backend-formatted burn-rate copy:** Keep Rust responsible for persistence and transport only; display wording stays in frontend i18n.
- **Placeholder burn-rate text:** When history or `resetsAt` is insufficient, show nothing.
- **Phase 5 leakage:** Do not change `status`, `progressTone`, tray severity, or notification thresholds in this phase.
- **Reset inference from labels:** If `resetsAt` is absent, hide burn-rate output. Do not infer reset time from `"5h"` or `"week"` labels.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Burn-rate persistence | New history file / database | Additive field in `snapshot-cache.json` | Locked constraint forbids a new storage layer; only 2-3 samples are needed |
| Relative time text | New runtime date library | Existing i18n patterns plus built-in `Date` / `Intl` | Already sufficient, cross-platform, and consistent with project guidance |
| Pace classification | Full statistical model or multi-bucket system | Simple 3-bucket ETA coverage thresholds | Matches locked UI scope and keeps copy understandable |
| Provider summary rollup | Provider-level burn-rate banner | Per-dimension output in `QuotaSummary` | Locked scope requires every visible quota dimension to stand alone |

**Key insight:** The hard problem here is not math complexity. It is making the result trustworthy on first launch, after restart, and across providers with imperfect timestamps. Persisting a tiny raw sample history solves that without broadening the architecture.

## Common Pitfalls

### Pitfall 1: History Disappears Across Restarts
**What goes wrong:** Burn rate works only within one open app session, then vanishes after relaunch.
**Why it happens:** Samples are kept only in React state, not the snapshot cache.
**How to avoid:** Persist 2-3 samples in Rust snapshot cache and attach them to returned panel state.
**Warning signs:** First manual refresh after relaunch always hides burn-rate output even when prior fresh data existed minutes earlier.

### Pitfall 2: Invalid `resetsAt` Produces Negative or Nonsensical ETA
**What goes wrong:** UI shows past-due or impossible ETA values.
**Why it happens:** `Date.parse()` returns `NaN` for invalid dates, and clock skew or stale data can produce past timestamps.
**How to avoid:** Treat parse failure or `resetMs <= nowMs` as unavailable and hide burn-rate output.
**Warning signs:** `"runs out in ~-5m"`, `"NaN"`, `"Infinity"`, or a visible burn-rate line on already-due windows.

### Pitfall 3: Label Changes Corrupt History Matching
**What goes wrong:** History for one dimension leaks into another or silently stops matching.
**Why it happens:** History keys use localized labels or provider-level keys only.
**How to avoid:** Key by `providerId + raw backend label`; never key by localized display label.
**Warning signs:** Weekly and 5h windows share one pace label or history resets when language changes.

### Pitfall 4: Burn-Rate Logic Accidentally Changes Alert Colors
**What goes wrong:** Phase 4 ships with new red/amber/green behavior before Phase 5 is planned.
**Why it happens:** Developers reuse burn-rate classification to overwrite `status` or `progressTone`.
**How to avoid:** Add separate optional burn-rate display fields; leave existing threshold logic untouched.
**Warning signs:** Existing `summary.test.ts` threshold assertions start failing during Phase 4 work.

## Code Examples

Verified patterns from official and project sources:

### Parse And Validate Reset Timestamps
```typescript
// Source: MDN Date.parse + project pattern in src/app/shared/i18n.ts
const resetMs = Date.parse(resetsAt);
if (!Number.isFinite(resetMs) || resetMs <= nowMs) {
  return undefined;
}
```

### Locale-Aware Relative Time Without A New Library
```typescript
// Source: MDN Intl.RelativeTimeFormat
const rtf = new Intl.RelativeTimeFormat("en", { style: "short", numeric: "always" });
rtf.format(3, "hour"); // "in 3 hr."
```

### Visible-Window-Only Recompute Pattern
```typescript
// Source: src/app/shell/AppShell.tsx
useEffect(() => {
  if (!isWindowVisible || currentView !== "panel") return;
  setDisplayNowMs(Date.now());
  const tickerId = window.setInterval(() => setDisplayNowMs(Date.now()), 60_000);
  return () => window.clearInterval(tickerId);
}, [currentView, isWindowVisible]);
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Single-snapshot quota display only | Persist 2-3 successful-refresh samples and project depletion ETA | Phase 4 | Makes quota display predictive instead of purely descriptive |
| Static threshold colors only | Separate pace label + ETA line, while keeping old colors until Phase 5 | Phase 4 | Adds insight without mixing alert policy changes into this phase |
| Session-only rate estimation idea | Cross-restart sample reuse from snapshot cache | Phase 4 | Prevents first-launch-after-restart blind spots |

**Deprecated/outdated:**
- Burn-rate from label-inferred reset windows alone: unnecessary for this phase and more fragile than ETA-vs-reset projection.
- Placeholder text like `Calculating…`: explicitly rejected by locked decision D-10.

## Open Questions

1. **Exact English compact copy**
   - What we know: Chinese recommendations are locked; English remains discretionary.
   - What's unclear: Whether `"runs out in ~3h"` or `"depletes in ~3h"` fits the existing card density better.
   - Recommendation: Use `"On track"`, `"Burning fast"`, `"Burning very fast"` plus `"Runs out in ~{value}"` / `"Will last until reset"`.

2. **Exact bucket thresholds for `behind` vs `far behind`**
   - What we know: Three buckets are locked; algorithm must be deterministic and explainable.
   - What's unclear: Whether the cutoff should be `0.5` or `0.67` coverage of time-until-reset.
   - Recommendation: Start with `coverage >= 1 => on track`, `0.5 <= coverage < 1 => behind`, `< 0.5 => far behind`; keep constants centralized for later tuning.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Frontend build/tests | ✓ | 24.14.1 | — |
| npm | Scripts/test runner invocation | ✓ | 11.11.0 | — |
| Cargo | Rust snapshot-cache tests | ✓ | 1.94.0 | — |
| Rustc | Rust build/test toolchain | ✓ | 1.94.0 | — |
| Vitest | Fast unit tests for burn-rate logic | ✓ | 3.2.4 | — |
| Playwright | Existing e2e coverage path if UI regressions need higher confidence | ✓ | 1.58.2 | — |
| Tauri CLI | Full desktop verification | ✓ | 2.10.1 | — |

**Missing dependencies with no fallback:**
- None.

**Missing dependencies with fallback:**
- None.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 3.2.4 + React Testing Library + Rust unit tests |
| Config file | `vitest.config.ts` |
| Quick run command | `npx vitest run src/lib/tauri/summary.test.ts src/app/shared/i18n.test.ts src/components/panel/ServiceCard.test.tsx src/app/panel/PanelView.test.tsx` |
| Full suite command | `npx vitest run src/lib/tauri/summary.test.ts src/app/shared/i18n.test.ts src/components/panel/ServiceCard.test.tsx src/app/panel/PanelView.test.tsx src/app/shell/AppShell.test.tsx && cargo test snapshot_cache --manifest-path src-tauri/Cargo.toml` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ALERT-01 | Classifies each quota dimension as on-track / behind / far-behind from sample history plus `resetsAt` | unit | `npx vitest run src/lib/tauri/summary.test.ts` | ✅ extend existing suite |
| ALERT-01 | Hides burn-rate output when history is insufficient or `resetsAt` invalid/missing | component | `npx vitest run src/components/panel/ServiceCard.test.tsx src/app/panel/PanelView.test.tsx` | ✅ extend existing suites |
| ALERT-02 | Shows compact depletion ETA when projected to run out before reset | unit + component | `npx vitest run src/app/shared/i18n.test.ts src/components/panel/ServiceCard.test.tsx src/app/panel/PanelView.test.tsx` | ✅ extend existing suites |
| ALERT-02 | Shows positive confirmation when projection lasts through reset | component | `npx vitest run src/components/panel/ServiceCard.test.tsx src/app/panel/PanelView.test.tsx` | ✅ extend existing suites |
| ALERT-01 / ALERT-02 | Persists additive rolling history without breaking cache reads | rust unit | `cargo test snapshot_cache --manifest-path src-tauri/Cargo.toml` | ✅ |

### Sampling Rate
- **Per task commit:** Run the task-specific `<automated>` command from the final Phase 04 plan set (`04-01-PLAN.md`, `04-02-PLAN.md`)
- **Per wave merge:** `npx vitest run src/lib/tauri/summary.test.ts src/app/shared/i18n.test.ts src/components/panel/ServiceCard.test.tsx src/app/panel/PanelView.test.tsx src/app/shell/AppShell.test.tsx && cargo test snapshot_cache --manifest-path src-tauri/Cargo.toml`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
None. Phase 04 intentionally extends existing suites instead of creating standalone Wave 0 test files:
- `src/lib/tauri/summary.test.ts` for burn-rate math and graceful degradation
- `src/app/shared/i18n.test.ts` for compact pace/ETA copy
- `src/components/panel/ServiceCard.test.tsx` and `src/app/panel/PanelView.test.tsx` for visible and hidden quota-row rendering
- existing Rust `snapshot_cache_*` coverage for additive `burn_rate_history` persistence

## Sources

### Primary (HIGH confidence)
- Local codebase: `src/components/panel/QuotaSummary.tsx`, `src/components/panel/ServiceCard.tsx`, `src/lib/tauri/summary.ts`, `src/lib/tauri/contracts.ts`, `src/app/shared/i18n.ts`, `src/app/shell/AppShell.tsx`, `src-tauri/src/commands/mod.rs`, `src-tauri/src/state/mod.rs`
- Phase context: `.planning/phases/04-burn-rate-engine/04-CONTEXT.md`
- Project scope: `.planning/ROADMAP.md`, `.planning/REQUIREMENTS.md`, `.planning/PROJECT.md`, `.planning/STATE.md`
- Prior milestone research: `.planning/research/SUMMARY.md`, `.planning/research/STACK.md`, `.planning/research/PITFALLS.md`, `.planning/research/codexbar-analysis.md`
- MDN `Date.parse()` - https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date/parse
- MDN `Intl.RelativeTimeFormat` - https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/RelativeTimeFormat
- Tauri JavaScript API reference - https://v2.tauri.app/reference/javascript/api/

### Secondary (MEDIUM confidence)
- npm `vite` package page - https://www.npmjs.com/package/vite
- npm `react` package page - https://www.npmjs.com/package/react
- npm `vitest` package page - https://www.npmjs.com/package/vitest
- npm `@tauri-apps/api` package page - https://www.npmjs.com/package/%40tauri-apps/api

### Tertiary (LOW confidence)
- None. Critical claims for this phase were grounded in local code or official docs.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Phase 4 should stay on the existing stack and requires no new runtime packages
- Architecture: HIGH - Existing code already exposes the correct seams: snapshot cache in Rust, pure derivation in TS, per-dimension rendering in `QuotaSummary`
- Pitfalls: HIGH - Failure modes are directly observable from current code and prior project research

**Research date:** 2026-04-01
**Valid until:** 2026-05-01
