# Phase 4: Burn Rate Engine - Context

**Gathered:** 2026-04-01
**Status:** Ready for planning

<domain>
## Phase Boundary

Add per-quota-dimension burn-rate forecasting to the panel so users can tell whether each quota window will last until reset. This phase covers pace classification and depletion ETA display in the panel only. It does not change warning colors, tray severity logic, or notification thresholds; those remain Phase 5 work.

</domain>

<decisions>
## Implementation Decisions

### Pace Model
- **D-01:** Phase 4 uses one pace algorithm for both `5h` and weekly windows to avoid contradictory behavior across providers or quota types.
- **D-02:** Pace is derived from whole-window progress: compare current consumption against elapsed time in the current reset window, then project depletion from the average burn so far.
- **D-03:** Supported windows are inferred only from labels we can identify confidently today (`5h`, `week`, `7d`). Unknown windows fail silent.
- **D-04:** Hide pace entirely when `remainingPercent <= 10`; at that point the remaining percentage is already the dominant signal.
- **D-05:** Phase 4 uses a simple 3-level pace model: `on track`, `behind`, `far behind`.
- **D-06:** Healthy cases are collapsed into a single `on track` label; do not distinguish `ahead` vs `on track` in this first version.
- **D-07:** Visible pace labels use short, explicit wording. Recommended Chinese copy is `进度正常`, `消耗偏快`, and `消耗过快`.

### Panel Presentation
- **D-08:** Burn-rate output appears inside each quota dimension block, not only once at the provider-card level.
- **D-09:** Risk rows keep a compact two-line treatment: a short pace label plus one short second line for depletion ETA and reset hint.
- **D-10:** `On track` rows stay visually quiet; Phase 4 does not force a burn-rate block onto healthy rows.

### Graceful Degradation
- **D-11:** When `resetsAt` is missing, unparseable, not in the future, or farther away than the inferred window length, hide burn-rate output for that quota dimension.
- **D-12:** Do not show placeholder copy such as `Calculating…`; unsupported or degraded rows stay silent.
- **D-13:** Phase 4 does not require persisted sample history. ETA and pace come from the current snapshot plus reset window inference.

### the agent's Discretion
- Exact English copy for the positive/negative second line, as long as it stays compact and pairs naturally with the chosen pace labels.
- Exact threshold cutoffs within the chosen three-level pace model, as long as the output remains deterministic and explainable.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Milestone Scope And Requirements
- `.planning/ROADMAP.md` — Phase 4 goal, boundary, and success criteria for pace classification and depletion ETA
- `.planning/REQUIREMENTS.md` — `ALERT-01` and `ALERT-02` definitions for burn rate and human-readable depletion ETA
- `.planning/PROJECT.md` — milestone constraints: no new runtime dependencies, no new storage layer, cross-platform behavior

### Burn-Rate Research
- `.planning/research/SUMMARY.md` — initial Phase 4 recommendation; final implementation simplified further after UI review and user feedback
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
- Compact card UI favors short labels and one extra line over larger new sections.

### Integration Points
- `src/lib/tauri/contracts.ts`: quota-dimension transport contract consumed directly by the panel.
- `src/lib/tauri/summary.ts`: likely entry point for burn-rate decoration and panel-level health interactions.
- `src/components/panel/QuotaSummary.tsx`: likely render point for pace label plus ETA/positive confirmation line.
- `src/app/shared/i18n.ts`: likely render-time localization for pace labels and second-line copy.

</code_context>

<specifics>
## Specific Ideas

- Keep burn-rate output attached to each quota row so users can read 5h and weekly windows independently.
- Favor compact wording that reads naturally in both English and Chinese.
- Do not show placeholder or speculative burn-rate output when the app lacks enough history to be trustworthy.
- User wanted the same pace algorithm for `5h` and weekly windows; the final implementation uses the same whole-window math for both.
- User approved a risk-only presentation: healthy rows stay silent, risky rows show pace plus ETA/reset information.

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
