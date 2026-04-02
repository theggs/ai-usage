---
phase: 06-about-page
plan: 02
subsystem: infra
tags: [licenses, npm, cargo, build, compliance]
requires: []
provides:
  - Deterministic build-time license audit coverage for npm and Rust dependencies
  - Generated JSON artifact with audited counts, copyleft totals, and unknown-license visibility
  - Build hooks that refresh the audit before web, Tauri, and E2E bundle flows
affects: [about-page, build, compliance]
tech-stack:
  added: []
  patterns:
    - Lockfile-driven npm auditing with exact install-path resolution
    - Local Cargo manifest resolution from registry, git checkout, and workspace sources
    - Fail-closed build metadata generation when an ecosystem resolves zero licenses
key-files:
  created:
    - scripts/audit-licenses.js
    - src/generated/license-audit.json
  modified:
    - package.json
key-decisions:
  - "Use package-lock.json packages entries as the npm source of truth and fall back to installed package manifests only when the lock entry omits a license."
  - "Resolve Rust licenses from local Cargo manifests instead of network lookups, and surface unresolved or license-file-only crates as unknown."
patterns-established:
  - "Build-time audit artifacts should be regenerated from lockfile-backed metadata before any distributable build path."
  - "Unknown dependency licenses are reported explicitly rather than treated as permissive."
requirements-completed: [ABOUT-05]
duration: 3min
completed: 2026-04-02
---

# Phase 06 Plan 02: Build-Time License Audit Summary

**Unified npm and Rust dependency audit with real local license metadata, copyleft totals, and unknown-license coverage in a generated JSON artifact**

## Performance

- **Duration:** 3 min
- **Started:** 2026-04-02T02:43:00Z
- **Completed:** 2026-04-02T02:46:02Z
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments
- Replaced the heuristic audit script with deterministic npm and Rust license resolution from local lockfile-backed metadata.
- Added fail-closed coverage guards plus explicit unknown-license counting so the About page cannot ship a misleading green audit.
- Wired `build:audit` into every bundle-oriented build script and regenerated the bundled JSON summary with both ecosystem counts.

## Task Commits

Each task was committed atomically:

1. **Task 1: Rebuild the license audit script around explicit npm and Rust metadata sources** - `ee386c7` (fix)
2. **Task 2: Run the audit in every build entry point that can bundle the app** - `0acd87f` (chore)
3. **Task 3: Generate and validate the new audit artifact with visible unknown-license coverage** - `d7f5ad8` (chore)

## Files Created/Modified
- `scripts/audit-licenses.js` - Audits npm packages from `package-lock.json` and Rust crates from local Cargo manifests, then writes a summary artifact.
- `package.json` - Ensures `build:audit` runs before `build`, `tauri:build`, and `test:e2e:build`.
- `src/generated/license-audit.json` - Bundled audit output with total package counts, audited counts, copyleft totals, and unknown-license coverage.

## Decisions Made
- Used the exact `package-lock.json` install path as the npm lookup key so nested packages resolve correctly without flattening.
- Supported both `src-tauri/Cargo.lock` and the workspace root `Cargo.lock`, because this repo currently stores the lockfile at the root.
- Counted packages without a declared SPDX license, including `license-file`-only Rust crates, as unknown instead of permissive.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added root Cargo.lock fallback for the Rust audit**
- **Found during:** Task 1 (Rebuild the license audit script around explicit npm and Rust metadata sources)
- **Issue:** The plan referenced `src-tauri/Cargo.lock`, but this workspace keeps the active lockfile at the repository root.
- **Fix:** Resolved Cargo lockfile discovery across both expected locations before auditing local crate manifests.
- **Files modified:** scripts/audit-licenses.js
- **Verification:** `node scripts/audit-licenses.js` produced `rustPackageCount: 559` and `rustAuditedCount: 556`
- **Committed in:** `ee386c7` (part of task commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** The deviation aligned the audit with the actual repo layout and kept the build-time coverage goal intact without expanding scope.

## Issues Encountered
- The first Cargo parser pass matched a leading newline before `name = ...` and skipped all Rust packages; this was corrected before the Task 1 commit and verified by rerunning the audit.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- The About page can now import a generated audit artifact that includes `npmAuditedCount`, `rustAuditedCount`, `copyleftCount`, and `unknownLicenseCount`.
- No blockers remain for consuming the audit summary in the UI.

## Self-Check

PASSED

- FOUND: `.planning/phases/06-about-page/06-02-SUMMARY.md`
- FOUND: `ee386c7`
- FOUND: `0acd87f`
- FOUND: `d7f5ad8`

---
*Phase: 06-about-page*
*Completed: 2026-04-02*
