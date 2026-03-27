# 实施计划：菜单栏自动服务跟随

**分支**：`015-agent-auto-menubar` | **日期**：2026-03-27 | **规格**：[spec.md](./spec.md)  
**输入**：来自 `/specs/015-agent-auto-menubar/spec.md` 的功能规格说明；补充参考 [doc/ai-usage-prd](/Users/chasewang/01workspace/projects/ai-usage/doc/ai-usage-prd) 与 [015-agent-activity-passive-detection-research.md](/Users/chasewang/01workspace/projects/ai-usage/doc/engineering/015-agent-activity-passive-detection-research.md)

## 摘要

本次迭代把“菜单栏服务”从手动固定服务扩展为“手动 + 自动”双模式，但自动模式的判断依据不来自前台窗口，而是来自本机可被动读取的 agent 活动痕迹。技术方案分三层推进：首先在 Rust 宿主层新增一个轻量活动监测模块，周期性读取 `~/.codex` 与 `~/.claude` 的结构化时间信号，并根据置信度、活跃窗口和可显示余量状态计算当前菜单栏显示对象；其次把 tray 的数字过滤、tooltip 和图标生成逻辑收敛到统一的“当前显示对象”决策上，在单服务稳定显示、双服务低频轮播和无新活动保留上次结果之间切换；最后扩展设置页与偏好契约，引入 `auto` 选项并保持手动模式、服务可见性、Claude Code 启用状态和主面板信息架构不被打乱。整个实现继续遵守 PRD 的 low-interruption、local-first 与 truthful state 原则，不新增系统权限、shell hook 或新的云端依赖。

## 技术上下文

**Language/Version**: Rust stable（edition 2021）、TypeScript 5.x、Node.js 24 LTS  
**Primary Dependencies**: Tauri 2、React 19、Tailwind CSS 4、Vitest、React Testing Library、Playwright；宿主侧新增 `rusqlite` 用于只读读取 Codex 本地 SQLite 元数据  
**Storage**: 沿用现有 `preferences.json` 与 `snapshot-cache.json` 本地持久化；新增只读外部元数据来源 `~/.codex` / `~/.claude`；自动模式运行时状态仅保存在宿主内存中  
**Testing**: `npm test`、`cargo test`、Rust 单元测试、前后端契约/集成测试、Tauri E2E 与截图审查  
**Target Platform**: Tauri 桌面应用；本轮真实运行验收环境为 macOS 菜单栏，Windows 仅要求现有系统托盘契约不被代码路径破坏，不作为本轮独立验收平台  
**Project Type**: 桌面应用（Tauri 2 宿主 + React 前端）  
**Performance Goals**: 活动切换在 2 分钟内反映到菜单栏；活动扫描不触发额外远端额度请求；空闲态保持轻量，新增后台循环只做低频本地元数据读取  
**Constraints**: 不得要求用户额外授权系统权限、安装 hook 或改动使用命令；不得读取 prompt/message 正文；自动模式只影响菜单栏，不改变主面板顺序与内容；图标与数字必须表达同一服务；Claude Code 关闭时不得因本地活动痕迹重新进入自动候选集合  
**Scale/Scope**: 当前覆盖 2 个服务（Codex、Claude Code）、1 个新增宿主活动监测模块、1 个 tray 自动选择状态机、1 个设置页下拉项扩展、1 组新的 tray 图标资产；不引入新的远端接口、账号体系或存储层

## 宪章检查

*门禁：必须在 Phase 0 研究前通过，并在 Phase 1 设计后重新检查。*

### I. 宿主边界安全 —— 通过

本特性把 `~/.codex` 与 `~/.claude` 的读取限制在 Rust 宿主层中执行，前端只消费已有偏好和可见服务派生结果，不直接接触本地 agent 目录、SQLite 或 JSONL 内容。tray 决策继续由宿主层负责，符合 host-boundary security。

**可信边界声明**：Rust 宿主负责活动信号读取、信号降级、自动模式选择、tray 图标/标题更新以及偏好持久化。React 前端只负责设置页选项渲染和保存 `menubarService`。

**明确非目标**：不新增 Accessibility / 前台窗口识别、不新增 shell hook、不引入主动上报、不把本地活动文件解析下放到前端。

### II. 契约优先的桌面表面 —— 通过

本特性在实现前先定义稳定契约：

- [data-model.md](./data-model.md) 定义自动模式下的活动快照、运行时选择状态和 tray 显示状态
- [contracts/menubar-auto-service-contract.md](./contracts/menubar-auto-service-contract.md) 规定 `menubarService = auto` 的偏好语义、宿主自动判断规则与 tray 图标/数字同步行为
- 现有 `UserPreferences`、`PreferencePatch`、`PanelPlaceholderItem` 与 `CodexPanelState` 继续作为跨层规范对象

### III. 测试门禁集成 —— 通过

本特性同时涉及宿主本地元数据读取、tray 运行时更新、设置页选项和真实菜单栏图标表现，因此必须覆盖：

- Rust 单元测试：本地活动信号读取、信号降级、自动选择状态机、偏好归一化、tray 图标选择
- 前端测试：`auto` 选项显示、可见服务范围、偏好保存与手动/自动切换
- 真实运行态验证：Tauri E2E 与截图回归，确认真实 tray 中图标与数字同步、双服务轮播节奏和手动回退行为

### IV. 真实用户状态 —— 通过

设计明确区分并要求 truthful 呈现以下状态：

- `手动固定服务`
- `自动单服务显示`
- `自动双服务轮播`
- `自动模式无新活动但保留上次显示`
- `自动模式尚未形成任何显示对象（中性态）`

并要求：

- 无新活动时只能保留“上一次自动选择结果”，不能伪造新活动
- 尚未形成显示对象时必须回退中性图标，不能暗示某个服务
- Claude Code 关闭时，即使本地文件有活动，也不得伪装成可显示服务

### V. 本地优先、可增量交付 —— 通过

本迭代完全依赖本地偏好、snapshot cache 和本机 agent 目录元数据，不需要新增云端或后台能力。交付可以分为：

1. 宿主活动监测与自动选择状态机
2. tray 数字/图标联动
3. 设置页 `auto` 选项与偏好持久化
4. 真实 tray 验证与回归

### 设计后宪章复查 —— 通过

Phase 1 设计产物已经覆盖关键门槛：

- `research.md` 固化了被动活动信号来源、宿主 ownership 和图标策略
- `data-model.md` 明确了 `auto` 模式下的运行时状态对象与边界
- `contracts/menubar-auto-service-contract.md` 固化了偏好、自动判断和 tray 显示契约
- `quickstart.md` 定义了本地测试、真实 tray 检查和异常场景验证流程

## 项目结构

### 文档（本特性）

```text
specs/015-agent-auto-menubar/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── menubar-auto-service-contract.md
├── checklists/
│   └── requirements.md
└── tasks.md
```

### 源码（仓库根目录）

```text
src/
├── app/
│   ├── settings/
│   │   ├── SettingsView.tsx
│   │   └── SettingsView.test.tsx
│   └── shared/
│       └── i18n.ts
├── features/
│   └── preferences/
│       └── defaultPreferences.ts
└── lib/
    └── tauri/
        ├── contracts.ts
        ├── summary.ts
        └── summary.test.ts

src-tauri/
├── Cargo.toml
├── icons/
│   └── services/           # 计划新增：tray 专用服务图标资产
└── src/
    ├── agent_activity/     # 计划新增：本地活动信号读取与自动模式状态机
    │   └── mod.rs
    ├── commands/
    │   └── mod.rs
    ├── state/
    │   └── mod.rs
    ├── tray/
    │   └── mod.rs
    └── lib.rs

tests/
├── contract/
├── integration/
└── e2e/
    ├── screenshot-review.mjs
    └── tray-panel.spec.mjs
```

**结构决策**：保持现有单仓库 Tauri 结构不变。本特性是“宿主本地活动信号读取 + tray 运行时选择 + 设置页选项扩展”的跨层增量改造，不需要新增包、独立服务或前端状态子应用。唯一新增模块是宿主侧 `agent_activity/`，用于隔离本地文件读取和自动选择状态机，避免把逻辑堆入 `tray/` 或 `commands/`。

## 阶段 0：研究 —— 已完成

完整结论见 [research.md](./research.md)。关键决策如下：

| 决策项 | 选择 | 原因 |
|--------|------|------|
| 活动来源 | 纯被动本地元数据读取 | 满足“对用户要求最小”与 local-first 目标 |
| 判断 owner | Rust 宿主层 | tray 生命周期在宿主层，且本地文件读取属于受信边界 |
| Codex 主信号 | `state_5.sqlite.threads.updated_at` | 最结构化、最接近真实会话活跃度 |
| Claude 主信号 | `projects/**/*.jsonl` 最新 mtime | 最接近 Claude 当前项目会话写入 |
| 自动语义 | 单服务优先 + 双服务低频轮播 + 无新活动保留上次结果 | 与已澄清规格一致，且可读性最好 |
| 运行节奏 | 15 秒扫描，15 秒轮播 | 满足 2 分钟内切换目标，不触发额外远端刷新 |
| tray 图标 | 服务图标基底 + 严重度着色 | 同时满足“显示当前服务”与既有风险提示 |
| 失败处理 | 降级回退链路，不伪造新活动 | 保持 truthful state |

## 阶段 1：设计与契约 —— 已完成

已产出以下设计工件：

- **[data-model.md](./data-model.md)**：定义 `auto` 模式的活动快照、运行时选择状态与 tray 显示状态
- **[contracts/menubar-auto-service-contract.md](./contracts/menubar-auto-service-contract.md)**：定义偏好语义、宿主自动判断规则和 tray 图标/数字同步契约
- **[quickstart.md](./quickstart.md)**：定义本地开发、自动模式验证、真实 tray 检查与回归流程

## 阶段 2：实现策略

### 切片 1 —— 偏好枚举扩展与可见服务范围收敛

范围：

- 将 `menubarService` 的规范值扩展为 `codex | claude-code | auto`
- 保持旧偏好文件兼容，并收敛新的归一化规则
- 让设置页下拉框始终展示 `auto`
- 在 Claude Code 关闭时，隐藏手动 `Claude Code` 选项，但保留 `auto`
- 更新前端 `VisibleServiceScope`，保证设置页与宿主偏好语义一致

主要文件：

- `src/lib/tauri/contracts.ts`
- `src/features/preferences/defaultPreferences.ts`
- `src/lib/tauri/summary.ts`
- `src/lib/tauri/summary.test.ts`
- `src/app/settings/SettingsView.tsx`
- `src/app/settings/SettingsView.test.tsx`
- `src-tauri/src/state/mod.rs`

测试：

- 旧偏好文件读取兼容性
- `auto` 选项可见性
- Claude Code 关闭时的手动选项隐藏与 `auto` 保留
- 手动模式与自动模式之间的切换持久化

### 切片 2 —— 宿主活动信号读取与自动选择状态机

范围：

- 在 `src-tauri/src/agent_activity/` 中实现 Codex / Claude 的被动活动信号读取器
- 使用只读 `rusqlite` 查询 Codex 主/辅信号，使用文件 metadata 读取 Claude 主/辅信号
- 为每个服务构建 `ServiceActivitySnapshot`
- 基于活跃窗口、阈值和可显示余量状态生成 `AutoMenubarSelectionState`
- 明确区分：
  - 单服务稳定显示
  - 双服务低频轮播
  - 无新活动保留上次结果
  - 尚未形成显示对象的中性态

主要文件：

- `src-tauri/Cargo.toml`
- `src-tauri/src/agent_activity/mod.rs`
- `src-tauri/src/state/mod.rs`
- `src-tauri/src/commands/mod.rs`

测试：

- Codex 主/辅信号读取与锁文件降级
- Claude 主/辅信号读取与不可读回退
- Claude Code 关闭时自动候选集合排除
- 单服务、双服务、无活动、中性态四种状态机转换

### 切片 3 —— tray 当前显示对象、图标与轮播运行时

范围：

- 把 tray 当前显示逻辑从“直接按 menubarService 过滤”升级为“按 resolved current display object 过滤”
- 引入宿主后台轻量循环，定期更新自动模式选择结果
- 在双服务近期活跃时按固定低频节奏轮播
- 将 tray 图标切换为当前服务图标，并保留严重度着色能力
- 在没有显示对象时使用中性图标
- 保持 tooltip、summaryText 与当前显示对象同步

主要文件：

- `src-tauri/src/tray/mod.rs`
- `src-tauri/src/lib.rs`
- `src-tauri/src/commands/mod.rs`
- `src-tauri/icons/services/*`

测试：

- tray summary 只取当前显示对象
- 图标与数字同步切换
- 中性态与保留上次结果的边界
- 双服务轮播节奏与退出轮播条件
- 启动后窗口隐藏状态下的 tray 自动更新

### 切片 4 —— 真实桌面验证与回归

范围：

- 用真实 Tauri tray 场景验证菜单栏数字、图标、tooltip 和手动回退
- 补充 E2E/截图覆盖，确保服务图标在真实菜单栏尺寸下可辨识
- 验证自动模式不改变 panel 顺序、刷新链路和已有 Claude/Codex 查询行为

主要文件：

- `tests/e2e/tray-panel.spec.mjs`
- `tests/e2e/screenshot-review.mjs`
- 受影响的 Rust / TS 测试文件

测试：

- `npm test`
- `cargo test`
- `npm run test:e2e:tauri`
- `npm run test:e2e:screenshots`
- 真实桌面手工检查 `auto` 选项、轮播节奏、无活动保留结果和图标同步

## 实现风险审查

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| 本地 SQLite / JSONL 在 agent 正在写入时可能短暂锁定或结构不完整 | 高 | Codex 与 Claude 都设计主/辅信号回退链路；单次读取失败不覆盖上一次稳定结果 |
| 纯被动信号可能受到后台整理写入影响，导致错误切换 | 高 | 引入活跃窗口、切换阈值、置信度优先级和“无新活动保留上次结果”规则 |
| tray 现在只在保存偏好或刷新数据时更新，自动模式需要额外运行时节奏 | 高 | 在宿主增加轻量后台循环，只更新自动选择结果，不触发远端额度刷新 |
| 服务图标在 18px 左右 tray 尺寸下可能不够可辨识，且严重度着色可能破坏识别 | 中 | 使用专门的 tray 资产，保留截图回归和真实菜单栏观察作为完成门槛 |
| `auto` 引入后，前后端对 `menubarService` 的合法值集合可能暂时不一致 | 中 | 同时更新 TS/Rust 契约、默认值和归一化测试，避免单侧先行 |
| Claude Code 已关闭但本地活动文件仍在更新，可能把 tray 错切到 Claude | 高 | 在宿主自动候选集合入口统一检查 `claudeCodeUsageEnabled`，并补回归测试 |
| “无新活动保留上次结果”和“尚未形成显示对象回退中性图标”容易被实现混淆 | 高 | 在数据模型与契约中显式拆成两个状态，并用单元测试锁定边界 |

## 复杂度跟踪

当前无须记录额外复杂度例外。方案保持在既有 Tauri + React 架构内，通过一个新的宿主活动模块和现有 tray/偏好链路扩展完成，不引入新的存储层、云基础设施或前台窗口权限方案。
