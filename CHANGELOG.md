# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/), and this project adheres to [Semantic Versioning](https://semver.org/).

[简体中文版](CHANGELOG.zh-CN.md)

## [Unreleased]

## [v1.1.1] - 2026-04-23

### Fixed

- Reduced menu bar panel white-screen delays by rendering the shell before provider loads complete
- Reduced manual refresh stalls by rebuilding tray state from cached snapshots after single-provider refreshes
- Added a Codex usage toggle in Settings and unified provider usage copy across settings surfaces

## [v1.1.0] - 2026-04-02

### Added

- **Provider architecture** — Unified ProviderDescriptor registry in Rust and TypeScript with dynamic provider map
- **Fetch pipeline** — ProviderFetcher trait with generic IPC commands, replacing per-service command wiring
- **New providers** — Kimi Code and GLM Coding Plan support
- **Burn-rate forecasting** — Pace-based projection engine with sample history persistence; panel rows show burn-rate warnings only when risky
- **Smart severity alerts** — Quota health classifier combining remaining percentage and burn rate; tray icon color reflects most urgent provider
- **About page** — App version, build metadata, license audit display, navigation from settings footer, and external browser handoff for links
- **Multi-strategy extension point** — ProviderFetcher pipeline supports multiple fetch strategies per provider

### Changed

- Migrated all views and state to dynamic provider map (registry-driven)
- Provider-aware i18n copy and placeholder routing
- Redesigned service order settings with drag affordances
- Panel summary aligned with pace health severity
- Codex promotion ended; promotion line hides automatically when no active promotions

### Fixed

- Windows: popover placement no longer gated to macOS-only; USERPROFILE fallback for storage path
- Promotion popover badges wrap correctly below service name
- Reset countdown formatting moved to UI layer
- Claude promotion policy states refreshed correctly
- Provider quota order normalized
- About footer copy and license localization tightened
- Interactive ETA tooltip now includes usage disclosure

## [v1.0.0] - 2026-03-31

### Added

- **Desktop shell** — Tauri 2 + React 19 desktop app with menubar-only mode (no dock icon)
- **Codex quota tracking** — Live usage limits panel via Codex CLI (`codex app-server` + `account/rateLimits/read`)
- **Claude Code quota tracking** — OAuth API integration with system proxy support; credentials read from macOS Keychain or `~/.claude/.credentials.json`
- **Menubar agent** — macOS menu-bar-only mode with `NSApplicationActivationPolicy::Accessory`; compact popover panel
- **Menubar UI overhaul** — Progress bars with threshold-based coloring, i18n (English / 中文), popover lifecycle management
- **Auto menubar service** — Detects active coding assistant via SQLite metadata and file activity; auto-highlights in menubar
- **Session recovery** — HTTP 401 treated as transient; stale cache preserved; auto-retry on next refresh
- **Snapshot cache** — Disk-persisted panel state for fast restart; tagged union `SnapshotStatus` for exhaustive state handling
- **Promotion system** — Capsule badges and detail popover for service promotions
- **Claude Code query disclosure** — Opt-in control with privacy notice; disabled by default
- **Settings** — Configurable refresh interval, panel order, language, autostart, proxy (auto-detect via `scutil --proxy`), per-service toggles
- **CI/CD** — GitHub Actions for desktop build (PR validation) and release (tag-triggered + nightly)

### Fixed

- Windows: hidden console window on launch (#2)
- Cross-platform Codex CLI snapshot tests
- Auto-refresh correctly wired to `refresh_interval_minutes`
- Promotion test timezone safety
- Claude Code shared-state test serialization

[Unreleased]: https://github.com/anthropics/ai-usage/compare/v1.1.1...HEAD
[v1.1.1]: https://github.com/anthropics/ai-usage/compare/v1.1.0...v1.1.1
[v1.1.0]: https://github.com/anthropics/ai-usage/compare/nightly-c6a486b...v1.1.0
[v1.0.0]: https://github.com/anthropics/ai-usage/releases/tag/v1.0.0
