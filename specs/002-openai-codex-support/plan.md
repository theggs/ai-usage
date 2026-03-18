# Implementation Plan: Iteration 2 Codex Usage Limits

**Branch**: `002-openai-codex-support` | **Date**: 2026-03-19 | **Spec**: [spec.md](/Users/chasewang/01workspace/projects/ai-usage/specs/002-openai-codex-support/spec.md)
**Input**: Feature specification from `/specs/002-openai-codex-support/spec.md`

## Summary

第二迭代将第一迭代的桌面壳推进到真实监控场景：设置页继续承载多 Codex 账户配置，但真实额度同步先限定为单个本地活跃 Codex CLI 会话，并以 `/status` 可见的 usage limits 作为主数据来源。实现上继续坚持宿主负责真实读取、前端负责展示和配置管理的边界，避免把 CLI 会话解析和凭证处理泄漏到 UI 层。

## Technical Context

**Language/Version**: Rust stable, TypeScript 5.x, Node.js 20 LTS  
**Primary Dependencies**: Tauri 2, React 19, Tailwind CSS 4, Tauri plugins for autostart and notification  
**Storage**: Local preferences file for user-facing settings and reserved Codex account metadata; host-side transient snapshots for active CLI session reads  
**Testing**: Vitest, React Testing Library, integration tests for host-command wiring, Rust `cargo test` for CLI snapshot parsing  
**Target Platform**: macOS 13+ and Windows 10 22H2+ desktop environments  
**Project Type**: Cross-platform desktop app  
**Performance Goals**: Panel open remains under 1 second; manual refresh returns a cached or newly-read CLI snapshot within 2 seconds in normal local conditions; idle memory remains under 50 MB  
**Constraints**: Real usage sync must come from local Codex CLI `/status`; frontend must not parse CLI output directly; second iteration supports one active local Codex session for live data while preserving multiple configured accounts for future expansion; application remains local-first with no third-party relay  
**Scale/Scope**: One local active Codex session, multiple saved account placeholders, a single tray/panel surface, and updated host/UI contracts for real limit snapshots

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

The repository constitution is active at version `1.0.0` and introduces five binding principles:
Host-Boundary Security, Contract-First Desktop Surfaces, Test-Gated Integration,
Truthful User States, and Local-First Incremental Delivery.

- Gate status: PASS
- Rationale: The plan keeps Codex CLI execution and parsing inside the native host,
  models explicit empty/disconnected/failed states, and includes contract plus parsing tests
  before treating payloads as stable.
- Constitutional impact:
  - Principle I satisfied by keeping CLI invocation, session reads, and future secret handling in `src-tauri/`
  - Principle II satisfied by the dedicated Codex host/UI contract in `contracts/codex-usage-contract.md`
  - Principle III satisfied by required frontend, contract, integration, and Rust parsing tests
  - Principle IV satisfied by explicit empty, disconnected, stale, failed, and pending-state handling
  - Principle V satisfied by scoping live data to one active local session while preserving future multi-account expansion

## Project Structure

### Documentation (this feature)

```text
specs/002-openai-codex-support/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── codex-usage-contract.md
└── tasks.md
```

### Source Code (repository root)

```text
src/
├── app/
│   ├── shell/
│   ├── panel/
│   ├── settings/
│   └── shared/
├── components/
├── features/
│   ├── preferences/
│   ├── notifications/
│   └── demo-services/
├── lib/
│   ├── persistence/
│   └── tauri/
└── test/

src-tauri/
├── src/
│   ├── commands/
│   ├── state/
│   ├── tray/
│   └── codex/
├── capabilities/
└── tauri.conf.json

tests/
├── contract/
├── integration/
└── e2e/
```

**Structure Decision**: 继续沿用单仓库 Tauri 桌面结构。前端留在 `src/` 中负责账户配置和状态渲染；宿主新增 `src-tauri/src/codex/` 负责读取和规范化本地 Codex CLI `/status` 快照；跨层交互继续通过 `src/lib/tauri/` 契约和命令桥接完成。

## Phase 0: Research

Research findings are documented in [research.md](/Users/chasewang/01workspace/projects/ai-usage/specs/002-openai-codex-support/research.md).

Key decisions to carry forward:

- 第二迭代主目标是 Codex usage limits，而不是泛化的 OpenAI API usage/costs。
- 真实数据先来自本地 Codex CLI `/status` 可见信息。
- 实时同步范围先限定为单个活跃本地会话，多账户保留配置位供后续扩展。
- CLI 输出解析和会话读取留在 Rust 宿主层，UI 只消费规范化快照。

## Phase 1: Design & Contracts

### Data Model

Data entities and validation rules are captured in [data-model.md](/Users/chasewang/01workspace/projects/ai-usage/specs/002-openai-codex-support/data-model.md).

### Interface Contracts

Host/UI contracts for Codex usage reads are defined in [codex-usage-contract.md](/Users/chasewang/01workspace/projects/ai-usage/specs/002-openai-codex-support/contracts/codex-usage-contract.md).

### Quickstart

Implementation and validation flow is documented in [quickstart.md](/Users/chasewang/01workspace/projects/ai-usage/specs/002-openai-codex-support/quickstart.md).

### Design Notes

- `AppShell` continues to load preferences and account metadata, but panel data becomes a merge of saved account configuration and the latest active-session CLI snapshot.
- The settings view distinguishes between “saved Codex account metadata” and “currently active local Codex session” so users understand why only one account can show live limits in this iteration.
- A host-side Codex service reads `/status`, normalizes limit dimensions, and returns one stable payload to the frontend.
- Tray summary formatting should use the active session's primary limit dimension when available and fall back to the configured empty-state messaging when not connected.
- Failure states must differentiate among “no configured accounts”, “configured but no active CLI session”, and “snapshot parse failed”.
- The panel must also distinguish “sync pending” from disconnected or failed states so first-run
  and not-yet-connected states remain truthful.

## Phase 2: Implementation Strategy

1. Introduce Codex-specific host/domain contracts for accounts, active sessions, limit dimensions, and snapshot status.
2. Add a Rust-side Codex reader module that shells out to the local Codex CLI, captures `/status`, and normalizes the result into a stable snapshot payload.
3. Update the Tauri command layer so the panel can request real Codex snapshot data and receive explicit disconnected/error states.
4. Refine the settings experience to keep multiple reserved accounts while clearly indicating that live data comes from the single active local session.
5. Update panel rendering and summary logic to display active-session limit dimensions, reset hints, and actionable empty/error states.
6. Add tests that lock down CLI snapshot parsing, UI state mapping, and host/frontend contract behavior before enabling broader iteration work.

## Post-Design Constitution Check

- Gate status: PASS
- No constitution violations are introduced in the final design.
- Host-boundary execution remains confined to the native layer, all cross-layer behavior is contract-led,
  and truthful-state coverage now explicitly includes pending, disconnected, stale, and failed states.

## Complexity Tracking

No constitution exceptions or complexity waivers are required for this iteration.
