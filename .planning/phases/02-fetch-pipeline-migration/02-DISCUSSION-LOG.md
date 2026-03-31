# Phase 2: Fetch Pipeline & Migration - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-31
**Phase:** 02-fetch-pipeline-migration
**Areas discussed:** Pipeline Trait Design, Strategy Chain Definition, Migration Scope, Command Surface
**Mode:** auto (all decisions auto-selected)

---

## Pipeline Trait Design

| Option | Description | Selected |
|--------|-------------|----------|
| Rust trait with per-provider impl | Idiomatic, extensible, testable with mocks | ✓ |
| Strategy enum with match dispatch | Simpler but less extensible | |
| Function pointer chain | Flexible but hard to test, unidiomatic | |

**User's choice:** [auto] Rust trait with per-provider impl (recommended default)
**Notes:** Aligns with Phase 3 requirement to add new providers by implementing the trait. Enables mock-based unit testing.

---

## Strategy Chain Definition

| Option | Description | Selected |
|--------|-------------|----------|
| Strategy list in trait impl | Each provider manages its own chain internally | ✓ |
| Registry-level strategy config | Strategies defined in ProviderDescriptor | |
| External config file | Strategies loaded from JSON/TOML | |

**User's choice:** [auto] Separate strategy list in each provider's trait impl (recommended default)
**Notes:** Keeps ProviderDescriptor minimal per Phase 1 D-01. Strategies are an implementation detail — Claude Code's env→keychain→file chain is fundamentally different from Codex's CLI subprocess approach.

---

## Migration Scope

| Option | Description | Selected |
|--------|-------------|----------|
| Refactor into pipeline directly | Restructure existing modules behind trait | ✓ |
| Adapter wrappers | Wrap existing code, no internal changes | |
| Hybrid (refactor Claude, wrap Codex) | Different treatment per complexity | |

**User's choice:** [auto] Refactor into pipeline directly (recommended default)
**Notes:** Both providers already produce ServiceSnapshot/SnapshotStatus. Adapter wrappers add indirection without benefit since both providers will use the pipeline long-term.

---

## Command Surface

| Option | Description | Selected |
|--------|-------------|----------|
| Generic commands + deprecate per-service | Add get_provider_state(id), keep old as wrappers | ✓ |
| Replace immediately | Remove per-service commands | |
| Keep both permanently | Maintain parallel APIs | |

**User's choice:** [auto] Add generic commands, deprecate per-service (recommended default)
**Notes:** Progressive migration reduces blast radius. Frontend migrates to generic in this phase.

---

## Claude's Discretion

- Pipeline error handling (retry semantics, timeouts)
- FetchContext struct vs individual args
- Test structure matching existing patterns

## Deferred Ideas

None
