# Phase 4: Burn Rate Engine - Context

**Gathered:** 2026-04-01
**Status:** Ready for planning

<domain>
## Phase Boundary

Add per-quota-dimension burn-rate forecasting to the panel so users can tell whether each quota window will last until reset. This phase covers pace classification and depletion ETA display in the panel only. It does not change warning colors, tray severity logic, or notification thresholds; those remain Phase 5 work.

</domain>

<decisions>
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

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Milestone Scope And Requirements
- `.planning/ROADMAP.md` — Phase 4 goal, boundary, and success criteria for pace classification and depletion ETA
- `.planning/REQUIREMENTS.md` — `ALERT-01` and `ALERT-02` definitions for burn rate and human-readable depletion ETA
- `.planning/PROJECT.md` — milestone constraints: no new runtime dependencies, no new storage layer, cross-platform behavior

### Burn-Rate Research
- `.planning/research/SUMMARY.md` — Phase 4 recommendation: pure frontend burn-rate engine plus tiny rolling history in existing snapshot cache
- `.planning/research/STACK.md` — recommended first-pass 3-bucket pace model and frontend-only implementation guidance
- `.planning/research/PITFALLS.md` §Pitfall 5 — fallback rules for missing or invalid `resetsAt`, and burn-rate first-launch failure modes
- `.planning/research/PITFALLS.md` §Pitfall 9 — warning about nonstandard or long reset windows and label-based inference risk
- `.planning/research/codexbar-analysis.md` §P0.1 — competitive reference for burn-rate forecasting and ETA as a key differentiator

### Prior Phase Decisions
- `.planning/phases/03-new-providers/03-CONTEXT.md` — new providers reuse existing ServiceCard/QuotaSummary patterns and consistent SnapshotStatus UI treatment
- `.planning/STATE.md` — current blocker note for Phase 5 clock-skew/reset-time policy, which Phase 4 should avoid preempting except for safe invalid-timestamp hiding

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/components/panel/QuotaSummary.tsx`: Existing per-dimension UI block where pace label and second-line ETA/confirmation can be added without inventing a new layout.
- `src/app/shell/AppShell.tsx`: Already maintains `displayNowMs` with a visible-window-only minute ticker and immediate recompute on focus/visibility restore.
- `src/app/shared/i18n.ts`: Existing home for localized time/status copy and short reset formatting.
- `src/lib/tauri/summary.ts`: Current quota derivation layer; natural place to call a new burn-rate utility and decorate dimensions for UI consumption.

### Established Patterns
- Frontend derives display state from shared contracts using pure TypeScript helpers instead of pushing presentation logic into provider fetchers.
- UI time-based labels are recomputed locally while the panel is visible; provider refresh cadence stays separate from display ticking.
- Additive schema changes are preferred for persisted cache data so upgrades fail gracefully.
- Compact card UI favors short labels and one extra line over larger new sections.

### Integration Points
- `src/lib/tauri/contracts.ts`: likely extension point for burn-rate display fields or history identifiers.
- `src/lib/tauri/summary.ts`: likely entry point for burn-rate decoration and panel-level health interactions.
- `src/components/panel/QuotaSummary.tsx`: likely render point for pace label plus ETA/positive confirmation line.
- `src/app/shared/i18n.ts`: likely render-time localization for pace labels and second-line copy.
- `src-tauri/src/commands/mod.rs`: existing snapshot-cache read/write path if rolling history is persisted across restarts.

</code_context>

<specifics>
## Specific Ideas

- Keep burn-rate output attached to each quota row so users can read 5h and weekly windows independently.
- Favor compact wording that reads naturally in both English and Chinese.
- Do not show placeholder or speculative burn-rate output when the app lacks enough history to be trustworthy.

</specifics>

<deferred>
## Deferred Ideas

- Distinguishing `ahead` from `on track` — defer until a later iteration proves the extra healthy-state nuance is worth the UI space.
- Provider-level aggregate burn-rate header summary — defer unless users later ask for a higher-level “worst window” rollup.
- Any change to warning colors, tray severity, or notification triggers — explicitly Phase 5 scope.

</deferred>

---

*Phase: 04-burn-rate-engine*
*Context gathered: 2026-04-01*
