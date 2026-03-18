# Research: Iteration 2 Codex Usage Limits

## Decision 1: Prioritize Codex usage limits over generic OpenAI API usage

- **Decision**: Scope Iteration 2 around Codex usage limits rather than general OpenAI API usage/costs.
- **Rationale**: The clarified spec and current Codex documentation point to user-visible “current usage limits” as the immediate product value. This aligns better with the tray-first goal of quickly checking remaining availability during coding sessions.
- **Alternatives considered**: Generic OpenAI API usage/costs were rejected because they would pull the feature toward broader platform analytics instead of the Codex-centric user workflow. Supporting both in the same iteration was rejected because it would expand data models and validation criteria before the local-session path is stable.

## Decision 2: Use the local Codex app-server rate-limit API as the first real data source

- **Decision**: Read live limit data from the locally installed Codex CLI through `codex app-server` and the structured `account/rateLimits/read` request in the native host layer.
- **Rationale**: Audit work for the installed CLI showed a stable JSON-RPC app-server protocol with typed `GetAccountRateLimitsResponse`, `RateLimitSnapshot`, and `RateLimitWindow` payloads. This is more robust than parsing `/status` text and still stays fully local-first.
- **Alternatives considered**: Parsing `/status` text was rejected as the primary path because it is less stable and harder to localize or test. Browser/dashboard scraping was rejected because it adds authentication, stability, and automation risk. Treating the dashboard as the primary source was rejected because it would weaken the desktop app's local-first architecture.
- **Implementation note**: The host now shells out to `codex app-server`, sends `initialize`, `initialized`, and `account/rateLimits/read`, and normalizes the structured response into panel dimensions. `AI_USAGE_CODEX_STATUS_TEXT` and `AI_USAGE_CODEX_STATUS_FILE` remain only as test/debug fallback when the Codex CLI is not available locally.

## Decision 3: Keep the user workflow centered on one active local Codex session

- **Decision**: Present Iteration 2 as a local Codex CLI status panel, not as a manual account-management flow.
- **Rationale**: Users expect the app to reflect the currently active Codex CLI session directly. Requiring account alias or credential placeholders in the primary UI creates confusion because those fields do not participate in real syncing.
- **Alternatives considered**: Exposing placeholder account forms in settings was rejected after implementation review because it suggested a credential-based setup path that does not exist in this iteration. Full multi-session live support was also rejected because it depends on session discovery work that is not required for the first real integration.

## Decision 4: Keep CLI execution and parsing inside the Rust host boundary

- **Decision**: Implement Codex CLI invocation, parsing, and normalization in `src-tauri`, then return a stable snapshot payload to the frontend.
- **Rationale**: This preserves a clean trust boundary. The frontend should render and manage user-facing state, but it should not own terminal command execution or raw CLI parsing.
- **Alternatives considered**: Frontend-side parsing was rejected because it would mix environment-specific execution concerns into the UI layer. Directly exposing raw CLI text to the frontend was rejected because it would create an unstable contract and make localization/error handling harder.
- **Implementation note**: The panel and settings page read only normalized snapshot payloads (`snapshotState`, `statusMessage`, `activeSession`, and limit rows). No UI code receives raw `/status` text or asks the user to provide manual Codex credentials.

## Decision 5: Model pending, disconnected, and failed states explicitly

- **Decision**: Represent “waiting for a readable local session”, “no active CLI session”, “parse failure”, and “last known snapshot stale” as distinct states in the host/UI contract.
- **Rationale**: The second iteration moves from demo data to real local state. Users need to know whether there is genuinely no active limit data or whether the app simply could not read it, without being told to create a synthetic account profile first.
- **Alternatives considered**: A single generic error state was rejected because it would not support actionable UI guidance. Silent fallback to old demo data was rejected because it would hide integration failures and undermine trust.
