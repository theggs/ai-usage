---
phase: 3
reviewers: [codex, claude]
reviewed_at: 2026-03-31T20:45:00+08:00
plans_reviewed: [03-01-PLAN.md, 03-02-PLAN.md]
---

# Cross-AI Plan Review — Phase 3

## Codex Review

### Summary (Plan 01)
The split between infrastructure/UI and HTTP implementation is reasonable. The main problem is sequencing: Plan 01 exposes new providers before they can truthfully fetch data, which may conflict with D-01. Stub fetchers returning NoCredentials are semantically wrong for "not available" — that state implies missing credentials, not "API unverified/unreachable."

### Summary (Plan 02)
Plan 02 is much closer to the actual phase goal. The credential-chain design, GLM percentage inversion, polymorphic number parsing, and provider-specific auth rules are all the right things to focus on. Remaining gaps are around shared error mapping, stale-cache behavior, and platform-selection rules.

### Strengths
- Good architectural fit with existing registry-driven model
- Separates schema/UI groundwork from fetch implementation
- Correctly captures highest-risk API details (GLM inversion, raw token auth, polymorphic numbers)
- TDD emphasis is appropriate for parser/mapping-heavy work

### Concerns
- **HIGH**: Registering Kimi/GLM in Wave 1 before real fetchers are ready conflicts with D-01
- **HIGH**: Stub fetchers returning NoCredentials are semantically wrong for "not available"
- **HIGH**: Reorderability may be incomplete if service-order UI is based on enabled providers only
- **HIGH**: HTTP status-to-SnapshotStatus mapping not explicitly defined for all codes
- **HIGH**: Proxy and timeout behavior not called out explicitly
- **MEDIUM**: provider_tokens migration defaults, empty-string handling, validation not described
- **MEDIUM**: Stale-cache behavior unspecified for transient failures
- **MEDIUM**: glm_platform needs deterministic selection logic
- **MEDIUM**: Kimi config parsing failure modes not described
- **LOW**: No redaction/no-logging constraints for tokens

### Suggestions
- Add a shared HTTP helper for timeout, proxy, auth header construction, response classification
- Gate provider visibility on passing fetcher tests rather than shipping stubs
- Add explicit test matrices for HTTP status codes (200/401/403/429/5xx/timeout)
- Define stale-data behavior for transient failures
- Specify credential-chain edge cases (blank env vars, malformed config files)

### Risk Assessment
Plan 01: **MEDIUM-HIGH** — sequencing risks
Plan 02: **MEDIUM** — right content but needs stronger error mapping definition

---

## Claude Review

### Summary (Plan 01)
A well-structured infrastructure plan that cleanly separates wiring from implementation. Registering stub providers returning NoCredentials is semantically correct for the intermediate state — users see "no token configured" rather than broken state. The plan correctly defers HTTP logic to Plan 02.

### Summary (Plan 02)
A thorough and technically detailed plan. The exhaustive behavior-driven test list and prominent flagging of GLM percentage inversion are excellent. The TDD approach is well-suited for parser-heavy work.

### Strengths
- Clean stub pattern returning NoCredentials is semantically correct for intermediate state
- Comprehensive interface section with exact struct definitions eliminates guesswork
- Password input type for token fields — correct security posture
- Exhaustive behavior-driven test list with named edge cases
- GLM percentage inversion prominently flagged as CRITICAL
- Polymorphic number handling is pragmatic
- Data envelope fallback handles API evolution gracefully

### Concerns
- **MEDIUM**: resolve_proxy() extraction is ambiguous — where does it live after extraction?
- **MEDIUM**: No rate limiting/backoff for repeated failures (e.g., invalid token producing 401s)
- **MEDIUM**: Kimi config.json fallback structure unclear (CLI may rename to .bak)
- **LOW**: Kimi percentage could exceed 100 if remaining > limit (add .min(100))
- **LOW**: GLM usage_pct as NaN/infinity would produce unpredictable results (clamp input)
- **LOW**: No timeout test case
- **LOW**: provider_tokens patch is replace-all, not merge — risk of wiping other tokens
- **LOW**: Large number formatting (750000/1000000 vs 750K/1M)

### Suggestions
- Extract resolve_proxy in Plan 01, not Plan 02 — shared utility module
- Clamp Kimi remaining_percent to 0..=100 (match GLM pattern)
- Clamp GLM usage_pct input: `.clamp(0.0, 100.0)` before inversion
- Add whitespace trimming for token values in normalizePreferences
- Clarify provider_tokens patch semantics (replace-all vs merge)
- Note seed_stale_cache as follow-up for new providers
- Add manual verification for tray summary format

### Risk Assessment
Plan 01: **LOW** — straightforward wiring with well-understood patterns
Plan 02: **MEDIUM** — external API behavior and proxy extraction are main risks

---

## Consensus Summary

### Agreed Strengths
- **Architecture fit**: Both reviewers agree the plans fit the existing registry-driven model well (2/2)
- **Wave separation**: Clean split between infrastructure (Wave 1) and HTTP fetch (Wave 2) is correct (2/2)
- **GLM critical details**: Both highlight that percentage inversion, raw token auth, and polymorphic numbers are well-addressed (2/2)
- **TDD approach**: Both endorse test-driven development for parser-heavy provider modules (2/2)
- **Token storage with password type**: Both note correct security posture for API key display (2/2)

### Agreed Concerns
- **resolve_proxy extraction**: Both flag that the shared proxy resolution function needs explicit extraction plan (2/2, MEDIUM)
- **Credential edge cases**: Both want more definition around blank env vars, malformed config files, empty tokens (2/2, MEDIUM)
- **Stale-cache / failure behavior**: Both note that transient failure handling is underspecified for new providers (2/2, MEDIUM)
- **Value clamping**: Both suggest clamping percentage values to prevent edge case overflow (2/2, LOW)

### Divergent Views
- **Stub semantics**: Codex rates NoCredentials stubs as HIGH concern (semantically wrong for "not available"); Claude rates it LOW (semantically correct for intermediate state). **Investigation note**: The stubs only exist between Wave 1 and Wave 2 execution — users never see them in a released build. However, if the app is used during development with only Wave 1 applied, the concern has merit. The plans should clarify this is a transient development state.
- **Plan 01 risk**: Codex rates MEDIUM-HIGH (sequencing concerns); Claude rates LOW (straightforward wiring). The difference reflects Codex's focus on user-visible intermediate states vs Claude's focus on final delivered state.
- **Provider visibility gating**: Codex wants providers hidden until fetchers pass tests; Claude accepts early registration as infrastructure wiring. Given that providers default to disabled (default_enabled: false), users won't see them unless they explicitly enable them — reducing the practical risk of the early registration approach.
