# Implementation Plan: UI/UX 视觉层级与交互优化

**Branch**: `009-ui-ux-polish` | **Date**: 2026-03-23 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/009-ui-ux-polish/spec.md`

## Summary

Polish the existing Tauri panel and settings experience so the user can understand quota health within one second, while making settings behave consistently with immediate persistence. The work stays primarily in the React/Tailwind layer: introduce a derived panel health summary, richer quota-card presentation, relative-time formatting, animated view transitions, grouped settings with auto-save, and drag-based service ordering. Existing Tauri commands and host-side secure boundaries remain intact; only the timing and frontend consumption of the existing preferences contract change.

## Technical Context

**Language/Version**: Rust stable (edition 2021), TypeScript 5.x, Node.js 20 LTS  
**Primary Dependencies**: Tauri 2, React 19, Tailwind CSS 4, Vitest, React Testing Library, Playwright  
**Storage**: Local preferences persistence via existing `save_preferences` / `preferencesStore`; no new storage layer  
**Testing**: Vitest + React Testing Library, Playwright/E2E screenshot review, targeted Tauri integration verification  
**Target Platform**: macOS menu bar desktop app (360x620 panel), with existing Windows-safe contracts preserved  
**Project Type**: Desktop app (Tauri 2 + React)  
**Performance Goals**: Preserve "< 1 second glanceability" for panel health; preference edits apply within the same interaction cycle; animations remain lightweight and do not block refresh/render flow  
**Constraints**: No new trusted-boundary data paths; proxy remains the only preference requiring explicit confirmation; UI must remain truthful for empty/stale/failed states; layout optimized for 360x620 without introducing scroll traps  
**Scale/Scope**: Current 2 services (Codex, Claude Code), designed to extend to 4-5 services without redesigning hierarchy or ordering

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### I. Host-Boundary Security — PASS

This feature does not add any new credential, CLI, proxy-resolution, or native-integrated data paths. All sensitive operations remain in the existing Tauri host layer. Frontend changes only consume already-normalized `CodexPanelState` and `UserPreferences` payloads, and continue to delegate persistence through the existing preference commands.

**Trusted boundary statement**: Rust host commands continue to emit normalized service/preference state; React derives presentation-only view models such as health summary, relative-time labels, and grouped settings sections.

**Explicit non-goals**: changing credential access, moving proxy validation into the frontend-only path, adding new host commands for UI-only state, or introducing remote analytics to measure glanceability.

### II. Contract-First Desktop Surfaces — PASS

The desktop surface changes are defined before implementation in the artifacts for this feature:
- `contracts/panel-settings-ui-contract.md` documents the derived UI contract for panel header summary, card alert treatment, global refresh timestamp, settings save behaviors, and drag ordering.
- `data-model.md` defines the derived entities and state transitions used by the panel and settings layers.
- Existing host contracts (`CodexPanelState`, `UserPreferences`, `PreferencePatch`) remain the canonical cross-layer payloads; no raw host responses are exposed.

### III. Test-Gated Integration — PASS

The plan requires automated checks at the narrowest useful layer plus cross-surface verification:
- Vitest coverage for health-summary derivation, relative-time formatting, dimension-label mapping, and immediate-save behavior
- React Testing Library coverage for grouped settings, proxy-only explicit apply, warning/danger card emphasis, and refresh timestamp de-duplication
- E2E coverage for panel-to-settings transition, refresh feedback, and drag-reorder persistence in the real Tauri shell

No feature slice is complete until the relevant `npm test` path and the affected E2E checks pass.

### IV. Truthful User States — PASS

The design explicitly distinguishes:
- healthy / warning / danger quota levels
- empty / disconnected / stale / failed service placeholders
- saving / applied / rejected preference interactions
- refreshing / refresh-failed / idle action feedback

The new panel header summary, badge rules, and global refresh label are all derived from canonical service state so the UI stays consistent with underlying data.

### V. Local-First Incremental Delivery — PASS

The feature can ship in small user-visible slices without new backend infrastructure:
1. Panel hierarchy and health-summary improvements
2. Immediate-save settings model and grouped layout
3. Drag ordering and micro-interactions

Each slice improves the local desktop workflow independently and preserves the current preference and service contracts.

## Project Structure

### Documentation (this feature)

```text
specs/009-ui-ux-polish/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── panel-settings-ui-contract.md
├── checklists/
│   └── requirements.md
└── tasks.md
```

### Source Code (repository root)

```text
src/
├── app/
│   ├── panel/
│   │   ├── PanelView.tsx
│   │   └── PanelView.test.tsx
│   ├── settings/
│   │   ├── SettingsView.tsx
│   │   └── SettingsView.test.tsx
│   ├── shell/
│   │   └── AppShell.tsx
│   └── shared/
│       ├── appState.ts
│       └── i18n.ts
├── components/
│   ├── panel/
│   │   ├── QuotaSummary.tsx
│   │   ├── ServiceCard.tsx
│   │   └── ServiceCard.test.tsx
│   └── settings/
│       ├── PreferenceField.tsx
│       └── PreferenceSection.tsx
├── features/
│   └── preferences/
│       ├── defaultPreferences.ts
│       └── preferencesController.ts
├── lib/
│   ├── persistence/
│   │   └── preferencesStore.ts
│   └── tauri/
│       ├── contracts.ts
│       └── summary.ts
└── styles/
    └── globals.css

tests/
├── e2e/
│   ├── screenshot-review.mjs
│   └── tray-panel.spec.mjs
└── integration/
    └── preferences-persistence.test.ts
```

**Structure Decision**: Keep the existing single-project Tauri structure. This feature is a UI/interaction refactor plus derived state helpers; it fits by extending current React view files, UI components, shared formatting utilities, and existing tests without introducing new packages or backend modules.

## Phase 0: Research — Complete

See [research.md](./research.md) for full decisions. Key outcomes:

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Settings save model | Field-level immediate persistence, proxy isolated behind explicit apply | Matches spec and removes mixed interaction model |
| Service ordering | Native drag-and-drop / pointer-event ordering in settings | Desktop-only requirement, no new dependency, compatible with 2-5 items |
| Panel health summary | Derive one header summary from the most urgent visible quota dimension | Satisfies "<1 second" glanceability and avoids duplicate alert stacks |
| Time presentation | Shared relative-time formatter with 30s refresh cadence and absolute tooltip | Aligns refresh and reset messaging without noisy realtime updates |
| View transitions | Lightweight CSS translate/opacity transitions inside `AppShell` | Preserves Tauri shell simplicity and avoids router/animation-library overhead |
| Visual language | Remove redundant "live" noise, elevate warning cards, retain truthful status badges only for abnormal states | Improves hierarchy without masking underlying state |

## Phase 1: Design & Contracts — Complete

Artifacts produced:
- **[data-model.md](./data-model.md)**: Derived UI entities, field semantics, validation, and state transitions
- **[contracts/panel-settings-ui-contract.md](./contracts/panel-settings-ui-contract.md)**: Stable UI behavior contract for panel and settings interactions
- **[quickstart.md](./quickstart.md)**: Local verification workflow for implementation and regression testing

## Phase 2: Implementation Strategy

### Slice 1 — Panel hierarchy and truthful summary

Scope:
- Add a derived health-summary selector across visible services
- Promote quota percentage into the progress bar / emphasized foreground treatment
- Add card-level warning/danger emphasis and user-friendly dimension labels
- Replace per-card duplicate refresh timestamps with a single global relative timestamp when aligned
- Suppress normal-state badges; preserve abnormal-state badges and not-connected guidance

Primary files:
- `src/app/panel/PanelView.tsx`
- `src/components/panel/ServiceCard.tsx`
- `src/components/panel/QuotaSummary.tsx`
- `src/lib/tauri/summary.ts`
- `src/app/shared/i18n.ts`

Tests:
- Extend panel and service-card tests for summary priority, warning/danger styling, label mapping, and global refresh display

### Slice 2 — Settings auto-save and hierarchy

Scope:
- Convert all non-proxy settings to immediate save + optimistic UI
- Remove global save button and saved-banner workflow
- Retain proxy validation and explicit apply button
- Reorganize settings into logical groups with highest-value controls above the fold
- Restyle low-priority actions and Codex CLI info block

Primary files:
- `src/app/settings/SettingsView.tsx`
- `src/components/settings/PreferenceField.tsx`
- `src/components/settings/PreferenceSection.tsx`
- `src/app/shared/appState.ts`
- `src/features/preferences/preferencesController.ts`

Tests:
- Update settings tests for auto-save semantics, proxy validation/apply, and grouped rendering
- Preserve integration coverage for persisted preferences

### Slice 3 — Drag ordering and micro-interactions

Scope:
- Replace up/down buttons with draggable service rows and visible grip affordance
- Add a directional arrow icon to the settings back button
- Animate refresh action, panel/settings slide transitions, sticky-header separation, and progress width changes
- Add single-service disabled-grip behavior

Primary files:
- `src/app/settings/SettingsView.tsx`
- `src/app/shell/AppShell.tsx`
- `src/components/panel/QuotaSummary.tsx`
- `src/styles/globals.css`
- `tests/e2e/tray-panel.spec.mjs`
- `tests/e2e/screenshot-review.mjs`

Tests:
- E2E reorder persistence and transition checks
- RTL coverage for draggable-row fallback/disabled state where feasible

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Immediate-save calls create noisy repeated writes | Medium | Centralize field save helper, debounce only where needed, keep proxy explicit |
| Native drag events are brittle in tests | Medium | Keep ordering logic in a pure helper; validate persistence via E2E in the real shell |
| Extra motion hurts perceived performance in a 360x620 panel | Medium | Use short, transform-based transitions and respect existing refresh lifecycle |
| Header summary could diverge from card data | High | Derive summary strictly from canonical quota dimensions and cover with selector tests |

## Post-Design Constitution Check

### I. Host-Boundary Security — PASS

Design artifacts do not introduce new sensitive flows. Proxy stays on the existing confirmed-save path; all other changes are UI-local or use existing preference commands.

### II. Contract-First Desktop Surfaces — PASS

The plan now includes explicit UI contracts and data models for all modified panel/settings behaviors before implementation.

### III. Test-Gated Integration — PASS

Each behavior-changing surface in this plan is tied to RTL and/or E2E coverage. Cross-surface behavior (save, reorder, transition, refresh feedback) is explicitly testable.

### IV. Truthful User States — PASS

The design centers on truthful summaries, visible abnormal states, and honest refresh/save feedback. No demo-style placeholder masking is introduced.

### V. Local-First Incremental Delivery — PASS

All slices remain local-first, independently shippable, and compatible with the current Tauri/persistence model.
