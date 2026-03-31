# Phase 1: Provider Registry - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-31
**Phase:** 01-provider-registry
**Areas discussed:** Registry shape, State migration, Backward compat, Command naming

---

## Registry Shape

### Q1: How should ProviderDescriptor be defined in Rust?

| Option | Description | Selected |
|--------|-------------|----------|
| Static struct array | const PROVIDERS: &[ProviderDescriptor] — compile-time fixed, enum dispatch, no heap alloc | ✓ |
| Trait objects | Box<dyn Provider> — runtime polymorphism, more flexible but adds lifetime complexity | |
| You decide | Claude picks the best approach | |

**User's choice:** Static struct array
**Notes:** Matches CodexBar's approach and existing codebase idioms.

### Q2: What metadata should each ProviderDescriptor include?

| Option | Description | Selected |
|--------|-------------|----------|
| Minimal | id, display_name, default_enabled, dashboard_url — extend later | |
| Full upfront | All fields now even if unused | |
| You decide | Claude picks based on incremental delivery constraint | ✓ |

**User's choice:** You decide
**Notes:** Claude has discretion to start minimal and extend as phases progress.

---

## State Migration

### Q1: How should frontend state migrate from per-service variables to dynamic map?

| Option | Description | Selected |
|--------|-------------|----------|
| Big bang | Replace panelState + claudeCodePanelState with Map in one phase | ✓ |
| Parallel period | Keep old vars AND add Map, gradually migrate | |
| You decide | Claude picks based on test coverage and risk | |

**User's choice:** Big bang
**Notes:** Clean result, touches AppShell, PanelView, SettingsView simultaneously.

### Q2: How should per-service refresh state generalize?

| Option | Description | Selected |
|--------|-------------|----------|
| Map of flags | refreshingServices: Set<string> | |
| Per-entry status | Each Map entry carries its own isRefreshing flag | |
| You decide | Claude's discretion | ✓ |

**User's choice:** You decide

---

## Backward Compat

### Q1: How should existing preferences.json handle unknown provider IDs after upgrade?

| Option | Description | Selected |
|--------|-------------|----------|
| Preserve + merge | Keep existing serviceOrder, append new providers, strip unknown IDs | ✓ |
| Reset to defaults | Reset serviceOrder if unknown IDs found | |
| You decide | Claude picks | |

**User's choice:** Preserve + merge

### Q2: What happens to snapshot-cache.json when data shape changes?

| Option | Description | Selected |
|--------|-------------|----------|
| Schema version field | Add version, discard on mismatch | |
| Best-effort parse | Try old shape, fallback to empty | |
| You decide | Claude's discretion | ✓ |

**User's choice:** You decide

---

## Command Naming

### Q1: How should Tauri IPC commands evolve?

| Option | Description | Selected |
|--------|-------------|----------|
| Generic + aliases | New generic commands, keep old as wrappers | |
| Replace immediately | Remove per-provider commands entirely | |
| You decide | Claude picks based on migration risk | ✓ |

**User's choice:** You decide

---

## Claude's Discretion

- Registry fields: minimal vs full — Claude picks based on incremental delivery
- Refresh state generalization approach
- Snapshot cache versioning strategy
- Command naming transition approach

## Deferred Ideas

None — discussion stayed within phase scope
