# Requirements: ai-usage v2

**Defined:** 2026-03-31
**Core Value:** Users always know whether their AI coding quota will last until reset — across all their active providers — without opening the app.

## v1 Requirements

Requirements for this milestone. Each maps to roadmap phases.

### Provider Architecture

- [x] **PROV-01**: All provider metadata (id, display name, fetch strategies, dashboard URL) is defined in a single ProviderDescriptor registry — no hardcoded service ID lists elsewhere
- [x] **PROV-02**: Adding a new provider requires only a new ProviderDescriptor entry and a fetch implementation — no changes to UI framework, preferences normalization, or snapshot cache logic
- [x] **PROV-03**: Existing Codex provider is migrated to the ProviderDescriptor registry with identical behavior
- [x] **PROV-04**: Existing Claude Code provider is migrated to the ProviderDescriptor registry with identical behavior
- [x] **PROV-05**: Each provider's credential resolution uses an ordered fallback chain within a single fetch method (e.g., Claude Code: env var → keychain → credentials file). The ProviderFetcher trait is designed as an extension point for future multi-pipeline support (multiple independent quota-fetching strategies per provider), but current implementations use a single pipeline each
- [x] **PROV-06**: Frontend state manages providers via a dynamic map (not per-service variables), supporting N providers without code changes
- [x] **PROV-07**: Snapshot cache includes a schema version field; incompatible cache is discarded gracefully on upgrade
- [x] **PROV-08**: Preferences normalization handles dynamic provider enable/disable flags from the registry — both Rust and TypeScript normalizers stay in sync

### New Providers

- [ ] **NPROV-01**: Kimi Code provider displays quota/usage data in the panel (pending API research confirmation)
- [ ] **NPROV-02**: GLM Coding Plan provider displays quota/usage data in the panel (pending API research confirmation)
- [x] **NPROV-03**: New providers appear in the service order configuration and can be reordered
- [x] **NPROV-04**: New providers use the same SnapshotStatus enum and visual treatment as existing providers
- [x] **NPROV-05**: If a provider's API is unreachable or undocumented, the UI shows a clear "not available" state (not a blank panel)

### Smart Alerts

- [ ] **ALERT-01**: Burn rate is calculated from `remainingPercent` + `resetsAt` + snapshot timestamp, showing consumption pace relative to window progress
- [ ] **ALERT-02**: Depletion ETA is displayed in human-readable form (e.g., "runs out in ~3h" or "will last until reset")
- [ ] **ALERT-03**: Warning thresholds are time-aware — "80% remaining with 4h left" is healthy; "10% remaining with 4h left" is danger
- [ ] **ALERT-04**: When `resetsAt` is unavailable, warning falls back to existing static percentage thresholds (>50% / 20-50% / <20%)
- [ ] **ALERT-05**: Pace classification uses at least 3 levels (on track / behind / far behind) visible in the UI

### About Page

- [ ] **ABOUT-01**: Independent About page accessible from the app (not a Settings tab)
- [ ] **ABOUT-02**: Displays app version and build info (from Tauri package metadata)
- [ ] **ABOUT-03**: Displays GitHub repository URL as a clickable link
- [ ] **ABOUT-04**: Displays open-source license of the app itself
- [ ] **ABOUT-05**: Displays dependency license summary with copyleft/viral license audit results (generated at build time)
- [ ] **ABOUT-06**: Layout is extensible for future fields (website, author email, etc.) via key-value list pattern

## v2 Requirements

Deferred to future milestones. Tracked but not in current roadmap.

### Enhanced Monitoring

- **MON-01**: Statuspage.io integration for provider incident badges
- **MON-02**: Quota usage history with sparkline visualization
- **MON-03**: Cost / token billing tracking per provider

### Platform Extensions

- **PLAT-01**: Bundled CLI tool for querying quota from terminal/scripts
- **PLAT-02**: macOS WidgetKit desktop widget support
- **PLAT-03**: Custom icon rendering per provider with animation

### Multi-Strategy Fetch Pipeline

- **PIPE-01**: Each provider supports multiple independent quota-fetching strategies (e.g., OAuth API → web scraping → local probe), ordered by reliability; first success stops the chain, failure auto-falls to next strategy (ref: codexbar ProviderFetchPlan pattern)
- **PIPE-02**: UI displays which fetch strategy is currently active for each provider (e.g., "via API" / "via page scrape")
- **PIPE-03**: Settings page allows enabling/disabling individual fetch strategies per provider, and configuring strategy-specific parameters

### UX Polish

- **UX-01**: Suppress panel refresh while user is reading (read-guard)
- **UX-02**: Cloud preference sync across devices

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Browser cookie-based auth | Privacy-hostile; macOS-only; fragile |
| Cost/token billing tracking | Most providers don't expose billing APIs |
| WidgetKit / desktop widgets | Tauri 2 doesn't support natively |
| Statuspage.io monitoring | Adds third-party dependency; defer |
| Custom animated icons per provider | High complexity, marginal benefit |
| CLI tool | Separate release artifact; no validated demand |
| Cloud preference sync | Requires auth + remote storage; no demand |
| Real-time chat/notification push | Not a collaboration tool |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| PROV-01 | Phase 1 | Complete |
| PROV-02 | Phase 1 | Complete |
| PROV-06 | Phase 1 | Complete |
| PROV-07 | Phase 1 | Complete |
| PROV-08 | Phase 1 | Complete |
| PROV-03 | Phase 2 | Complete |
| PROV-04 | Phase 2 | Complete |
| PROV-05 | Phase 2 | Complete |
| NPROV-01 | Phase 3 | Pending |
| NPROV-02 | Phase 3 | Pending |
| NPROV-03 | Phase 3 | Complete |
| NPROV-04 | Phase 3 | Complete |
| NPROV-05 | Phase 3 | Complete |
| ALERT-01 | Phase 4 | Pending |
| ALERT-02 | Phase 4 | Pending |
| ALERT-03 | Phase 5 | Pending |
| ALERT-04 | Phase 5 | Pending |
| ALERT-05 | Phase 5 | Pending |
| ABOUT-01 | Phase 6 | Pending |
| ABOUT-02 | Phase 6 | Pending |
| ABOUT-03 | Phase 6 | Pending |
| ABOUT-04 | Phase 6 | Pending |
| ABOUT-05 | Phase 6 | Pending |
| ABOUT-06 | Phase 6 | Pending |

**Coverage:**
- v1 requirements: 24 total
- Mapped to phases: 24
- Unmapped: 0

---
*Requirements defined: 2026-03-31*
*Last updated: 2026-03-31 after roadmap creation*
