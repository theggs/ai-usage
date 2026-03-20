# Research: Menubar UI/UX Overhaul

**Feature**: 004-menubar-ui-overhaul | **Date**: 2026-03-19

## Decision 1: Handle close and blur as host-owned hide behavior

- **Decision**: Treat both window close requests and focus loss as hide actions implemented in the Tauri host layer.
- **Rationale**: The spec defines a true menubar popover mental model. The close button, outside click, and app-switch blur all belong to native window lifecycle behavior, and implementing them in `src-tauri/` avoids brittle frontend workarounds or accidental process termination.
- **Alternatives considered**: Leaving the default close behavior was rejected because it exits the process and violates FR-001. React-side visibility state only was rejected because it cannot reliably intercept native close/blur events. Keeping close-to-hide but not blur-to-hide was rejected because it would still feel unlike a macOS menu bar popover.

## Decision 2: Collapse the panel into one status row plus quota cards

- **Decision**: Remove the large green summary bar and blue sync card, leaving a compact header, quota-card list, one inline status row, and a refresh control.
- **Rationale**: The highest-priority user story is scanning remaining quota in under two seconds. Today the primary information competes with duplicated status treatments. A single status row preserves truthful state while letting quota rows become the visual focus.
- **Alternatives considered**: Keeping both status blocks with lighter styling was rejected because it still preserves duplicate hierarchy. Moving all status/error copy into each card was rejected because it would repeat the same message and dilute quota readability.

## Decision 3: Map progress appearance from normalized quota status, not ad hoc UI logic

- **Decision**: Drive progress-bar colors from normalized quota semantics (`healthy`, `warning`, `exhausted`, `unknown`) and explicit thresholds aligned with the spec.
- **Rationale**: The existing contract already distinguishes quota-health semantics. Reusing that status model keeps the UI deterministic across the frontend and host boundary, and allows the visual layer to stay presentation-focused.
- **Alternatives considered**: Recomputing thresholds independently inside multiple React components was rejected because it risks drift. Using only raw percentages without an `unknown` state was rejected because missing values must render a neutral placeholder rather than a misleading zero-like danger style.

## Decision 4: Complete localization by eliminating remaining hard-coded settings and status copy

- **Decision**: Move all remaining user-visible settings labels, helper text, and quota time labels into the shared copy tree in `i18n.ts`.
- **Rationale**: The current settings page still contains hard-coded English section titles and field labels, which directly violates FR-006. Consolidating copy also makes future panel/status refinements safer and easier to test.
- **Alternatives considered**: Translating only the most visible labels was rejected because the acceptance criteria require zero English remnants in Chinese mode. File-local constants were rejected because they fragment translation ownership across components.

## Decision 5: Keep feedback local to the action area

- **Decision**: Show saving, saved, and notification-result feedback near the initiating control or section instead of as detached messages at the page bottom.
- **Rationale**: In a compact menu bar window, off-screen or low-priority feedback is easy to miss. The UX goal is immediate, glanceable confirmation without extra scrolling.
- **Alternatives considered**: Global toast-only feedback was rejected because popover windows are small and transient. Leaving the existing bottom-stacked feedback blocks was rejected because it forces users to scan the entire page after each action.

## Decision 6: Enforce popover dimensions at both shell and content levels

- **Decision**: Shrink the Tauri window configuration into the spec range, disable resizing, and make long content scroll inside the panel.
- **Rationale**: A menubar utility should feel compact and predictable. Relying on CSS alone cannot stop user-driven resizing, and relying on host size alone cannot prevent content overflow.
- **Alternatives considered**: Keeping the current 420x720 resizable shell was rejected because it reads like a standalone app window. Auto-resizing to arbitrary content height was rejected because long settings content can exceed available screen space.
