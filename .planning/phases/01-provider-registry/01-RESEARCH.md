# Phase 1: Provider Registry - Research

**Researched:** 2026-03-31
**Domain:** Rust + TypeScript registry pattern, frontend state generalization, preferences migration
**Confidence:** HIGH

## Summary

Phase 1 replaces five hardcoded service-ID lists with a single `ProviderDescriptor` registry in Rust, mirrors it in TypeScript, and migrates the frontend from per-service state variables (`panelState` + `claudeCodePanelState`) to a dynamic `Map<string, CodexPanelState>`. The snapshot cache gains a `schema_version` field for graceful upgrade handling.

The codebase is well-structured for this refactor. The existing `CodexPanelState` struct is already generic (not Codex-specific despite its name), and `SnapshotStatus` is a shared tagged union. The main challenge is the big-bang frontend state migration: AppShell, PanelView, SettingsView, panelController, and summary utilities all reference per-service fields that must switch to map-based lookups simultaneously. The Rust side is simpler since the snapshot cache already uses `HashMap<String, CodexPanelState>`.

**Primary recommendation:** Define the Rust registry as a `const` static slice of `ProviderDescriptor` structs. Mirror in TypeScript as a frozen array. Migrate frontend state in a single coordinated change across all consumers. Add `schema_version: 1` to the snapshot cache struct.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Use a static struct array (`const PROVIDERS: &[ProviderDescriptor]`) with compile-time fixed entries and enum dispatch. No trait objects, no heap allocation. Matches CodexBar's approach and existing codebase idioms.
- **D-02:** Big bang migration: replace `panelState` + `claudeCodePanelState` with `Map<string, CodexPanelState>` in AppStateValue in this phase. Touches AppShell, PanelView, SettingsView. All consumers switch at once.
- **D-03:** Preferences migration: preserve existing `serviceOrder` entries and append new providers at the end. Unknown IDs are silently stripped on save. Existing users' customization is preserved.

### Claude's Discretion
- Registry fields: Start minimal (id, display_name, default_enabled, dashboard_url) and extend later.
- Refresh state generalization: `Set<string>` of refreshing IDs vs. per-entry flags.
- Snapshot cache versioning: Explicit `schema_version` field vs. best-effort parse.
- Command naming: Generic commands alongside existing vs. immediate replacement.

### Deferred Ideas (OUT OF SCOPE)
None.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PROV-01 | All provider metadata in single ProviderDescriptor registry | Registry pattern (Rust static slice + TS frozen array); replaces 5 hardcoded lists |
| PROV-02 | Adding new provider requires only descriptor + fetch impl | Dynamic map-based state, registry-driven preferences normalization, no UI framework changes |
| PROV-06 | Frontend state via dynamic map | `Map<string, CodexPanelState>` replaces per-service fields; `Set<string>` for refresh tracking |
| PROV-07 | Snapshot cache with schema version | `schema_version: u32` field in SnapshotCache struct; discard on mismatch |
| PROV-08 | Preferences normalization handles dynamic enable/disable flags | `providerEnabled: Record<string, boolean>` map replaces `claudeCodeUsageEnabled` boolean |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

- **Tech stack**: Rust stable (edition 2021), TypeScript 5.x, Node.js 24, Tauri 2, React 19, Tailwind CSS 4
- **No new runtime dependencies**: Existing crates only (serde, serde_json, ureq, chrono, sha2, rusqlite, png)
- **No new storage layer**: Continue using preferences.json + snapshot-cache.json
- **Backward compatible**: Existing Codex + Claude Code users must not lose functionality
- **Cross-platform**: Must work on macOS and Windows
- **Naming conventions**: snake_case Rust, camelCase TypeScript, PascalCase components
- **Dual normalizers**: Rust and TypeScript preferences normalizers must stay in sync
- **Discriminated unions**: Use `kind` tag for serialization (`#[serde(tag = "kind")]`)
- **Git commit style**: `type: lowercase description` (feat, fix, docs, chore)

## Standard Stack

No new libraries needed. This phase is pure refactoring of existing code.

### Core (already in project)
| Library | Version | Purpose | Role in This Phase |
|---------|---------|---------|-------------------|
| serde + serde_json | 1.0 | Rust serialization | SnapshotCache schema_version, ProviderDescriptor serialization |
| React 19 | 19.x | UI framework | State migration from per-service to Map |
| Tauri 2 | 2.0.0 | IPC bridge | Command routing (existing or genericized) |

### Alternatives Considered
None. D-01 locks the approach: static struct array, no trait objects.

## Architecture Patterns

### Recommended Project Structure

No new files needed beyond the registry modules. Changes are in-place refactors.

```
src-tauri/src/
  registry.rs              # NEW: ProviderDescriptor + PROVIDERS static slice
  state/mod.rs             # MODIFY: Replace KNOWN_SERVICE_IDS/KNOWN_MENUBAR_SERVICES with registry lookups
  commands/mod.rs          # MODIFY: SnapshotCache gains schema_version; optionally add generic dispatch
  snapshot.rs              # UNCHANGED
src/
  lib/tauri/
    registry.ts            # NEW: TypeScript mirror of ProviderDescriptor + PROVIDERS
    contracts.ts           # MODIFY: Add ProviderDescriptor type; generalize MenubarService type
    summary.ts             # MODIFY: Replace SERVICE_IDS constant with registry import
  lib/persistence/
    preferencesStore.ts    # MODIFY: Replace KNOWN_SERVICE_IDS/KNOWN_MENUBAR_SERVICES with registry lookups
  app/shared/
    appState.ts            # MODIFY: Replace per-service fields with Map + Set
  app/shell/
    AppShell.tsx           # MODIFY: Big-bang state migration
  app/panel/
    PanelView.tsx          # MODIFY: Replace SERVICE_DISPLAY_NAMES and stateByServiceId with registry + map
  app/settings/
    SettingsView.tsx        # MODIFY: Replace hardcoded label switch with registry lookup
  features/
    demo-services/
      panelController.ts   # MODIFY: Generalize load/refresh to use provider IDs
    preferences/
      defaultPreferences.ts # MODIFY: Generate defaults from registry
```

### Pattern 1: Rust Static Registry

**What:** Compile-time array of provider descriptors as the single source of truth.
**When to use:** When the set of providers is fixed at compile time (our case).

```rust
// src-tauri/src/registry.rs

#[derive(Debug, Clone)]
pub struct ProviderDescriptor {
    pub id: &'static str,
    pub display_name: &'static str,
    pub default_enabled: bool,
    pub dashboard_url: Option<&'static str>,
}

pub const PROVIDERS: &[ProviderDescriptor] = &[
    ProviderDescriptor {
        id: "codex",
        display_name: "Codex",
        default_enabled: true,
        dashboard_url: Some("https://chatgpt.com/admin/usage"),
    },
    ProviderDescriptor {
        id: "claude-code",
        display_name: "Claude Code",
        default_enabled: false,
        dashboard_url: Some("https://console.anthropic.com/settings/usage"),
    },
];

/// Get all known provider IDs.
pub fn provider_ids() -> Vec<&'static str> {
    PROVIDERS.iter().map(|p| p.id).collect()
}

/// Get all valid menubar service IDs (provider IDs + "auto").
pub fn menubar_service_ids() -> Vec<&'static str> {
    let mut ids = provider_ids();
    ids.push("auto");
    ids
}

/// Look up a provider by ID.
pub fn get_provider(id: &str) -> Option<&'static ProviderDescriptor> {
    PROVIDERS.iter().find(|p| p.id == id)
}
```

### Pattern 2: TypeScript Registry Mirror

**What:** Frozen array matching the Rust registry, used by all frontend code.

```typescript
// src/lib/tauri/registry.ts

export interface ProviderDescriptor {
  readonly id: string;
  readonly displayName: string;
  readonly defaultEnabled: boolean;
  readonly dashboardUrl?: string;
}

export const PROVIDERS: readonly ProviderDescriptor[] = Object.freeze([
  {
    id: "codex",
    displayName: "Codex",
    defaultEnabled: true,
    dashboardUrl: "https://chatgpt.com/admin/usage",
  },
  {
    id: "claude-code",
    displayName: "Claude Code",
    defaultEnabled: false,
    dashboardUrl: "https://console.anthropic.com/settings/usage",
  },
]);

export const getProvider = (id: string): ProviderDescriptor | undefined =>
  PROVIDERS.find((p) => p.id === id);

export const providerIds = (): string[] => PROVIDERS.map((p) => p.id);

export const menubarServiceIds = (): string[] => [...providerIds(), "auto"];
```

### Pattern 3: Dynamic Map State (Frontend)

**What:** Replace per-service state variables with a single Map.

```typescript
// src/app/shared/appState.ts (modified)

export interface AppStateValue {
  providerStates: Map<string, CodexPanelState>;   // was: panelState + claudeCodePanelState
  refreshingProviders: Set<string>;                // was: isRefreshing + isClaudeCodeRefreshing
  preferences: UserPreferences | null;
  notificationResult: NotificationCheckResult | null;
  currentView: "panel" | "settings";
  isLoading: boolean;
  isE2EMode: boolean;
  error: string | null;
  refreshPanel: (manual?: boolean) => Promise<void>;
  savePreferences: (patch: PreferencePatch) => Promise<UserPreferences | null>;
  sendTestNotification: () => Promise<NotificationCheckResult | null>;
  setAutostart: (enabled: boolean) => Promise<UserPreferences | null>;
  openSettings: () => void;
  closeSettings: () => void;
}
```

### Pattern 4: Generic Preferences Enable/Disable

**What:** Replace `claudeCodeUsageEnabled: boolean` with `providerEnabled: Record<string, boolean>`.

```typescript
// In UserPreferences (contracts.ts)
export interface UserPreferences {
  // ... existing fields ...
  providerEnabled: Record<string, boolean>;  // replaces claudeCodeUsageEnabled
  // claudeCodeUsageEnabled is REMOVED (breaking change, handled by normalizer)
}
```

```rust
// In UserPreferences (state/mod.rs)
pub struct UserPreferences {
    // ... existing fields ...
    #[serde(default = "default_provider_enabled")]
    pub provider_enabled: HashMap<String, bool>,
    // claudeCodeUsageEnabled removed; normalizer migrates old data
}
```

**Migration in normalizer:**
```rust
// If legacy claudeCodeUsageEnabled field is present, migrate to providerEnabled map
fn normalize_preferences(mut prefs: UserPreferences) -> UserPreferences {
    // Seed defaults from registry for any provider not in the map
    for provider in PROVIDERS {
        prefs.provider_enabled
            .entry(provider.id.into())
            .or_insert(provider.default_enabled);
    }
    // ... rest of normalization
    prefs
}
```

### Pattern 5: Snapshot Cache Schema Version

**What:** Add explicit version field to detect incompatible cache formats.

```rust
const SNAPSHOT_CACHE_VERSION: u32 = 1;

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
struct SnapshotCache {
    #[serde(default)]
    schema_version: u32,
    services: HashMap<String, CodexPanelState>,
}

fn read_snapshot_cache() -> SnapshotCache {
    let path = snapshot_cache_path();
    let cache = std::fs::read_to_string(path)
        .ok()
        .and_then(|contents| serde_json::from_str::<SnapshotCache>(&contents).ok())
        .unwrap_or_default();

    if cache.schema_version != SNAPSHOT_CACHE_VERSION {
        // Incompatible version: discard and return empty
        return SnapshotCache {
            schema_version: SNAPSHOT_CACHE_VERSION,
            services: HashMap::new(),
        };
    }
    cache
}
```

### Anti-Patterns to Avoid

- **Partial migration:** Do NOT leave some components reading from the old per-service fields while others use the new map. D-02 mandates big-bang: all consumers switch at once.
- **Duplicated registry data:** Do NOT define provider metadata in both Rust and TypeScript independently. The TypeScript registry must be treated as a mirror of the Rust registry. If they drift, display names or IDs will mismatch.
- **HashMap for preferences.provider_enabled default:** Do NOT use `HashMap::new()` as the serde default. Use a function that seeds from the registry so all providers get their `default_enabled` value.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Preferences migration (legacy -> new) | Custom file version detector | serde `#[serde(default)]` + normalizer function | serde already handles missing fields; normalizer fills gaps from registry |
| Service ID validation | Per-site switch/match statements | `registry::get_provider(id).is_some()` | Single validation point; adding a provider auto-validates |
| Display name lookup | `SERVICE_DISPLAY_NAMES` Record | `registry::getProvider(id)?.displayName` | Registry is the single source of truth |
| Menubar service validation | `KNOWN_MENUBAR_SERVICES.includes()` | `registry::menubarServiceIds().includes()` | Automatically includes new providers |

## Common Pitfalls

### Pitfall 1: Rust-TypeScript Registry Drift
**What goes wrong:** Rust registry adds a field or changes an ID; TypeScript mirror is not updated. Frontend shows wrong names or crashes on unknown IDs.
**Why it happens:** Two separate source files with no compile-time link.
**How to avoid:** (a) Keep registries adjacent in the PR review. (b) Write a unit test that asserts the TypeScript registry's IDs match a known set. (c) Consider a build step that generates the TS file from Rust (out of scope for this phase, but worth noting).
**Warning signs:** i18n showing raw IDs instead of display names; settings view showing "undefined" labels.

### Pitfall 2: Legacy Preferences Deserialization Failure
**What goes wrong:** Existing users have `claudeCodeUsageEnabled: true` in their preferences.json. After the refactor removes that field and adds `providerEnabled`, serde fails to deserialize the old file, and the app resets all preferences.
**Why it happens:** Removing a field from the struct breaks backward-compatible deserialization.
**How to avoid:** Keep `claudeCodeUsageEnabled` as a `#[serde(default)]` field in the struct during migration. The normalizer reads its value, populates `provider_enabled["claude-code"]`, and the field is not written back. Alternatively, use `#[serde(alias)]` or a custom deserializer. The existing test `deserializes_legacy_preferences_with_defaults` must be extended.
**Warning signs:** Users report settings being reset after update.

### Pitfall 3: Map Serialization in React State
**What goes wrong:** JavaScript `Map` does not serialize to JSON by default. If AppShell state is logged, persisted, or serialized anywhere, Map contents are lost.
**Why it happens:** `JSON.stringify(new Map())` produces `{}`.
**How to avoid:** Use a plain `Record<string, CodexPanelState>` object instead of `Map`. Or ensure no code path serializes the app state context. Given the existing codebase uses plain objects everywhere, `Record<string, ...>` is safer.
**Warning signs:** Debug logging shows empty objects for provider states.

### Pitfall 4: Snapshot Cache Version Bump Losing Data
**What goes wrong:** Every update bumps schema_version, discarding the cache. Users see blank data on first launch after every update.
**Why it happens:** Version bumped unnecessarily, or version check is too strict.
**How to avoid:** Only bump schema_version when the serialization format actually changes (field renames, type changes). The version check in `read_snapshot_cache` should discard only on mismatch, not on "less than".
**Warning signs:** Users always see a brief empty state after updates.

### Pitfall 5: panelController Dedup Guards Lost in Generalization
**What goes wrong:** The existing `pendingRefresh` / `pendingClaudeCodeRefresh` dedup guards in `panelController.ts` prevent concurrent refresh calls. If these are merged into a generic approach carelessly, concurrent requests to the same provider may fire.
**Why it happens:** The generic version uses a Map but forgets to check the map before creating a new promise.
**How to avoid:** Use `Map<string, Promise<CodexPanelState>>` with the same pattern: check map, create if missing, delete on finally.
**Warning signs:** Multiple simultaneous API calls for the same provider in network logs.

### Pitfall 6: SettingsView and Promotions Still Referencing Per-Service Logic
**What goes wrong:** The promotions resolver (`resolver.ts`) has `DEFAULT_SERVICE_NAMES` hardcoded. The SettingsView has a hardcoded label switch at lines 143-144. These are missed during migration.
**Why it happens:** These aren't in the obvious "state" path; they're in secondary UI code.
**How to avoid:** Grep for all occurrences of `"codex"`, `"claude-code"`, `SERVICE_DISPLAY_NAMES`, `DEFAULT_SERVICE_NAMES` before marking the phase complete.
**Warning signs:** Promotions show wrong service names; settings labels are broken.

## Code Examples

### Generalized panelController

```typescript
// src/features/demo-services/panelController.ts

import { tauriClient } from "../../lib/tauri/client";
import { providerIds } from "../../lib/tauri/registry";

const pendingRefreshes = new Map<string, Promise<CodexPanelState>>();

export const loadProviderState = (providerId: string) =>
  tauriClient.getProviderPanelState(providerId);

export const refreshProviderState = (providerId: string) => {
  if (!pendingRefreshes.has(providerId)) {
    const promise = tauriClient.refreshProviderPanelState(providerId).finally(() => {
      pendingRefreshes.delete(providerId);
    });
    pendingRefreshes.set(providerId, promise);
  }
  return pendingRefreshes.get(providerId)!;
};
```

### Generalized AppShell State (key fragment)

```typescript
// In AppShell.tsx
const [providerStates, setProviderStates] = useState<Record<string, CodexPanelState | null>>({});
const [refreshingProviders, setRefreshingProviders] = useState<Set<string>>(new Set());

const refreshPanel = async (manual = true) => {
  if (refreshingProviders.size > 0) return;

  const enabledProviders = providerIds().filter(
    (id) => preferences?.providerEnabled[id] ?? getProvider(id)?.defaultEnabled
  );

  setRefreshingProviders(new Set(enabledProviders));
  try {
    const results = await Promise.all(
      enabledProviders.map(async (id) => [id, await refreshProviderState(id)] as const)
    );
    setProviderStates((prev) => {
      const next = { ...prev };
      for (const [id, state] of results) {
        next[id] = state;
      }
      return next;
    });
  } finally {
    setRefreshingProviders(new Set());
  }
};
```

### Legacy Preferences Migration (Rust normalizer)

```rust
pub fn normalize_preferences(mut preferences: UserPreferences) -> UserPreferences {
    // Migrate legacy claudeCodeUsageEnabled into providerEnabled map
    if preferences.provider_enabled.is_empty() {
        // First run after migration: seed from legacy field + registry defaults
        for provider in crate::registry::PROVIDERS {
            let enabled = if provider.id == "claude-code" {
                preferences.claude_code_usage_enabled
            } else {
                provider.default_enabled
            };
            preferences.provider_enabled.insert(provider.id.into(), enabled);
        }
    } else {
        // Ensure new providers get their defaults
        for provider in crate::registry::PROVIDERS {
            preferences.provider_enabled
                .entry(provider.id.into())
                .or_insert(provider.default_enabled);
        }
    }

    // Existing normalization logic follows...
    preferences.refresh_interval_minutes = preferences.refresh_interval_minutes.max(5);
    preferences.service_order = normalize_service_order(preferences.service_order);
    // ...
    preferences
}
```

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 3.x (TypeScript), cargo test (Rust) |
| Config file | `vitest.config.ts`, `src-tauri/Cargo.toml` |
| Quick run command | `npx vitest run --reporter=verbose` |
| Full suite command | `npx vitest run && cd src-tauri && cargo test` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PROV-01 | Registry is sole source of provider IDs | unit | `npx vitest run src/lib/tauri/registry.test.ts -x` | Wave 0 |
| PROV-02 | Adding provider needs no UI changes | unit | `npx vitest run src/app/panel/PanelView.test.tsx -x` | Exists (needs update) |
| PROV-06 | Frontend uses dynamic map state | unit | `npx vitest run src/app/shell/AppShell.test.tsx -x` | Exists (needs update) |
| PROV-07 | Schema version in snapshot cache | unit | `cd src-tauri && cargo test snapshot_cache -x` | Wave 0 |
| PROV-08 | Dynamic provider enable/disable | unit | `npx vitest run src/lib/persistence/preferencesStore.test.ts -x` | Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run`
- **Per wave merge:** `npx vitest run && cd src-tauri && cargo test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/lib/tauri/registry.test.ts` -- covers PROV-01 (registry has expected IDs, getProvider works)
- [ ] `src/lib/persistence/preferencesStore.test.ts` -- covers PROV-08 (normalizer with providerEnabled map)
- [ ] Rust test in `src-tauri/src/commands/mod.rs` or `src-tauri/src/registry.rs` -- covers PROV-07 (schema version discard)
- [ ] Update `src/app/shell/AppShell.test.tsx` -- covers PROV-06 (map-based state)
- [ ] Update `src/app/panel/PanelView.test.tsx` -- covers PROV-02 (registry-driven rendering)

## Open Questions

1. **`claudeCodeUsageEnabled` migration strategy**
   - What we know: The field exists in both Rust `UserPreferences` and TypeScript `UserPreferences`. It is referenced in AppShell, SettingsView, panelController, summary.ts, and preferencesStore.ts.
   - What's unclear: Should we keep the legacy field as a serde alias during migration or use a custom deserializer? The former is simpler but leaves dead code.
   - Recommendation: Keep as `#[serde(default, skip_serializing)]` in Rust so old files deserialize but the field is not written back. The normalizer migrates the value into `provider_enabled`. Remove the field entirely in a follow-up phase.

2. **`claudeCodeDisclosureDismissedAt` fate**
   - What we know: This is a Claude Code-specific onboarding disclosure. It is stored in preferences.
   - What's unclear: Should this become a generic `providerDisclosureDismissedAt: Record<string, string>` or stay Claude-specific?
   - Recommendation: Keep it as-is for Phase 1. It is specific to Claude Code's OAuth data usage disclosure, not a generic provider pattern. Generalize only if other providers need similar disclosures.

3. **Command naming transition**
   - What we know: Current commands are `get_codex_panel_state`, `refresh_codex_panel_state`, `get_claude_code_panel_state`, `refresh_claude_code_panel_state`.
   - What's unclear: Whether to add generic `get_provider_panel_state(provider_id)` alongside or replace.
   - Recommendation: Add generic commands that dispatch internally. Keep old commands as thin wrappers calling the generic version. This minimizes blast radius and lets E2E tests continue working.

## Sources

### Primary (HIGH confidence)
- Direct codebase analysis of all files listed in CONTEXT.md canonical references
- `src-tauri/src/state/mod.rs` -- current hardcoded lists, preferences struct, normalization logic
- `src-tauri/src/commands/mod.rs` -- snapshot cache struct, read/write functions
- `src/app/shared/appState.ts` -- current AppStateValue interface
- `src/app/shell/AppShell.tsx` -- current per-service state management
- `src/lib/tauri/contracts.ts` -- current type definitions
- `src/lib/persistence/preferencesStore.ts` -- current TS normalizer with hardcoded lists

### Secondary (MEDIUM confidence)
- CONTEXT.md design decisions (D-01, D-02, D-03) from user discussion session

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - No new libraries; pure refactoring of existing code
- Architecture: HIGH - Pattern is straightforward (registry + map state); all target files examined
- Pitfalls: HIGH - All five hardcoded list locations verified in code; migration edge cases identified from actual struct definitions and serde attributes

**Research date:** 2026-03-31
**Valid until:** 2026-04-30 (stable; no external dependency changes expected)
