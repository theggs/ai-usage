# Architecture

**Analysis Date:** 2026-03-31

## Pattern Overview

**Overall:** Layered desktop application with isolated frontend (React/TypeScript) and backend (Rust) communicating via Tauri IPC.

**Key Characteristics:**
- Strict separation between presentation (React components) and business logic (Rust backend)
- State management via React Context for UI state; Rust Mutex-based AppState for backend state
- Data normalization and validation at boundaries (preferencesStore, snapshot contracts)
- Service-oriented polling with dedup guards to prevent concurrent refresh requests
- Tagged union (discriminated union) patterns for exhaustive status handling

## Layers

**Frontend Presentation Layer:**
- Purpose: Render UI, manage user interactions, display cached/live data
- Location: `src/app/` (views), `src/components/` (reusable UI)
- Contains: React components (PanelView, SettingsView, ServiceCard), icons (inline SVG)
- Depends on: tauriClient for IPC, appState context, i18n for localization
- Used by: React app root (main.tsx)

**Frontend Business Logic Layer:**
- Purpose: Handle state mutations, validation, preferences persistence, service orchestration
- Location: `src/features/` (feature modules), `src/lib/tauri/` (IPC contracts), `src/lib/persistence/` (local storage)
- Contains: Controllers (panelController, preferencesController, notificationController), data normalization (summary utilities, preference normalization), promotion resolution logic
- Depends on: tauriClient, localStorage (for preferences/accounts fallback), local contracts
- Used by: Views and components via useAppState() hook

**Frontend-Backend Contract Layer:**
- Purpose: Define shared types and Tauri IPC method signatures
- Location: `src/lib/tauri/contracts.ts` (frontend), `src-tauri/src/state/mod.rs` (Rust equivalent)
- Contains: Type aliases (SnapshotStatus, CodexPanelState, UserPreferences), interface definitions for panel state, quota dimensions, notification results
- Depends on: serde (Rust side) for serialization
- Used by: All frontend/backend code

**Backend Command Handler Layer:**
- Purpose: Expose Tauri IPC endpoints that the frontend invokes
- Location: `src-tauri/src/commands/mod.rs`
- Contains: `get_codex_panel_state`, `refresh_codex_panel_state`, `get_claude_code_panel_state`, `refresh_claude_code_panel_state`, preference/account mutations, test notification dispatch
- Depends on: codex module (Codex CLI interface), claude_code module (OAuth/snapshot logic), snapshot cache, state management
- Used by: Tauri app (invoked via IPC from frontend)

**Backend Service Integration Layer:**
- Purpose: Interface with external CLIs and APIs
- Location: `src-tauri/src/codex/` (Codex CLI), `src-tauri/src/claude_code/` (Claude Code OAuth), `src-tauri/src/notifications/` (notification dispatch)
- Contains: JSON-RPC handling (for Codex), OAuth credential management (for Claude Code), CLI process spawning, HTTP requests via ureq
- Depends on: serde_json, ureq, environment detection (proxy, home directory)
- Used by: commands layer

**Backend State Management Layer:**
- Purpose: Hold shared mutable state for preferences, accounts, auto-menubar selection
- Location: `src-tauri/src/state/mod.rs`
- Contains: AppState (Mutex-wrapped preferences, codex_accounts), AutoMenubarSelectionState, type definitions for all contracts
- Depends on: serde for persistence
- Used by: commands, tray, agent_activity, and background threads

**Backend Persistence Layer:**
- Purpose: Load/save preferences and accounts to JSON files
- Location: `src-tauri/src/codex/mod.rs` (preferences_path, load_preferences, save_preferences), snapshot cache in commands/mod.rs
- Contains: preferences.json (user settings), codex-accounts.json (account credentials), snapshot-cache.json (recent panel state for fast restarts)
- Depends on: filesystem I/O, serde_json
- Used by: commands layer, AppState initialization, auto-menubar loop

**Desktop Tray & Menu Bar Layer:**
- Purpose: Manage tray icon, popover window positioning, menubar mode state
- Location: `src-tauri/src/tray/mod.rs`
- Contains: Tray icon generation (dynamic coloring for Claude Code), popover placement logic (considering screen bounds, last successful position, safe defaults), menubar service selection display
- Depends on: Tauri tray/window APIs, png encoding, AppHandle for window management
- Used by: Tauri app setup, commands (tray updates after refresh)

**Background Agent Activity Loop:**
- Purpose: Auto-detect active service for "auto" menubar mode
- Location: `src-tauri/src/agent_activity/mod.rs`, started in `src-tauri/src/lib.rs`
- Contains: Activity snapshot collectors (SQLite reads from Codex, file mtimes), confidence scoring, auto-menubar selection resolver
- Depends on: rusqlite (read-only Codex metadata), filesystem access
- Used by: Background thread (15-second scan interval), auto-menubar decision in tray module

**Snapshot Status Enum:**
- Purpose: Exhaustive tagged union representing all possible service fetch states
- Location: `src-tauri/src/snapshot.rs`
- Contains: Fresh, CliNotFound, NotLoggedIn, NoCredentials, SessionRecovery, RateLimited, AccessDenied, ProxyInvalid, TemporarilyUnavailable, NoData, Disabled
- Depends on: serde (tagged enum serialization)
- Used by: codex module, claude_code module, commands layer to construct CodexPanelState

## Data Flow

**Panel Initialization (AppShell -> Tauri -> Codex CLI):**

1. User launches app or window gains focus
2. AppShell.useEffect (line 95) calls `loadPanelState()` and `getPreferences()`
3. panelController.loadPanelState → tauriClient.getCodexPanelState → invoke("get_codex_panel_state")
4. Tauri IPC arrives at commands::get_codex_panel_state (backend)
5. Backend reads snapshot cache (snapshot-cache.json); if stale/missing, calls codex::load_snapshot
6. codex::load_snapshot spawns Codex CLI process, parses JSON-RPC responses
7. Backend constructs CodexPanelState with items (quota dimensions) and SnapshotStatus
8. State stored in snapshot cache for next app restart
9. Frontend receives CodexPanelState via tauriClient.withSummary (adds traySummary computed field)
10. AppShell setState(panelState), renders PanelView with visible items

**Panel Refresh (Manual or Auto-Interval):**

1. User clicks refresh button OR auto-refresh interval fires (preferences.refreshIntervalMinutes)
2. AppShell.refreshPanel() called
3. panelController.refreshPanelState invoked (dedup guard: returns pending promise if already refreshing)
4. Command dispatches to backend via Tauri IPC
5. Backend repeats steps 5-9 above, always forcing fresh CLI call (not cached)
6. Frontend markPanelStateRefreshing updates UI (badge="Refreshing", statusLabel="refreshing") while awaiting
7. New state received, UI updates with fresh quota data

**Preferences Mutation (Settings View -> Tauri -> localStorage + CLI):**

1. User changes preference (e.g., enables Claude Code, changes summary mode)
2. SettingsView.applyImmediatePatch calls AppShell.savePreferences(patch)
3. AppShell.runSettingsMutation calls tauriClient.savePreferences(patch)
4. Frontend invokes("save_preferences", {patch}) via Tauri IPC
5. Backend calls codex::save_preferences (writes preferences.json)
6. Backend normalizes patch via preferencesStore.normalizePreferences (validates, defaults, sanitizes proxy URLs)
7. Normalized prefs stored in AppState.preferences Mutex
8. If Claude Code enabled/disabled or proxy changed: backend calls refresh_claude_code_panel_state immediately
9. Frontend receives updated UserPreferences and new claudeCodePanelState
10. AppShell updates preferences state, triggers re-render with new traySummaryMode applied to tray icon
11. Tray menu updated via tray::apply_display_mode

**Auto-Menubar Selection (Background Loop -> Agent Activity -> Tray):**

1. Background thread in lib.rs (start_auto_menubar_loop) wakes every 15 seconds
2. If menubar_service == "auto": collect_service_activity_snapshots (Codex SQLite + Claude session files)
3. resolve_auto_menubar_selection computes confidence for each service based on activity window (5-minute recency)
4. AppState.auto_menubar_selection updated with chosen service and metadata
5. tray::apply_display_mode reads chosen service, renders tray icon with appropriate brand color (Claude Code tint vs. Codex)
6. Popover window title updated to reflect active service

**Error Recovery - Session Recovery (401 Transient):**

1. Codex CLI or Claude Code OAuth returns HTTP 401
2. SnapshotStatus set to SessionRecovery (tagged as transient, not permanent)
3. Frontend displays SessionRecovery message (e.g., "Session expired, retrying...")
4. Next auto-refresh (on interval) or manual refresh attempts recovery without user intervention
5. If successful: SnapshotStatus → Fresh, panel updates
6. If persists: SnapshotStatus → AccessDenied (permanent), requires user action in settings

## Key Abstractions

**CodexPanelState:**
- Purpose: Complete view of quota and connection state for a single service (Codex or Claude Code)
- Examples: `src-tauri/src/state/mod.rs` (struct definition), `src/lib/tauri/contracts.ts` (TypeScript type)
- Pattern: Contains DesktopSurfaceState (tray context), items (quota dimensions), status (SnapshotStatus), activeSession (for rate limit retry logic)

**SnapshotStatus (Tagged Union):**
- Purpose: Exhaustive representation of all fetch outcomes; forces frontend to handle every case
- Examples: `src-tauri/src/snapshot.rs` (Rust enum), `src/lib/tauri/contracts.ts` (TypeScript type)
- Pattern: Discriminated union with `kind` field; optional fields for context (RateLimited.retry_after_minutes, TemporarilyUnavailable.detail)

**UserPreferences:**
- Purpose: All user-configurable settings with normalization rules
- Examples: `src/features/preferences/defaultPreferences.ts`, `src/lib/persistence/preferencesStore.ts` (normalizePreferences function)
- Pattern: Immutable; mutations always via normalizePreferences which validates language, traySummaryMode, proxy URL format, service order

**PanelPlaceholderItem:**
- Purpose: Individual quota card displayed in panel (represents one service's dimension)
- Examples: `src/components/panel/ServiceCard.tsx` (rendered), `src/lib/tauri/summary.ts` (computed properties like progressTone)
- Pattern: Contains label, remaining%, reset hint, statusLabel (demo/refreshing/action-needed), badge text

**ServiceActivitySnapshot:**
- Purpose: Metadata about active service for auto-menubar mode (SQLite reads, file mtimes, confidence)
- Examples: `src-tauri/src/state/mod.rs` (struct), `src-tauri/src/agent_activity/mod.rs` (collected via Codex/Claude file reads)
- Pattern: Includes signal source (CLI, files, env vars), confidence level, eligibility for auto mode

## Entry Points

**Frontend Application Root:**
- Location: `src/main.tsx`
- Triggers: Browser load (or Tauri webview initialization)
- Responsibilities: React root render, AppShell component mount

**AppShell Component:**
- Location: `src/app/shell/AppShell.tsx`
- Triggers: React mount, window focus events
- Responsibilities: Initial state load (preferences + panel state), auto-refresh interval setup, view switching (panel ↔ settings), error handling, context provider setup

**Tauri App Setup:**
- Location: `src-tauri/src/lib.rs` (run function, line 76)
- Triggers: Tauri desktop app initialization
- Responsibilities: Menu bar mode setup (NSApplicationActivationPolicy on macOS), AppState initialization, tray setup, background loop startup (auto-menubar, E2E control), window event handlers (close/blur → hide, not quit)

**Command Handlers (IPC Endpoints):**
- Location: `src-tauri/src/commands/mod.rs` and subsequent modules
- Triggers: Frontend invoke() calls
- Responsibilities: Dispatch to codex/claude_code modules, snapshot cache management, preference/account persistence, response serialization

**Background Auto-Menubar Loop:**
- Location: `src-tauri/src/lib.rs` (start_auto_menubar_loop, line 52)
- Triggers: App setup, runs continuously
- Responsibilities: 15-second activity collection, auto-selection resolution, tray icon update

## Error Handling

**Strategy:** Tagged union (SnapshotStatus) for all service fetch outcomes; transient vs. permanent distinction for recovery logic.

**Patterns:**

**Transient Errors (Retry without user intervention):**
- SessionRecovery (HTTP 401): Auto-retry on next interval refresh
- TemporarilyUnavailable: Preserve stale cache, auto-retry
- RateLimited: Hold status, suppress auto-refresh for retry_after_minutes

**Permanent Errors (Require settings action):**
- CliNotFound: Codex binary not found; offer setup link
- NotLoggedIn: No Codex session; direct user to login
- NoCredentials: Claude Code OAuth missing; direct to settings
- AccessDenied (HTTP 403): Check proxy or credentials in settings
- ProxyInvalid: Validate proxy URL format in settings

**UI Error Presentation:**
- AppShell.error state holds error message from last failed operation
- SettingsView displays error in header during preference mutations
- PanelView shows SnapshotStatus-specific messages via i18n (getSnapshotMessage)

**Dedup Guards (Prevent concurrent requests):**
- panelController: pendingRefresh promise variable (line 5, panelController.ts) ensures only one Codex refresh in flight
- claude_code module: Similar guard for Claude Code refreshes
- Settings mutations: setIsRefreshing flag gates concurrent mutations

## Cross-Cutting Concerns

**Logging:** Console-only (no aggregation backend); error messages logged to AppShell.error state, displayed in UI

**Validation:** Centralized in preferencesStore.normalizePreferences (language, traySummaryMode, proxy URL, refresh interval, service order); Rust side re-validates in commands layer

**Authentication:**
- Codex: Spawns CLI which handles authentication (user runs `codex login` separately)
- Claude Code: OAuth credentials stored in macOS Keychain (or hex-encoded fallback in ~/.claude/.credentials.json); read-only access via security CLI

**Localization:** Frontend-only via i18n.ts (getCopy for text, localizeDimensionLabel for quota labels, localizeRemaining for reset hints); backend returns English, frontend maps

**Proxy Support:**
- Frontend: networkProxyMode and networkProxyUrl stored in preferences; validated as valid URL with http/https/socks5 protocol
- Backend: ureq automatically detects system proxy env vars; falls back to `scutil --proxy` on macOS (critical for GUI apps that don't inherit shell env)

**Snapshot Cache:** Persists recent CodexPanelState to snapshot-cache.json for fast app restarts; always refreshed on demand (user click), seeded with stale data if live fetch fails

---

*Architecture analysis: 2026-03-31*
