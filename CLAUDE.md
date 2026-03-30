# ai-usage
Read @AGENTS.md for full development guidelines, project structure, commands, architecture decisions, and feature history.

## Active Technologies
- Rust stable (edition 2021), TypeScript 5.x, Node.js 24 LTS + Tauri 2, React 19, Tailwind CSS 4
- Rust crates: `serde`, `serde_json` (existing); `ureq` + `chrono` + `sha2` (005-claude-code-support)
- Storage: local preferences JSON; macOS Keychain (read-only, via `security` CLI); `~/.claude/.credentials.json` (read-only)
- Outbound HTTP: `ureq` with auto-detected system proxy (`scutil --proxy` fallback for GUI apps)

## Recent Changes
- 005-claude-code-support: Claude Code quota display via OAuth API; menubar service selection; panel display order; system proxy support for outbound API calls
- 007-session-recovery: Remodel 401 as transient session-recovery state; preserve stale cache; auto-recover via existing refresh interval

<!-- GSD:project-start source:PROJECT.md -->
## Project

**ai-usage v2: Provider Architecture & Smart Alerts**

A macOS/Windows menubar desktop app that tracks AI coding assistant usage quotas in real time. Currently supports Codex and Claude Code. This milestone restructures the app around a unified Provider abstraction, adds Kimi Code and GLM Coding Plan support, introduces time-aware smart alerts and burn rate forecasting, and adds an About page with license/version info.

**Core Value:** Users always know whether their AI coding quota will last until reset — across all their active providers — without opening the app.

### Constraints

- **Tech stack**: Rust + Tauri 2 + React 19 + Tailwind CSS 4 — no new runtime dependencies
- **Cross-platform**: Must work on macOS and Windows (no macOS-only APIs in new code)
- **Backward compatible**: Existing Codex + Claude Code users must not lose functionality during migration
- **Incremental delivery**: Each feature should be independently shippable and usable
- **No new storage layer**: Continue using existing preferences.json + snapshot-cache.json
<!-- GSD:project-end -->

<!-- GSD:stack-start source:codebase/STACK.md -->
## Technology Stack

## Languages
- Rust (edition 2021) - Backend/Tauri core, CLI integrations, system-level operations
- TypeScript 5.x - React frontend, UI logic, type-safe client interface
- JavaScript (Node.js 24) - Build tooling, test configuration, scripts
- Shell script (.sh/.cmd) - E2E testing automation, test fixtures
## Runtime
- Node.js 24 LTS (via nvm, see `.nvmrc`)
- Rust stable (edition 2021)
- Tauri 2.0.0 (provides runtime bridge between Rust and TypeScript)
- npm (Node.js packages)
- Cargo (Rust crates)
- Lockfiles: `package-lock.json` (npm), `Cargo.lock` (Rust)
## Frameworks
- Tauri 2.0.0 - Cross-platform desktop shell (Rust + TypeScript)
- React 19.x - UI component framework
- Tailwind CSS 4.x - Utility-first CSS styling with Vite integration (`@tailwindcss/vite`)
- Vitest 3.x - Unit/integration tests (TypeScript, runs in jsdom)
- React Testing Library 16.x - Component testing utilities
- Playwright 1.54.x - E2E browser automation tests
- Jest DOM matchers (via `@testing-library/jest-dom`)
- Vite 6.x - Frontend build tool and dev server
- TypeScript 5.8+ - Type checking (strict mode)
- Tauri CLI 2.0.0 - Desktop app bundler and dev runner
## Key Dependencies
- `@tauri-apps/api` 2.0.0 - Tauri command invocation bridge (core IPC)
- `tauri` 2.0.0 - Backend app framework
- `@vitejs/plugin-react` 4.4.1 - JSX support for Vite
- `@tailwindcss/postcss` 4.2.2 - CSS processing pipeline
- `serde` 1.0 + `serde_json` 1.0 - JSON serialization (Rust state sync)
- `ureq` 2.x - HTTP client (OAuth API calls, system proxy support)
- `chrono` 0.4 - Date/time handling (reset hints, activity timestamps)
- `rusqlite` 0.32 (with bundled feature) - Read-only SQLite access for Codex/Claude metadata
- `sha2` 0.10 - Hashing (keychain service name derivation)
- `png` 0.17 - PNG image handling (tray icon generation)
- `tauri-plugin-notification` 2.0.0 - Native notifications
- `tauri-plugin-autostart` 2.0.0 - Launch-on-startup support (macOS LaunchAgent)
- `jsdom` 26.x - DOM simulation for unit tests
- `@testing-library/user-event` 14.x - User interaction simulation
- `@types/*` - TypeScript definitions for React, Node.js, testing libraries
## Configuration
- `.nvmrc` - Node.js version pinning (24)
- `Cargo.toml` - Rust workspace with `src-tauri` member
- `package.json` - Node.js scripts, dependencies, engine constraints
- Environment variables (no `.env` file in repo; see INTEGRATIONS.md for credential sources)
- `vite.config.ts` - Vite configuration with React plugin, test environment (jsdom)
- `vitest.config.ts` - Vitest setup with globals, jsdom, setupFiles
- `tsconfig.json` - References to `tsconfig.app.json` and `tsconfig.node.json`
- `tsconfig.app.json` - App compilation: ES2021 target, strict mode, React JSX
- `tsconfig.node.json` - Build script types
- `playwright.config.ts` - E2E test configuration (testDir: `tests/e2e`, parallel, list reporter)
- `tauri.conf.json` - Tauri app manifest (built by `tauri build`)
- `src-tauri/Cargo.toml` - Rust backend dependencies and build settings
## Platform Requirements
- Rust toolchain (stable, edition 2021)
- Node.js 24 (via nvm or system)
- Xcode Command Line Tools (macOS) or Visual Studio Build Tools (Windows)
- Native build tools (make, gcc/clang for C dependencies like SQLite)
- macOS (native binary) - Primary deployment target
- Windows support (via Rust + Tauri)
- Linux support (not explicitly tested; no config present)
- `scutil --proxy` for system proxy detection (Tauri GUI apps don't inherit shell env vars)
- macOS Keychain via `security` CLI (read-only Claude Code credentials)
- `NSApplicationActivationPolicy::Accessory` (menu-bar-only mode, Cmd+Tab hiding)
- `.codex` and `.claude` home directories (activity metadata, local cache)
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

## Naming Patterns
- TypeScript/React: PascalCase for component files (`ServiceCard.tsx`, `AppShell.tsx`), camelCase for utility files (`summary.ts`, `i18n.ts`)
- Rust: snake_case for module files (`claude_code/mod.rs`, `snapshot.rs`, `codex/mod.rs`)
- Test files: Same name as source file with `.test.ts`, `.test.tsx`, or `.spec.ts` suffix
- TypeScript/React: camelCase (`formatTraySummary`, `getVisibleServiceScope`, `localizeBadgeLabel`)
- Rust: snake_case (`start_e2e_control_loop`, `statusToConnectionState`, `now_unix`)
- Component functions: Exported as const arrows: `export const ServiceCard = ({...}) => {...}`
- Prefix with descriptive verbs: `get*`, `format*`, `resolve*`, `derive*`, `localize*`, `seed*`, `apply*`
- camelCase in TypeScript (`remainingPercent`, `shouldShowBadge`, `serviceId`)
- snake_case in Rust (`pause_state`, `rate_limit_cooldown_secs`, `UNIX_EPOCH`)
- Constants: UPPER_SNAKE_CASE in Rust (`RATE_LIMIT_COOLDOWN_SECS`, `AUTO_SCAN_INTERVAL_SECS`), camelCase or UPPER_CASE in TypeScript based on usage
- Booleans prefixed with `is*`, `have*`, `should*`: `isFresh()`, `hasVisibleClaudeCode`, `shouldShowBadge`
- PascalCase: `SnapshotStatus`, `ServiceSnapshot`, `CopyTree`, `PromotionDisplayDecision`, `UserPreferences`, `QuotaDimension`
- Type files: match domain (`contracts.ts` for Tauri contracts, `types.ts` for feature types)
- Discriminated unions use `kind` tag for serialization: `#[serde(tag = "kind")]`
## Code Style
- No explicit formatter configured; follow TypeScript strict mode and Rust edition 2021 conventions
- Line length guidance: ~80 characters for readability, but not enforced
- Indentation: 2 spaces (TypeScript), standard Rust (4 spaces)
- TypeScript: Strict mode enabled (`"strict": true` in tsconfig.app.json)
- Type checking: Explicit `noEmit` in build pipeline
- No ESLint or Prettier config found; relies on IDE defaults and manual review
- Rust: Standard clippy conventions
## Import Organization
- None configured; all imports use relative paths (`../../lib/tauri/...`)
## Error Handling
- TypeScript: Explicit return type annotations; null/undefined returned for missing values
- Example from `src/lib/tauri/summary.ts`:
- Discriminated unions via `kind` tag for state management (e.g., `SnapshotStatus`)
- No throw statements in data transformation functions; return early with fallback values
- Rust: Pattern matching on enums, explicit error types (`ApiError`, `ProxyResolutionError`)
- Example from `src-tauri/src/snapshot.rs`:
## Logging
- No centralized logging library; console output used for development
- Rust: Use descriptive comments and doc comments (`///`) for public APIs
- TypeScript: Comments only when logic is non-obvious; prefer clear function names
## Comments
- Algorithm explanation (e.g., threshold-based sorting, time zone formatting)
- Non-obvious state machine logic (e.g., pause states in `claude_code/mod.rs`)
- Module-level documentation for public APIs
- Not consistently used; function names are self-documenting
- Type annotations preferred over comments
- Example of clear naming: `getVisibleServiceScope`, `decorateQuotaDimension`, `getPanelHealthSummary`
## Function Design
- Prefer small, composable functions (50-150 lines typical)
- Example: `summary.ts` has 20+ utility functions, each with single responsibility
- Use object parameters for functions with 2+ params (destructured in signature)
- Example from `ServiceCard.tsx`:
- Explicit return types on all functions
- Discriminated unions for state (`kind` field in Rust enums)
- Null/undefined for missing values (not exceptions)
## Module Design
- Named exports preferred over default exports
- Example: `export const formatTraySummary = (...)` in `summary.ts`
- Re-export shared types at module boundaries
- Not used; imports use direct file paths
- Each module file explicitly lists its dependencies
- Each React component: single file with one export
- Props type defined inline with component using destructuring
- Example: `ServiceCard.tsx` defines component props inline
## Styling (CSS)
- Inline Tailwind classes, no CSS files for component styling
- Example from `ServiceCard.tsx`:
- Color system: emerald (success), amber (warning), rose (danger), slate (neutral)
- Responsive: Not heavily used in current codebase (compact fixed-size UI)
- No inline styles except dynamic values
## State Management
- React hooks + TypeScript for frontend state
- Tauri commands for backend state sync
- Local storage for persistence (`localStorage.setItem`, `localStorage.getItem`)
- Immutable updates: spread operator (`{...state, field: newValue}`)
- Discriminated unions for UI states
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

## Pattern Overview
- Strict separation between presentation (React components) and business logic (Rust backend)
- State management via React Context for UI state; Rust Mutex-based AppState for backend state
- Data normalization and validation at boundaries (preferencesStore, snapshot contracts)
- Service-oriented polling with dedup guards to prevent concurrent refresh requests
- Tagged union (discriminated union) patterns for exhaustive status handling
## Layers
- Purpose: Render UI, manage user interactions, display cached/live data
- Location: `src/app/` (views), `src/components/` (reusable UI)
- Contains: React components (PanelView, SettingsView, ServiceCard), icons (inline SVG)
- Depends on: tauriClient for IPC, appState context, i18n for localization
- Used by: React app root (main.tsx)
- Purpose: Handle state mutations, validation, preferences persistence, service orchestration
- Location: `src/features/` (feature modules), `src/lib/tauri/` (IPC contracts), `src/lib/persistence/` (local storage)
- Contains: Controllers (panelController, preferencesController, notificationController), data normalization (summary utilities, preference normalization), promotion resolution logic
- Depends on: tauriClient, localStorage (for preferences/accounts fallback), local contracts
- Used by: Views and components via useAppState() hook
- Purpose: Define shared types and Tauri IPC method signatures
- Location: `src/lib/tauri/contracts.ts` (frontend), `src-tauri/src/state/mod.rs` (Rust equivalent)
- Contains: Type aliases (SnapshotStatus, CodexPanelState, UserPreferences), interface definitions for panel state, quota dimensions, notification results
- Depends on: serde (Rust side) for serialization
- Used by: All frontend/backend code
- Purpose: Expose Tauri IPC endpoints that the frontend invokes
- Location: `src-tauri/src/commands/mod.rs`
- Contains: `get_codex_panel_state`, `refresh_codex_panel_state`, `get_claude_code_panel_state`, `refresh_claude_code_panel_state`, preference/account mutations, test notification dispatch
- Depends on: codex module (Codex CLI interface), claude_code module (OAuth/snapshot logic), snapshot cache, state management
- Used by: Tauri app (invoked via IPC from frontend)
- Purpose: Interface with external CLIs and APIs
- Location: `src-tauri/src/codex/` (Codex CLI), `src-tauri/src/claude_code/` (Claude Code OAuth), `src-tauri/src/notifications/` (notification dispatch)
- Contains: JSON-RPC handling (for Codex), OAuth credential management (for Claude Code), CLI process spawning, HTTP requests via ureq
- Depends on: serde_json, ureq, environment detection (proxy, home directory)
- Used by: commands layer
- Purpose: Hold shared mutable state for preferences, accounts, auto-menubar selection
- Location: `src-tauri/src/state/mod.rs`
- Contains: AppState (Mutex-wrapped preferences, codex_accounts), AutoMenubarSelectionState, type definitions for all contracts
- Depends on: serde for persistence
- Used by: commands, tray, agent_activity, and background threads
- Purpose: Load/save preferences and accounts to JSON files
- Location: `src-tauri/src/codex/mod.rs` (preferences_path, load_preferences, save_preferences), snapshot cache in commands/mod.rs
- Contains: preferences.json (user settings), codex-accounts.json (account credentials), snapshot-cache.json (recent panel state for fast restarts)
- Depends on: filesystem I/O, serde_json
- Used by: commands layer, AppState initialization, auto-menubar loop
- Purpose: Manage tray icon, popover window positioning, menubar mode state
- Location: `src-tauri/src/tray/mod.rs`
- Contains: Tray icon generation (dynamic coloring for Claude Code), popover placement logic (considering screen bounds, last successful position, safe defaults), menubar service selection display
- Depends on: Tauri tray/window APIs, png encoding, AppHandle for window management
- Used by: Tauri app setup, commands (tray updates after refresh)
- Purpose: Auto-detect active service for "auto" menubar mode
- Location: `src-tauri/src/agent_activity/mod.rs`, started in `src-tauri/src/lib.rs`
- Contains: Activity snapshot collectors (SQLite reads from Codex, file mtimes), confidence scoring, auto-menubar selection resolver
- Depends on: rusqlite (read-only Codex metadata), filesystem access
- Used by: Background thread (15-second scan interval), auto-menubar decision in tray module
- Purpose: Exhaustive tagged union representing all possible service fetch states
- Location: `src-tauri/src/snapshot.rs`
- Contains: Fresh, CliNotFound, NotLoggedIn, NoCredentials, SessionRecovery, RateLimited, AccessDenied, ProxyInvalid, TemporarilyUnavailable, NoData, Disabled
- Depends on: serde (tagged enum serialization)
- Used by: codex module, claude_code module, commands layer to construct CodexPanelState
## Data Flow
## Key Abstractions
- Purpose: Complete view of quota and connection state for a single service (Codex or Claude Code)
- Examples: `src-tauri/src/state/mod.rs` (struct definition), `src/lib/tauri/contracts.ts` (TypeScript type)
- Pattern: Contains DesktopSurfaceState (tray context), items (quota dimensions), status (SnapshotStatus), activeSession (for rate limit retry logic)
- Purpose: Exhaustive representation of all fetch outcomes; forces frontend to handle every case
- Examples: `src-tauri/src/snapshot.rs` (Rust enum), `src/lib/tauri/contracts.ts` (TypeScript type)
- Pattern: Discriminated union with `kind` field; optional fields for context (RateLimited.retry_after_minutes, TemporarilyUnavailable.detail)
- Purpose: All user-configurable settings with normalization rules
- Examples: `src/features/preferences/defaultPreferences.ts`, `src/lib/persistence/preferencesStore.ts` (normalizePreferences function)
- Pattern: Immutable; mutations always via normalizePreferences which validates language, traySummaryMode, proxy URL format, service order
- Purpose: Individual quota card displayed in panel (represents one service's dimension)
- Examples: `src/components/panel/ServiceCard.tsx` (rendered), `src/lib/tauri/summary.ts` (computed properties like progressTone)
- Pattern: Contains label, remaining%, reset hint, statusLabel (demo/refreshing/action-needed), badge text
- Purpose: Metadata about active service for auto-menubar mode (SQLite reads, file mtimes, confidence)
- Examples: `src-tauri/src/state/mod.rs` (struct), `src-tauri/src/agent_activity/mod.rs` (collected via Codex/Claude file reads)
- Pattern: Includes signal source (CLI, files, env vars), confidence level, eligibility for auto mode
## Entry Points
- Location: `src/main.tsx`
- Triggers: Browser load (or Tauri webview initialization)
- Responsibilities: React root render, AppShell component mount
- Location: `src/app/shell/AppShell.tsx`
- Triggers: React mount, window focus events
- Responsibilities: Initial state load (preferences + panel state), auto-refresh interval setup, view switching (panel ↔ settings), error handling, context provider setup
- Location: `src-tauri/src/lib.rs` (run function, line 76)
- Triggers: Tauri desktop app initialization
- Responsibilities: Menu bar mode setup (NSApplicationActivationPolicy on macOS), AppState initialization, tray setup, background loop startup (auto-menubar, E2E control), window event handlers (close/blur → hide, not quit)
- Location: `src-tauri/src/commands/mod.rs` and subsequent modules
- Triggers: Frontend invoke() calls
- Responsibilities: Dispatch to codex/claude_code modules, snapshot cache management, preference/account persistence, response serialization
- Location: `src-tauri/src/lib.rs` (start_auto_menubar_loop, line 52)
- Triggers: App setup, runs continuously
- Responsibilities: 15-second activity collection, auto-selection resolution, tray icon update
## Error Handling
- SessionRecovery (HTTP 401): Auto-retry on next interval refresh
- TemporarilyUnavailable: Preserve stale cache, auto-retry
- RateLimited: Hold status, suppress auto-refresh for retry_after_minutes
- CliNotFound: Codex binary not found; offer setup link
- NotLoggedIn: No Codex session; direct user to login
- NoCredentials: Claude Code OAuth missing; direct to settings
- AccessDenied (HTTP 403): Check proxy or credentials in settings
- ProxyInvalid: Validate proxy URL format in settings
- AppShell.error state holds error message from last failed operation
- SettingsView displays error in header during preference mutations
- PanelView shows SnapshotStatus-specific messages via i18n (getSnapshotMessage)
- panelController: pendingRefresh promise variable (line 5, panelController.ts) ensures only one Codex refresh in flight
- claude_code module: Similar guard for Claude Code refreshes
- Settings mutations: setIsRefreshing flag gates concurrent mutations
## Cross-Cutting Concerns
- Codex: Spawns CLI which handles authentication (user runs `codex login` separately)
- Claude Code: OAuth credentials stored in macOS Keychain (or hex-encoded fallback in ~/.claude/.credentials.json); read-only access via security CLI
- Frontend: networkProxyMode and networkProxyUrl stored in preferences; validated as valid URL with http/https/socks5 protocol
- Backend: ureq automatically detects system proxy env vars; falls back to `scutil --proxy` on macOS (critical for GUI apps that don't inherit shell env)
<!-- GSD:architecture-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd:quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd:debug` for investigation and bug fixing
- `/gsd:execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->

<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd:profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
