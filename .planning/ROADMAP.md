# Roadmap: ai-usage v2 — Provider Architecture & Smart Alerts

## Overview

This milestone transforms a two-provider hardcoded app into an extensible N-provider platform. The work proceeds in dependency order: first establish a unified ProviderDescriptor registry (the critical path enabler), then generalize the fetch pipeline and migrate existing providers, then add Kimi Code and GLM Coding Plan, then layer on burn rate forecasting and time-aware alert thresholds, then ship the About page. Each phase delivers a coherent, independently verifiable capability.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Provider Registry** - Establish single ProviderDescriptor registry replacing five hardcoded service-ID lists
- [ ] **Phase 2: Fetch Pipeline & Migration** - Generalize credential fetch pipeline; migrate Codex and Claude Code into it
- [ ] **Phase 3: New Providers** - Add Kimi Code and GLM Coding Plan via the validated registry and pipeline
- [x] **Phase 4: Burn Rate Engine** - Pure frontend burn rate calculation with depletion ETA display
- [x] **Phase 5: Time-Aware Alert Thresholds** - Replace static percentage thresholds with time-relative quota health classification
- [ ] **Phase 6: About Page** - Standalone About page with version, license, and dependency audit info

## Phase Details

### Phase 1: Provider Registry
**Goal**: A single ProviderDescriptor registry is the sole source of truth for all provider IDs, display names, and configuration — existing users see no change in behavior
**Depends on**: Nothing (first phase)
**Requirements**: PROV-01, PROV-02, PROV-06, PROV-07, PROV-08
**Success Criteria** (what must be TRUE):
  1. All provider IDs, display names, and dashboard URLs are defined in one registry; no other file contains a hardcoded service-ID list
  2. Frontend provider state is managed via a dynamic map (not per-service variables); adding a new entry to the registry requires no UI framework changes
  3. Preferences enable/disable flags use a generic `providerEnabled: Record<string, boolean>` map; both Rust and TypeScript normalizers handle it consistently
  4. Snapshot cache includes a `schema_version` field; loading an incompatible cache discards it gracefully without crashing
  5. Existing Codex and Claude Code quota display is unchanged for current users after the registry refactor ships
**Plans:** 3 plans
Plans:
- [x] 01-01-PLAN.md — Registry definitions + snapshot cache versioning + preferences migration
- [x] 01-02-PLAN.md — Frontend big-bang state migration to dynamic provider map
- [x] 01-03-PLAN.md — Fix Claude Code toggle to use providerEnabled (gap closure)

### Phase 2: Fetch Pipeline & Migration
**Goal**: A unified ProviderFetcher trait dispatches per-provider fetch logic; existing Codex and Claude Code integrations are migrated into it with verified behavioral parity; the trait is designed as an extension point for future multi-pipeline strategies
**Depends on**: Phase 1
**Requirements**: PROV-03, PROV-04, PROV-05
**Success Criteria** (what must be TRUE):
  1. Codex quota data fetches successfully via the new pipeline using the same credential and CLI strategy as before (no regression for existing users)
  2. Claude Code quota data fetches successfully via the new pipeline, including all three credential sources (env var, keychain, file) in priority order within its single fetch method
  3. Proxy auto-detection works on both macOS and Windows for all outbound API calls through the pipeline
  4. The ProviderFetcher trait is structured so adding a second independent fetch strategy (e.g., web scraping) for any provider requires only a new trait impl and pipeline config — no changes to IPC, snapshot cache, or frontend
**Plans:** 2 plans
Plans:
- [x] 02-01-PLAN.md — ProviderFetcher trait + Codex and Claude Code implementations
- [x] 02-02-PLAN.md — Generic IPC commands + frontend migration + tray generalization

### Phase 3: New Providers
**Goal**: Kimi Code and GLM Coding Plan appear in the panel and can be reordered alongside existing providers; providers with unconfirmed APIs show a clear "not available" state rather than a blank panel
**Depends on**: Phase 2
**Requirements**: NPROV-01, NPROV-02, NPROV-03, NPROV-04, NPROV-05
**Success Criteria** (what must be TRUE):
  1. Kimi Code quota or usage data is displayed in the panel (or a clear "not available" state if API is unconfirmed) — never a blank panel
  2. GLM Coding Plan quota or usage data is displayed in the panel (or a clear "not available" state if API is unconfirmed) — never a blank panel
  3. Both new providers appear in the service order settings and can be dragged to any position
  4. New providers use the same SnapshotStatus visual treatment (colors, progress bars, error states) as Codex and Claude Code
**Plans:** 4 plans
Plans:
- [x] 03-01-PLAN.md — Infrastructure, contracts, and UI (registry, shared proxy, preferences, pipeline stubs, i18n, Settings)
- [x] 03-02-PLAN.md — Kimi Code and GLM Coding Plan provider HTTP fetch implementations
- [x] 03-03-PLAN.md — Fix provider-specific i18n messages and capsule spacing (gap closure)
- [x] 03-04-PLAN.md — Fix capsule overflow and token-change auto-refresh (gap closure)

### Phase 4: Burn Rate Engine
**Goal**: The app calculates and displays how fast each provider's quota is being consumed relative to the reset window, including a human-readable depletion ETA
**Depends on**: Phase 2
**Requirements**: ALERT-01, ALERT-02
**Success Criteria** (what must be TRUE):
  1. Each provider panel shows a pace classification (e.g., "on track", "behind", "far behind") derived from consumption rate vs. window progress
  2. When quota is projected to run out before the reset, the panel shows a human-readable ETA (e.g., "runs out in ~3h")
  3. When quota is projected to last until reset, the panel shows a positive confirmation (e.g., "will last until reset")
  4. On first launch or when historical data is insufficient, the burn rate display degrades gracefully (no NaN, no crash, no misleading value)
**Plans**: 2 plans
**UI hint**: yes
Plans:
- [x] 04-01-PLAN.md — Initial burn-rate helper foundation (later simplified during execution)
- [x] 04-02-PLAN.md — Add localized quota-row burn-rate UI plus manual readability verification

### Phase 5: Time-Aware Alert Thresholds
**Goal**: Warning colors and notification triggers reflect actual quota health relative to the time remaining in the reset window — not just an absolute percentage
**Depends on**: Phase 4
**Requirements**: ALERT-03, ALERT-04
**Success Criteria** (what must be TRUE):
  1. A provider at 80% remaining with 5 minutes until reset shows as danger (not green), because the quota cannot realistically last
  2. A provider at 20% remaining with 6 hours until reset shows a healthy or moderate state when burn rate supports it
  3. When `resetsAt` is unavailable, the app falls back to the existing static percentage thresholds (>50% green, 20-50% amber, <20% red) with no visible error
  4. All SnapshotStatus switch statements are exhaustive — no unhandled variant causes a silent no-op or UI blank
Traceability note: ALERT-05 remains a Phase 4 burn-rate UI contract; Phase 5 reuses that classifier while keeping healthy rows visually quiet per D-03.
**Plans**: 4 plans
**UI hint**: yes
Plans:
- [x] 05-01-PLAN.md — Shared quota-health classifier and deterministic aggregate selection
- [x] 05-02-PLAN.md — Panel, card, and summary UI migration to pace-aware labels
- [x] 05-03-PLAN.md — Tray alignment and SnapshotStatus exhaustiveness audit
- [x] 05-04-PLAN.md — Reconcile Phase 05 requirement bookkeeping with the approved risk-only UI

### Phase 6: About Page
**Goal**: The app has a standalone About page showing version, GitHub link, app license, and a dependency license audit summary generated at build time
**Depends on**: Phase 1
**Requirements**: ABOUT-01, ABOUT-02, ABOUT-03, ABOUT-04, ABOUT-05, ABOUT-06
**Success Criteria** (what must be TRUE):
  1. About page is accessible from the app as an independent page (not a tab inside Settings)
  2. The app version number shown on the About page matches the actual binary version from Tauri package metadata
  3. The GitHub repository URL is displayed as a clickable link that opens in the default browser
  4. The app's open-source license text (or SPDX identifier) is displayed
  5. A dependency license summary is displayed, with any copyleft/viral licenses explicitly flagged; the list is generated at build time (not hard-coded)
  6. The About page layout uses a key-value list pattern that accommodates new fields (website, author email) without structural changes
**Plans:** 4 plans
**UI hint**: yes
Plans:
- [x] 06-01-PLAN.md — Infrastructure: Extend view system from 2 views to 3 views (panel/settings/about)
- [x] 06-02-PLAN.md — Build-time License Audit: Create audit script for Rust/npm dependencies with copyleft detection
- [ ] 06-03-PLAN.md — AboutView Component: Create About page UI with hero, key-value list, version, GitHub link
- [ ] 06-04-PLAN.md — Settings Footer: Add "About AIUsage >" footer link in SettingsView

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4 -> 5 -> 6
Note: Phase 3 is gated by Kimi Code and GLM Coding Plan API research. Phases 4 and 6 can begin as soon as Phase 2 is complete — they do not depend on Phase 3.

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Provider Registry | 3/3 | Complete | - |
| 2. Fetch Pipeline & Migration | 2/2 | Complete | - |
| 3. New Providers | 4/4 | Complete | 2026-04-01 |
| 4. Burn Rate Engine | 2/2 | Complete | 2026-04-02 |
| 5. Time-Aware Alert Thresholds | 4/4 | Complete | 2026-04-02 |
| 6. About Page | 1/4 | In Progress | - |

## Backlog

### Phase 999.1: 用抽象模块管理优惠信息，取代现在的硬编码 (BACKLOG)

**Goal:** [Captured for future planning]
**Requirements:** TBD
**Plans:** 0 plans

Plans:
- [ ] TBD (promote with $gsd-review-backlog when ready)

### Phase 999.2: automatic quota notifications (BACKLOG)

**Goal:** [Captured for future planning]
**Requirements:** TBD
**Plans:** 0 plans

Plans:
- [ ] TBD (promote with $gsd-review-backlog when ready)
