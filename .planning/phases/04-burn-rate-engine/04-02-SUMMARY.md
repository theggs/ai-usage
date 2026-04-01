---
phase: 04-burn-rate-engine
plan: 02
subsystem: ui
tags: [typescript, react, tauri, burn-rate, panel, i18n]

# Dependency graph
requires:
  - phase: 04-burn-rate-engine
    plan: 01
    provides: Base burn-rate helper and quota-row integration points
provides:
  - Compact localized burn-rate copy in the panel
  - Risk-only quota-row burn-rate rendering
  - Unified whole-window pace math for `5h` and weekly windows
  - Phase close-out and manual UI approval
affects: [phase-05]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Whole-window pace and ETA derived from current remaining percentage plus inferred reset window
    - Healthy rows stay visually quiet; only risky rows render pace copy
    - No persisted burn-rate sample history in the final phase outcome

key-files:
  created: []
  modified:
    - src/app/shared/i18n.ts
    - src/components/panel/QuotaSummary.tsx
    - src/features/demo-services/demoData.ts
    - src/lib/tauri/burnRate.ts
    - src/lib/tauri/summary.ts
    - src/lib/tauri/contracts.ts
    - src-tauri/src/commands/mod.rs

key-decisions:
  - "5h and weekly windows use the same whole-window pace algorithm"
  - "Hide pace when remainingPercent is 10% or lower"
  - "Keep burn-rate UI only on risky rows; healthy rows show no extra burn-rate text"
  - "Remove sample-history persistence once the final model no longer depends on it"

requirements-completed: [ALERT-01, ALERT-02]

# Metrics
completed: 2026-04-02
---

# Phase 04 Plan 02 Summary

**Burn-rate UI shipped with whole-window math, risk-only rendering, and manual panel approval**

## Outcome

- Added compact localized pace/ETA helpers and wired them into `QuotaSummary`
- Iterated the layout from a full two-line treatment on every row to the approved risk-only version
- Replaced the intermediate sample-based burn-rate model with one whole-window algorithm shared by `5h` and weekly rows
- Removed unused burn-rate sample transport/cache plumbing once the final model no longer required it

## User-Driven Changes During Execution

- The initial two-line treatment made cards too tall for the panel
- The compact one-line variant still read poorly in `zh-CN`
- User prioritized keeping two providers visible by default, so the final UI only shows burn-rate details for risky rows
- Weekly sample-based pace looked mathematically unstable in practice; after review and CodexBar research, user chose one simpler algorithm for all windows instead
- User explicitly chose the simplest model for now: whole-window pace and ETA, no sample-driven display logic, and hide pace when `remainingPercent <= 10`

## Final Behavior

- `Behind` / `Far behind` rows render:
  - a compact pace line
  - a secondary line with `Runs out in ~...` on the left and the reset hint on the right
- `On track` rows render no extra burn-rate block
- Rows with missing/invalid `resetsAt`, unsupported labels, or `remainingPercent <= 10` stay silent
- `5h` and weekly windows use the same pace math

## Commits

Implementation evolved through these commits:

1. `20bc091` — burn-rate localization helpers
2. `c724fc7` — initial panel rendering
3. `d7b239d` — compact one-line variant
4. `dee0ed2` — risk-only disclosure layout
5. `07f881d` — weekly stabilization attempt
6. `0d3d2fb` — final whole-window pace math and sample-history removal

The earlier sample-history foundation from `04-01` was intentionally superseded before final sign-off.

## Verification

- Automated:
  - `npx vitest run src/lib/tauri/summary.test.ts src/app/shared/i18n.test.ts src/components/panel/ServiceCard.test.tsx src/app/panel/PanelView.test.tsx src/app/shell/AppShell.test.tsx`
  - `cargo test snapshot_cache --manifest-path src-tauri/Cargo.toml`
- Result:
  - `80` Vitest tests passed
  - Rust snapshot-cache suite passed
- Manual:
  - User approved the final panel UI on `2026-04-02`

## Next Phase Readiness

- Phase 05 can now build time-aware color thresholds on top of a stable, explainable pace signal
- No sample-retention policy is carried forward as a hidden dependency

---
*Phase: 04-burn-rate-engine*
*Completed: 2026-04-02*
