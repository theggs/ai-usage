# ai-usage Development Guidelines

## Active Technologies
- Rust stable (edition 2021), TypeScript 5.x, Node.js 20 LTS + Tauri 2, React 19, Tailwind CSS 4, Vitest, React Testing Library, Playwrigh (009-ui-ux-polish)
- Local preferences persistence via existing `save_preferences` / `preferencesStore`; no new storage layer (009-ui-ux-polish)
- Existing local preferences persistence via `save_preferences` / `preferencesStore`, plus existing snapshot cache; no new storage layer (010-ui-ux-completion)

- **Runtime**: Rust stable (edition 2021), TypeScript 5.x, Node.js 20 LTS (via nvm, see `.nvmrc`)
- **Framework**: Tauri 2 (tauri-build 2.0.0) + React 19
- **Styling**: Tailwind CSS 4 (`@tailwindcss/vite` plugin + `@source` CSS directive)
- **Testing**: Vitest, React Testing Library, Playwright
- **Tauri Plugins**: autostart, notification, secure store access
- **Storage**: Local preferences file for user settings and Codex session metadata; host-side transient snapshot reads for live quota data

## Project Structure

```text
src/                          # React frontend
  app/                        # Views (panel, settings, shell)
    shared/                   # Shared state (appState.ts) and i18n (i18n.ts)
  components/                 # Reusable UI components
  features/                   # Feature modules (demo-services, notifications, preferences)
  lib/tauri/                  # Tauri contracts, client, summary utilities
  styles/                     # Global CSS (globals.css with Tailwind @source)
src-tauri/                    # Rust backend
  src/
    commands/                 # Tauri commands
    state/                    # App state management
    tray/                     # Tray icon and menu
    lib.rs                    # App setup, window lifecycle
tests/                        # Contract, e2e, integration tests
specs/                        # Feature specifications (speckit)
```

## Commands

```bash
# Frontend
npm run dev                   # Vite dev server
npm test                      # Vitest (all tests)
npx vitest run                # Run tests once

# Rust
cargo test                    # Rust unit tests
cargo clippy                  # Lint

# Desktop app
npm run tauri:dev              # Full Tauri dev mode (frontend + backend)
npm run tauri:build            # Production build
```

## Code Style

- Rust: Follow standard conventions (edition 2021)
- TypeScript/React: Follow standard conventions (strict mode)
- CSS: Tailwind CSS 4 utility classes; no inline styles except dynamic values

## Git Commit Message Convention

Format: `type: lowercase description`

Allowed types:
- `feat` — new feature or significant enhancement
- `fix` — bug fix or correction
- `docs` — documentation only (specs, engineering docs, README)
- `chore` — tooling, dependencies, CI, license, config changes

Rules:
- First word after colon is lowercase
- No period at the end
- Keep the subject line under 72 characters
- Body is optional; use it for multi-faceted changes to list key items
- Do not include AI tool names, model names, or "Co-Authored-By" lines

## Key Architecture Decisions

- **Window lifecycle**: Close/blur → hide (not quit). Managed in `src-tauri/src/lib.rs` via `WindowEvent::CloseRequested` and `Focused(false)`
- **i18n**: Frontend-only localization via `src/app/shared/i18n.ts`. Backend returns English strings; frontend maps via `localizeRemaining`, `localizeResetHint`, `localizeBadgeLabel`
- **Quota visualization**: Progress bars with threshold-based coloring (`>50%` green, `20-50%` amber, `<20%` red, `undefined` gray). Logic in `src/lib/tauri/summary.ts`
- **macOS menu bar mode**: `NSApplicationActivationPolicy::Accessory` for dock/Cmd+Tab hiding
- **Outbound HTTP proxy**: `src-tauri/src/claude_code/mod.rs` auto-detects system proxy via env vars (`HTTPS_PROXY` etc.) then `scutil --proxy` (macOS). GUI apps don't inherit shell proxy env vars, so `scutil` fallback is essential for users behind a proxy.
- **Claude Code credentials**: Keychain stores plain JSON (`{"claudeAiOauth":{"accessToken":"…"}}`). Fall back to hex-decode for older Claude Code versions that stored hex-encoded JSON. Priority: env var → keychain → `~/.claude/.credentials.json`.

## Feature History

- 001-desktop-shell: Initial Tauri desktop shell
- 002-openai-codex-support: Codex CLI usage limits integration
- 003-macos-menubar-agent: macOS menu bar agent mode
- 004-menubar-ui-overhaul: Compact UI, progress bars, i18n, popover lifecycle
- 005-claude-code-support: Claude Code quota display, menubar service selection, panel display order

## Recent Changes
- 010-ui-ux-completion: Added Rust stable (edition 2021), TypeScript 5.x, Node.js 20 LTS + Tauri 2, React 19, Tailwind CSS 4, Vitest, React Testing Library, Playwrigh
- 009-ui-ux-polish: Added Rust stable (edition 2021), TypeScript 5.x, Node.js 20 LTS + Tauri 2, React 19, Tailwind CSS 4, Vitest, React Testing Library, Playwrigh
