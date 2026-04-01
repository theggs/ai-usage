---
status: complete
phase: 03-new-providers
source: [03-01-SUMMARY.md, 03-02-SUMMARY.md, 03-03-SUMMARY.md]
started: 2026-04-01T07:00:00.000Z
updated: 2026-04-01T08:30:00.000Z
---

## Current Test

[testing complete]

## Tests

### 1. Kimi Code Settings Section
expected: Open Settings. Scroll down past Claude Code section. A "Kimi Code Usage" section should appear with an enable/disable toggle (pill switch). When toggled on, a password-type token input field should appear with placeholder "sk-..." and a hint mentioning kimi.com/code/console.
result: pass

### 2. GLM Coding Plan Settings Section
expected: Below Kimi Code, a "GLM Coding Plan Usage" section should appear with enable/disable toggle. When enabled, a password-type token input field and a "Region" dropdown selector with options "Global (z.ai)" and "China (bigmodel.cn)" should appear.
result: pass

### 3. New Providers in Service Order (re-test)
expected: In Settings, the service display order capsules should show provider names clearly — drag handle dots should NOT overlap the label text. Check "Claude Code" and "Kimi Code" capsules especially.
previous_result: issue (cosmetic — capsule text overlap)
fix: 03-03 changed gap-1→gap-1.5, px-2→px-2.5
result: issue
reported: "Still failing. The first capsule 'Claude' overlaps with the row label '显示顺序'. The internal capsule spacing fix didn't address the real problem — the capsule row itself overflows into the label area."
severity: cosmetic

### 4. Language Toggle Shows Chinese Labels
expected: Switch language to Chinese. Kimi Code section title should read "Kimi Code 用量". GLM section title should read "GLM 编程套餐用量". Region options should show "国际 (z.ai)" and "国内 (bigmodel.cn)".
result: pass

### 5. Token Whitespace Trimming
expected: Enable Kimi Code. Paste "  sk-test-token  " (with leading/trailing spaces) into the token field. Click away (blur). If you re-focus the field, the token should be trimmed to "sk-test-token" with no surrounding spaces.
result: skipped
reason: Token field is password type — can't visually verify whitespace trimming. Covered by unit tests in preferencesStore.test.ts and Rust normalizer tests.

### 6. No Token Shows NoCredentials (re-test)
expected: Enable Kimi Code or GLM without entering a token. Switch to panel view. The card should show "Token not configured" (EN) or "未配置 Token" (ZH) — NOT "请先安装 Claude Code CLI".
previous_result: issue (major — showed Claude Code CLI message)
fix: 03-03 added provider-aware getPlaceholderCopy routing
result: issue
reported: "Partial pass — correct message shows after manual refresh, but when deleting token after a failed AccessDenied state, the panel shows stale 'AccessDenied' until manually refreshed. Token deletion should auto-trigger a provider refresh."
severity: minor

### 7. Kimi Code Quota Display with Valid Token (re-test)
expected: Enter a valid Kimi Code API token. Switch to panel view. Quota card(s) should appear showing usage with a percentage bar and remaining count — NOT Claude Code CLI messages.
previous_result: issue (blocker — showed Claude Code message)
fix: 03-03 added provider-aware copy routing
result: issue
reported: "Quota data displays correctly after manual refresh, but not immediately after saving token in settings. Same auto-refresh issue as test 6 — settings changes should trigger provider refresh."
severity: minor

### 8. GLM Coding Plan Quota Display with Valid Token (re-test)
expected: Enter a valid GLM API token with correct region. Switch to panel view. Quota card(s) should appear showing usage dimensions — NOT Claude Code CLI messages.
previous_result: issue (blocker — showed Claude Code message)
fix: 03-03 added provider-aware copy routing
result: skipped
reason: No GLM Coding Plan subscription available. Will test when ready.

### 9. Invalid Token Error Handling (re-test)
expected: Enter an invalid/expired token for either provider. Trigger refresh. The card should show "access denied" or error message — NOT Claude Code CLI install prompt.
previous_result: issue (blocker — showed Claude Code message)
fix: 03-03 added provider-aware copy routing
result: issue
reported: "Error message is correct (GLM shows '暂时无法连接' not Claude Code text). But same auto-refresh issue — panel doesn't refresh after returning from settings until manual refresh."
severity: minor

## Summary

total: 9
passed: 3
issues: 4
pending: 0
skipped: 2
blocked: 0

## Gaps

- truth: "Service order capsules should display provider names clearly without overlapping the row label"
  status: failed
  reason: "User reported: first capsule 'Claude' still overlaps with row label '显示顺序'. Root cause: flex-nowrap container overflows into the 112px label column when 4+ capsules are rendered. The 03-03 internal spacing fix (gap-1.5/px-2.5) did not address container overflow."
  severity: cosmetic
  test: 3
  artifacts:
    - src/app/settings/SettingsView.tsx:496
  missing: []

- truth: "Saving or deleting a provider token in Settings should immediately refresh that provider's panel state"
  status: failed
  reason: "User reported across tests 6, 7, 9: after changing token in settings and returning to panel, stale snapshot status persists until manual refresh. Token save/delete should auto-trigger a provider refresh so the panel immediately reflects the new credential state."
  severity: minor
  test: 6, 7, 9
  artifacts:
    - src/app/settings/SettingsView.tsx
    - src/app/shell/AppShell.tsx
  missing: []
