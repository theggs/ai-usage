---
phase: 05
slug: time-aware-alert-thresholds
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-02
---

# Phase 05 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest + cargo test |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npx vitest run src/lib/tauri/summary.test.ts src/components/panel/ServiceCard.test.tsx src/app/shell/AppShell.test.tsx && cargo test tray --manifest-path src-tauri/Cargo.toml` |
| **Full suite command** | `npx vitest run src/lib/tauri/summary.test.ts src/app/shared/i18n.test.ts src/components/panel/ServiceCard.test.tsx src/app/panel/PanelView.test.tsx src/app/shell/AppShell.test.tsx && cargo test tray --manifest-path src-tauri/Cargo.toml && cargo test build_tray_items --manifest-path src-tauri/Cargo.toml` |
| **Estimated runtime** | ~25 seconds |

---

## Sampling Rate

- **After every task commit:** Run that task's `<automated>` command from the map below
- **After every plan wave:** Run `npx vitest run src/lib/tauri/summary.test.ts src/app/shared/i18n.test.ts src/components/panel/ServiceCard.test.tsx src/app/panel/PanelView.test.tsx src/app/shell/AppShell.test.tsx && cargo test tray --manifest-path src-tauri/Cargo.toml && cargo test build_tray_items --manifest-path src-tauri/Cargo.toml`
- **Before `$gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 25 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 05-01-01 | 01 | 1 | ALERT-03, ALERT-04 | unit | `npx vitest run src/lib/tauri/summary.test.ts` | ✅ extend existing suite | ⬜ pending |
| 05-02-01 | 02 | 2 | ALERT-03, ALERT-04 | unit | `npx vitest run src/app/shared/i18n.test.ts src/components/panel/ServiceCard.test.tsx src/app/panel/PanelView.test.tsx src/app/shell/AppShell.test.tsx` | ✅ extend existing suites | ⬜ pending |
| 05-03-01 | 03 | 2 | ALERT-03, ALERT-04 | rust | `cargo test tray --manifest-path src-tauri/Cargo.toml && cargo test build_tray_items --manifest-path src-tauri/Cargo.toml` | ✅ extend existing Rust tests | ⬜ pending |
| 05-03-02 | 03 | 2 | ALERT-04 | unit | `npx vitest run src/lib/tauri/summary.test.ts src/app/shell/AppShell.test.tsx` | ✅ existing suites cover fallback and aggregate copy | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

None. Phase 05 can satisfy Nyquist by extending existing suites:
- `src/lib/tauri/summary.test.ts` for pace-aware severity derivation and fallback policy
- `src/app/shared/i18n.test.ts` for badge and summary copy
- `src/components/panel/ServiceCard.test.tsx` and `src/app/panel/PanelView.test.tsx` for row/card rendering regressions
- `src/app/shell/AppShell.test.tsx` for top-summary wording and tone
- `src-tauri/src/tray/mod.rs` and `src-tauri/src/commands/mod.rs` tests for tray severity and cached-tray behavior

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Pace badge disclosure stays compact and discoverable in the menubar panel | ALERT-03 | Hover behavior and visual density are hard to prove with unit tests alone | Open the panel in `zh-CN` and `en-US`, confirm risky rows show pace disclosure without restoring the old inline two-line block, and confirm ETA appears on hover |
| Aggregate surfaces agree on the same worst row | ALERT-03, ALERT-04 | Automated tests can check isolated logic, but final UI consistency across panel, header badge, and tray still benefits from human confirmation | Exercise one pace-danger row, one pace-warning row, and one fallback-warning row; verify card accent, top summary, and tray icon match the worst visible row |

*If none: "All phase behaviors have automated verification."*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 25s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
