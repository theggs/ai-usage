# Phase 5: Time-Aware Alert Thresholds - Research

**Researched:** 2026-04-02
**Domain:** Time-aware quota health classification across panel rows, service cards, top summary, and tray severity
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
## Implementation Decisions

### Severity Source of Truth
- **D-01:** Reuse the existing Phase 4 whole-window pace signal as the time-aware source of truth. Do not invent a second severity formula if the current pace signal is sufficient.
- **D-02:** Static row warning labels become pace labels when a valid time-aware signal exists.
- **D-03:** `On track` rows stay visually quiet. Do not add a new healthy badge where none exists today.

### Surface Mapping
- **D-04:** The row-level warning label should display pace text directly.
- **D-05:** ETA moves out of the row body and appears only when hovering the pace label or badge.
- **D-06:** Remove the current inline pace block and secondary line from the quota row body.
- **D-07:** The service-card header badge must show the worst visible row's pace label.
- **D-08:** The top health summary and tray must follow the worst visible pace too.

### Fallback Behavior
- **D-09:** When a row has no valid time-aware signal, fall back to the old static labels (`偏低` / `紧张`) instead of showing no severity label.
- **D-10:** Keep the existing static percentage thresholds as fallback whenever `resetsAt` or other time-aware inputs are unusable.

### Scope Boundary
- **D-11:** Phase 5 is visual and tray severity only. Do not add automatic quota notifications in this phase.
- **D-12:** Automatic quota notifications stay deferred to backlog item `999.2`.

### the agent's Discretion
- Exact hover disclosure implementation, as long as it remains compact and discoverable.
- Exact English copy changes needed for badge-first presentation.
- Exact tie-break behavior when multiple rows share the same worst pace.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ALERT-03 | Warning thresholds are time-aware | Derive quota health from existing `getBurnRateDisplay(...)` output when valid; otherwise fall back to the static percentage thresholds |
| ALERT-04 | Missing `resetsAt` falls back to static percentage thresholds | Treat invalid, past, or out-of-window `resetsAt` exactly like missing time-aware input and use the existing percentage policy |
</phase_requirements>

ALERT-05 stays mapped to Phase 4 in `.planning/REQUIREMENTS.md`.

## Summary

Phase 5 should not create a second forecasting system. The right plan is to keep Phase 4's `getBurnRateDisplay(...)` helper as the only time-aware signal, then build one small health-classification layer above it that all user-facing severity surfaces consume.

That classification layer should answer three questions for each quota dimension:

1. Is there a valid time-aware pace signal right now?
2. If yes, what health level does that pace imply for UI severity (`normal`, `warning`, `danger`)?
3. If no, what static fallback level applies from the existing percentage thresholds?

**Primary recommendation:** create a shared frontend helper in `src/lib/tauri/summary.ts` that decorates each quota row with pace-aware severity metadata, including:
- effective level
- badge label key
- whether ETA should be exposed on hover
- whether the row contributes to service/header/panel aggregation

Then mirror the same policy in a small Rust helper for tray severity so the menu bar follows the same worst-row rule without pushing presentation copy into provider fetchers.

## Project Constraints

- Follow `AGENTS.md` and keep the work within the existing Rust + React + TypeScript stack.
- Do not add runtime dependencies.
- Preserve cross-platform behavior on macOS and Windows.
- Do not add a new storage layer.
- Do not broaden scope into automatic notification policy.

## Current Code Reality

### Existing reusable pieces
- `src/lib/tauri/burnRate.ts` already provides the only validated time-aware pace signal.
- `src/lib/tauri/summary.ts` already owns service-level aggregation and top-summary derivation.
- `src/components/panel/QuotaSummary.tsx` already renders row badges and currently hosts the inline burn-rate block that must be removed.
- `src/components/panel/ServiceCard.tsx` already renders the card header badge and accent treatment.
- `src/app/shell/AppShell.tsx` already renders the panel summary line from `getPanelHealthSummary(...)`.
- `src-tauri/src/tray/mod.rs` already computes tray severity and icon tinting, but still from lowest remaining percentage only.

### Existing duplication that Phase 5 should reduce
- `src-tauri/src/commands/mod.rs`, `src-tauri/src/kimi/mod.rs`, and `src-tauri/src/glm/mod.rs` all encode percentage-only tone/status thresholds.
- `src/lib/tauri/summary.ts` also encodes percentage-only thresholds for the frontend.
- Card/header/panel/tray surfaces all independently consume those static results today.

The plan should move the severity source of truth up to a shared classification layer instead of patching each surface separately.

## Architecture Patterns

### Pattern 1: One quota-health classifier above burn-rate
**What:** Introduce a helper that takes a quota dimension plus `nowMs` and returns a normalized health object, for example:

```ts
type QuotaHealthLevel = "normal" | "warning" | "danger";

type QuotaHealthSignal = {
  level: QuotaHealthLevel;
  source: "pace" | "fallback";
  pace?: "on-track" | "behind" | "far-behind";
  showBadge: boolean;
  etaOnHover: boolean;
};
```

**Why:** It keeps pace interpretation, static fallback, label decisions, and aggregation semantics in one place.

**Recommendation:** Put this in `src/lib/tauri/summary.ts`, next to existing panel/tray aggregation helpers. `getBurnRateDisplay(...)` stays in `burnRate.ts`; `summary.ts` decides how that signal maps to UI severity.

### Pattern 2: Worst visible row wins across aggregate surfaces
**What:** Service-card header badge, service-card accent, top summary, and tray severity should all pick the most urgent visible quota row from the same helper.

**Recommendation:** Add one selector helper that sorts candidate row health in deterministic order:
- `danger` before `warning` before `normal`
- pace-based rows before fallback rows at the same severity
- shorter window before longer window when severity ties
- original row order last, to remain deterministic

This preserves the existing "worst wins" behavior while making the policy explicit instead of incidental.

### Pattern 3: Frontend recalculates, Rust mirrors
**What:** The frontend already has a visible-window time ticker, so panel row/card/top-summary health must be recomputed locally from `nowMs`. Rust only needs the same rule for tray severity at refresh time and cached tray-state reads.

**Recommendation:** Do not move pace formatting into Rust. Keep Rust focused on:
- tray severity classification
- tray icon tint selection
- cached tray item behavior

Do not rewrite provider fetchers (`kimi/mod.rs`, `glm/mod.rs`) to own Phase 5 logic. If backend normalization needs alignment, do it in `commands/mod.rs` or tray-local helpers, not inside each provider adapter.

## Explicit Recommendation For The Open Blocker

`STATE.md` called out clock-skew handling as unresolved. The existing Phase 4 burn-rate helper already has the right fail-safe rule:
- if `resetsAt` is missing, invalid, in the past, or farther away than the inferred window length, treat the time-aware signal as unavailable
- once unavailable, fall back to the current static percentage thresholds

That should be the Phase 5 policy too. It is stricter and safer than adding a separate `>14 days` rule, and it matches the actual supported windows (`5h`, `week`, `7d`) already recognized by the code.

## Recommended Plan Split

### Plan 01: Shared health-classification engine
Build the quota-health helper layer in `summary.ts` and lock it with unit tests. This plan should:
- map pace `far-behind` -> `danger`
- map pace `behind` -> `warning`
- map pace `on-track` -> `normal`
- fall back to current static thresholds when pace is unavailable
- provide deterministic "worst visible row" selection helpers for service and panel summary use

### Plan 02: Row, card, and panel UI migration
Apply the classifier to the React surfaces. This plan should:
- replace row severity badge copy with pace label copy when `source === "pace"`
- keep old static badge copy when `source === "fallback"`
- remove the inline burn-rate block and secondary line from the row body
- expose ETA via hover affordance on the pace badge/label
- update service-card header badge and top summary wording to use the new aggregated health object

### Plan 03: Tray alignment and exhaustiveness audit
Update Rust tray severity to use the same rule and close the roadmap exhaustiveness requirement. This plan should:
- replace percentage-only `tray_severity(...)`
- keep tray summary text behavior unchanged unless a concrete UX reason emerges
- audit `SnapshotStatus` switch statements in frontend helpers to remove silent fallback risk
- add tests for pace-aware tray severity and any new exhaustive branches

## Anti-Patterns To Avoid

- **Do not create a second formula for Phase 5.** Use Phase 4 pace when valid.
- **Do not keep inline ETA text in the row body.** The user explicitly rejected the current two-line layout for this phase.
- **Do not patch only the badge text while leaving colors static.** Success criterion 1 requires "80% with 5 minutes left" to become danger, not just differently worded.
- **Do not push Phase 5 logic into provider-specific modules.** That would copy the policy into every provider adapter.
- **Do not add notification automation.** Existing notification plumbing is not the scope of this phase.
- **Do not rely on `default:` branches for `SnapshotStatus` where an exhaustive switch is possible.** Phase 5 explicitly calls out silent no-op risk.

## Common Pitfalls

### Pitfall 1: Pace label changes but bar/card colors stay static
This happens if the implementation swaps only localized copy and keeps `status` / `progressTone` untouched. Phase 5 must update the effective severity source, not only the wording.

### Pitfall 2: Healthy rows become noisy
If the new helper renders an explicit healthy badge for `on-track`, the panel will regress in density. Keep `on-track` rows visually quiet as requested.

### Pitfall 3: Fallback rows lose warning visibility
If invalid `resetsAt` returns "no label", users lose the old signal entirely. Missing time-aware input must reuse the current percentage warning labels and tones.

### Pitfall 4: Tray and panel drift
If frontend uses pace-aware aggregation but Rust tray still uses lowest remaining percentage, the menu bar will disagree with the open panel. Phase 5 needs one explicit mirrored policy.

### Pitfall 5: Hover-only ETA becomes inaccessible
If ETA is exposed only through a visual hover state with no `title`, `aria-label`, or equivalent discoverable target, keyboard and non-hover users lose the detail entirely. The implementation should keep the disclosure compact but accessible.

## Validation Architecture

Phase 5 can satisfy Nyquist by extending existing suites instead of adding new infrastructure.

### Recommended automated coverage
- `src/lib/tauri/summary.test.ts`
  - pace-to-severity mapping
  - fallback-to-static mapping when `resetsAt` is missing/invalid
  - worst-row selection for service and panel summary
  - tray visual-state severity if the TS helper still feeds selected-service tray state
- `src/app/shared/i18n.test.ts`
  - pace label copy
  - new summary wording if copy keys change
  - fallback static label localization still intact
- `src/components/panel/ServiceCard.test.tsx`
  - header badge follows worst visible row
  - danger/warning accents follow pace-aware severity
- `src/app/panel/PanelView.test.tsx`
  - inline burn-rate block removed
  - row badge retains fallback label when time-aware signal is unavailable
- `src/app/shell/AppShell.test.tsx`
  - top summary line follows worst visible pace/fallback classification
- `src-tauri/src/tray/mod.rs` tests
  - pace-aware tray severity overrides high remaining percentage when reset is imminent
  - fallback static thresholds still apply when `resets_at` is unavailable or invalid

### Recommended manual verification
- Open the panel in `zh-CN` and `en-US`.
- Confirm a row with pace data shows a compact pace badge/label and no inline ETA line.
- Confirm hovering the pace disclosure reveals ETA detail.
- Confirm a fallback row still shows the old warning label.
- Confirm the top summary text, card accent, and tray icon all agree on the worst visible row.

## Planning Notes

- The existing `getBurnRateDisplay(...)` helper already resolves the clock-skew question well enough for planning.
- The phase likely needs 3 plans across 2 waves:
  - Wave 1: shared classification engine
  - Wave 2: UI migration + tray/exhaustiveness alignment in parallel
- `ALERT-03` must appear in the shared-classifier plan.
- `ALERT-04` must appear in the shared-classifier plan and the tray-alignment plan.
- Do not claim ALERT-05 in Phase 05 plan frontmatter because the three-bucket pace model is an upstream Phase 4 contract and D-03 keeps healthy rows visually quiet.
