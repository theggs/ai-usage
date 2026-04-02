---
status: complete
phase: 06-about-page
source: [06-VERIFICATION.md]
started: 2026-04-02T03:10:00Z
updated: 2026-04-02T03:16:34Z
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
  root_cause: "The footer entrypoint copy is hardcoded as a single localized string (`aboutLink`) that combines label, product name, and chevron. In zh-CN this renders as `关于 AIUsage >`, which reads awkwardly and looks visually clumsy in the footer."
  artifacts:
    - path: "src/app/shared/i18n.ts"
      issue: "Localized footer copy uses awkward phrasing in zh-CN and includes the chevron in the string itself."
    - path: "src/app/settings/SettingsView.tsx"
      issue: "Footer renders the raw localized string directly, so copy and visual treatment cannot be tuned independently."
  missing:
    - "Replace the footer entrypoint copy with a cleaner localized label that reads naturally in zh-CN."
    - "Render the chevron as UI chrome instead of baking `>` into the translation string."
  debug_session: ""
