<!--
Sync Impact Report
Version change: template -> 1.0.0
Modified principles:
- Principle 1 placeholder -> I. Host-Boundary Security
- Principle 2 placeholder -> II. Contract-First Desktop Surfaces
- Principle 3 placeholder -> III. Test-Gated Integration
- Principle 4 placeholder -> IV. Truthful User States
- Principle 5 placeholder -> V. Local-First Incremental Delivery
Added sections:
- Security & Quality Gates
- Delivery Workflow
Removed sections:
- None
Templates requiring updates:
- ✅ reviewed, no update required: /Users/chasewang/01workspace/projects/ai-usage/.specify/templates/plan-template.md
- ✅ reviewed, no update required: /Users/chasewang/01workspace/projects/ai-usage/.specify/templates/spec-template.md
- ✅ reviewed, no update required: /Users/chasewang/01workspace/projects/ai-usage/.specify/templates/tasks-template.md
- ⚠ not applicable, directory absent: /Users/chasewang/01workspace/projects/ai-usage/.specify/templates/commands/
- ✅ reviewed, no update required: /Users/chasewang/01workspace/projects/ai-usage/README.md
- ✅ reviewed, no update required: /Users/chasewang/01workspace/projects/ai-usage/AGENTS.md
Follow-up TODOs:
- None
-->
# AIUsage Constitution

## Core Principles

### I. Host-Boundary Security
All secrets, local CLI session reads, secure-store access, and operating-system
integrations MUST execute in the Tauri host layer or another explicitly trusted
native boundary. Frontend code MUST NOT directly execute CLI commands, parse raw
CLI output, or transmit real credentials to third-party endpoints. Every feature
that introduces a new sensitive data path MUST document the trusted boundary and
its failure modes before implementation.

### II. Contract-First Desktop Surfaces
Every user-visible desktop capability MUST be expressed through a stable
host-to-UI contract before implementation expands across layers. Commands,
payloads, and state transitions MUST be documented in feature contracts when a
change affects tray behavior, panel rendering, settings persistence, or native
integrations. UI components MUST consume normalized state objects rather than
raw host responses or unstructured text.

### III. Test-Gated Integration
Changes that alter host commands, persistent settings, CLI snapshot parsing, or
cross-layer state mapping MUST ship with automated validation at the narrowest
useful layer and at least one integration-level check when behavior crosses the
host/UI boundary. Contract tests or parsing tests MUST exist before a new host
payload shape is treated as stable. A feature is not complete until the relevant
`npm test` and `cargo test` paths for the changed behavior pass.

### IV. Truthful User States
The product MUST represent live status truthfully and MUST NOT mask missing,
stale, disconnected, blocked, or failed states behind demo or placeholder data.
Whenever live monitoring is unavailable, the UI MUST distinguish among empty
setup, disconnected environment, stale snapshot, and explicit failure so users
can take the next action with confidence. Derived summaries, tray text, and
notifications MUST remain consistent with the underlying canonical state.

### V. Local-First Incremental Delivery
Each iteration MUST deliver a user-visible slice that is independently testable
and valuable without requiring future cloud infrastructure. New integrations
SHOULD start from the smallest local-first path that proves the workflow, then
expand to broader account or session coverage in later iterations. Scope cuts
MUST preserve upgrade paths instead of forcing redesign of existing settings,
contracts, or user mental models.

## Security & Quality Gates

- Features involving credentials, local session data, or operating-system
  capabilities MUST include explicit non-goals and trusted-boundary statements
  in the spec and plan.
- New tray, panel, or settings behaviors MUST define user-visible empty, error,
  and loading states in the specification.
- Persistent data models MUST define identity, validation rules, and lifecycle
  expectations in `data-model.md` before broad implementation begins.
- Build and validation commands documented in the repository MUST stay current
  with the actual workflow used to accept changes.

## Delivery Workflow

- Work MUST progress through specification, clarification when needed, planning,
  task decomposition, and implementation in that order unless the user
  explicitly requests an exploratory spike.
- Constitution checks in feature plans MUST state pass/fail status and explain
  any caution or exception in plain language.
- Reviews and implementation summaries MUST call out constitutional impacts when
  a change affects host boundaries, contracts, testing scope, or truthful state
  handling.
- Amendments to this constitution MUST be reflected in dependent templates or
  explicitly documented as “reviewed, no update required”.

## Governance

This constitution supersedes ad hoc local practice for architecture, testing,
and delivery decisions in this repository. Every plan, task list, review, and
implementation affecting governed areas MUST be checked for compliance.

Amendments:
- MUST be documented in this file with a semantic version update.
- MUST include a brief Sync Impact Report describing affected principles and
  dependent artifacts.
- MUST update `Last Amended` when content changes.

Versioning policy:
- MAJOR: Remove or redefine a principle in a backward-incompatible way.
- MINOR: Add a new principle, gate, or mandatory workflow requirement.
- PATCH: Clarify wording without changing governance meaning.

Compliance review expectations:
- Feature plans MUST include a Constitution Check section.
- Task breakdowns MUST reflect required testing or contract work introduced by
  these principles.
- Implementation that violates this constitution requires an explicit written
  exception in the relevant plan before merge.

**Version**: 1.0.0 | **Ratified**: 2026-03-19 | **Last Amended**: 2026-03-19
