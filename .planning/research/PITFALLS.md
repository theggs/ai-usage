# Domain Pitfalls

**Domain:** AI coding quota tracker — provider extensibility, Chinese service integrations, smart alerts, license audit
**Researched:** 2026-03-31
**Confidence:** HIGH (all findings grounded in actual codebase state; no external sources required)

---

## Critical Pitfalls

Mistakes that cause rewrites, user-visible regressions, or ship blockers.

---

### Pitfall 1: Service IDs Hardcoded in Five Places — Adding a Provider Misses At Least One

**What goes wrong:** `"codex"` and `"claude-code"` are not managed from one source of truth. They appear as literals in:
- `KNOWN_SERVICE_IDS: [&str; 2]` in `src-tauri/src/state/mod.rs` (line 37)
- `KNOWN_MENUBAR_SERVICES: [&str; 3]` in `src-tauri/src/state/mod.rs` (line 38)
- `const KNOWN_SERVICE_IDS = ["codex", "claude-code"] as const` in `src/lib/persistence/preferencesStore.ts` (line 37)
- `const SERVICE_IDS = ["codex", "claude-code"] as const` in `src/lib/tauri/summary.ts` (line 37)
- `MenubarService` type union in `src/lib/tauri/contracts.ts` (line 2)
- Normalization defaults (fall-through to `"codex"`) in both Rust and TypeScript normalizers

Adding `"kimi-code"` to one list without the others causes silent validation rejection. The normalizer will silently strip the new service ID from `serviceOrder` because it does not appear in `KNOWN_SERVICE_IDS`. The user sees the service disabled with no error.

**Why it happens:** The original design hardcoded two known services. Each site that validates or defaults was written independently.

**Consequences:** New provider is accepted by the UI but silently stripped from `serviceOrder` on save. Auto-menubar rotation ignores the provider. Preferences written with the new service ID get corrupted on load.

**Prevention:**
- Define a single Rust `const KNOWN_SERVICE_IDS` and derive everything from it (pass to TypeScript via a Tauri command, or regenerate at build time).
- Or: introduce a Provider Registry struct that owns the canonical list and make every validation site consume it rather than inline constants.
- Add a test that asserts the Rust and TypeScript `KNOWN_SERVICE_IDS` arrays are identical at the contract boundary.

**Warning signs:** New provider does not appear in Settings after enabling. `serviceOrder` in preferences.json does not contain the new ID. No compilation error — failure is silent at runtime.

**Phase mapping:** Provider Descriptor Registry phase must resolve this before adding any new provider. Attempting to add Kimi Code without fixing this guarantees silent preference corruption.

---

### Pitfall 2: Preference Normalization Duplicated Across Rust and TypeScript — Schema Drift on Migration

**What goes wrong:** `normalizePreferences` is implemented independently in:
- Rust: `src-tauri/src/state/mod.rs` (lines 270–306)
- TypeScript: `src/lib/persistence/preferencesStore.ts` (`normalizePreferences`, lines 77–129)

Every new provider requires a new per-provider enabled flag (like `claude_code_usage_enabled`). Each flag needs a default, a normalization rule, and a fallback. Because the two normalizers are written in two languages with no shared schema, a field added in Rust but missed in TypeScript causes the frontend to overwrite the backend's value with `undefined` on the next preferences save. Conversely, a TypeScript-only field is silently discarded when Rust deserializes the file.

**Why it happens:** There is currently no contract test that verifies both normalizers accept and produce the same field shapes.

**Consequences:** New per-provider enable flag defaults to `false` on Rust side but `undefined` on TypeScript side. On the first save-from-UI, TypeScript omits the field. Rust reads the file and falls back to `false`. New provider silently stays disabled. No error, no panic.

**Prevention:**
- For each new provider flag: add it to both normalizers in the same commit.
- Add a round-trip integration test: serialize preferences with the new field from Rust, deserialize in TypeScript, re-serialize, deserialize in Rust, assert field survives unchanged.
- Longer term: consider having TypeScript always defer to Rust normalization (fire a Tauri command that returns the normalized struct rather than normalizing client-side).

**Warning signs:** Provider enable toggle in Settings does not persist across app restarts. Preferences.json contains the field but app shows it as disabled.

**Phase mapping:** Provider Descriptor Registry phase. Any phase that adds a provider enable flag (Kimi Code, GLM Coding Plan) is blocked by this.

---

### Pitfall 3: Chinese AI Service APIs Are Undocumented — Integration May Require Reverse Engineering

**What goes wrong:** Kimi Code and GLM Coding Plan are newer Chinese AI coding assistants. Their usage/quota APIs are not publicly documented in the same way that Anthropic's OAuth API is. Integration may require one or more of:
- Capturing HTTP traffic from the official desktop client
- Parsing CLI output rather than calling a stable API
- Relying on unofficial API endpoints that change without notice

Claude Code's `anthropic-beta: oauth-2025-04-20` header already indicates that even Anthropic's own quota API is experimental. Kimi/GLM are likely more fragile.

**Why it happens:** Chinese AI service providers typically release user-facing products before developer APIs. Quota data is often embedded in dashboard web apps, not exposed as machine-readable endpoints.

**Consequences:**
- Integration requires a research spike before any implementation can start.
- If the only available source is CLI stdout parsing, the integration breaks on every upstream version bump.
- If the source is a web endpoint, CORS or auth headers may change without warning.
- A provider that cannot produce reliable data will show as `TemporarilyUnavailable` permanently — worse UX than not showing it at all.

**Prevention:**
- Treat Kimi Code and GLM Coding Plan as research-gated work items. Do not start implementation until the fetch strategy is confirmed.
- Design the Multi-Strategy Fetch Pipeline with a "probe-and-fall-back" pattern: if the preferred endpoint fails, try an alternative, then return `NoData` cleanly rather than `TemporarilyUnavailable`.
- Add a `dataSource` field to `PanelPlaceholderItem` that distinguishes `"api"` from `"cli"` from `"scrape"` so users can see how fragile the data is.

**Warning signs:** No official API documentation found after 2 hours of research. Only sources are community reverse-engineering threads.

**Phase mapping:** Kimi Code and GLM Coding Plan integration phases each need a research sub-task ("confirm fetch strategy") before any code is written. Block implementation on a confirmed strategy.

---

### Pitfall 4: Backward-Compatibility Break When Migrating Codex and Claude Code Into the Provider Abstraction

**What goes wrong:** Existing `get_codex_panel_state` and `get_claude_code_panel_state` Tauri commands return `CodexPanelState` structs. The frontend references these by command name and field name across multiple files. If the Provider Descriptor Registry refactor renames or restructures these commands, old snapshot-cache.json files from before the migration contain the old format. On app upgrade, the cache deserialization silently fails (returns `Default` because `serde_json` returns `None` on parse error) and users see an empty panel on first launch after upgrade — the cache that was supposed to give a fast start is gone.

**Why it happens:** The cache format and command surface are tightly coupled to the current two-provider naming scheme. There is no versioning on `snapshot-cache.json`.

**Consequences:**
- Every user upgrading to the provider-registry version loses their cached quota data on first launch.
- If the Tauri command name changes, the frontend panics on invoke (Tauri returns an error for unknown commands; the frontend may not handle it gracefully).
- Session recovery state for Claude Code is held in a module-level `OnceLock<Mutex<PauseState>>`. If the module is reorganized under a provider registry, that static state must be migrated or it will reset on every provider lookup.

**Prevention:**
- Keep the existing Tauri command names and response shapes stable during the refactor. Internally restructure the Rust code to use the Provider trait without changing what crosses the IPC boundary.
- Add a `schema_version` field to `snapshot-cache.json` (even just `1`). On load, if version is missing or mismatched, discard cache gracefully rather than silently returning default.
- Test the upgrade path explicitly: write a snapshot-cache.json in the old format, upgrade to the refactored code, assert the cache is either migrated or discarded cleanly (not panicked).

**Warning signs:** After the provider registry refactor, panel shows "No data" on first launch but data appears after first manual refresh. Rust logs show `Error: Unknown command "get_codex_panel_state"`.

**Phase mapping:** Provider Descriptor Registry phase. This is the highest-risk refactor in the milestone.

---

### Pitfall 5: Time-Aware Alert Thresholds Depend on `resetsAt` Which Is Often Missing or Wrong

**What goes wrong:** The current threshold logic (`>50%` green, `20-50%` amber, `<20%` red) works purely on `remainingPercent` and never needs `resetsAt`. The proposed time-aware alerts ("80% remaining with 4h left is fine; 10% remaining with 4h left is not") require a reliable reset timestamp. Looking at the actual Codex and Claude Code data:

- Codex's `resets_at` field in `RateLimitWindow` is `Option<i64>` — it can be `None`.
- Claude Code's `resets_at` is a string from the API response, but clock skew between the API server and the user's machine means the calculated "time until reset" can be negative or unexpectedly large.
- When `resets_at` is `None`, the time-aware formula has no denominator and must fall back to the current absolute-percentage logic.

If the fallback is not explicitly designed, time-aware alerts will show misleading severity when reset time is unknown — either always-red (no reset time means "imminent") or always-green (missing time treated as "far future").

**Why it happens:** The burn rate / pace forecasting formula (`remaining / rate`) requires both the current consumption rate and the time window. Neither is directly available — they must be inferred from snapshots over time, which requires storing historical data points. The current codebase stores only the most recent snapshot.

**Consequences:**
- Alert thresholds appear broken for providers that don't return `resets_at`.
- Burn rate computation returns `Infinity` or `NaN` for freshly-launched sessions with no prior data point.
- Users on Kimi Code or GLM (whose API format is unknown) may get perpetually incorrect alert levels if reset time is not exposed.

**Prevention:**
- Design the time-aware threshold logic with an explicit three-path decision: (1) `resetsAt` known and `remainingPercent` known → time-aware calculation; (2) `remainingPercent` known but no `resetsAt` → fall back to current absolute-percentage logic; (3) neither known → show muted/unknown state.
- For burn rate: store a rolling window of 2-3 `(timestamp, remainingPercent)` pairs per provider in the snapshot cache. This requires only a small schema addition. Without it, burn rate is only computable within a single session (not across app restarts).
- Unit test all three paths with explicit fixture data including `resetsAt: null` and `resetsAt: past_timestamp`.

**Warning signs:** Tray icon shows red immediately after launch even with 90% quota remaining. Burn rate ETA shows "00:00" or "∞" in the UI.

**Phase mapping:** Time-aware warning thresholds phase and Burn rate / pace forecasting phase. Both phases should be designed together to share the same fallback path.

---

## Moderate Pitfalls

Mistakes that degrade UX or require a targeted fix but do not require a rewrite.

---

### Pitfall 6: License Audit Discovers a Copyleft Rust Crate After Build Is Done

**What goes wrong:** The current Rust dependency tree pulls in `rusqlite` with bundled SQLite (a permissive license). But as new providers are added, their authentication strategies may require additional crates. If a new crate has an LGPL or GPL dependency (e.g., some cryptography or TLS crates have GPL-licensed test dependencies that get bundled), the audit done at the last minute blocks the About page's license list.

The `cargo-license` and `cargo-deny` tools exist to catch this, but they are not currently in the CI pipeline (no `.github/workflows/` found in the codebase). A manual audit done once at the start of the milestone may miss crates added in later phases.

**Why it happens:** Rust's transitive dependency graph is deep. A crate added for a narrow purpose (e.g., HMAC signing for a new provider's auth) can pull in 20+ transitive dependencies, any of which may have license concerns.

**Prevention:**
- Run `cargo deny check licenses` at the start of the milestone to establish a baseline.
- Add a `deny.toml` that explicitly allowlists acceptable licenses (MIT, Apache-2.0, BSD-2/3-Clause, ISC) and blocklists GPL variants.
- Re-run after each new crate is added. Do not save this for the About page phase.
- For npm: `license-checker --summary --excludePrivatePackages` at the same cadence.

**Warning signs:** `cargo deny check` shows "license not found" or "GPL-2.0" for any dependency. `cargo tree` shows unexpected new crates after adding a provider auth helper.

**Phase mapping:** Run the baseline audit during the Provider Descriptor Registry phase (before any new crates are added). Re-run during each new provider integration phase. About page phase should be a final confirmation, not the first audit.

---

### Pitfall 7: `SnapshotStatus` Enum Cannot Be Extended Without Updating Every Match Site

**What goes wrong:** `SnapshotStatus` is serialized with `#[serde(tag = "kind")]`. The TypeScript side mirrors it as a discriminated union. Every `match`/`switch` on this type must handle all variants. The frontend's `statusToConnectionState` and `statusToPrimaryMessage` in `summary.ts` already have a default arm, which means a new variant from a new provider's error state (e.g., `ApiKeyExpired` specific to Kimi Code) will be silently mapped to `"Not connected"` instead of giving a useful message.

**Why it happens:** The `default` arms in the TypeScript switch statements were added for safety, but they prevent TypeScript from flagging unhandled cases at compile time. There is no exhaustiveness check enforced.

**Prevention:**
- Before adding new `SnapshotStatus` variants, grep all match/switch sites: `statusToConnectionState`, `statusToPrimaryMessage`, `getSnapshotMessage` in i18n, and any test fixtures that serialize a status.
- To restore exhaustiveness: replace `default` arms in TypeScript switches with an explicit never check: `const _: never = status; return "fallback"`. This makes the TypeScript compiler flag new unhandled variants.
- Document in the snapshot.rs comment: "all new variants must be handled in summary.ts and i18n.ts before merging."

**Warning signs:** New provider returns an error state but the panel shows generic "Not connected" with no actionable message. TypeScript does not produce a type error when the variant is added.

**Phase mapping:** Provider Descriptor Registry phase (when adding new fetch error states). Also relevant to each new provider integration phase.

---

### Pitfall 8: Proxy Resolution Is macOS-Only — New Providers Fail Silently on Windows

**What goes wrong:** The `get_macos_system_proxy()` fallback in `src-tauri/src/claude_code/mod.rs` calls `scutil --proxy`, which is a macOS-only command. The project constraint says all new code must work on macOS and Windows. If new providers reuse the existing proxy resolution logic (which is embedded in the `claude_code` module), Windows users behind a corporate proxy will get `ProxyInvalid` errors from the new providers even though their proxy is configured correctly in Windows settings.

**Why it happens:** The proxy resolution code was written to solve a specific macOS problem (GUI apps not inheriting shell env vars) and lives inside the `claude_code` module rather than a shared utility.

**Consequences:** New providers on Windows silently fail to reach their endpoints when behind a proxy. User sees `TemporarilyUnavailable` with no actionable explanation.

**Prevention:**
- When extracting the shared provider fetch pipeline, move proxy resolution to a shared `network` module.
- Add a Windows equivalent: `netsh winhttp show proxy` or reading `HKCU\Software\Microsoft\Windows\CurrentVersion\Internet Settings` for proxy settings.
- Add a test fixture that simulates proxy detection on both platforms.

**Warning signs:** New provider works on macOS but shows network errors on Windows. `ProxyInvalid` appears in logs without user having set a manual proxy.

**Phase mapping:** Multi-Strategy Fetch Pipeline phase. The proxy resolution must be generalized before it is shared across providers.

---

### Pitfall 9: Burn Rate Calculation Produces Misleading Output for Long Reset Windows

**What goes wrong:** Kimi Code and GLM Coding Plan may use monthly reset windows (common in Chinese AI service pricing). The current codebase's burn rate label inference (`inferWindowMinutes` in `summary.ts`) handles `5h` and `week/7d` windows but has no concept of monthly windows. A monthly window parsed as "unknown" gets sorted to the back or treated as `Number.MAX_SAFE_INTEGER` minutes, causing it to never appear in `window-5h` or `window-week` summary modes and to produce an incorrect burn rate ETA.

**Why it happens:** The window duration inference was designed around the two known Codex windows (5-hour and weekly). Monthly windows from Chinese providers were not in scope.

**Prevention:**
- Extend `inferWindowMinutes` to handle `30d`, `month`, and `monthly` patterns before adding providers that use monthly resets.
- Add a `windowDurationMinutes` field to `QuotaDimension` at the Rust layer (populated by each provider) rather than inferring from the label string. This makes the label display-only and avoids label-parsing bugs.
- Test `inferWindowMinutes` with `"30d"`, `"monthly"`, `"月"` (Chinese), and empty labels.

**Warning signs:** Monthly-window provider shows zero seconds remaining in burn rate ETA. Summary mode `window-5h` falls through to `sorted[0]` fallback when monthly provider is the only one configured.

**Phase mapping:** Burn rate / pace forecasting phase. Also relevant when adding Kimi Code and GLM Coding Plan if they use monthly windows.

---

## Minor Pitfalls

Mistakes that are easy to fix but easy to introduce when moving fast.

---

### Pitfall 10: About Page License List Goes Stale Immediately

**What goes wrong:** If the About page renders a hard-coded license list (copy-pasted from `cargo license` output), it diverges from reality as soon as a new crate is added. Users who check licenses for compliance will see an outdated list.

**Prevention:** Generate the license list at build time from `cargo license --json` and embed it as a build artifact. Read from the artifact at runtime rather than hard-coding. Alternatively, link to a `LICENSES` file that is updated by CI before each release.

**Phase mapping:** About page phase.

---

### Pitfall 11: `claudeCodeUsageEnabled` Anti-Pattern Repeats for Each New Provider

**What goes wrong:** Claude Code added a per-provider `claudeCodeUsageEnabled` preference flag because it requires an extra disclosure step (API calls external servers). If Kimi Code and GLM Coding Plan are implemented the same way, the preferences schema accumulates `kimiCodeUsageEnabled`, `glmCodingPlanUsageEnabled`, etc. Each flag requires its own disclosure dialog, its own normalization rule in two languages, its own test, and its own migration path.

**Why it happens:** The enable/disable pattern was designed for one service. There is no generic "per-provider enabled" mechanism.

**Prevention:**
- Design a generic `providerEnabled: Record<string, boolean>` map in `UserPreferences` as part of the Provider Descriptor Registry phase.
- Migrate `claudeCodeUsageEnabled` to `providerEnabled["claude-code"]` in the same phase (with backward-compatible migration).
- Each provider descriptor declares whether it requires a disclosure step; the disclosure UI is driven by that flag, not by provider-specific code.

**Phase mapping:** Provider Descriptor Registry phase. Must be designed before adding the second new provider to avoid the proliferating-flags anti-pattern.

---

### Pitfall 12: `OnceLock<Mutex<PauseState>>` Pattern Per Provider Does Not Scale

**What goes wrong:** `claude_code/mod.rs` uses a module-level `OnceLock<Mutex<PauseState>>` to hold session recovery and rate-limit state between refresh cycles. This is a module-level static — fine for one provider, but if Kimi Code and GLM Coding Plan each add their own module-level static, the state management spreads across four separate module files with no central visibility.

**Consequences:** Debugging rate-limit or session-recovery behavior requires knowing which module holds which static. There is no way to inspect all provider pause states in one place. Tray icon logic that needs to know "are any providers rate-limited?" must query each module individually.

**Prevention:**
- Move provider runtime state (pause state, stale cache) into the `AppState` struct under a `HashMap<String, ProviderRuntimeState>` keyed by provider ID.
- This is also the prerequisite for showing per-provider connection status in the Settings view.

**Phase mapping:** Provider Descriptor Registry phase, as part of the AppState extension.

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Provider Descriptor Registry | Service ID list diverges between Rust and TypeScript (Pitfall 1) | Single source-of-truth constant, tested at contract boundary |
| Provider Descriptor Registry | Per-provider enabled flags proliferate (Pitfall 11) | Generic `providerEnabled` map in preferences schema |
| Provider Descriptor Registry | Module-level pause state does not scale (Pitfall 12) | Move to `AppState.HashMap<provider_id, ProviderRuntimeState>` |
| Multi-Strategy Fetch Pipeline | Proxy resolution is macOS-only (Pitfall 8) | Generalize before sharing across providers |
| Codex + Claude Code migration | Cache format breaks on upgrade (Pitfall 4) | Schema version on snapshot-cache.json; keep command names stable |
| Codex + Claude Code migration | Preference normalization drift (Pitfall 2) | Dual-side update with round-trip test |
| Kimi Code integration | API may be undocumented (Pitfall 3) | Research spike before implementation; confirmed fetch strategy required |
| GLM Coding Plan integration | API may be undocumented (Pitfall 3) | Same as Kimi; monthly reset window likely (Pitfall 9) |
| Time-aware thresholds | `resetsAt` missing or wrong (Pitfall 5) | Three-path fallback design; unit tests for null reset time |
| Burn rate forecasting | No historical data available (Pitfall 5) | Store rolling 2-3 data points in snapshot cache |
| Burn rate forecasting | Monthly windows not handled (Pitfall 9) | Extend `inferWindowMinutes`; add `windowDurationMinutes` to contract |
| About page | License list goes stale (Pitfall 10) | Build-time generation; not hard-coded |
| About page | `SnapshotStatus` new variants unhandled (Pitfall 7) | Add exhaustiveness check before merge |
| All provider phases | License audit done too late (Pitfall 6) | Run `cargo deny check` after each new crate is added |

---

## Sources

All findings are grounded in direct codebase inspection:

- `src-tauri/src/state/mod.rs` — KNOWN_SERVICE_IDS, KNOWN_MENUBAR_SERVICES, UserPreferences schema, normalizePreferences (Rust)
- `src/lib/persistence/preferencesStore.ts` — KNOWN_SERVICE_IDS, normalizePreferences (TypeScript)
- `src/lib/tauri/summary.ts` — SERVICE_IDS, inferWindowMinutes, statusToConnectionState, statusToPrimaryMessage
- `src/lib/tauri/contracts.ts` — MenubarService type, UserPreferences interface
- `src-tauri/src/snapshot.rs` — SnapshotStatus enum design, serde(tag = "kind")
- `src-tauri/src/claude_code/mod.rs` — OnceLock<Mutex<PauseState>>, proxy resolution, credential priority
- `src-tauri/src/codex/mod.rs` — JSON-RPC integration, RateLimitWindow with Option<i64> resets_at
- `.planning/codebase/CONCERNS.md` — existing tech debt and fragile areas (cross-referenced for severity)
- `.planning/codebase/ARCHITECTURE.md` — data flow, error handling patterns, IPC command surface
- `.planning/codebase/INTEGRATIONS.md` — API details, credential sources, proxy detection strategy
- `.planning/research/codexbar-analysis.md` — multi-provider reference architecture from CodexBar (25 providers)
- `.planning/PROJECT.md` — milestone requirements and constraints
