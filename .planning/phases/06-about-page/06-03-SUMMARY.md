---
phase: 06-about-page
plan: 03
subsystem: ui
tags: [react, tauri, i18n, license-audit, about-page]
requires:
  - phase: 06-about-page
    provides: 3-view shell navigation and About route state
  - phase: 06-about-page
    provides: build-time license audit artifact with copyleft and unknown counts
provides:
  - localized About page hero with static app icon and runtime Tauri version lookup
  - build-info, license, GitHub, and dependency audit rows rendered as an extensible key-value list
  - guarded AboutView mount so hidden About content does not initialize
affects: [about-page, settings-navigation, release-metadata]
tech-stack:
  added: []
  patterns:
    - static frontend asset import for About hero media
    - About metadata split between runtime version lookup and bundled Tauri config build info
    - dependency audit summaries treat unknown licenses as explicit risk, not permissive coverage
key-files:
  created:
    - src/assets/icons/app-icon.png
    - src/app/about/AboutView.tsx
  modified:
    - src/app/shared/i18n.ts
    - src/app/shell/AppShell.tsx
key-decisions:
  - "AboutView reads productName and identifier from tauri.conf.json while getVersion() remains the runtime source for the visible version string."
  - "Dependency audit messaging distinguishes copyleft-only, unknown-only, and mixed-risk states with localized summary and badge copy."
  - "AppShell mounts AboutView only when currentView is about so metadata fetching does not run while the page is hidden."
patterns-established:
  - "About rows stay as a simple key-value list; adding future metadata requires only another row."
  - "Canonical external links are rendered and opened from the same shared constant."
requirements-completed: [ABOUT-01, ABOUT-02, ABOUT-03, ABOUT-04, ABOUT-05, ABOUT-06]
duration: 5min
completed: 2026-04-02
---

# Phase 06 Plan 03: AboutView Component Summary

**Localized About page with canonical GitHub linking, Tauri build metadata, and dependency audit risk summaries**

## Performance

- **Duration:** 5 min
- **Started:** 2026-04-02T02:48:00Z
- **Completed:** 2026-04-02T02:52:49Z
- **Tasks:** 3
- **Files modified:** 4

## Accomplishments
- Added the static frontend icon asset used by the About hero.
- Extended About i18n copy with build-info, unavailable-version, unknown-license, mixed-risk, and localized badge strings for both locales.
- Replaced the About placeholder with a real AboutView that shows runtime version, bundled build info, Apache 2.0 license, canonical GitHub URL, and dependency audit risk states.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add the About hero asset for a static frontend import** - `e34a626` (feat)
2. **Task 2: Localize About labels, summary strings, and audit-risk badges** - `1c222a3` (feat)
3. **Task 3: Implement AboutView and swap the shell placeholder for a guarded About mount** - `2dd13aa` (feat)

## Files Created/Modified
- `src/assets/icons/app-icon.png` - Stable frontend import of the app icon for the About hero.
- `src/app/about/AboutView.tsx` - Final About page component with runtime version lookup, bundled build metadata, canonical GitHub link, and audit summary rendering.
- `src/app/shared/i18n.ts` - Localized About labels, risk summaries, and badge copy for English and Simplified Chinese.
- `src/app/shell/AppShell.tsx` - Guarded AboutView mount replacing the placeholder content.

## Decisions Made
- Used `useState<string | null>(null)` plus an explicit failure state so the About hero never renders a bare `v` during async version loading.
- Rendered the exact canonical URL `https://github.com/theggs/ai-usage` in the UI and reused that same constant for `shell.open(...)`.
- Treated unknown-license coverage as audit risk and surfaced it distinctly instead of folding it into the permissive case.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 06-04 can wire the existing Settings footer to the shipped About view.
- The About page now has the final content contract needed for later visual or interaction verification.

## Self-Check: PASSED

- FOUND: `.planning/phases/06-about-page/06-03-SUMMARY.md`
- FOUND: `src/assets/icons/app-icon.png`
- FOUND: `src/app/about/AboutView.tsx`
- FOUND: task commits `e34a626`, `1c222a3`, `2dd13aa`
