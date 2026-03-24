# Implementation Plan: Claude Code 用度查询告知与启用控制

**Branch**: `012-claude-code-usage-query-disclosure` | **Date**: 2026-03-24 | **Spec**: [spec.md](./spec.md)  
**Input**: Feature specification from `/specs/012-claude-code-usage-query-disclosure/spec.md`

## Summary

本迭代把 Claude Code 用度查询从“默认隐式触发的敏感行为”收敛为“用户可见、可理解、可控制”的本地集成功能。实现方案分三层同步推进：在现有偏好模型中新增显式启用与告知确认字段；在前端加载、手动刷新、自动刷新和宿主侧命令中同时加上 Claude Code 的硬关闭保护，并让所有 Claude 官方请求共享统一冷却机制，确保关闭时不再读取登录凭证、不再请求官方接口，开启时则优先用缓存快速恢复并伴随真实查询中状态；在 README、首次引导和设置页末尾补齐一致的告知与控制入口，其中设置页使用与主设置卡片同级的独立 Claude Code 查询卡片。现有 snapshot cache 继续保留，但在关闭状态下不得驱动 UI、托盘或任何 Claude Code 请求链路。

## Technical Context

**Language/Version**: Rust stable (edition 2021), TypeScript 5.x, Node.js 20 LTS  
**Primary Dependencies**: Tauri 2, React 19, Tailwind CSS 4, Vitest, React Testing Library, Playwright  
**Storage**: 现有 `preferences.json` 与 `snapshot-cache.json` 本地持久化；不新增存储层  
**Testing**: Vitest + React Testing Library、Rust 单元测试、前后端契约/集成测试、Playwright/E2E 截图与真实 Tauri 场景验证  
**Target Platform**: macOS 菜单栏桌面应用优先，保持现有 Windows 兼容契约不破坏  
**Project Type**: Desktop app (Tauri 2 + React)  
**Performance Goals**: 保持面板“1 秒内可扫视”的使用目标；设置开关在同一次交互周期内完成真实状态切换；关闭 Claude Code 后不再产生额外凭证读取或官方请求；冷却期内避免重复请求触发 429  
**Constraints**: 必须复用现有首次引导与设置页结构；设置原有顺序不得变动；Claude Code 关闭必须是跨前端编排与宿主命令的硬关闭；已有缓存可保留但关闭时不得展示；新增界面文案需支持中英文切换；状态必须对 empty/error/loading/disabled 保持真实；Claude Code 开关触发、手动刷新和自动刷新必须共享同一请求冷却机制  
**Scale/Scope**: 当前 2 个服务（Codex、Claude Code）；新增 2 个持久化字段、1 个运行时冷却协调实体、1 个 onboarding 卡片、1 个设置独立卡片、1 个 README 小节；不引入新的后端服务、账号体系或云同步

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### I. Host-Boundary Security — PASS

本特性继续把 Claude Code 登录凭证读取、官方额度查询、代理解析、冷却控制与 snapshot cache 读写限制在 Tauri 宿主层或受信的前端编排边界中。前端只读取归一化后的 `UserPreferences` 与 `CodexPanelState`，不得直接接触真实凭证或自行拼装第三方请求。

**Trusted boundary statement**: Rust 宿主层负责决定 Claude Code 是否允许进入查询链路、是否可以读取缓存、冷却机制是否允许发起新的官方请求，以及托盘如何根据启用态与可见服务做归一化。React 只负责渲染说明、开关与可见状态，并调用受控命令。

**Explicit non-goals**: 不新增云端遥测、不把 Claude Code 凭证透传到前端、不新增账号托管能力、不把代理配置改造成独立网络层。

### II. Contract-First Desktop Surfaces — PASS

本特性在实现前先定义稳定契约：
- [contracts/claude-code-usage-query-contract.md](./contracts/claude-code-usage-query-contract.md) 规定偏好字段扩展、宿主命令禁用语义、共享冷却约束、首次引导卡片与设置页独立卡片行为
- [data-model.md](./data-model.md) 规定新增偏好字段、运行时冷却实体、可见服务派生规则、缓存可见性与状态迁移
- 既有 `UserPreferences`、`PreferencePatch` 与 `CodexPanelState` 继续作为跨层规范对象

### III. Test-Gated Integration — PASS

计划要求在最窄有效层完成自动化验证，并补一层真实运行态检查：
- 前端：`PanelView` / `SettingsView` / `AppShell` / 偏好持久化测试覆盖告知卡、开关、双语文案、查询中状态、冷却命中与隐藏项
- 宿主：Rust 偏好默认值、命令禁用短路、共享冷却、tray 归一化与缓存保留逻辑测试
- 跨层：Claude Code contract test 与 preferences persistence test 扩展新增字段、禁用语义和冷却约束
- 真实运行态：使用 `npm run tauri:dev:onboarding` 和 E2E 场景验证首次引导卡片、设置页底部 Claude Code 查询卡片、启用后缓存+查询中反馈、关闭后空状态回退与冷却期行为

### IV. Truthful User States — PASS

设计明确区分以下状态，并禁止互相伪装：
- `已关闭`：Claude Code 既不读取凭证，也不展示为可选或正在刷新
- `已启用且查询中`：用户刚开启、主动刷新或缓存回暖后，UI 必须明确展示查询中，而不是空白、旧结果冒充最新状态或静默等待
- `已启用且展示缓存`：可以先展示本地缓存，但必须伴随刷新中指示；若命中冷却间隔，可平滑停留在缓存/当前结果而不报错
- `已启用但不可用`：可以展示真实的未登录、网络失败、代理不满足或恢复中状态
- `已确认说明`：只影响 onboarding 中的说明卡片，不代表已启用
- `有缓存但关闭`：缓存可保留，但 UI、托盘与刷新链路不得再消费它

### V. Local-First Incremental Delivery — PASS

本迭代完全基于现有本地偏好、宿主命令和菜单栏/面板 UI 落地，不依赖任何新增云能力。交付可以按用户价值分段推进：
1. 偏好字段、冷却协调与宿主硬关闭
2. 首次引导、设置页、README 的告知与开关
3. 真实运行态、冷却命中与回归验证

### Post-Design Re-check — PASS

设计产物已经覆盖 constitution 要求的关键门槛：
- `data-model.md` 明确了新偏好字段、冷却实体、显示规则与生命周期
- `contracts/claude-code-usage-query-contract.md` 定义了 host/UI 契约、禁用语义与共享冷却约束
- `quickstart.md` 给出了本地验证、冷却行为与真实 Tauri 检查流程

## Project Structure

### Documentation (this feature)

```text
specs/012-claude-code-usage-query-disclosure/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── claude-code-usage-query-contract.md
├── checklists/
│   └── requirements.md
└── tasks.md
```

### Source Code (repository root)

```text
README.md
scripts/dev/
└── run-onboarding-scenario.mjs

src/
├── app/
│   ├── panel/
│   │   ├── PanelView.tsx
│   │   └── PanelView.test.tsx
│   ├── settings/
│   │   ├── SettingsView.tsx
│   │   └── SettingsView.test.tsx
│   ├── shell/
│   │   ├── AppShell.tsx
│   │   └── AppShell.test.tsx
│   └── shared/
│       ├── appState.ts
│       └── i18n.ts
├── features/
│   ├── demo-services/
│   │   └── panelController.ts
│   └── preferences/
│       ├── defaultPreferences.ts
│       └── preferencesController.ts
├── lib/
│   ├── persistence/
│   │   └── preferencesStore.ts
│   └── tauri/
│       ├── client.ts
│       ├── contracts.ts
│       └── summary.ts
└── components/
    └── settings/
        └── PreferenceField.tsx

src-tauri/src/
├── commands/
│   └── mod.rs
├── state/
│   └── mod.rs
├── tray/
│   └── mod.rs
└── claude_code/
    └── mod.rs

tests/
├── contract/
│   └── claude-code-panel-state.test.ts
├── integration/
│   └── preferences-persistence.test.ts
└── e2e/
    ├── screenshot-review.mjs
    └── tray-panel.spec.mjs
```

**Structure Decision**: 保持现有单仓库 Tauri 结构不变。本特性是偏好模型、宿主命令语义与桌面表面交互的跨层收敛，不需要引入新的包、子应用或服务端模块；在当前 `src/` 与 `src-tauri/` 分层内即可完成。

## Phase 0: Research — Complete

详见 [research.md](./research.md)。关键结论如下：

| 决策主题 | 选择 | 原因 |
|----------|------|------|
| 启用控制边界 | 前端编排 + 宿主命令双重硬关闭 | 单层保护不足以防止启动、托盘或意外调用继续读取凭证 |
| 偏好演进策略 | 扩展现有 `UserPreferences` / `PreferencePatch`，默认关闭并兼容旧文件 | 不新增存储层，且满足升级用户安全默认值 |
| 缓存处理 | 保留 Claude snapshot cache，但关闭时不展示、不驱动托盘、不触发请求 | 兼顾重启/重新启用体验与“关闭就停”的产品承诺 |
| 设置联动 | 隐藏 Claude 相关选项，当前 tray 选择立即归一化 | 避免“已关闭但仍可配置”的矛盾状态 |
| 首次引导承载 | 复用现有 onboarding，增加独立说明卡片与持久化确认 | 满足告知需求，同时保持低打断与低结构改动 |
| 共享冷却 | 开关触发、手动刷新和自动刷新共用最小冷却间隔 | 避免 429，同时保留缓存优先与真实反馈 |
| 验证策略 | 单元/集成覆盖逻辑，真实 Tauri 场景验证 UI 与启动路径 | 关闭语义、冷却行为和首次引导呈现不能只靠 JSDOM 证明 |

## Phase 1: Design & Contracts — Complete

产物如下：
- **[data-model.md](./data-model.md)**：定义新偏好字段、运行时冷却实体、派生可见服务集合、缓存可见性与生命周期
- **[contracts/claude-code-usage-query-contract.md](./contracts/claude-code-usage-query-contract.md)**：定义偏好契约、宿主命令禁用语义、共享冷却约束、首次引导与设置页表面契约
- **[quickstart.md](./quickstart.md)**：定义本地开发、真实 onboarding 场景、冷却行为与回归验证流程

## Phase 2: Implementation Strategy

### Slice 1 — 偏好字段、冷却协调与宿主硬关闭

Scope:
- 在前后端偏好模型中新增 `claudeCodeUsageEnabled` 与 `claudeCodeDisclosureDismissedAt`
- 让旧偏好文件在未包含新字段时自动落到安全默认值
- 在 `get_claude_code_panel_state`、`refresh_claude_code_panel_state`、`build_tray_items` 等宿主入口上加 Claude Code 禁用短路
- 为开关触发、手动刷新和自动刷新引入共享冷却协调，确保任意两次实际官方请求之间满足最小间隔
- 关闭时立即归一化 tray 选择与相关可见服务，避免 Claude Code 继续驱动托盘或面板
- 保留 snapshot cache 文件，但在关闭状态下仅允许留存，不允许展示或触发刷新

Primary files:
- `src/lib/tauri/contracts.ts`
- `src/features/preferences/defaultPreferences.ts`
- `src/lib/persistence/preferencesStore.ts`
- `src-tauri/src/state/mod.rs`
- `src-tauri/src/commands/mod.rs`
- `src-tauri/src/tray/mod.rs`

Tests:
- 扩展 `tests/integration/preferences-persistence.test.ts`
- 扩展 `tests/contract/claude-code-panel-state.test.ts`
- 增加 Rust 偏好默认值、禁用短路与共享冷却测试

### Slice 2 — 首次引导与设置页的告知和控制

Scope:
- 在现有 onboarding 卡片区新增独立的 Claude Code 说明卡片和 `我知道了` 按钮
- 在设置页最底部新增与主设置卡片同级的 Claude Code 查询卡片，标题与开关位于同一行，并保持原有设置顺序不变
- 开关开启后立即进入查询中状态；若存在缓存则先显示缓存并伴随刷新中指示；若未命中冷却则触发首次查询
- 关闭后立刻隐藏 Claude Code 的相关可配置入口
- 在中文/英文两套 copy 中补齐新增文案，并保持 README 语义一致

Primary files:
- `src/app/panel/PanelView.tsx`
- `src/app/settings/SettingsView.tsx`
- `src/app/shell/AppShell.tsx`
- `src/app/shared/i18n.ts`
- `src/features/demo-services/panelController.ts`
- `src/components/settings/PreferenceField.tsx`

Tests:
- 扩展 `src/app/panel/PanelView.test.tsx`
- 扩展 `src/app/settings/SettingsView.test.tsx`
- 为启用即查、缓存+查询中状态、冷却命中、隐藏相关选项和 onboarding 卡片确认补充 RTL 覆盖

### Slice 3 — README、真实启动路径与回归验证

Scope:
- 在 README 中新增长期可见的 Claude Code 查询说明小节
- 验证 AppShell 初始化、自动刷新和手动刷新都尊重禁用语义与共享冷却
- 用现有 onboarding 启动脚本和 E2E 场景验证真实 Tauri 窗口中的首次引导卡片、设置页底部 Claude Code 查询卡片、关闭后空状态回退、启用后的缓存恢复与刷新反馈
- 验证重新启用时可优先使用已有缓存，并在冷却结束后恢复真实刷新

Primary files:
- `README.md`
- `src/app/shell/AppShell.tsx`
- `scripts/dev/run-onboarding-scenario.mjs`
- `tests/e2e/tray-panel.spec.mjs`
- `tests/e2e/screenshot-review.mjs`

Tests:
- `npm test`
- `cargo test`
- 扩展 `src/app/shell/AppShell.test.tsx`，显式验证初始化、自动刷新和手动刷新三条路径在 Claude Code 关闭时都不会触发查询，且冷却命中时不会重复请求
- 扩展 `src-tauri/src/tray/mod.rs` / `src-tauri/src/commands/mod.rs` Rust 测试，显式验证关闭后 tray 不再消费 Claude 缓存、menubar service 会归一化回退，且冷却命中时不会生成新的官方请求
- 真实 Tauri onboarding 场景检查
- 受影响 E2E / 截图审查

## Implementation Risk Review

| 风险 | 影响 | 缓解方案 |
|------|------|----------|
| 宿主侧 `build_tray_items` 和 Claude commands 目前会无条件读取 Claude 数据 | 高 | 把禁用语义收敛在宿主层统一入口，前端只作为第一道保护而不是唯一保护 |
| 关闭后若只隐藏 UI，不清理当前 tray/service 选择，会留下“已关闭但仍活跃”的矛盾态 | 高 | 在保存偏好时同步做归一化，并给设置与托盘补充回归测试 |
| onboarding 卡片与现有引导共存，JSDOM 难以证明真实布局和按钮层级 | 中 | 使用 `npm run tauri:dev:onboarding` 和截图/E2E 场景做真实窗口验证 |
| 开启即查与现有自动刷新/手动刷新去重逻辑可能产生双请求或 429 | 高 | 把首次查询、手动刷新和自动刷新统一纳入共享冷却协调，并复用已有 panel controller pending guard |
| 旧偏好文件和本地缓存中可能仍包含 Claude Code 的旧状态 | 中 | 在 TS 与 Rust 两侧都加 legacy default/normalization 测试，确保升级用户默认关闭且不意外触发查询 |
| 缓存快速恢复若没有明确刷新中指示，容易被误读为最新结果 | 中 | 把缓存态单独建模，并要求 UI 在缓存展示期间始终伴随刷新中反馈 |

## Complexity Tracking

本计划未引入需要额外豁免的复杂度例外。现有跨层改动均直接服务于 trusted boundary、truthful state 和 local-first 目标，没有新增仓库级抽象或基础设施。
