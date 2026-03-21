# Feature Specification: Claude Code Session Recovery

**Feature Branch**: `007-session-recovery`
**Created**: 2026-03-22
**Status**: Draft
**Input**: User description: "Claude Code 401 会话过期后，应用无法自动恢复，需要建模为'会话待恢复'过渡态，保留缓存数据，通过现有刷新周期自动探测恢复，并向用户展示产品化文案。"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Seamless Session Recovery After Token Expiry (Priority: P1)

A developer has been using AIUsage to monitor Claude Code quota throughout the day. They close their laptop overnight. The next morning, the Claude Code access token has expired. When they open the AIUsage panel, instead of seeing a blank panel with a technical error, they see their last-known quota data (marked as stale) with a friendly message that the session is being restored. After they open Claude Code (which refreshes the token), the next automatic refresh cycle picks up the valid token and the panel returns to showing live data — all without any manual intervention from the user.

**Why this priority**: This is the core problem. The current behavior (blank panel + technical error + no auto-recovery) directly contradicts the PRD goal of "zero-interruption quota awareness." This story alone, if implemented, resolves the primary user pain point.

**Independent Test**: Can be fully tested by simulating a 401 API response and verifying the panel retains cached data, shows the recovery message, and automatically restores on the next successful refresh.

**Acceptance Scenarios**:

1. **Given** the user previously had a successful quota fetch (cached data exists), **When** the next refresh returns HTTP 401, **Then** the panel displays the cached quota data with a "stale" indicator and a user-friendly recovery message.
2. **Given** the panel is in session-recovery state, **When** the next automatic refresh cycle runs and the API returns HTTP 200, **Then** the panel immediately updates to show fresh quota data and clears the recovery message.
3. **Given** the panel is in session-recovery state, **When** the user manually clicks the refresh button, **Then** the app attempts a fresh API call (not blocked by any pause state).

---

### User Story 2 - First-Time 401 Without Cached Data (Priority: P2)

A developer installs AIUsage and configures Claude Code for the first time. Their access token happens to be expired (e.g., they logged in to Claude Code weeks ago but haven't used it recently). On the very first fetch, the API returns 401 and there is no cached data to fall back on. The panel shows an empty state with a clear, non-technical message guiding them to open Claude Code to restore the session.

**Why this priority**: While less common than Story 1 (most users will have at least one successful fetch before encountering 401), this covers the cold-start edge case and ensures a good first impression.

**Independent Test**: Can be tested by starting with empty cache and simulating a 401 response, verifying the empty-state message is user-friendly and non-technical.

**Acceptance Scenarios**:

1. **Given** no cached quota data exists, **When** the first fetch returns HTTP 401, **Then** the panel shows a friendly empty state with a message like "Claude Code session is being restored. Open Claude Code to restore the session."
2. **Given** the panel is in this empty recovery state, **When** the automatic refresh runs and succeeds, **Then** the panel populates with live quota data seamlessly.

---

### User Story 3 - Recovery State Does Not Interfere with 429/403 Handling (Priority: P2)

A developer's session is in recovery state (401). During a recovery probe, the API returns 429 (rate limited) or 403 (access denied). The existing rate-limit cooldown and access-denied pause behaviors continue to work correctly and are not disrupted by the new session-recovery state.

**Why this priority**: Ensures no regression in existing error-handling logic. The three error states (401, 403, 429) must remain independently managed.

**Independent Test**: Can be tested by transitioning between session-recovery state and rate-limit/access-denied states, verifying each behaves according to its own rules.

**Acceptance Scenarios**:

1. **Given** the panel is in session-recovery state, **When** a recovery probe returns 429, **Then** the app enters rate-limit cooldown (existing behavior) and the session-recovery state is superseded by rate-limit state.
2. **Given** the panel is in session-recovery state, **When** a recovery probe returns 403, **Then** the app enters access-denied pause (existing behavior) and automatic refresh is halted.
3. **Given** the panel is in rate-limit cooldown, **When** the cooldown expires and the next refresh returns 401, **Then** the app enters session-recovery state (not access-denied or any other state).

---

### User Story 4 - User-Friendly Localized Messaging (Priority: P3)

All user-facing messages related to session recovery are presented in the user's chosen language (Chinese or English) using product-oriented language. No technical terms like "token," "keychain," "401," or "credentials" appear in any user-facing surface.

**Why this priority**: Important for polish and aligns with the PRD's i18n requirement, but the functional recovery behavior (Stories 1-3) is more critical to ship first.

**Independent Test**: Can be tested by switching language settings and verifying all session-recovery messages display correctly in both supported languages.

**Acceptance Scenarios**:

1. **Given** the app language is set to English, **When** the panel enters session-recovery state, **Then** the message reads in plain product language (e.g., "Claude Code session is being restored. It usually recovers after you open Claude Code.").
2. **Given** the app language is set to Chinese, **When** the panel enters session-recovery state, **Then** the message reads in localized Chinese (e.g., "Claude Code 会话恢复中，打开 Claude Code 后通常会自动恢复").

---

### Edge Cases

- What happens when the app starts and the very first credential read succeeds but the API call returns 401? The app enters recovery state with an empty (no-cache) variant of the recovery message — not a technical error.
- What happens when the user is in recovery state and changes proxy settings? The recovery state is cleared and a fresh attempt is made immediately (consistent with existing proxy-change-clears-pause behavior).
- What happens when the token expires again shortly after recovery? The app re-enters recovery state, preserving the most recent cached data from the brief successful window.
- What happens if multiple rapid 401 responses occur? The app does not increase API call frequency; the normal refresh interval governs probe frequency.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST treat HTTP 401 responses as a transient "session recovery" state, not a terminal failure.
- **FR-002**: System MUST preserve the most recent successfully-fetched quota data in cache when entering session-recovery state (401 MUST NOT clear the cache).
- **FR-003**: System MUST NOT block automatic refresh cycles during session-recovery state. The existing refresh interval serves as the recovery probe frequency.
- **FR-004**: System MUST display cached (stale) quota data during session-recovery state when cache is available, accompanied by a recovery-status indicator.
- **FR-005**: System MUST display a friendly empty-state message during session-recovery when no cached data is available.
- **FR-006**: System MUST automatically exit session-recovery state and display fresh data when a subsequent API call succeeds (HTTP 200).
- **FR-007**: System MUST allow manual refresh to bypass any pause state during session recovery (consistent with existing manual-refresh behavior for other pause states).
- **FR-008**: All user-facing messages for session-recovery MUST use product language without technical jargon. No references to tokens, keychains, HTTP status codes, or credential sources.
- **FR-009**: Session-recovery messages MUST be localized in all supported languages (English, Chinese).
- **FR-010**: Session-recovery state MUST be independent from rate-limit (429) and access-denied (403) states. Transitioning to one MUST NOT corrupt or interfere with the others.
- **FR-011**: When proxy settings are changed while in session-recovery state, the recovery state MUST be cleared and a fresh attempt MUST be made immediately.

### Key Entities

- **Session State**: Represents the current access condition of the Claude Code integration. States include: normal operation, session recovery (401), rate-limited (429), and access denied (403). Each state governs how automatic refresh behaves and what the user sees.
- **Stale Cache**: The most recently fetched quota dimensions, preserved across transient failures to maintain user visibility into their last-known quota.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: After a token expires and the user reopens Claude Code, the quota display recovers automatically within one refresh cycle (default 15 minutes, configurable) without any manual user action.
- **SC-002**: During session-recovery state, users always see either their last-known quota data (stale) or a clear recovery message — never a blank/empty panel with a technical error.
- **SC-003**: No user-facing message during session recovery contains technical terms (token, keychain, 401, credentials, OAuth).
- **SC-004**: Existing 429 rate-limit cooldown and 403 access-denied pause behaviors pass all current tests without regression after session-recovery changes are introduced.
- **SC-005**: The transition from session-recovery to normal state completes within a single refresh cycle once a valid token is available.
