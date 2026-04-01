---
phase: 04
slug: burn-rate-engine
status: completed
nyquist_compliant: true
wave_0_complete: true
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
| **Quick run command** | `npx vitest run src/lib/tauri/summary.test.ts src/app/shared/i18n.test.ts src/components/panel/ServiceCard.test.tsx src/app/panel/PanelView.test.tsx` |
| **Full suite command** | `npx vitest run src/lib/tauri/summary.test.ts src/app/shared/i18n.test.ts src/components/panel/ServiceCard.test.tsx src/app/panel/PanelView.test.tsx src/app/shell/AppShell.test.tsx && cargo test snapshot_cache --manifest-path src-tauri/Cargo.toml` |
| **Estimated runtime** | ~20 seconds |

---

## Sampling Rate

- **After every task commit:** Run that task's `<automated>` command from the map below
- **After every plan wave:** Run `npx vitest run src/lib/tauri/summary.test.ts src/app/shared/i18n.test.ts src/components/panel/ServiceCard.test.tsx src/app/panel/PanelView.test.tsx src/app/shell/AppShell.test.tsx && cargo test snapshot_cache --manifest-path src-tauri/Cargo.toml`
- **Before `$gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 20 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 04-01-01 | 01 | 1 | ALERT-01 | rust | `cargo test snapshot_cache --manifest-path src-tauri/Cargo.toml` | ✅ extend existing Rust tests | ✅ green |
| 04-01-02 | 01 | 1 | ALERT-01 | unit | `npx vitest run src/lib/tauri/summary.test.ts` | ✅ update existing suite | ✅ green |
| 04-02-01 | 02 | 2 | ALERT-02 | unit | `npx vitest run src/app/shared/i18n.test.ts` | ✅ update existing suite | ✅ green |
| 04-02-02 | 02 | 2 | ALERT-01, ALERT-02 | component | `npx vitest run src/components/panel/ServiceCard.test.tsx src/app/panel/PanelView.test.tsx` | ✅ update existing suites | ✅ green |
| 04-02-03 | 02 | 2 | ALERT-01, ALERT-02 | checkpoint | `npx vitest run src/app/shared/i18n.test.ts src/components/panel/ServiceCard.test.tsx src/app/panel/PanelView.test.tsx` | ✅ same suites before human verify | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

None. Phase 04 satisfies Nyquist by extending existing suites already named in the plans:
- `src/lib/tauri/summary.test.ts` covers burn-rate math and graceful degradation for Task `04-01-02`
- `src/app/shared/i18n.test.ts` covers compact copy and ETA formatting for Task `04-02-01`
- `src/components/panel/ServiceCard.test.tsx` and `src/app/panel/PanelView.test.tsx` cover visible and hidden burn-rate rendering for Tasks `04-02-02` and `04-02-03`
- `cargo test snapshot_cache --manifest-path src-tauri/Cargo.toml` covers additive cache-history persistence for Task `04-01-01`

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Risk-only burn-rate rows remain readable in the menubar panel at normal width | ALERT-01, ALERT-02 | Final layout fit and hierarchy are hard to prove with unit tests alone | Open the panel with providers that have multiple quota dimensions in both `zh-CN` and `en-US`; verify the risky rows fit without awkward wrapping or pushing `Last refreshed` out of view |
| Burn-rate output stays hidden for healthy rows and for invalid/missing reset metadata | ALERT-01, ALERT-02 | Needs end-to-end confirmation that the final “silent when not needed” behavior looks intentional | Exercise healthy and malformed timestamp cases; confirm the quota row shows existing percent/reset content only, with no placeholder or broken burn-rate copy |

### Manual Result

- User approved the final UI on `2026-04-02`
- Final approved behavior:
  - risky rows show pace + ETA/reset line
  - healthy rows stay silent
  - layout fits the normal menubar width in the reviewed examples

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 20s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved on 2026-04-02
