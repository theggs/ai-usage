# Phase 3: New Providers - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-31
**Phase:** 03-new-providers
**Areas discussed:** API research strategy, Credential discovery, Unavailable state UX, Rollout approach, UI appearance, Manual credential input

---

## API Research Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Stub-first | Register provider with stub fetcher returning TemporarilyUnavailable | |
| Balance-as-proxy | Display credit balance with caveat if no quota API | |
| Skip until confirmed | Don't register until API is fully confirmed | ✓ |

**User's choice:** Skip until confirmed
**Notes:** Phase 3 scope is flexible — could ship zero, one, or two providers depending on research results.

### Research Confirmation Method

| Option | Description | Selected |
|--------|-------------|----------|
| Network capture | Intercept VS Code extension HTTP traffic | |
| Reverse-engineer extension | Read VS Code extension source code | |
| Both approaches | Extension source + network validation | |

**User's choice:** Other — "Why VS Code extensions?" User clarified that both providers have web dashboards, not just VS Code extensions.

### Research Source

| Option | Description | Selected |
|--------|-------------|----------|
| Web dashboard | Web portal shows usage/quota info | ✓ |
| VS Code extension UI | Extension shows stats in sidebar | |
| Don't know yet | Research should figure it out | |

**User's choice:** Web dashboard

### Research Method (revised)

| Option | Description | Selected |
|--------|-------------|----------|
| Dashboard API capture | User captures browser DevTools network traffic | ✓ |
| Claude researches independently | Researcher searches web for API docs | |

**User's choice:** Dashboard API capture

---

## Credential Discovery

| Option | Description | Selected |
|--------|-------------|----------|
| Browser session / cookies | Login via browser, extract session cookies | ✓ (initial report) |
| API key / token | Generate API key from dashboard | |
| OAuth flow | Access token + refresh token stored on disk | |
| Don't know yet | Research determines from captured traffic | |

**User's choice:** Browser session / cookies (but noted this is preliminary — research should confirm actual mechanism)

### Token Source (if manual input needed)

| Option | Description | Selected |
|--------|-------------|----------|
| User pastes token manually | Extract from DevTools, paste in app | |
| Read browser cookie store | App reads browser SQLite cookies | |
| Research first | Determine actual auth flow first | ✓ |

**User's choice:** Research first

---

## Unavailable State UX

| Option | Description | Selected |
|--------|-------------|----------|
| Existing pattern | Reuse SnapshotStatus-based cards (NoCredentials, TemporarilyUnavailable) | ✓ |
| Provider-specific guidance | Tailored message + setup instructions per provider | |
| Minimal with link | Provider name + status icon + Learn more link | |

**User's choice:** Existing pattern
**Notes:** Consistent across all providers, already localized.

---

## Rollout Approach

| Option | Description | Selected |
|--------|-------------|----------|
| Ship what's ready | Ship confirmed provider(s), defer others to 3.1 | ✓ |
| Wait for both | Phase 3 ships both or not at all | |

**User's choice:** Ship what's ready

---

## UI Appearance

### Card Style

| Option | Description | Selected |
|--------|-------------|----------|
| Identical cards | Same ServiceCard layout as existing providers | ✓ |
| Provider-colored accent | Same layout with subtle color accent per provider | |
| Custom card per provider | Different layout per provider | |

**User's choice:** Identical cards

### Tray Display

| Option | Description | Selected |
|--------|-------------|----------|
| Same format | Identical tray summary format as existing providers | ✓ |
| Exclude from tray initially | Panel only, no tray integration | |

**User's choice:** Same format

### Auto Menubar

| Option | Description | Selected |
|--------|-------------|----------|
| Manual only initially | Appear in manual selector, no auto-detection | ✓ |
| Full auto support | Research + implement activity signal detection | |

**User's choice:** Manual only initially

---

## Manual Credential Input

### Token Input Location

| Option | Description | Selected |
|--------|-------------|----------|
| Settings page field | Token input field per provider in Settings | ✓ |
| First-launch setup flow | Guided dialog on first enable | |
| You decide | Claude picks best approach | |

**User's choice:** Settings page field

### Token Storage

| Option | Description | Selected |
|--------|-------------|----------|
| preferences.json | Store alongside other settings | ✓ |
| System keychain | macOS Keychain / Windows Credential Manager | |
| Separate credentials file | New credentials.json | |

**User's choice:** preferences.json

---

## Claude's Discretion

- Provider module structure
- Error mapping from API errors to SnapshotStatus
- Settings UI layout for token input fields
- i18n keys and translations

## Deferred Ideas

- Auto-menubar activity detection for new providers (separate research needed)
- Provider-colored accents or custom card styling (decided against)
