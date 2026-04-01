# Phase 4: Burn Rate Engine - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-01
**Phase:** 04-burn-rate-engine
**Areas discussed:** Burn-rate history, panel presentation, graceful degradation, pace scale and wording, projection math, reset validity, history identity, row copy

---

## Burn-Rate History

| Option | Description | Selected |
|--------|-------------|----------|
| Session-only in React state | Simplest implementation, but ETA disappears after app restart | |
| Tiny rolling history in existing `snapshot-cache.json` | Survives restart while staying lightweight | ✓ |
| Larger persisted history window | More trend data, but unnecessary for this phase | |

**User's choice:** Tiny rolling history in existing `snapshot-cache.json`
**Notes:** User accepted the lightweight persisted history approach.

| Option | Description | Selected |
|--------|-------------|----------|
| Provider only | Too coarse for providers with multiple windows | |
| Provider + quota dimension | Keeps each window's burn rate separate | ✓ |
| Provider + inferred window kind | Workable, but weaker than using the actual dimension identity | |

**User's choice:** Provider + quota dimension
**Notes:** Keeps weekly and short rolling windows independent.

| Option | Description | Selected |
|--------|-------------|----------|
| On each successful provider snapshot refresh only | Uses only real observed points | ✓ |
| On every visible-minute UI tick | Creates synthetic history points with no fresh data | |
| Only on manual refresh | Too sparse for reliable forecasting | |

**User's choice:** On each successful provider snapshot refresh only
**Notes:** User agreed local countdown ticks must not affect burn-rate history.

---

## Panel Presentation

| Option | Description | Selected |
|--------|-------------|----------|
| Inside each quota dimension block | Burn rate stays attached to the specific reset window | ✓ |
| Once per provider card header | Simpler visually, but loses precision with multiple windows | |
| Both header and per-dimension | Most informative, but likely too crowded for the compact UI | |

**User's choice:** Inside each quota dimension block
**Notes:** User explicitly wanted UI discussion before finalizing wording.

| Option | Description | Selected |
|--------|-------------|----------|
| Pace label only | Compact, but misses ETA/positive outcome | |
| Pace label plus one short second line | Shows both diagnosis and outcome compactly | ✓ |
| ETA only | Concise, but loses the explicit pace classification | |

**User's choice:** Pace label plus one short second line
**Notes:** This became the anchor for later wording decisions.

| Option | Description | Selected |
|--------|-------------|----------|
| Every dimension gets its own burn-rate line | Each window stands on its own | ✓ |
| Only the most important dimension gets burn-rate UI | Cleaner, but hides useful information | |
| One primary dimension expanded and others hidden behind interaction | Too much UI complexity for this phase | |

**User's choice:** Every dimension gets its own burn-rate line
**Notes:** Burn-rate treatment should remain per-window rather than aggregated.

---

## Graceful Degradation

| Option | Description | Selected |
|--------|-------------|----------|
| Show a neutral placeholder like `Calculating…` | Explicit, but noisy in a compact card | |
| Show no burn-rate line yet | Quietest behavior and avoids false confidence | ✓ |
| Show only static reset countdown | Useful, but easy to confuse with real burn-rate output | |

**User's choice:** Show no burn-rate line yet
**Notes:** User preferred silence over placeholders when data is insufficient.

| Option | Description | Selected |
|--------|-------------|----------|
| Hide burn-rate output when `resetsAt` is missing | Safe and honest | ✓ |
| Infer from labels like `5h` or `weekly` | Possible, but error-prone across providers/locales | |
| Show generic “prediction unavailable” copy | Explicit, but adds visual noise | |

**User's choice:** Hide burn-rate output when `resetsAt` is missing
**Notes:** Avoid guessing from labels in Phase 4.

| Option | Description | Selected |
|--------|-------------|----------|
| Treat invalid `resetsAt` as unavailable and hide output | Safe fallback | ✓ |
| Show pace classification but suppress ETA | Partially useful, but still leans on suspect time data | |
| Show inline error state | Too heavy for this phase | |

**User's choice:** Treat invalid `resetsAt` as unavailable and hide output
**Notes:** Invalid timestamps should fail safe, not produce speculative burn-rate output.

---

## Pace Scale And Wording

| Option | Description | Selected |
|--------|-------------|----------|
| 3 levels: `on track / behind / far behind` | Compact, roadmap-aligned first pass | ✓ |
| 5 levels | More nuance, but denser in the current UI | |
| 7 levels like CodexBar | Richest model, but too granular for this phase | |

**User's choice:** 3 levels
**Notes:** This was locked before the UI wording discussion finished.

| Option | Description | Selected |
|--------|-------------|----------|
| Collapse `ahead` into one healthy label | Simpler mental model for compact cards | ✓ |
| Distinguish `ahead` and `on track` | More nuance, but more concepts without changing action | |

**User's choice:** Collapse healthy states into one label
**Notes:** User first asked why `ahead` should collapse into `on track`, then accepted the simpler first-pass model after UI placement was clarified.

| Option | Description | Selected |
|--------|-------------|----------|
| Friendly outcome wording | More conversational, but blurs pace vs ETA | |
| Short pace wording | Clear, compact, and pairs well with a second line | ✓ |

**User's choice:** Short pace wording
**Notes:** Recommended Chinese labels: `进度正常`, `消耗偏快`, `消耗过快`.

---

## the agent's Discretion

- Exact English phrasing for the second-line ETA/positive confirmation text
- Exact cache payload shape for rolling history, as long as it stays additive and lightweight
- Exact threshold cutoffs inside the chosen 3-level model, as long as output stays deterministic and explainable

---

## Context Refresh Decisions

| Option | Description | Selected |
|--------|-------------|----------|
| CodexBar-style even-budget pace | Compare usage against elapsed-window budget like CodexBar | |
| Sample-based ETA-vs-reset projection | Estimate depletion from successful refresh samples and compare to `resetsAt` | ✓ |
| Sample-based math with CodexBar-style early-window hiding | Keep sample-based math but borrow extra gating | |

**User's choice:** Sample-based ETA-vs-reset projection
**Notes:** User explicitly asked to research CodexBar first, then chose not to mirror its even-budget window-progress model for Phase 4.

| Option | Description | Selected |
|--------|-------------|----------|
| Minimal fail-safe | Hide burn-rate when `resetsAt` is unparseable or not in the future | ✓ |
| Stricter fail-safe | Also hide burn-rate for implausibly distant reset times | |
| You decide | Leave exact reset-validity behavior to implementation | |

**User's choice:** Minimal fail-safe
**Notes:** User wanted Phase 4 to avoid pulling in extra reset-policy decisions that belong more naturally in later work.

| Option | Description | Selected |
|--------|-------------|----------|
| `providerId + raw quota label` | Low-churn per-dimension key using existing raw identity | ✓ |
| Explicit dimension key contract | Add a new stable identifier field now | |
| You decide | Leave history identity to implementation | |

**User's choice:** `providerId + raw quota label`
**Notes:** Keeps weekly and 5h windows separate without extra contract churn in this phase.

| Option | Description | Selected |
|--------|-------------|----------|
| Keep current terse two-line copy | Reuse UI-spec wording for pace label + ETA/confirmation | ✓ |
| More explicit English wording | Keep structure but expand English copy slightly | |
| You decide | Leave English wording to implementation | |

**User's choice:** Keep current terse two-line copy
**Notes:** User kept the existing compact UI-spec wording to fit the current `QuotaSummary` footprint.

---

## Late Execution Decisions

| Option | Description | Selected |
|--------|-------------|----------|
| Keep burn-rate visible on every row | Adds symmetry but increases card height substantially | |
| Show burn-rate only for risky rows | Preserves two-provider default view and spends height where action may be needed | ✓ |

**User's choice:** Show burn-rate only for risky rows
**Notes:** Healthy rows should not expand the card; risky rows keep the extra pace detail.

| Option | Description | Selected |
|--------|-------------|----------|
| Use different math for `5h` and weekly | Could optimize each window separately but creates trust and explainability problems | |
| Use one shared algorithm for `5h` and weekly | Same mental model everywhere | ✓ |

**User's choice:** Use one shared algorithm for `5h` and weekly
**Notes:** User explicitly rejected mixed algorithms because identical labels would mean different things.

| Option | Description | Selected |
|--------|-------------|----------|
| Keep sample-based ETA/projection | More reactive, but weekly results looked noisy and hard to trust | |
| Switch to whole-window average-so-far pace/ETA | Simpler, more stable, same across windows | ✓ |

**User's choice:** Whole-window average-so-far pace/ETA
**Notes:** Final formula uses current remaining percent plus inferred window length from `resetsAt` and the quota label.

| Option | Description | Selected |
|--------|-------------|----------|
| Show pace at all remaining levels | Maximal visibility but noisy when quota is already clearly low | |
| Hide pace when remaining percentage is 10% or lower | Lets the remaining percentage dominate near exhaustion | ✓ |

**User's choice:** Hide pace when remaining percentage is 10% or lower
**Notes:** Low remaining percentage is already the clearest signal at that point.

| Option | Description | Selected |
|--------|-------------|----------|
| Keep persisted burn-rate samples in the cache | Useful only if the display math still needs them | |
| Remove sample persistence from the final phase | Final whole-window model does not depend on retained samples | ✓ |

**User's choice:** Remove sample persistence from the final phase
**Notes:** The earlier sample-based foundation was intentionally simplified away before final approval.

## Deferred Ideas

- Add a separate `ahead` healthy-state label in a future iteration if users want more nuance
- Add provider-level aggregate burn-rate summary in a future phase if the per-dimension view feels insufficient
- Move alert colors and notification behavior to time-aware logic in Phase 5 only
