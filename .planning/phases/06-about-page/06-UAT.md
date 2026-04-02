---
status: diagnosed
phase: 06-about-page
source: [06-VERIFICATION.md]
started: 2026-04-02T04:20:04Z
updated: 2026-04-02T04:42:44Z
---

## Current Test

[testing complete]

## Tests

### 1. Settings to About navigation
expected: The Settings footer entry reads naturally (`About` / `关于`), opens About as a third shell page, and the back button returns to Settings.
result: pass

### 2. Version display and GitHub browser handoff
expected: The About page shows the packaged app version and clicking the GitHub row opens https://github.com/theggs/ai-usage in the default browser.
result: issue
reported: "pass. But `许可证` should be `开源许可证`"
severity: cosmetic

### 3. Blur and reopen reset behavior
expected: After opening About and scrolling, hiding or blurring the window resets the shell to Panel and clears the About scroll position before reopen.
result: pass

## Summary

total: 3
passed: 2
issues: 1
pending: 0
skipped: 0
blocked: 0

## Gaps

- truth: "The About page shows the packaged app version and clicking the GitHub row opens https://github.com/theggs/ai-usage in the default browser."
  status: failed
  reason: "User reported: pass. But `许可证` should be `开源许可证`"
  severity: cosmetic
  test: 2
  root_cause: "The About page binds the license row to `copy.aboutLicenseLabel` correctly, but the zh-CN locale value was authored as `许可证` and the About copy spec only locked the generic English label `License`, so the preferred Chinese wording was never enforced."
  artifacts:
    - path: "src/app/shared/i18n.ts"
      issue: "zh-CN `aboutLicenseLabel` is authored as `许可证` instead of the preferred `开源许可证`."
    - path: "src/app/about/AboutView.tsx"
      issue: "The view renders `copy.aboutLicenseLabel` directly, so the user-visible wording comes entirely from the locale contract."
    - path: ".planning/phases/06-about-page/06-UI-SPEC.md"
      issue: "The copy spec leaves the label as generic `License`, so the preferred Chinese wording was not enforced during implementation."
  missing:
    - "Change the zh-CN `aboutLicenseLabel` value from `许可证` to `开源许可证`."
    - "Update the About copy/design contract so the preferred Chinese label is explicit for future reviews."
  debug_session: ".planning/debug/about-license-zh-label.md"
