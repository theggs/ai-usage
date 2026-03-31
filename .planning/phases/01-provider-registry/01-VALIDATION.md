---
phase: 1
slug: provider-registry
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-31
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 3.x (TypeScript), cargo test (Rust) |
| **Config file** | `vitest.config.ts`, `src-tauri/Cargo.toml` |
| **Quick run command** | `npx vitest run --reporter=verbose` |
| **Full suite command** | `npx vitest run && cd src-tauri && cargo test` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=verbose`
- **After every plan wave:** Run `npx vitest run && cd src-tauri && cargo test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 01-01-01 | 01 | 0 | PROV-01 | unit | `npx vitest run src/lib/tauri/registry.test.ts` | ❌ W0 | ⬜ pending |
| 01-01-02 | 01 | 0 | PROV-07 | unit | `cd src-tauri && cargo test snapshot_cache` | ❌ W0 | ⬜ pending |
| 01-01-03 | 01 | 0 | PROV-08 | unit | `npx vitest run src/lib/persistence/preferencesStore.test.ts` | ❌ W0 | ⬜ pending |
| 01-02-01 | 02 | 1 | PROV-01 | unit | `cd src-tauri && cargo test registry` | ❌ W0 | ⬜ pending |
| 01-02-02 | 02 | 1 | PROV-06 | unit | `npx vitest run src/app/shell/AppShell.test.tsx` | ✅ (update) | ⬜ pending |
| 01-02-03 | 02 | 1 | PROV-02 | unit | `npx vitest run src/app/panel/PanelView.test.tsx` | ✅ (update) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/lib/tauri/registry.test.ts` — covers PROV-01 (registry has expected IDs, getProvider works)
- [ ] `src/lib/persistence/preferencesStore.test.ts` — covers PROV-08 (normalizer with providerEnabled map)
- [ ] Rust test in `src-tauri/src/registry.rs` — covers PROV-07 (schema version discard on mismatch)
- [ ] Update `src/app/shell/AppShell.test.tsx` — covers PROV-06 (map-based state)
- [ ] Update `src/app/panel/PanelView.test.tsx` — covers PROV-02 (registry-driven rendering)

*Existing test infrastructure (Vitest + cargo test) covers the framework. Wave 0 adds test stubs for new modules.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Existing Codex display unchanged | PROV-02 | Visual regression | Launch app, verify Codex panel shows quota, progress bars, colors identical to pre-refactor |
| Existing Claude Code display unchanged | PROV-02 | Visual regression | Enable Claude Code, verify panel shows quota identical to pre-refactor |
| Preferences survive upgrade | PROV-08 | Requires real preferences.json with legacy field | Copy pre-refactor preferences.json, launch new build, verify settings preserved |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
