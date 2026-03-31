---
phase: 02
slug: fetch-pipeline-migration
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-31
---

# Phase 02 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 3.x (TypeScript), cargo test (Rust) |
| **Config file** | `vitest.config.ts`, `src-tauri/Cargo.toml` |
| **Quick run command** | `npx vitest run && cargo test --manifest-path src-tauri/Cargo.toml` |
| **Full suite command** | `npx vitest run && cargo test --manifest-path src-tauri/Cargo.toml` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run && cargo test --manifest-path src-tauri/Cargo.toml`
- **After every plan wave:** Run full suite
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 02-01-01 | 01 | 1 | PROV-05 | unit | `cargo test --manifest-path src-tauri/Cargo.toml` | ✅ | ⬜ pending |
| 02-01-02 | 01 | 1 | PROV-03 | unit | `cargo test --manifest-path src-tauri/Cargo.toml` | ✅ | ⬜ pending |
| 02-01-03 | 01 | 1 | PROV-04 | unit | `cargo test --manifest-path src-tauri/Cargo.toml` | ✅ | ⬜ pending |
| 02-02-01 | 02 | 2 | PROV-03,04 | unit | `cargo test --manifest-path src-tauri/Cargo.toml` | ✅ | ⬜ pending |
| 02-02-02 | 02 | 2 | PROV-03,04 | integration | `npx vitest run` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements. Both Vitest and cargo test are configured and passing.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Proxy auto-detection (macOS) | PROV-05 | Requires system proxy config | Set system proxy via Network preferences, verify API calls route through proxy |
| Proxy auto-detection (Windows) | PROV-05 | Requires Windows system proxy | Set system proxy via Internet Options, verify API calls route through proxy |
| Keychain credential read | PROV-04 | Requires actual keychain entry | Verify Claude Code credentials read from macOS Keychain |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
