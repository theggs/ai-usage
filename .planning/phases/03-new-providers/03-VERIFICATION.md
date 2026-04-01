---
phase: 03-new-providers
verified: 2026-04-01T13:19:47Z
status: passed
score: 5/5 must-haves verified
re_verification:
  previous_status: human_needed
  previous_score: 5/5
  gaps_closed:
    - "03-05 service-order redesign is now included in the verification evidence and approved in real UAT"
    - "Live Kimi runtime was approved after follow-up fixes"
    - "Live GLM runtime was approved after follow-up fixes"
    - "Token save/clear immediate refresh behavior was approved in the running app"
    - "Reset countdowns now use raw `resetsAt` plus frontend-only precise formatting and were approved in the running app"
    - "Main-menu reopen responsiveness regression was fixed and approved in the running app"
  gaps_remaining: []
  regressions: []
---

# Phase 03: New Providers Verification Report

**Phase Goal:** Kimi Code and GLM Coding Plan appear in the panel and can be reordered alongside existing providers; providers with unconfirmed APIs show a clear "not available" state rather than a blank panel
**Verified:** 2026-04-01T13:19:47Z
**Status:** passed
**Re-verification:** Yes -- previous verification paused for human UAT; this pass records user-approved runtime checks and follow-up fixes without advancing to Phase 04

## Goal Achievement

### Observable Truths

Truths were derived from the Phase 03 roadmap success criteria, with the 03-05 gap-closure contract folded into the service-order verification.

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | Kimi Code can produce panel content through the provider pipeline, or fall back to a clear non-blank placeholder state | ✓ VERIFIED | `src-tauri/src/kimi/mod.rs` resolves credentials, fetches `https://api.kimi.com/coding/v1/usages`, maps response dimensions, and returns `NoCredentials` / `AccessDenied` / `RateLimited` / `ProxyInvalid` / `TemporarilyUnavailable` statuses. `src-tauri/src/commands/mod.rs` converts non-empty dimensions into `PanelPlaceholderItem`s, while `src/app/panel/PanelView.tsx` renders placeholder copy when `items` is empty. |
| 2 | GLM Coding Plan can produce panel content through the provider pipeline, or fall back to a clear non-blank placeholder state | ✓ VERIFIED | `src-tauri/src/glm/mod.rs` resolves token + endpoint, fetches `/api/monitor/usage/quota/limit`, decodes envelope/bare payloads, inverts usage percentage to remaining percentage, and returns the shared `SnapshotStatus` variants consumed by `PanelView`. |
| 3 | New providers appear in service-order settings and can be dragged to any position | ✓ VERIFIED | `src/lib/tauri/registry.ts` and `src-tauri/src/registry.rs` register `kimi-code` and `glm-coding`; `src/app/settings/SettingsView.tsx` derives `serviceOptions` from `getVisibleServiceScope(...).visiblePanelServiceOrder`; `src/app/settings/SettingsView.test.tsx` verifies four-provider rendering, multiline list layout, and persisted pointer reordering. |
| 4 | New providers use the same shared status and quota rendering treatment as existing providers | ✓ VERIFIED | `src-tauri/src/snapshot.rs` defines the shared `SnapshotStatus` enum; `src-tauri/src/commands/mod.rs` normalizes provider snapshots into the common `CodexPanelState` / `PanelPlaceholderItem` shape; `src/components/panel/ServiceCard.tsx` and `src/app/panel/PanelView.tsx` render all provider data and placeholder states through the same UI path. |
| 5 | The 03-05 redesign turns service ordering into a readable, intentional sortable control on the narrow settings surface | ✓ VERIFIED | `src/app/settings/SettingsView.tsx` now uses `PreferenceField multiline`, a dedicated reorder block, numbered full-width rows, and a drag overlay instead of wrapped right-aligned chips. `src/app/settings/SettingsView.test.tsx` verifies full-width list semantics, zh-CN/en-US label readability, and preserved drag behavior. |

**Score:** 5/5 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
| --- | --- | --- | --- |
| `src-tauri/src/registry.rs` | Rust provider registry includes new providers | ✓ VERIFIED | 108 lines; `PROVIDERS` contains `codex`, `claude-code`, `kimi-code`, `glm-coding` plus registry tests |
| `src/lib/tauri/registry.ts` | Frontend registry mirrors provider metadata | ✓ VERIFIED | 20 lines; four providers exposed to UI code |
| `src-tauri/src/kimi/mod.rs` | Kimi credential chain, HTTP fetch, and response mapping | ✓ VERIFIED | 671 lines; substantive implementation and focused tests |
| `src-tauri/src/glm/mod.rs` | GLM credential chain, endpoint selection, HTTP fetch, and response mapping | ✓ VERIFIED | 798 lines; substantive implementation and focused tests |
| `src-tauri/src/pipeline/kimi.rs` | Pipeline entry delegates to Kimi loader | ✓ VERIFIED | Delegates `fetch()` to `crate::kimi::load_snapshot(preferences)` |
| `src-tauri/src/pipeline/glm.rs` | Pipeline entry delegates to GLM loader | ✓ VERIFIED | Delegates `fetch()` to `crate::glm::load_snapshot(preferences)` |
| `src-tauri/src/state/mod.rs` | Preferences support provider tokens and GLM platform | ✓ VERIFIED | `provider_tokens` + `glm_platform` fields present; Rust normalization trims tokens and validates platform |
| `src/lib/persistence/preferencesStore.ts` | Frontend preferences normalize tokens, service order, and region | ✓ VERIFIED | Trims token whitespace, removes blank tokens, validates `glmPlatform`, and normalizes service order |
| `src/app/panel/PanelView.tsx` | Panel renders provider-specific placeholder states without blank sections | ✓ VERIFIED | Calls `getPlaceholderCopy(copy, state.status, serviceId)` and renders fallback cards for empty `items` |
| `src/app/shared/i18n.ts` | Token-based providers get generic token-not-configured copy and localized reset countdown formatting | ✓ VERIFIED | `getPlaceholderCopy()` routes `kimi-code` and `glm-coding` `NoCredentials` to generic token copy; `localizeResetHint()` formats raw `resetsAt` into precise localized countdowns |
| `src/app/shell/AppShell.tsx` | Token changes trigger immediate provider refresh and reset countdowns tick only while the panel is visible | ✓ VERIFIED | `savePreferences()` detects `"providerTokens" in patch` and refreshes all enabled providers; visible-window ticker updates `displayNowMs` locally without extra provider API calls |
| `src/app/settings/SettingsView.tsx` | 03-05 redesigned service-order UI and provider token settings | ✓ VERIFIED | 915 lines; multiline full-width reorder list, drag rows, Kimi/GLM token inputs, GLM region selector |
| `src/app/settings/SettingsView.test.tsx` | Regression coverage for the redesigned service-order UI | ✓ VERIFIED | 588 lines; covers multiline layout, label readability, drag behavior, overlay lifecycle, and persistence |

### Key Link Verification

| From | To | Via | Status | Details |
| --- | --- | --- | --- | --- |
| `src/app/settings/SettingsView.tsx` | `src/components/settings/PreferenceField.tsx` | `multiline` service-order field | ✓ WIRED | Service order field uses full-width multiline mode |
| `src/app/settings/SettingsView.tsx` | `src/lib/tauri/summary.ts` | `getVisibleServiceScope(draft)` | ✓ WIRED | Reorder rows are derived from current visible provider order, not hardcoded IDs |
| `src/app/settings/SettingsView.tsx` | `savePreferences` | `applyImmediatePatch()` / `commitOrder()` | ✓ WIRED | Pointer drag reorder persists `serviceOrder` changes |
| `src/app/shell/AppShell.tsx` | `refreshProviderState` | `"providerTokens" in patch` | ✓ WIRED | Token save/clear triggers refresh of enabled providers |
| `src/app/panel/PanelView.tsx` | `src/app/shared/i18n.ts` | `getPlaceholderCopy(copy, state.status, serviceId)` | ✓ WIRED | Empty provider states render explicit placeholder copy |
| `src-tauri/src/commands/mod.rs` | `src-tauri/src/pipeline/mod.rs` | `pipeline::fetch_provider(provider_id, ...)` | ✓ WIRED | Generic provider commands dispatch new providers through the shared pipeline |
| `src-tauri/src/pipeline/kimi.rs` | `src-tauri/src/kimi/mod.rs` | `crate::kimi::load_snapshot(preferences)` | ✓ WIRED | Thin fetcher delegates to real loader |
| `src-tauri/src/pipeline/glm.rs` | `src-tauri/src/glm/mod.rs` | `crate::glm::load_snapshot(preferences)` | ✓ WIRED | Thin fetcher delegates to real loader |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| --- | --- | --- | --- | --- |
| `src/app/settings/SettingsView.tsx` | `serviceOptions` | `getVisibleServiceScope(draft).visiblePanelServiceOrder` + registry lookup | Yes | ✓ FLOWING |
| `src-tauri/src/commands/mod.rs` | `PanelPlaceholderItem.quota_dimensions` | `pipeline::fetch_provider()` result -> `snapshot.dimensions` -> `normalize_dimensions()` | Yes | ✓ FLOWING |
| `src-tauri/src/kimi/mod.rs` | `ServiceSnapshot.dimensions` | Live HTTP response from Kimi usage API -> `map_kimi_response()` | Yes | ✓ FLOWING |
| `src-tauri/src/glm/mod.rs` | `ServiceSnapshot.dimensions` | Live HTTP response from GLM quota API -> `decode_glm_response()` -> `map_glm_response()` | Yes | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| --- | --- | --- | --- |
| Phase-03 frontend regressions stay green after reset-countdown refactor | `npx vitest run src/app/shared/i18n.test.ts src/components/panel/ServiceCard.test.tsx src/app/panel/PanelView.test.tsx src/app/settings/SettingsView.test.tsx src/app/shell/AppShell.test.tsx src/lib/tauri/summary.test.ts --reporter=verbose` | 6 files passed, 85 tests passed | ✓ PASS |
| Rust registry includes four providers | `cargo test --lib providers_contains_all_four -- --nocapture` | 1 passed | ✓ PASS |
| Pipeline registry exposes four fetchers | `cargo test --lib fetchers_contains_exactly_four_entries -- --nocapture` | 1 passed | ✓ PASS |
| Kimi mapping produces real dimensions from verified sample payload | `cargo test --lib valid_full_response_produces_two_dimensions -- --nocapture` | 1 passed | ✓ PASS |
| GLM mapping produces real dimensions from verified sample payload | `cargo test --lib valid_three_limit_response_produces_three_dimensions -- --nocapture` | 1 passed | ✓ PASS |
| All Rust library tests stay green after raw-`resetsAt` migration | `cargo test --lib` | 149 passed, 0 failed | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| --- | --- | --- | --- | --- |
| `NPROV-01` | `03-02`, `03-03`, `03-04` | Kimi Code provider displays quota/usage data in the panel | ✓ SATISFIED | Loader, pipeline delegation, token settings, token-refresh wiring, and live runtime approval are complete; reset countdown now formats from raw `resetsAt` in the frontend |
| `NPROV-02` | `03-02`, `03-03`, `03-04` | GLM Coding Plan provider displays quota/usage data in the panel | ✓ SATISFIED | Loader, endpoint selection, percentage inversion, token settings, token-refresh wiring, and live runtime approval are complete; reset countdown now formats from raw `resetsAt` in the frontend |
| `NPROV-03` | `03-01`, `03-04`, `03-05` | New providers appear in the service order configuration and can be reordered | ✓ SATISFIED | Registry contains both providers; Settings derives the order dynamically; 03-05 tests verify multiline four-provider layout, zh/en readability, and pointer drag persistence |
| `NPROV-04` | `03-01`, `03-02`, `03-03`, `03-04` | New providers use the same `SnapshotStatus` enum and visual treatment as existing providers | ✓ SATISFIED | Shared Rust `SnapshotStatus`, shared command conversion, shared `PanelView` placeholder handling, and shared `ServiceCard` quota rendering |
| `NPROV-05` | `03-01`, `03-02`, `03-03`, `03-04` | If a provider API is unreachable or undocumented, the UI shows a clear "not available" state | ✓ SATISFIED | Kimi/GLM loaders return explicit status variants on missing credentials, auth errors, rate limits, proxy failures, and transient failures; `PanelView` + `getPlaceholderCopy()` render non-blank placeholder cards |

No orphaned Phase 03 requirements found in `.planning/REQUIREMENTS.md`.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| --- | --- | --- | --- | --- |
| None | - | Targeted TODO/FIXME/stub scan found no phase-blocking placeholders in the verified Phase 03 artifacts | - | No blocker or warning found |

### Human Verification Required

None remaining. The user approved the real-surface service-order redesign, live Kimi runtime, live GLM runtime, token save/clear refresh loop, reset countdown presentation, and main-menu reopen responsiveness on 2026-04-01.

### Gaps Summary

No implementation gaps remain for Phase 03. The earlier service-order redesign concern was closed by `03-05`, and the later reset-countdown / reopen-responsiveness issues were fixed before final user approval. Phase 03 is complete and no additional human validation is required.

---

_Verified: 2026-04-01T13:19:47Z_
_Verifier: Claude (gsd-verifier)_
