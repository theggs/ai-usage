# ai-usage v2: Provider Architecture & Smart Alerts

## What This Is

A macOS/Windows menubar desktop app that tracks AI coding assistant usage quotas in real time. Currently supports Codex and Claude Code. This milestone restructures the app around a unified Provider abstraction, adds Kimi Code and GLM Coding Plan support, introduces time-aware smart alerts and burn rate forecasting, and adds an About page with license/version info.

## Core Value

Users always know whether their AI coding quota will last until reset — across all their active providers — without opening the app.

## Requirements

### Validated

- ✓ Codex CLI quota tracking (5h/weekly windows) — existing
- ✓ Claude Code OAuth quota tracking — existing
- ✓ Multi-service menubar display with configurable order — existing
- ✓ Chinese/English localization — existing
- ✓ Menubar service selection (manual + auto) — existing
- ✓ Session recovery on 401 with stale cache — existing
- ✓ System proxy auto-detection for outbound HTTP — existing
- ✓ Desktop notifications on quota thresholds — existing
- ✓ Autostart support — existing
- ✓ Snapshot cache for fast app restart — existing

### Active

- [ ] Provider Descriptor Registry — unified abstraction for all providers
- [ ] Multi-Strategy Fetch Pipeline — ordered fallback chain per provider
- [ ] Refactor Codex + Claude Code into the new Provider abstraction
- [ ] Kimi Code provider integration
- [ ] GLM Coding Plan provider integration
- [ ] Time-aware warning thresholds — alerts relative to reset time, not absolute percentage
- [ ] Burn rate / pace forecasting — consumption rate classification with depletion ETA
- [ ] About page — license info (with dependency license audit), version, GitHub URL
- [ ] About page extensible for future fields (website, author email)

### Out of Scope

- Cost/token tracking — requires per-provider billing API, not all providers expose this
- WidgetKit / desktop widgets — Tauri 2 doesn't support natively, high complexity
- CLI tool — nice to have but not in this milestone
- Statuspage.io incident monitoring — defer to future milestone
- Custom icon rendering per provider — defer, standard icons sufficient
- Browser cookie-based auth — privacy concern, not aligned with project values

## Context

- Existing codebase: Rust (Tauri 2) + React 19 + TypeScript + Tailwind CSS 4
- Codex integration: JSON-RPC via `codex app-server` subprocess
- Claude Code integration: OAuth API with keychain/env/file credential sources
- Competitive reference: CodexBar (Swift, 25 providers) — see `.planning/research/codexbar-analysis.md`
- Kimi Code and GLM Coding Plan are Chinese AI coding assistants; their usage API details need research during planning
- Current warning logic: hard-coded thresholds (>50% green, 20-50% amber, <20% red) in `src/lib/tauri/summary.ts`
- Dependency licenses need audit — Rust crates + npm packages; must check for copyleft/viral licenses

## Constraints

- **Tech stack**: Rust + Tauri 2 + React 19 + Tailwind CSS 4 — no new runtime dependencies
- **Cross-platform**: Must work on macOS and Windows (no macOS-only APIs in new code)
- **Backward compatible**: Existing Codex + Claude Code users must not lose functionality during migration
- **Incremental delivery**: Each feature should be independently shippable and usable
- **No new storage layer**: Continue using existing preferences.json + snapshot-cache.json

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Provider Registry as Rust trait + TypeScript interface | Unified abstraction enables new providers without new modules | — Pending |
| Time-aware thresholds replace absolute thresholds | "80% remaining with 4h left" is fine; "10% remaining with 4h left" is not | — Pending |
| Separate About page (not Settings tab) | Keeps Settings focused on configuration; About is reference info | — Pending |
| Kimi Code + GLM Coding Plan as first new providers | Chinese AI coding market is underserved by existing tools | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd:transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-03-31 after initialization*
