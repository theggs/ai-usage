---
status: diagnosed
phase: 03-new-providers
source: [03-01-SUMMARY.md, 03-02-SUMMARY.md]
started: 2026-04-01T07:00:00.000Z
updated: 2026-04-01T07:30:00.000Z
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

### 3. New Providers in Service Order
expected: In Settings, the service display order section should include "Kimi Code" and "GLM Coding Plan" as reorderable items alongside Codex and Claude Code.
result: issue
reported: "the service display order sections of kimi and glm only show when they are on (I think it is as expected). But the display is abnormal: the capsule covers the characters."
severity: cosmetic

### 4. Language Toggle Shows Chinese Labels
expected: Switch language to Chinese. Kimi Code section title should read "Kimi Code 用量". GLM section title should read "GLM 编程套餐用量". Region options should show "国际 (z.ai)" and "国内 (bigmodel.cn)".
result: pass

### 5. Token Whitespace Trimming
expected: Enable Kimi Code. Paste "  sk-test-token  " (with leading/trailing spaces) into the token field. Click away (blur). If you re-focus the field, the token should be trimmed to "sk-test-token" with no surrounding spaces.
result: skipped
reason: Token field is password type — can't visually verify whitespace trimming. Covered by unit tests in preferencesStore.test.ts and Rust normalizer tests.

### 6. No Token Shows NoCredentials
expected: Enable Kimi Code or GLM Coding Plan without entering a token. Switch to panel view. The provider's card should show a "no credentials" or setup message (not a crash or blank card).
result: issue
reported: "the provider's card shows incorrect text: Kimi Code / 未连接 / 请先安装 Claude Code CLI 并登录，安装后再回到这里完成连接。 — shows Claude Code-specific message instead of a generic or Kimi-specific no credentials message"
severity: major

### 7. Kimi Code Quota Display with Valid Token
expected: Enter a valid Kimi Code API token (from kimi.com/code/console). Switch to panel view. Quota card(s) should appear showing "Weekly" usage with a percentage bar and remaining count. If a 5h window limit exists, a second dimension should show.
result: issue
reported: "Even with a valid token entered, the card still shows '未连接 / 请先安装 Claude Code CLI 并登录' — same Claude Code-specific message. Token may not be reaching the fetcher, or snapshot status messages are hardcoded to Claude Code text for all providers."
severity: blocker

### 8. GLM Coding Plan Quota Display with Valid Token
expected: Enter a valid GLM API token. Select the correct region. Switch to panel view. Quota card(s) should appear showing token and/or MCP usage dimensions with percentage bars, remaining counts, and reset time hints.
result: issue
reported: "Same issue as test 7 — GLM card shows Claude Code CLI message '未连接 / 请先安装 Claude Code CLI 并登录' even with valid token and correct region. Same root cause as Kimi."
severity: blocker

### 9. Invalid Token Error Handling
expected: Enter an invalid/expired token for either provider. Switch to panel view and trigger refresh. The provider card should show an "access denied" or error message — not a crash, blank panel, or infinite loading state.
result: issue
reported: "Same root cause — GLM card shows Claude Code '未连接 / 请先安装 Claude Code CLI' message for invalid token. All snapshot status messages are mapped to Claude Code-specific text regardless of provider."
severity: blocker

## Summary

total: 9
passed: 3
issues: 5
pending: 0
skipped: 1
blocked: 0
skipped: 0
blocked: 0

## Gaps

- truth: "Service order capsules should display provider names clearly without overlap"
  status: failed
  reason: "User reported: the capsule covers the characters in the service display order row — drag handle dots overlap text, especially visible on 'Claude' capsule"
  severity: cosmetic
  test: 3
  artifacts: []
  missing: []

- truth: "NoCredentials status for Kimi Code/GLM should show a provider-appropriate message, not Claude Code's CLI installation message"
  status: failed
  reason: "User reported: Kimi Code card shows '请先安装 Claude Code CLI 并登录' (Claude Code CLI install prompt) instead of a token-based no credentials message"
  severity: major
  test: 6
  artifacts: []
  missing: []

- truth: "Kimi Code quota data displays in the panel when a valid token is configured"
  status: failed
  reason: "User reported: even with valid token, card still shows Claude Code '未连接' message. Token may not reach fetcher or snapshot status messages hardcoded to Claude Code text."
  severity: blocker
  test: 7
  artifacts: []
  missing: []

- truth: "GLM Coding Plan quota data displays in the panel when a valid token is configured"
  status: failed
  reason: "User reported: same as Kimi — GLM card shows Claude Code '未连接' message with valid token. Same root cause."
  severity: blocker
  test: 8
  artifacts: []
  missing: []

- truth: "Invalid/expired token for new providers should show access denied or error message, not Claude Code CLI install prompt"
  status: failed
  reason: "User reported: same root cause — all snapshot status messages mapped to Claude Code text regardless of provider"
  severity: blocker
  test: 9
  artifacts: []
  missing: []
