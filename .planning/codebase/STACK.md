# Technology Stack

**Analysis Date:** 2026-03-31

## Languages

**Primary:**
- Rust (edition 2021) - Backend/Tauri core, CLI integrations, system-level operations
- TypeScript 5.x - React frontend, UI logic, type-safe client interface
- JavaScript (Node.js 24) - Build tooling, test configuration, scripts

**Secondary:**
- Shell script (.sh/.cmd) - E2E testing automation, test fixtures

## Runtime

**Environment:**
- Node.js 24 LTS (via nvm, see `.nvmrc`)
- Rust stable (edition 2021)
- Tauri 2.0.0 (provides runtime bridge between Rust and TypeScript)

**Package Manager:**
- npm (Node.js packages)
- Cargo (Rust crates)
- Lockfiles: `package-lock.json` (npm), `Cargo.lock` (Rust)

## Frameworks

**Core:**
- Tauri 2.0.0 - Cross-platform desktop shell (Rust + TypeScript)
- React 19.x - UI component framework
- Tailwind CSS 4.x - Utility-first CSS styling with Vite integration (`@tailwindcss/vite`)

**Testing:**
- Vitest 3.x - Unit/integration tests (TypeScript, runs in jsdom)
- React Testing Library 16.x - Component testing utilities
- Playwright 1.54.x - E2E browser automation tests
- Jest DOM matchers (via `@testing-library/jest-dom`)

**Build/Dev:**
- Vite 6.x - Frontend build tool and dev server
- TypeScript 5.8+ - Type checking (strict mode)
- Tauri CLI 2.0.0 - Desktop app bundler and dev runner

## Key Dependencies

**Critical:**
- `@tauri-apps/api` 2.0.0 - Tauri command invocation bridge (core IPC)
- `tauri` 2.0.0 - Backend app framework
- `@vitejs/plugin-react` 4.4.1 - JSX support for Vite
- `@tailwindcss/postcss` 4.2.2 - CSS processing pipeline

**Infrastructure/Backend:**
- `serde` 1.0 + `serde_json` 1.0 - JSON serialization (Rust state sync)
- `ureq` 2.x - HTTP client (OAuth API calls, system proxy support)
- `chrono` 0.4 - Date/time handling (reset hints, activity timestamps)
- `rusqlite` 0.32 (with bundled feature) - Read-only SQLite access for Codex/Claude metadata
- `sha2` 0.10 - Hashing (keychain service name derivation)
- `png` 0.17 - PNG image handling (tray icon generation)

**Tauri Plugins:**
- `tauri-plugin-notification` 2.0.0 - Native notifications
- `tauri-plugin-autostart` 2.0.0 - Launch-on-startup support (macOS LaunchAgent)

**Development:**
- `jsdom` 26.x - DOM simulation for unit tests
- `@testing-library/user-event` 14.x - User interaction simulation
- `@types/*` - TypeScript definitions for React, Node.js, testing libraries

## Configuration

**Environment:**
- `.nvmrc` - Node.js version pinning (24)
- `Cargo.toml` - Rust workspace with `src-tauri` member
- `package.json` - Node.js scripts, dependencies, engine constraints
- Environment variables (no `.env` file in repo; see INTEGRATIONS.md for credential sources)

**Build:**
- `vite.config.ts` - Vite configuration with React plugin, test environment (jsdom)
- `vitest.config.ts` - Vitest setup with globals, jsdom, setupFiles
- `tsconfig.json` - References to `tsconfig.app.json` and `tsconfig.node.json`
- `tsconfig.app.json` - App compilation: ES2021 target, strict mode, React JSX
- `tsconfig.node.json` - Build script types
- `playwright.config.ts` - E2E test configuration (testDir: `tests/e2e`, parallel, list reporter)
- `tauri.conf.json` - Tauri app manifest (built by `tauri build`)
- `src-tauri/Cargo.toml` - Rust backend dependencies and build settings

## Platform Requirements

**Development:**
- Rust toolchain (stable, edition 2021)
- Node.js 24 (via nvm or system)
- Xcode Command Line Tools (macOS) or Visual Studio Build Tools (Windows)
- Native build tools (make, gcc/clang for C dependencies like SQLite)

**Production:**
- macOS (native binary) - Primary deployment target
- Windows support (via Rust + Tauri)
- Linux support (not explicitly tested; no config present)

**macOS-specific:**
- `scutil --proxy` for system proxy detection (Tauri GUI apps don't inherit shell env vars)
- macOS Keychain via `security` CLI (read-only Claude Code credentials)
- `NSApplicationActivationPolicy::Accessory` (menu-bar-only mode, Cmd+Tab hiding)
- `.codex` and `.claude` home directories (activity metadata, local cache)

---

*Stack analysis: 2026-03-31*
