# Phase 5: Time-Aware Alert Thresholds - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-02
**Phase:** 05-time-aware-alert-thresholds
**Areas discussed:** severity source of truth, ETA placement, aggregation policy, fallback behavior, phase scope

---

## Severity Source of Truth

| Option | Description | Selected |
|--------|-------------|----------|
| Keep static severity labels | Preserve `偏低` / `紧张` even when time-aware pace exists | |
| Replace severity labels with pace labels | Use the Phase 4 pace wording directly on the warning label | ✓ |

**User's choice:** Replace severity labels with pace labels
**Notes:** User explicitly called the current static warning label useless now that a time-aware pace signal already exists.

---

## ETA Placement

| Option | Description | Selected |
|--------|-------------|----------|
| Keep ETA inline in the row body | Preserve the current Phase 4 risk-only second line | |
| Show ETA only on hover of the pace label | Make the row compact again and hide detail until needed | ✓ |

**User's choice:** Show ETA only on hover of the pace label
**Notes:** User also asked to remove the current inline pace block and secondary line from the panel body.

---

## Service-Card Aggregation

| Option | Description | Selected |
|--------|-------------|----------|
| Keep generic service warning labels | Card header stays percentage-oriented or generic | |
| Show the worst row's pace label | Card header reflects the most urgent visible quota row | ✓ |

**User's choice:** Show the worst row's pace label
**Notes:** This locks service-card header aggregation around the same pace semantics as the row.

---

## Fallback Behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Fall back to old static labels | Use `偏低` / `紧张` when the time-aware signal is unavailable | ✓ |
| Show no label without time-aware data | Avoid mixed semantics but lose warning visibility | |

**User's choice:** Fall back to the old static labels
**Notes:** User wants the app to remain informative even when `resetsAt` or other time-aware inputs are unusable.

---

## Summary And Tray Aggregation

| Option | Description | Selected |
|--------|-------------|----------|
| Keep percentage-based summary/tray wording | Only row and card badge adopt pace wording | |
| Follow the worst visible pace too | Top summary and tray align with the same worst-row pace semantics | ✓ |

**User's choice:** Follow the worst visible pace too
**Notes:** This keeps all user-facing severity surfaces aligned instead of mixing pace wording with percentage wording.

---

## Notification Scope

| Option | Description | Selected |
|--------|-------------|----------|
| Visual/tray severity only | Restrict Phase 5 to UI/tray severity changes | ✓ |
| Include automatic notifications | Add a new alert-trigger policy in the same phase | |

**User's choice:** Visual/tray severity only
**Notes:** User asked to add automatic notifications to backlog instead of including them in Phase 5.

## the agent's Discretion

- Exact hover interaction implementation for the ETA disclosure
- Exact deterministic tie-break rules when multiple rows share the same worst pace

## Deferred Ideas

- Automatic quota notifications — added to backlog for future planning
