---
phase: 04
slug: burn-rate-engine
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-01
---

# Phase 04 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest + cargo test |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npx vitest run src/lib/tauri/summary.test.ts src/app/shared/i18n.test.ts src/components/panel/ServiceCard.test.tsx` |
| **Full suite command** | `npx vitest run src/lib/tauri/summary.test.ts src/app/shared/i18n.test.ts src/components/panel/ServiceCard.test.tsx src/app/panel/PanelView.test.tsx src/app/shell/AppShell.test.tsx && cargo test snapshot_cache --manifest-path src-tauri/Cargo.toml` |
| **Estimated runtime** | ~20 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run src/lib/tauri/summary.test.ts src/app/shared/i18n.test.ts src/components/panel/ServiceCard.test.tsx`
- **After every plan wave:** Run `npx vitest run src/lib/tauri/summary.test.ts src/app/shared/i18n.test.ts src/components/panel/ServiceCard.test.tsx src/app/panel/PanelView.test.tsx src/app/shell/AppShell.test.tsx && cargo test snapshot_cache --manifest-path src-tauri/Cargo.toml`
- **Before `$gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 20 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 04-01-01 | 01 | 1 | ALERT-01 | unit | `npx vitest run src/lib/tauri/summary.test.ts` | ✅ | ⬜ pending |
| 04-01-02 | 01 | 1 | ALERT-01 | rust | `cargo test snapshot_cache --manifest-path src-tauri/Cargo.toml` | ✅ | ⬜ pending |
| 04-01-03 | 01 | 2 | ALERT-02 | component | `npx vitest run src/components/panel/ServiceCard.test.tsx src/app/shared/i18n.test.ts src/app/panel/PanelView.test.tsx` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Compact per-dimension pace label and second-line ETA remain readable in the menubar panel at normal width | ALERT-01, ALERT-02 | Visual density and localization fit are hard to prove with unit tests alone | Open the panel with providers that have multiple quota dimensions in both `zh-CN` and `en-US`; verify the new lines do not wrap awkwardly, overlap progress bars, or push the last refreshed line out of view |
| Burn-rate output stays hidden when history is insufficient, `resetsAt` is missing, or `resetsAt` is invalid | ALERT-01, ALERT-02 | Needs end-to-end confirmation that degraded states look intentionally quiet, not broken | Exercise first-launch and malformed timestamp fixtures; confirm the quota row shows existing percent/reset content only, with no placeholder or broken burn-rate copy |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 20s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
