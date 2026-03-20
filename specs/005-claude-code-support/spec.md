# Feature Specification: Claude Code Service Support

**Feature Branch**: `005-claude-code-support`
**Created**: 2026-03-20
**Status**: Draft
**Input**: User description: "Add Claude Code AI service support: quota display for Claude Code subscriptions, user preference for which AI service to show in the menubar, and configurable display order of AI services in the main panel."

## Clarifications

### Session 2026-03-20

- Q: When "both services" are selected for the menubar, should the tray show a single merged metric or per-service pair? → A: No "both" option. The menubar preference is a single-selection from all configured services; the design must remain extensible as more AI services are added in the future.
- Q: When the Claude Code API fails with a non-429 error (timeout, 5xx, DNS failure), should the app show stale data or a distinct error state? → A: Same behavior as 429 — show last cached data with a "stale" indicator. All transient network failures are treated uniformly.
- Q: Should the OAuth token be re-read from the host credential store on every refresh, or cached in-app memory? → A: Re-read from host on every refresh cycle. This ensures token renewals by the Claude Code CLI are picked up automatically.
- Q: What text should appear for each Claude Code quota dimension in the UI? → A: `Claude Code / 5h`, `Claude Code / week`, `Claude Code / week (Sonnet)`, `Claude Code / week (Opus)` — consistent with the existing Codex label convention.
- Q: Can a user hide a service entirely from the panel, or are all services always shown? → A: No explicit disable — all configured services are always shown in the panel; unavailable ones display a "not connected" card.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - View Claude Code Quota in Main Panel (Priority: P1)

A user who subscribes to Claude Code (Max plan) wants to see how much of their quota they have remaining across different time windows, just as they can for Codex. They open the app's main panel and see Claude Code's quota dimensions listed alongside (or instead of) Codex.

**Why this priority**: This is the core value of the feature — without quota visibility, there is nothing else to configure or order.

**Independent Test**: Can be tested by configuring a valid Claude Code credential on the host machine, launching the app, and verifying that the main panel shows Claude Code quota dimensions with correct remaining percentages and reset times.

**Acceptance Scenarios**:

1. **Given** a user has a valid Claude Code subscription and credentials on their machine, **When** they open the main panel, **Then** they see one or more Claude Code quota dimensions (e.g., "5h window", "weekly all-models"), each showing a remaining percentage, a color-coded progress bar, and a reset time hint.
2. **Given** the Claude Code API returns `null` for a dimension (e.g., `seven_day_opus`), **When** the panel loads, **Then** that dimension is not shown — the UI does not display empty or placeholder rows.
3. **Given** the user's Claude Code credentials are missing or expired, **When** the panel loads, **Then** the Claude Code service card shows a clear, non-crashing "not connected" state with a hint to log in to Claude Code.
4. **Given** the Claude Code API call fails for any transient reason (HTTP 429, timeout, 5xx, network error), **When** the panel loads, **Then** the previous quota data is shown with a "stale" indicator rather than an error state.
5. **Given** the user has no Claude Code subscription (credentials exist but subscription is absent), **When** the panel loads, **Then** the Claude Code service card reflects unavailability without crashing.

---

### User Story 2 - Choose Which Service Appears in the Menubar (Priority: P2)

A user wants control over which AI service's quota is reflected in the macOS menubar indicator (tray title / badge). They go to Settings and select exactly one service from the list of configured services. The preference is designed to scale as more AI services are added to the app in the future.

**Why this priority**: The menubar is prime real estate on macOS. Users may primarily use one service and want the menubar to reflect only that one.

**Independent Test**: Can be tested independently by opening Settings, changing the menubar service preference, and confirming the tray icon title/badge updates to reflect the selected service's data.

**Acceptance Scenarios**:

1. **Given** the user selects "Codex" as the menubar service, **When** the tray is updated, **Then** the tray title/badge reflects Codex quota data only.
2. **Given** the user selects "Claude Code" as the menubar service, **When** the tray is updated, **Then** the tray title/badge reflects Claude Code quota data only.
3. **Given** the selected menubar service is unavailable (e.g., Claude Code not connected), **When** the tray is updated, **Then** the tray shows a neutral "not connected" indicator for that service rather than crashing or silently showing stale data.

---

### User Story 3 - Reorder AI Services in the Main Panel (Priority: P3)

A user who uses both Codex and Claude Code wants to control the order in which the two service cards appear in the main panel. They use a preference in Settings to place their primary service first.

**Why this priority**: Display order is a usability enhancement on top of the core quota visibility. It delivers value only once both services are shown.

**Independent Test**: Can be tested by enabling both services, reordering them in Settings, and confirming that the panel renders the service cards in the new order on the next load.

**Acceptance Scenarios**:

1. **Given** both Codex and Claude Code are visible in the panel, **When** the user changes the display order in Settings to put Claude Code first, **Then** the main panel renders Claude Code's card above Codex's card on the next panel open.
2. **Given** the user has set a custom order but one service becomes unavailable, **When** the panel loads, **Then** the available service is always prominently visible; the unavailable service card is shown in a "not connected" state at its configured position.

---

### Edge Cases

- What happens when both Codex and Claude Code credentials are missing? → The panel shows both service cards in a "not connected" state; the tray shows a neutral indicator.
- What happens when the Claude Code API is slow to respond? → The panel shows a loading/pending state for that service card while Codex data may already be displayed.
- What happens when a user has `CLAUDE_CONFIG_DIR` set to a non-default path? → The credential lookup must handle the resulting keychain service name suffix variation on macOS.
- What happens if the Claude Code API returns a `utilization` value outside the 0–100 range? → The UI clamps the displayed percentage to 0–100 and does not crash.
- What happens when the Claude Code `five_hour` window resets during an active session? → The new remaining percentage is fetched on the next scheduled refresh; no special handling is needed.

## Requirements *(mandatory)*

### Functional Requirements

**Claude Code Quota Reading**

- **FR-001**: The app MUST read the Claude Code OAuth access token from the host machine on every refresh cycle, checking (in order): the `CLAUDE_CODE_OAUTH_TOKEN` environment variable, the macOS system keychain (service name `Claude Code-credentials`), and the fallback credentials file (`~/.claude/.credentials.json` on Linux/Windows). The token MUST NOT be cached in-app memory between refresh cycles, so that token renewals made by the Claude Code CLI are picked up automatically.
- **FR-002**: The app MUST call the Claude Code usage API and retrieve quota utilization across available dimensions (`five_hour`, `seven_day`, `seven_day_sonnet`, `seven_day_opus`).
- **FR-003**: The app MUST convert API `utilization` values (percentage already used) into remaining percentages (`100 − utilization`) for display, matching the convention used for Codex.
- **FR-004**: Quota dimensions returned as `null` by the API MUST be omitted from display entirely.
- **FR-005**: The app MUST apply the same color-coded progress-bar logic used for Codex to Claude Code dimensions (green > 50%, amber 20–50%, red < 20%, gray when unavailable).
- **FR-006**: Each Claude Code quota dimension MUST display its label and a reset time hint localized using the existing i18n system. Dimension labels MUST follow the convention: `Claude Code / 5h` (five_hour), `Claude Code / week` (seven_day), `Claude Code / week (Sonnet)` (seven_day_sonnet), `Claude Code / week (Opus)` (seven_day_opus). Reset hints are derived from the API's `resets_at` field.
- **FR-007**: When the Claude Code API call fails for any transient reason (HTTP 429, timeout, 5xx, DNS failure), the app MUST surface the previously cached quota data with a visible "stale" indicator. Only authentication failures (HTTP 401/403) transition the card to the "not connected" state.
- **FR-008**: When Claude Code credentials are absent, expired, or invalid, the Claude Code service card MUST display a clear "not connected" state without crashing.

**Menubar Service Preference**

- **FR-009**: The app MUST provide a user-configurable preference for selecting exactly one AI service to drive the menubar indicator. The preference is a single-selection from the list of configured services (e.g., Codex, Claude Code), and must remain extensible as future services are added.
- **FR-010**: When the selected menubar service is unavailable (not connected or credentials missing), the tray MUST show a neutral "not connected" indicator for that service — it MUST NOT silently show stale data or crash.
- **FR-011**: Changes to the menubar service preference MUST take effect without requiring an app restart.

**Panel Display Order**

- **FR-013**: The app MUST provide a user-configurable preference for the order in which AI service cards appear in the main panel.
- **FR-014**: The default display order MUST be: Codex first, Claude Code second (preserving backward compatibility for existing users).
- **FR-015**: All configured services are always shown in the panel. There is no per-service enable/disable toggle. If a service is unavailable or not connected, its card MUST remain visible at its configured position in a "not connected" state rather than being silently hidden.

### Key Entities

- **ClaudeCodeCredential**: Represents the OAuth access token and its metadata (expiry, subscription type) read from the host system. Read-only from the app's perspective; sourced from the host credential store or environment variable.
- **ClaudeCodeQuotaDimension**: A single usage window (e.g., "5-hour", "7-day all models") with a remaining percentage, color tone, and reset hint. Structurally equivalent to a Codex quota dimension.
- **ServiceDisplayPreference**: User preference controlling which single service drives the menubar indicator (single-selection, extensible to N services) and the ordered list of service cards shown in the main panel.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user with valid Claude Code credentials can see their quota remaining percentages in the main panel within one refresh cycle of opening the app, with no additional configuration beyond having credentials on the machine.
- **SC-002**: A user can change the menubar service preference in Settings and see the tray indicator update within 3 seconds, without restarting the app.
- **SC-003**: A user can change the panel service order in Settings and see the new order reflected the next time the panel is opened.
- **SC-004**: When Claude Code credentials are absent, the app remains fully functional for Codex — no regressions in Codex quota display, tray behavior, or refresh cycle.
- **SC-005**: The Claude Code quota API is called no more frequently than the user's configured global refresh interval (default 15 minutes), avoiding rate-limit errors under normal usage.

## Scope

**In scope**:
- Reading Claude Code quota data from the Anthropic usage API using stored OAuth credentials
- Displaying Claude Code quota dimensions in the main panel alongside Codex
- User preference for which service drives the menubar indicator
- User preference for the order of service cards in the main panel
- Localization of Claude Code dimension labels and reset hints using the existing i18n system

**Out of scope**:
- Logging in to Claude Code or managing OAuth tokens within this app
- Displaying Claude Code conversation history or session details
- Windows or Linux native keychain/credential-manager integration (file-based fallback covers those platforms)
- Notifications triggered by Claude Code quota thresholds
- Automatic token refresh or re-authentication flows

## Assumptions

- The app runs on macOS as its primary target; Linux and Windows are supported via the file-based credential fallback.
- Claude Code credentials are managed externally by the Claude Code CLI; this app is read-only with respect to those credentials.
- The `utilization` field in the Claude Code API always represents percentage already used (0–100 scale).
- A `null` dimension in the API response means the user's subscription does not include that model/window — it should not be shown.
- The existing quota dimension data structure in the backend is compatible with Claude Code data without schema changes.
- The refresh interval for Claude Code quota is shared with (or no shorter than) the global app refresh interval to avoid API rate limiting.
- Users who have not installed Claude Code will see a "not connected" Claude Code card; there is no requirement to detect whether the Claude Code CLI is installed.
