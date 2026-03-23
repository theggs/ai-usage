# Research: UI/UX 视觉层级与交互优化

**Phase**: 0 — Research & Decision Log  
**Feature**: 009-ui-ux-polish  
**Date**: 2026-03-23

## Decision 1 — Settings Persistence Model

**Decision**: Convert every non-proxy preference control to immediate persistence through a shared field-save helper; keep network proxy on an explicit validate-and-apply path.

**Rationale**: The current mixed model is the clearest usability regression called out in both the review and the spec. The existing app already persists `autostart` immediately, and the existing `savePreferences` path is fast enough for the remaining preference fields. Separating proxy preserves a deliberate confirmation step for the only setting that can break outbound connectivity.

**Alternatives considered**:
- Keep a global save button and make `autostart` match it: rejected because it preserves the core interaction inconsistency
- Make proxy auto-save too: rejected because invalid input and connection-breaking mistakes are higher-risk than ordinary preferences
- Stage all edits locally and save on view-exit: rejected because it hides persistence timing and complicates truthful feedback

---

## Decision 2 — Service Reordering Interaction

**Decision**: Implement service ordering with native drag-and-drop or equivalent pointer-driven row reordering in the settings view, without adding a drag library.

**Rationale**: The spec explicitly narrows the requirement to desktop mouse interactions and a small list size (2 services now, 4-5 later). Native drag handling is sufficient, keeps bundle size flat, and avoids introducing a dependency solely for one short settings list.

**Alternatives considered**:
- `dnd-kit`: flexible and polished, but unnecessary dependency overhead for this scope
- Keep up/down buttons with visual polish: rejected because it does not satisfy the new interaction requirement
- Use a sortable table abstraction: rejected as too heavy for a simple settings stack

---

## Decision 3 — Panel Health Summary Derivation

**Decision**: Derive a single panel-header health summary from the most urgent visible quota dimension across all rendered services.

**Rationale**: The header should answer "do I need to care right now?" without forcing card-by-card scanning. The existing data model already exposes `remainingPercent`, `status`, and `serviceId`, so the summary can be computed entirely in the frontend from canonical state. This keeps the host contract stable while satisfying the spec's urgency-order requirement.

**Summary priority order**:
1. Explicit empty/disconnected setup guidance when no services are connected
2. Lowest remaining dangerous dimension (`<20%`)
3. Lowest remaining warning dimension (`20-50%`)
4. Healthy "all services normal" summary

**Alternatives considered**:
- Backend-generated summary strings: rejected because this is presentational logic and would increase i18n coupling
- Show multiple simultaneous warnings in the header: rejected because it adds noise and weakens glanceability

---

## Decision 4 — Time Formatting Strategy

**Decision**: Use a shared frontend relative-time formatter for refresh timestamps, updating on a 30-second cadence or on data refresh, with absolute time exposed via tooltip/title.

**Rationale**: The spec and review both call out inconsistency between reset hints and refresh timestamps. A shared formatter keeps all refresh labels in one presentation system while preserving exact timestamps on hover for inspection. A 30-second cadence matches the spec assumption and avoids excessive re-renders in a small menu bar panel.

**Alternatives considered**:
- Keep absolute timestamps only: rejected because they are slower to parse during glance usage
- Update every second: rejected as visually noisy and unnecessary
- Move formatting into the backend: rejected because relative phrasing is locale-sensitive UI logic

---

## Decision 5 — Motion and Transition Implementation

**Decision**: Use lightweight CSS class transitions in `AppShell` and component classes for refresh spin, slide navigation, sticky-header separation, and quota-width animation.

**Rationale**: The app already renders a single shell with two views, so motion can be added with transform/opacity classes and minimal state. This approach avoids router or animation-library complexity and keeps transitions GPU-friendly in the Tauri environment.

**Alternatives considered**:
- Introduce Framer Motion or another animation library: rejected because the added dependency is disproportionate for four small interactions
- Use no motion beyond current width transition: rejected because it misses explicit feature requirements

---

## Decision 6 — Card and Badge Visual Rules

**Decision**: Keep badges only for abnormal service states; express quota urgency mainly through card-level accenting, progress-bar tone, and emphasized numeric labels.

**Rationale**: "实时/Live" currently adds no useful signal when all cards show it. The more truthful and lower-noise model is to reserve badges for states the user needs help noticing, while normal health is conveyed by the summary and the quota visualization itself.

**Alternatives considered**:
- Keep "Live" badges and add more color elsewhere: rejected because it compounds visual noise
- Remove badges entirely: rejected because stale/failed/offline states still need an at-a-glance affordance

---

## Decision 7 — Settings Information Hierarchy

**Decision**: Reorganize settings into clear groups with the highest-frequency controls first: general/display at the top, connection/proxy next, secondary actions and CLI info last.

**Rationale**: The 360x620 constraint means hierarchy matters more than total control count. Grouping lets the user see language, autostart, summary mode, and related controls in the first viewport, while pushing lower-frequency diagnostic or test actions down without hiding them behind new navigation.

**Alternatives considered**:
- Add tabs inside settings: rejected because it adds navigation complexity inside a very small popover
- Use collapsible accordions for all sections: rejected because common settings become harder to scan quickly
