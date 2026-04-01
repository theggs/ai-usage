# Phase 5: Time-Aware Alert Thresholds - Context

**Gathered:** 2026-04-02
**Status:** Ready for planning

<domain>
## Phase Boundary

Replace the remaining percentage-based warning system with time-aware severity derived from the existing Phase 4 pace signal. This phase updates severity-bearing surfaces such as row labels, service-card badges, card accents, panel summary, and tray severity. It does not add automatic notifications; that idea is deferred to backlog.

</domain>

<decisions>
## Implementation Decisions

### Severity Source of Truth
- **D-01:** Phase 5 must reuse the existing Phase 4 whole-window pace signal as the time-aware source of truth. Do not invent a second severity formula if the current pace signal is sufficient.
- **D-02:** Static row warning labels become pace labels when a valid time-aware signal exists. Example: `偏低` / `紧张` is replaced by `消耗偏快` / `消耗过快`.
- **D-03:** `On track` rows stay visually quiet. Phase 5 should not add a new healthy label where none is needed today.

### Surface Mapping
- **D-04:** The row-level warning label should display pace text directly.
- **D-05:** ETA moves out of the row body and appears only when hovering the pace label/badge.
- **D-06:** Remove the current inline pace block and secondary line from the quota row body.
- **D-07:** The service-card header badge must show the worst visible row's pace label.
- **D-08:** The top health summary and tray must follow the worst visible pace too, not separate percentage-based wording.

### Fallback Behavior
- **D-09:** When a row has no valid time-aware signal, fall back to the old static labels (`偏低` / `紧张`) instead of showing no severity label at all.
- **D-10:** The existing fallback static-percentage thresholds remain the fallback policy whenever `resetsAt` or other time-aware inputs are unusable.

### Scope Boundary
- **D-11:** Phase 5 is visual/tray severity only. Do not add automatic quota notifications in this phase.
- **D-12:** Automatic quota notifications should be captured as a backlog item for future planning.

### the agent's Discretion
- Exact hover treatment for the ETA disclosure, as long as it remains discoverable and compact.
- Exact wording for fallback English labels if current copy needs minor adjustment to fit the new badge-first presentation.
- Exact tie-breaking details when multiple rows share the same worst pace, as long as the result stays deterministic.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Milestone Scope And Requirements
- `.planning/ROADMAP.md` — Phase 5 goal, current success criteria, and backlog section
- `.planning/REQUIREMENTS.md` — `ALERT-03`, `ALERT-04`, and completed `ALERT-05` mapping
- `.planning/PROJECT.md` — milestone constraints, core value, and no-new-runtime-dependency rule
- `.planning/STATE.md` — current project position and Phase 5 blocker note

### Prior Phase Decisions
- `.planning/phases/04-burn-rate-engine/04-CONTEXT.md` — final Phase 4 pace math, risk-only UI, and degradation rules
- `.planning/phases/04-burn-rate-engine/04-02-SUMMARY.md` — final approved Phase 4 implementation outcome after the algorithm change

### Codebase Guidance
- `.planning/codebase/ARCHITECTURE.md` — frontend/backend layering and tray/service-summary flow
- `.planning/codebase/STRUCTURE.md` — where panel, summary, tray, and provider-normalization logic live
- `.planning/codebase/CONVENTIONS.md` — naming and utility patterns for summary/i18n/state code

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/lib/tauri/burnRate.ts`: Existing whole-window pace and depletion ETA helper that Phase 5 should reuse instead of replacing.
- `src/lib/tauri/summary.ts`: Current frontend source for `status`, `progressTone`, service alert level, panel health summary, and tray visual state.
- `src/components/panel/QuotaSummary.tsx`: Current quota-row render point where static severity labels and the Phase 4 pace block meet.
- `src/components/panel/ServiceCard.tsx`: Current service-card header badge and accent-strip render point.
- `src/app/shell/AppShell.tsx`: Current panel-summary wording and tone selection for the top-line health message.
- `src-tauri/src/tray/mod.rs`: Current tray severity logic that still derives from static remaining-percentage thresholds.

### Established Patterns
- Severity is currently duplicated across frontend and backend normalization paths: frontend `summary.ts`, backend `commands/mod.rs`, and provider-specific Rust modules (`kimi/mod.rs`, `glm/mod.rs`).
- The panel already sorts multiple quota windows and chooses “worst wins” in several places; Phase 5 can continue that pattern if it is made pace-aware and explicit.
- UI time-based display logic already recomputes locally while the panel is visible; hover-only ETA fits that model without adding new persistence requirements.

### Integration Points
- `src/lib/tauri/summary.ts`: likely primary entry point for replacing static row/service/tray severity with pace-aware severity plus fallback rules.
- `src/components/panel/QuotaSummary.tsx`: row badge/hover behavior and inline block removal.
- `src/components/panel/ServiceCard.tsx`: worst-row pace badge and accent mapping.
- `src/app/shell/AppShell.tsx`: top health summary should follow worst pace rather than percentage-only wording.
- `src-tauri/src/tray/mod.rs`: tray icon severity should match the same worst-pace policy.
- `src-tauri/src/commands/mod.rs`, `src-tauri/src/kimi/mod.rs`, `src-tauri/src/glm/mod.rs`: backend-generated `status` / `progress_tone` values currently use static thresholds and will need alignment or demotion.

</code_context>

<specifics>
## Specific Ideas

- The current static warning badge is considered useless once pace already exists.
- The user wants the row to become more compact again: warning label carries the pace meaning, and ETA is hidden behind hover instead of taking a full line in the panel.
- “Worst row wins” should apply consistently across row aggregation surfaces, including the service-card header, top summary, and tray.

</specifics>

<deferred>
## Deferred Ideas

- Automatic quota notifications based on pace transitions or threshold crossings — moved to backlog item `999.2`.

</deferred>

---

*Phase: 05-time-aware-alert-thresholds*
*Context gathered: 2026-04-02*
