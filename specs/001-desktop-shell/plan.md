# Implementation Plan: Iteration 1 Desktop Shell

**Branch**: `001-desktop-shell` | **Date**: 2026-03-18 | **Spec**: [spec.md](/Users/chasewang/01workspace/projects/ai-usage/specs/001-desktop-shell/spec.md)
**Input**: Feature specification from `/specs/001-desktop-shell/spec.md`

## Summary

交付一个可运行的跨平台桌面空壳，使用 Tauri 承载 macOS 菜单栏与 Windows 托盘体验，使用 React 提供弹出面板与设置界面骨架，并在首轮中完成本地偏好持久化、开机自启、测试通知以及双平台安装包构建流水线。第一迭代明确不接入任何真实 AI 服务数据，而是以演示数据和可验证的桌面集成能力为目标。

## Technical Context

**Language/Version**: Rust stable, TypeScript 5.x, Node.js 20 LTS  
**Primary Dependencies**: Tauri 2, React 19, Tailwind CSS 4, Tauri plugins for autostart, notification, and secure store access  
**Storage**: Local application settings file plus operating system secure credential store for future API secrets  
**Testing**: Vitest, React Testing Library, Playwright, Rust `cargo test`, GitHub Actions build verification  
**Target Platform**: macOS 13+ and Windows 10 22H2+ desktop environments  
**Project Type**: Cross-platform desktop app  
**Performance Goals**: Tray icon visible within 2 seconds of launch; panel visible within 1 second of click; idle memory under 50 MB; idle CPU under 1%  
**Constraints**: Local-first only, no third-party relay, no real service integrations in Iteration 1, silent startup to tray, settings must persist across restarts  
**Scale/Scope**: Single-user desktop utility with 1-3 demo service cards, one settings surface, and one CI pipeline producing macOS and Windows installers

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

The repository constitution is still an unfilled template, so there are no ratified project-specific gates to enforce yet.

- Gate status: PASS with caution
- Rationale: No concrete constitutional rules exist beyond the default planning workflow.
- Follow-up: Establish a real constitution before later iterations introduce external service integrations, secrets handling, and release governance.

## Project Structure

### Documentation (this feature)

```text
specs/001-desktop-shell/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── desktop-shell-contract.md
└── tasks.md
```

### Source Code (repository root)

```text
.github/
└── workflows/
    └── desktop-build.yml

src/
├── app/
│   ├── shell/
│   ├── panel/
│   ├── settings/
│   └── shared/
├── components/
├── features/
│   ├── demo-services/
│   ├── preferences/
│   └── notifications/
├── lib/
│   ├── tauri/
│   └── persistence/
├── styles/
└── test/

src-tauri/
├── src/
│   ├── tray/
│   ├── commands/
│   ├── notifications/
│   ├── autostart/
│   └── state/
├── icons/
├── capabilities/
└── tauri.conf.json

tests/
├── e2e/
├── integration/
└── contract/
```

**Structure Decision**: 采用单仓库桌面应用结构，前端界面放在 `src/`，Tauri 原生宿主与系统集成放在 `src-tauri/`，自动化构建放在 `.github/workflows/`。这样既符合 PRD 中的技术选型，也为后续按功能模块扩展到真实服务接入保留清晰边界。

## Phase 0: Research

Research findings are documented in [research.md](/Users/chasewang/01workspace/projects/ai-usage/specs/001-desktop-shell/research.md).

Key decisions to carry forward:

- Use Tauri 2 as the desktop shell so one codebase can cover macOS menu bar and Windows tray behavior.
- Keep Iteration 1 data local and synthetic so user flows can be validated without any external dependency.
- Separate frontend feature modules from Rust-side system integration code to reduce cross-layer coupling.
- Use GitHub Actions for packaging verification on both platforms before any release automation is introduced.

## Phase 1: Design & Contracts

### Data Model

Data entities and validation rules are captured in [data-model.md](/Users/chasewang/01workspace/projects/ai-usage/specs/001-desktop-shell/data-model.md).

### Interface Contracts

User-visible desktop contracts are defined in [desktop-shell-contract.md](/Users/chasewang/01workspace/projects/ai-usage/specs/001-desktop-shell/contracts/desktop-shell-contract.md).

### Quickstart

Implementation and validation flow is documented in [quickstart.md](/Users/chasewang/01workspace/projects/ai-usage/specs/001-desktop-shell/quickstart.md).

### Design Notes

- Tray lifecycle belongs to the Tauri layer and exposes minimal commands to the UI layer for opening panel, reading preferences, saving preferences, refreshing demo state, and sending a test notification.
- The panel and settings views share a single preference store so that changed values survive app restart and are instantly reflected in the active session.
- Demo service cards should be modeled with the same shape expected by future real integrations, allowing Iteration 2 to replace data sources without redesigning the panel.
- CI should build installers, run frontend and Rust tests, and archive installer artifacts separately per platform.

## Phase 2: Implementation Strategy

1. Bootstrap the Tauri 2 desktop application with React and Tailwind, including tray initialization and a hidden-on-launch main window.
2. Build the panel shell with demo service cards, refresh timestamp handling, and entry points into the settings view.
3. Implement the settings skeleton with local preference persistence and toggles for startup, language, display mode, and notification checks.
4. Wire native integrations for autostart and test notifications behind stable Tauri commands.
5. Add automated tests covering preference persistence, core UI flows, and smoke-level tray/panel behavior.
6. Add GitHub Actions workflows for macOS and Windows package builds with artifact retention.

## Post-Design Constitution Check

- Gate status: PASS with caution
- No additional constitution violations were introduced during design.
- Remaining governance risk is organizational rather than architectural: the team should ratify a real constitution before Iteration 2 expands secrets and external API handling.

## Complexity Tracking

No constitution exceptions or complexity waivers are required for this iteration.
