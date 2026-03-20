# Implementation Plan: Menubar UI/UX Overhaul

**Branch**: `004-menubar-ui-overhaul` | **Date**: 2026-03-19 | **Spec**: [spec.md](/Users/chasewang/01workspace/projects/ai-usage/specs/004-menubar-ui-overhaul/spec.md)
**Input**: Feature specification from `/specs/004-menubar-ui-overhaul/spec.md`

## Summary

本次迭代聚焦把现有 Tauri 菜单栏应用从“可用原型”收紧为符合 macOS menubar 心智的正式面板：宿主层修复关闭窗口误退出进程的问题，并在失焦时以 popover 方式自动隐藏；前端层重构主面板信息层级，只保留额度卡片、状态行和刷新操作；同时补齐设置页国际化、保存反馈、Autostart 交互形态与视觉密度，使配额信息在 2 秒内可读。

## Technical Context

**Language/Version**: Rust stable, TypeScript 5.x, Node.js 20 LTS  
**Primary Dependencies**: Tauri 2, React 19, Tailwind CSS 4 (`@tailwindcss/vite` plugin + `@source` CSS directive, requires Node >= 20), Vitest, React Testing Library, Playwright, Tauri plugins for autostart and notification
**Storage**: Local preferences file for user settings and Codex session-related metadata; host-side transient snapshot reads for live quota data  
**Testing**: `npm test`, targeted React Testing Library component tests, contract/integration tests in `tests/`, Rust `cargo test` for host-side tray/window behavior helpers  
**Target Platform**: macOS menu bar app as primary target, with no regressions for existing Windows desktop shell behavior  
**Project Type**: Tauri desktop application with tray-first UI  
**Performance Goals**: Panel opens with meaningful quota state visible within 2 seconds; refresh stays single-flight while loading; panel width remains 320-380px with no horizontal overflow  
**Constraints**: Window close must hide instead of terminating the process; any blur outside the panel must auto-hide; frontend must consume normalized host/UI contracts instead of raw host state; all visible copy must be localized for `zh-CN` and `en-US`; visual hierarchy must stay within two layers of nesting  
**Scale/Scope**: One tray window, one panel surface, one settings surface, existing Codex limit rows plus presentation-only enhancements for progress state, status line, and localized settings copy

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

The repository constitution is active at version `1.0.0` and introduces five binding principles:
Host-Boundary Security, Contract-First Desktop Surfaces, Test-Gated Integration,
Truthful User States, and Local-First Incremental Delivery.

- Gate status: PASS
- Rationale: The plan keeps native window lifecycle rules inside `src-tauri/`, formalizes the adjusted panel payload and window expectations through a feature contract, preserves truthful loading/error/disconnected states inline in the compact UI, and requires targeted host plus UI regression coverage before implementation is complete.
- Constitutional impact:
  - Principle I satisfied by implementing close/hide/focus-loss behavior in the Tauri host boundary rather than letting frontend code emulate window lifecycle.
  - Principle II satisfied by documenting the compact panel payload and window visibility expectations in `contracts/menubar-ui-contract.md`.
  - Principle III satisfied by requiring component tests for progress/status rendering and host-side tests for tray/window toggle behavior.
  - Principle IV satisfied by keeping error/disconnected information visible in the single status line instead of hiding failures behind decorative cards.
  - Principle V satisfied by limiting scope to one menu bar surface and incremental UX polish without introducing any cloud dependency or account-model redesign.

## Project Structure

### Documentation (this feature)

```text
specs/004-menubar-ui-overhaul/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── menubar-ui-contract.md
└── tasks.md
```

### Source Code (repository root)

```text
src/
├── app/
│   ├── shell/
│   ├── panel/
│   ├── settings/
│   └── shared/
├── components/
│   ├── panel/
│   └── settings/
├── features/
│   ├── notifications/
│   └── preferences/
├── lib/
│   └── tauri/
└── styles/

src-tauri/
├── src/
│   ├── commands/
│   ├── state/
│   ├── tray/
│   └── lib.rs
└── tauri.conf.json

tests/
├── contract/
├── e2e/
└── integration/
```

**Structure Decision**: 继续沿用单仓库 Tauri 结构。原生窗口生命周期与 tray toggle 逻辑保持在 `src-tauri/`；面板和设置页布局收敛、文案国际化、交互反馈与视觉样式调整落在 `src/`；类型与命令约束继续由 `src/lib/tauri/` 作为跨层契约入口。

## Phase 0: Research

Research findings are documented in [research.md](/Users/chasewang/01workspace/projects/ai-usage/specs/004-menubar-ui-overhaul/research.md).

Key decisions to carry forward:

- 关闭按钮和失焦隐藏都由 Tauri 宿主统一处理，避免 React 侧拼接窗口生命周期逻辑。
- 主面板保留一个紧凑状态行，将“上次刷新时间”和错误信息合并呈现，移除双重状态卡。
- 配额颜色分级直接基于既有 `CodexLimitStatus` 语义映射，缺失值显示为中性占位样式。
- 设置页所有可见文本统一进入 `i18n.ts`，保存与通知反馈改为就近可见而非页面底部堆叠。
- 面板尺寸与滚动策略在 Tauri 配置和前端容器两层同时收口，确保 menubar popover 密度。

## Phase 1: Design & Contracts

### Data Model

Data entities and validation rules are captured in [data-model.md](/Users/chasewang/01workspace/projects/ai-usage/specs/004-menubar-ui-overhaul/data-model.md).

### Interface Contracts

Host/UI behavior and compact surface expectations are defined in [menubar-ui-contract.md](/Users/chasewang/01workspace/projects/ai-usage/specs/004-menubar-ui-overhaul/contracts/menubar-ui-contract.md).

### Quickstart

Implementation and validation flow is documented in [quickstart.md](/Users/chasewang/01workspace/projects/ai-usage/specs/004-menubar-ui-overhaul/quickstart.md).

### Design Notes

- `PanelView` should collapse to a small header, quota-card list, a single inline status row, and a refresh affordance with spinner/disabled state.
- `ServiceCard` becomes the primary information unit and should own progress bar rendering, color grading, reset hint, and undefined-value placeholder styling.
- `QuotaSummary` renders each dimension as a compact three-line layout: label + percentage number, progress bar, reset hint. The redundant "剩余 X%" text line is removed since the percentage is already shown in the header row.
- `SettingsView` should separate “偏好设置” and “通知测试” into distinct sections, replace raw checkbox with switch-style control, and keep save success feedback adjacent to the save action.
- `i18n.ts` becomes the single source of truth for all panel/settings labels, including section titles and dynamic status labels that are currently hard-coded. Backend data strings (badgeLabel, remainingAbsolute, resetHint) are localized on the frontend via `localizeRemaining`, `localizeResetHint`, `localizeBadgeLabel` utility functions that parse English backend output and map to the current locale.
- `tauri.conf.json`, tray toggle helpers, and app startup/window event wiring together define a non-resizable popover-like shell that hides on close or blur instead of exiting.
- `AppShell` and the panel controller should keep the last successful panel payload visible during refresh so hide/reopen and in-flight refreshes do not flash empty UI.
- 全局圆角统一到 `rounded-xl`（12px）至 `rounded-2xl`（16px）范围，移除所有 `rounded-[28px]`、`rounded-[32px]`、`rounded-3xl`、`rounded-full`（仅按钮/badge 保留 `rounded-full`）。涉及 `AppShell.tsx` 外层容器、`ServiceCard.tsx` 卡片、`QuotaSummary.tsx` 维度行、`PanelView.tsx` 状态栏/信息卡、`SettingsView.tsx` 表单控件和反馈区块。
- 视觉密度收紧：`globals.css` 中径向渐变透明度降低或替换为纯色微渐变；移除 `AppShell.tsx` 外层的 `backdrop-blur-xl` 和 `shadow-2xl`，改为轻量 `shadow-sm`；`ServiceCard` 的 `backdrop-blur` 和 `shadow-lg` 降级为 `shadow-sm`；整体从三层半透明嵌套（容器 > 卡片 > 维度行）压缩到两层（容器 > 卡片，维度行为卡片内的平铺元素）。
- 数据模型变更落地位置：`QuotaDimensionPresentation` 新增的 `status`/`progressTone` 字段在 `src/lib/tauri/contracts.ts` 中扩展 `QuotaDimension` 类型，由 `QuotaSummary.tsx` 消费；`SettingsFeedbackState` 作为 `SettingsView` 的局部 React 状态实现，不需要新增 Tauri command 或 Rust 类型；颜色映射逻辑封装为纯函数放在 `src/lib/tauri/` 或 `src/components/panel/` 中。

## Phase 2: Implementation Strategy

1. Adjust the host window lifecycle so tray clicks toggle visibility, close requests are intercepted into hide actions, and focus loss triggers hide without terminating the app.
2. Tighten the tray window shell for a popover footprint by setting a non-resizable width/height envelope (360px wide, 620px tall) and ensuring content can scroll vertically when needed.
3. Refactor panel layout to remove redundant status blocks, move error/disconnected messaging into one compact status line, and keep refresh state visible but unobtrusive.
4. Update quota card presentation to include deterministic progress-bar fill, threshold-based colors, and neutral fallback styling for unknown percentages. Extend `QuotaDimension` in `contracts.ts` with `status` and `progressTone` fields; add a pure color-mapping utility consumed by `QuotaSummary.tsx`.
5. Unify visual density: replace all `rounded-[28px]`/`rounded-[32px]`/`rounded-3xl` with `rounded-xl`(12px)–`rounded-2xl`(16px); reduce `backdrop-blur-xl` and `shadow-2xl` to lightweight alternatives; simplify `globals.css` background gradient; flatten nesting from three visual layers to two.
6. Complete settings-page localization and UX polish, including localized section labels, switch styling, separated action groups, and inline save/test feedback. Implement `SettingsFeedbackState` as local React state in `SettingsView`.
7. Add or update tests that lock down window toggle behavior, compact panel rendering, progress color thresholds (covering 0%, 2%, 20%, 50%, 80%, 100%), border-radius compliance, and bilingual copy coverage before implementation is considered done.

## Post-Design Constitution Check

- Gate status: PASS
- No constitution violations are introduced in the final design.
- Native window behavior remains inside the trusted host boundary, the UI consumes documented normalized state, and compact status handling still preserves truthful live/disconnected/failed user feedback.

## Complexity Tracking

No constitution exceptions or complexity waivers are required for this iteration.
