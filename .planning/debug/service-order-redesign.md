---
status: diagnosed
trigger: "Service order control no longer overlaps the label, but the wrapped capsule layout still looks visually broken and needs redesign"
created: 2026-04-01T12:05:14Z
updated: 2026-04-01T12:05:14Z
---

## Current Focus

hypothesis: CONFIRMED — the overlap fix solved the collision bug, but the interaction is still constrained by the wrong layout model for a sortable control
test: Read SettingsView.tsx and PreferenceField.tsx, then compare the rendered layout against the user screenshot from UAT
expecting: A narrow inline field pattern forcing draggable items into a cramped wrap stack
next_action: Report findings and create gap-closure plan

## Symptoms

expected: Service ordering reads as a deliberate sortable control, with enough width and structure that four providers feel organized and easy to scan
actual: The control avoids overlap, but the providers render as a tall right-aligned chip stack that looks cramped and improvised in the menubar-sized settings surface
errors: Visual design issue only (cosmetic)
reproduction: Open Settings with four providers visible and inspect the service-order row
started: Phase 03 UAT retest after 03-04 gap closure

## Eliminated

- hypothesis: The bug is still caused by drag-handle overlap inside each pill
  evidence: |
    SettingsView.tsx now uses `gap-1.5` and `px-2.5` inside `renderServicePill()`,
    and the screenshot confirms the text is no longer being covered by the handle.
    The remaining problem is overall composition, not intra-pill spacing.
  timestamp: 2026-04-01

- hypothesis: The wrapped layout is failing because `flex-nowrap` is still active
  evidence: |
    SettingsView.tsx uses `flex flex-wrap justify-end gap-1.5` for the service-order
    container. Wrapping is happening as intended. The result is just aesthetically weak
    because the control is too narrow for a wrapped capsule cluster.
  timestamp: 2026-04-01

## Evidence

- timestamp: 2026-04-01
  checked: src/app/settings/SettingsView.tsx lines 485-500
  found: |
    The service-order field still uses the standard inline settings row:
      `layoutClassName="grid-cols-[112px_minmax(0,1fr)] items-center gap-x-2"`
    Inside that row, providers render in:
      `<div className="flex flex-wrap justify-end gap-1.5">`
    This gives the interactive control only the remaining width after the fixed 112px
    label column, which is too little on a narrow settings panel.
  implication: |
    The service-order interaction is being forced into a layout optimized for compact
    selects and toggles, not for a sortable collection of four draggable items.

- timestamp: 2026-04-01
  checked: src/components/settings/PreferenceField.tsx
  found: |
    PreferenceField already supports `multiline`, which removes the compact two-column
    row treatment and the default right-aligned control clamp. The current service-order
    implementation does not use that escape hatch.
  implication: |
    The codebase already has the right primitive for a redesign: promote service order
    to a multiline block instead of keeping it in the inline form-row pattern.

- timestamp: 2026-04-01
  checked: User-provided screenshot from UAT
  found: |
    Four providers render as one pill per line in a staggered right-aligned stack.
    The layout reads as overflow containment rather than intentional hierarchy.
  implication: |
    The redesign should change the interaction shape, not just tweak chip padding again.

## Resolution

root_cause: |
  The remaining cosmetic issue comes from a layout mismatch, not a spacing bug. The
  service-order UI in `src/app/settings/SettingsView.tsx` still uses the compact
  two-column settings-row pattern (`grid-cols-[112px_minmax(0,1fr)]`) that works for
  dropdowns and switches. After the overlap fix switched the control to `flex-wrap`,
  four draggable providers no longer collide with the label, but they still have to fit
  inside the narrow value column of a menubar-sized surface. That produces a tall,
  right-aligned chip stack with weak hierarchy and awkward rhythm.

  `src/components/settings/PreferenceField.tsx` already exposes a `multiline` mode for
  controls that need full-row treatment, but the service-order control does not use it.
  The gap should therefore be solved as a structural redesign: make service order a
  multiline block with a clearer sortable list presentation, not another micro-adjustment
  to chip spacing.
fix:
verification:
files_changed: []
