# ai-usage
Read @AGENTS.md for full development guidelines, project structure, commands, architecture decisions, and feature history.

## Active Technologies
- Rust stable (edition 2021), TypeScript 5.x, Node.js 20 LTS + Tauri 2, React 19, Tailwind CSS 4
- Rust crates: `serde`, `serde_json` (existing); `ureq` + `chrono` + `sha2` (005-claude-code-support)
- Storage: local preferences JSON; macOS Keychain (read-only, via `security` CLI); `~/.claude/.credentials.json` (read-only)
- Outbound HTTP: `ureq` with auto-detected system proxy (`scutil --proxy` fallback for GUI apps)

## Recent Changes
- 005-claude-code-support: Claude Code quota display via OAuth API; menubar service selection; panel display order; system proxy support for outbound API calls
- 007-session-recovery: Remodel 401 as transient session-recovery state; preserve stale cache; auto-recover via existing refresh interval
