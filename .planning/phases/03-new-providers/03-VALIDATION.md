---
phase: 3
slug: new-providers
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-31
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 3.x (frontend) + cargo test (Rust) |
| **Config file** | `vitest.config.ts` / `Cargo.toml` |
| **Quick run command** | `npx vitest run && cargo test` |
| **Full suite command** | `npx vitest run && cargo test` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run && cargo test`
- **After every plan wave:** Run `npx vitest run && cargo test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 03-01-01 | 01 | 1 | NPROV-01 | unit | `cargo test --lib kimi` | ❌ W0 | ⬜ pending |
| 03-01-02 | 01 | 1 | NPROV-02 | unit | `cargo test --lib glm` | ❌ W0 | ⬜ pending |
| 03-01-03 | 01 | 1 | NPROV-03 | unit | `cargo test --lib registry && npx vitest run src/lib/tauri/registry.test.ts` | ✅ partial | ⬜ pending |
| 03-02-01 | 02 | 2 | NPROV-04 | unit | `npx vitest run src/components/panel/ServiceCard.test.tsx` | ✅ | ⬜ pending |
| 03-02-02 | 02 | 2 | NPROV-05 | unit | `npx vitest run src/components/panel/ServiceCard.test.tsx` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src-tauri/src/kimi/mod.rs` tests — response parsing, credential chain, error mapping
- [ ] `src-tauri/src/glm/mod.rs` tests — response parsing, credential chain, error mapping
- [ ] `src/lib/tauri/registry.test.ts` — add assertions for new provider entries
- [ ] `src-tauri/src/registry.rs` tests — add assertions for new provider entries

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Token input in Settings UI | NPROV-01, NPROV-02 | Requires user interaction with Settings view | Open Settings → verify token input fields for Kimi and GLM appear; enter a test token; verify it persists after app restart |
| Tray summary with new providers | NPROV-04 | Requires visual tray icon inspection | Enable Kimi/GLM → verify tray tooltip shows "Kimi: XX%" format |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
