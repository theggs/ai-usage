---
phase: quick
plan: 260401-uo3
subsystem: ui
tags: [react, vitest, panel, quota]
requires:
  - phase: 03-new-providers
    provides: provider-backed quota cards for Codex, Claude Code, Kimi Code, and GLM
provides:
  - consistent short-to-long quota ordering across provider cards
  - shared display-order helper for quota dimensions
  - regression coverage for reversed Kimi/GLM payload order
affects: [service-card, quota-ordering, quick-task-state]
tech-stack:
  added: []
  patterns:
    - normalize quota display order in shared UI utilities instead of provider-specific conditionals
key-files:
  created:
    - .planning/quick/260401-uo3-normalize-kimi-glm-quota-item-order-so-5/260401-uo3-PLAN.md
  modified:
    - src/lib/tauri/summary.ts
    - src/components/panel/ServiceCard.tsx
    - src/components/panel/ServiceCard.test.tsx
key-decisions:
  - Fix the inconsistency in the display layer so all providers share one ordering rule.
  - Preserve backend quota values and provider ordering; only reorder quota rows within a card.
patterns-established:
  - Service-card quota rows should prefer window duration ordering, with stable fallback to original order for unknown labels.
requirements-completed: []
duration: 10min
completed: 2026-04-01
---

# Quick Task 260401-uo3 Summary

**Normalized Kimi/GLM quota row order to match Codex and Claude Code**

## Accomplishments

- Added a shared `sortQuotaDimensionsForDisplay` helper so shorter quota windows render before longer ones.
- Updated `ServiceCard` to use the normalized display order instead of trusting raw backend order.
- Added a regression test proving that reversed Kimi quota data still renders as `5h` before `Weekly`.

## Verification

- `npx vitest run src/components/panel/ServiceCard.test.tsx`
- `npx vitest run src/lib/tauri/summary.test.ts src/app/panel/PanelView.test.tsx`

## Task Commit

- `pending` (`fix: normalize provider quota order`)
