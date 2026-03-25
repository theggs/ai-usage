# ai-usage Development Guidelines

## Active Technologies
- Rust stable (edition 2021), TypeScript 5.x, Node.js 24 LTS + Tauri 2, React 19, Tailwind CSS 4, Vitest, React Testing Library, Playwrigh (009-ui-ux-polish)
- Local preferences persistence via existing `save_preferences` / `preferencesStore`; no new storage layer (009-ui-ux-polish)
- Existing local preferences persistence via `save_preferences` / `preferencesStore`, plus existing snapshot cache; no new storage layer (010-ui-ux-completion)
- 现有 `preferences.json` 与 `snapshot-cache.json` 本地持久化；不新增存储层 (012-claude-code-usage-query-disclosure)
- Rust stable (edition 2021), TypeScript 5.x, Node.js 24 LTS + Tauri 2, React 19, Tailwind CSS 4, Vitest, React Testing Library, Playwright；优先复用内建 `Date` / `Intl` 时间能力，不新增运行时日期库 (013-promotion-status)

- **Runtime**: Rust stable (edition 2021), TypeScript 5.x, Node.js 24 LTS (via nvm, see `.nvmrc`)
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
- 013-promotion-status: Added Rust stable (edition 2021), TypeScript 5.x, Node.js 24 LTS + Tauri 2, React 19, Tailwind CSS 4, Vitest, React Testing Library, Playwright；优先复用内建 `Date` / `Intl` 时间能力，不新增运行时日期库

## Spec-Kit Workflow Constraints

- `spec-kit` artifacts define product intent and acceptance scope, but they do not replace professional implementation judgment for UI behavior, state cleanup, layout stability, or interaction feedback.
- After `speckit-plan`, any UI-heavy or interaction-heavy feature must include an explicit implementation risk review before coding starts. Capture likely runtime risks, environment traps, and behaviors that cannot be trusted to JSDOM alone.
- After `speckit-tasks`, verify that tasks cover not only feature implementation but also real-runtime validation, screenshot or visual review, and abnormal-path verification for the affected UX.
- For drag-and-drop, overlays, animations, window transitions, or coordinate-sensitive UI work, do not treat Vitest/RTL passing as sufficient completion evidence. Real runtime verification is required before calling the work done.
- For desktop UI changes, the first implementation pass must be followed by screenshot review or real-window inspection before polish is considered complete.
- Before running any macOS GUI/E2E, screenshot, screen recording, or other frontmost-session-dependent check, first verify that the desktop session is truly interactive rather than only reachable over CLI: the display is awake and unlocked, `pmset -g assertions` does not indicate an inactive user session, and the run will not continue during display sleep. If needed, ask once per session whether the display should be explicitly woken and kept awake, such as with `caffeinate -d`; if the environment is unsuitable, stop and report an environment issue instead of treating failures as app regressions.
- When using `speckit-analyze`, also check whether implementation-quality gates are missing from the plan or task breakdown, not just whether requirements are mapped.
- Do not declare completion based only on code paths and unit tests. Completion requires that the user-facing problem is actually resolved in the running app.
- See [spec-kit-workflow-constraints.md](/Users/chasewang/01workspace/projects/ai-usage/doc/engineering/spec-kit-workflow-constraints.md) for the full operating guide.
