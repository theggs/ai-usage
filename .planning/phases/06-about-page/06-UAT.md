---
status: diagnosed
phase: 06-about-page
source: [06-VERIFICATION.md]
started: 2026-04-02T03:10:00Z
updated: 2026-04-02T03:18:25Z
---

## Current Test

[testing complete]

## Tests

### 1. Settings to About navigation
expected: The Settings footer link opens About as a third shell page, and the back button returns to Settings.
result: issue
reported: "approve. but entrypoint `关于 AIUsage >` is ugly."
severity: cosmetic

### 2. Version display and GitHub browser handoff
expected: The About page shows the packaged app version and clicking the GitHub row opens https://github.com/theggs/ai-usage in the default browser.
result: skipped
reason: session interrupted by issue on Test 1

### 3. Blur and reopen reset behavior
expected: After opening About and scrolling, hiding or blurring the window resets the shell to Panel and clears the About scroll position before reopen.
result: skipped
reason: session interrupted by issue on Test 1

## Summary

total: 3
passed: 0
issues: 1
pending: 0
skipped: 2
blocked: 0

## Gaps

- truth: "The Settings footer link opens About as a third shell page, and the back button returns to Settings."
  status: failed
  reason: "User reported: approve. but entrypoint `关于 AIUsage >` is ugly."
  severity: cosmetic
  test: 1
  root_cause: "The awkward entrypoint comes from a copy/structure decision: `aboutLink` is defined as a single localized string that combines wording, product name, and a literal chevron. `SettingsView` renders that raw string directly, so the label and disclosure chrome cannot be tuned independently."
  artifacts:
    - path: "src/app/shared/i18n.ts"
      issue: "The `aboutLink` translation embeds both the label text and the chevron in one string, including the awkward `关于 AIUsage >` zh-CN variant."
    - path: "src/app/settings/SettingsView.tsx"
      issue: "Footer renders the raw localized string directly, so copy and visual treatment cannot be tuned independently."
    - path: ".planning/phases/06-about-page/06-04-PLAN.md"
      issue: "The phase plan itself prescribed the combined `About AIUsage >` / `关于 AIUsage >` strings."
  missing:
    - "Replace the footer entrypoint copy with a cleaner localized label that reads naturally in zh-CN."
    - "Render the chevron as UI chrome instead of baking `>` into the translation string."
  debug_session: ".planning/debug/settings-about-entry-copy.md"
