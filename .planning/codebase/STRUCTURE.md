# Codebase Structure

**Analysis Date:** 2026-03-31

## Directory Layout

```
ai-usage/
├── src/                           # React frontend (TypeScript)
│   ├── main.tsx                   # React root entry point
│   ├── app/                       # Application views and state
│   │   ├── shell/                 # AppShell (root view, state orchestration)
│   │   ├── panel/                 # Panel view (quota display)
│   │   ├── settings/              # Settings view (preferences UI)
│   │   └── shared/                # Shared state context (appState.ts), i18n
│   ├── components/                # Reusable UI components
│   │   ├── panel/                 # ServiceCard, QuotaSummary, PromotionStatusLine
│   │   └── settings/              # PreferenceField, form components
│   ├── features/                  # Feature modules (self-contained business logic)
│   │   ├── demo-services/         # Panel state loading/refreshing (controllers)
│   │   ├── preferences/           # Preference loading/persistence (controllers)
│   │   ├── notifications/         # Test notification dispatch
│   │   └── promotions/            # Promotion display logic (resolver, catalog)
│   ├── lib/                       # Utilities and cross-cutting logic
│   │   ├── tauri/                 # Tauri IPC client, contracts, summary utilities
│   │   └── persistence/           # Local storage (preferencesStore, codexAccountStore)
│   ├── styles/                    # CSS (globals.css with Tailwind @source)
│   ├── assets/                    # Static assets (icons, icons/services)
│   └── test/                      # Test setup and utilities
├── src-tauri/                     # Rust backend (Tauri 2)
│   ├── src/
│   │   ├── main.rs                # Tauri app entry point
│   │   ├── lib.rs                 # App initialization, window lifecycle, background loops
│   │   ├── snapshot.rs            # SnapshotStatus enum (exhaustive tagged union)
│   │   ├── commands/              # Tauri command handlers (IPC endpoints)
│   │   │   └── mod.rs             # get/refresh_codex/claude_code_panel_state, preferences, accounts
│   │   ├── state/                 # Shared mutable state (AppState, UserPreferences, types)
│   │   │   └── mod.rs             # Mutex-wrapped preferences, codex_accounts, auto-menubar state
│   │   ├── codex/                 # Codex CLI integration
│   │   │   └── mod.rs             # JSON-RPC CLI communication, snapshot loading
│   │   ├── claude_code/           # Claude Code OAuth integration
│   │   │   └── mod.rs             # OAuth credential reading, API calls via ureq
│   │   ├── tray/                  # Tray icon and popover window management
│   │   │   └── mod.rs             # Icon generation, popover placement, menubar display modes
│   │   ├── agent_activity/        # Auto-menubar service detection
│   │   │   └── mod.rs             # Activity snapshot collection (SQLite, file mtimes)
│   │   ├── notifications/         # System notification dispatch
│   │   │   └── mod.rs             # Tauri notification plugin calls
│   │   └── autostart/             # Autostart/login-item management
│   │       └── mod.rs             # Platform-specific autostart setup
│   ├── tauri.conf.json            # Tauri app config (window, permissions, plugins)
│   └── Cargo.toml                 # Rust dependencies
├── tests/                         # Integration and contract tests
│   ├── contract/                  # Contract tests (verify Tauri command outputs)
│   └── e2e/                       # End-to-end tests (Playwright)
├── vite.config.ts                 # Vite bundler config
├── tsconfig.app.json              # TypeScript config (frontend)
├── vitest.config.ts               # Vitest test runner config
├── package.json                   # Node dependencies and scripts
├── CLAUDE.md                      # Project guidelines (active technologies, decisions)
├── AGENTS.md                      # Development guidelines (structure, commands, history)
└── .planning/codebase/            # This directory: GSD codebase analysis docs
```

## Directory Purposes

**`src/app/`:**
- Purpose: View layer (Shell, Panel, Settings) and shared app state
- Contains: React component hierarchies, AppStateContext provider, i18n localization
- Key files: `AppShell.tsx` (root, orchestration), `PanelView.tsx` (quota display), `SettingsView.tsx` (preferences form), `appState.ts` (context definition), `i18n.ts` (localization strings)

**`src/components/`:**
- Purpose: Reusable presentational components and composed UI pieces
- Contains: Stateless or lightly-stateful React components; no business logic
- Key files: `ServiceCard.tsx` (renders individual quota card), `QuotaSummary.tsx` (summary stats), `PromotionStatusLine.tsx` (promotion display), `PreferenceField.tsx` (form field wrapper)

**`src/features/`:**
- Purpose: Self-contained feature modules with domain logic, data fetching, state mutations
- Contains: Controllers (panelController, preferencesController), feature-specific utilities (promotions resolver/catalog), API dispatch logic
- Key files: `demo-services/panelController.ts` (load/refresh panel state), `preferences/preferencesController.ts` (preference mutations), `promotions/resolver.ts` (promotion decision logic)

**`src/lib/tauri/`:**
- Purpose: Tauri IPC client, contract definitions, summary computation
- Contains: Type definitions (contracts.ts), tauriClient abstraction (invoke wrapper), summary utilities (quota status, panel health, tray text formatting)
- Key files: `contracts.ts` (SnapshotStatus, CodexPanelState, UserPreferences types), `client.ts` (tauriClient object, mock implementations for demo), `summary.ts` (formatting and state derivation)

**`src/lib/persistence/`:**
- Purpose: Local storage abstraction for preferences and accounts
- Contains: localStorage access, normalization, validation
- Key files: `preferencesStore.ts` (normalizePreferences, load/save), `codexAccountStore.ts` (Codex account management in localStorage)

**`src-tauri/src/commands/`:**
- Purpose: Tauri IPC command handlers
- Contains: Endpoint implementations for panel state fetching/refreshing, preference mutations, snapshot cache management
- Key files: `mod.rs` (all command handlers; ~1000 lines; handles dedup, cache, state mutations)

**`src-tauri/src/state/`:**
- Purpose: Shared mutable state and type definitions
- Contains: AppState (Mutex-wrapped), contract type definitions, enums (SnapshotStatus, ActivitySignalSource, AutoMenubarMode)
- Key files: `mod.rs` (AppState, UserPreferences, all type structs)

**`src-tauri/src/codex/`:**
- Purpose: Codex CLI integration
- Contains: JSON-RPC communication with Codex CLI, snapshot fetching, preference/account file I/O
- Key files: `mod.rs` (load_snapshot, load_accounts, load_preferences, save_preferences, save_accounts; ~1000 lines)

**`src-tauri/src/claude_code/`:**
- Purpose: Claude Code OAuth and API integration
- Contains: Credential reading (Keychain, fallback to ~/.claude/.credentials.json), OAuth token refresh, quota API calls via ureq
- Key files: `mod.rs` (load_snapshot, clear_access_pause)

**`src-tauri/src/tray/`:**
- Purpose: Tray icon and popover window management
- Contains: Dynamic icon generation, popover placement calculation (respecting screen bounds, last position, safe defaults), menubar display mode logic
- Key files: `mod.rs` (initialize_tray, toggle_main_window, apply_display_mode; ~1500 lines)

**`src-tauri/src/agent_activity/`:**
- Purpose: Auto-detect active service for "auto" menubar mode
- Contains: Activity snapshot collection (Codex SQLite reads, Claude file mtimes), confidence scoring, auto-selection resolver
- Key files: `mod.rs` (collect_service_activity_snapshots, resolve_auto_menubar_selection)

## Key File Locations

**Entry Points:**
- `src/main.tsx`: React app root, calls ReactDOM.createRoot on AppShell
- `src-tauri/src/main.rs`: Tauri app entry point (calls lib.rs::run())
- `src-tauri/src/lib.rs`: Tauri initialization, window lifecycle, background loop startup

**Configuration:**
- `package.json`: Node.js scripts (npm run dev, npm test, npm run tauri:dev)
- `src-tauri/tauri.conf.json`: Tauri permissions (fs, http, notification, plugin configs)
- `tsconfig.app.json`: TypeScript strict mode, path aliases
- `vitest.config.ts`: Test runner, coverage, setup file

**Core Logic:**
- `src/app/shell/AppShell.tsx`: Root component, state orchestration, interval refresh, preference mutations
- `src/lib/tauri/contracts.ts`: All TypeScript type definitions (shared with Rust via JSON serialization)
- `src/lib/persistence/preferencesStore.ts`: Preference normalization and validation rules
- `src-tauri/src/snapshot.rs`: SnapshotStatus enum definition
- `src-tauri/src/commands/mod.rs`: All Tauri command handlers
- `src-tauri/src/lib.rs`: App setup, NSApplicationActivationPolicy, background loops

**Testing:**
- `src/test/setup.ts`: Vitest setup (React Testing Library config)
- `src/**/*.test.tsx` and `src/**/*.test.ts`: Component and utility tests (co-located)
- `tests/contract/`: Contract tests verifying Tauri command response shapes
- `tests/e2e/`: Playwright end-to-end tests

## Naming Conventions

**Files:**
- Components: PascalCase, e.g., `ServiceCard.tsx`, `PromotionStatusLine.tsx`
- Utilities/Controllers: camelCase, e.g., `panelController.ts`, `preferencesStore.ts`
- Tests: `.test.ts` or `.test.tsx` suffix, e.g., `ServiceCard.test.tsx`
- Rust modules: `mod.rs` for module root, e.g., `src-tauri/src/codex/mod.rs`

**Directories:**
- Feature modules: kebab-case or descriptive, e.g., `demo-services/`, `agent_activity/`
- Component groups: Grouped by UI context, e.g., `components/panel/`, `components/settings/`
- Library modules: Descriptive, e.g., `lib/tauri/`, `lib/persistence/`

**Functions/Exports:**
- Tauri command handlers: snake_case (for IPC dispatch), e.g., `get_codex_panel_state`, `refresh_codex_panel_state`
- TypeScript functions: camelCase, e.g., `loadPanelState()`, `refreshPanelState()`, `normalizePreferences()`
- React components: PascalCase, e.g., `ServiceCard`, `AppShell`
- Type names: PascalCase, e.g., `CodexPanelState`, `UserPreferences`, `SnapshotStatus`

**Constants:**
- Rust: SCREAMING_SNAKE_CASE, e.g., `AUTO_SCAN_INTERVAL_SECS`, `MIN_CLAUDE_REFRESH_COOLDOWN_SECS`
- TypeScript: camelCase or SCREAMING_SNAKE_CASE depending on scope (const arrays/enums tend to be SCREAMING)

## Where to Add New Code

**New Feature (e.g., account linking):**
- Primary code: `src/features/[feature-name]/` (controllers, resolvers, types)
- Components: `src/components/[feature-name]/` (if UI-heavy) or reuse existing components
- Tests: Co-located `.test.ts` files in feature module
- Backend command: Add handler in `src-tauri/src/commands/mod.rs`
- Backend logic: New module in `src-tauri/src/[feature-name]/mod.rs` if complex
- Types: Update `src/lib/tauri/contracts.ts` and `src-tauri/src/state/mod.rs`

**New Component (e.g., quota gauge widget):**
- Implementation: `src/components/[category]/[ComponentName].tsx`
- Tests: `src/components/[category]/[ComponentName].test.tsx`
- Use existing patterns: Import contracts from `src/lib/tauri/contracts`, use copy from `src/app/shared/i18n`

**Utilities (e.g., new summary formatter):**
- Shared frontend utility: `src/lib/[category]/utilities.ts`
- Backend utility: `src-tauri/src/lib.rs` (as module) or inline in relevant module

**Preferences/Settings:**
- Add field to `UserPreferences` in `src/lib/tauri/contracts.ts` and `src-tauri/src/state/mod.rs`
- Update normalization logic in `src/lib/persistence/preferencesStore.ts` (add validation function)
- Add UI field in `src/app/settings/SettingsView.tsx` via `PreferenceField` component
- Add mutation handler in `AppShell.savePreferences()` if special side effects

**Error Handling:**
- Add to `SnapshotStatus` enum in `src-tauri/src/snapshot.rs` if a new service state is needed
- Update frontend UI in `PanelView.tsx` (getSnapshotMessage) and `SettingsView.tsx` (shouldShowSettingsLink)
- Add i18n key in `src/app/shared/i18n.ts` (getCopy function) for both languages

## Special Directories

**`src/assets/icons/`:**
- Purpose: SVG and raster icon assets (service logos, tray icons)
- Generated: No (committed as PNG/SVG)
- Committed: Yes
- Usage: Imported in components via `import_bytes!` (Rust) or static imports (React)

**`.planning/codebase/`:**
- Purpose: GSD codebase analysis documents (ARCHITECTURE.md, STRUCTURE.md, etc.)
- Generated: No (manually written by mapping agent)
- Committed: Yes (aids future development)
- Usage: Reference by `/gsd:plan-phase` and `/gsd:execute-phase` commands

**`snapshot-cache.json`:**
- Purpose: Persisted panel state for fast app restart (stale cache used if fetch fails)
- Generated: Yes (by commands/mod.rs)
- Committed: No (ignored in .gitignore, generated at runtime)
- Path: `~/.config/ai-usage/snapshot-cache.json` (macOS) or same directory as preferences.json

**`preferences.json`:**
- Purpose: User settings persistence
- Generated: Yes (initial creation with defaults)
- Committed: No (ignored in .gitignore)
- Path: `~/.config/ai-usage/preferences.json` or platform-specific location

---

*Structure analysis: 2026-03-31*
