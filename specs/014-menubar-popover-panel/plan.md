# 实施计划：菜单栏吸附式弹出面板

**分支**：`014-menubar-popover-panel` | **日期**：2026-03-25 | **规格**：[spec.md](./spec.md)  
**输入**：来自 `/specs/014-menubar-popover-panel/spec.md` 的功能规格说明

## 摘要

本次工作把 AIUsage 的主界面从“标准窗口中的内嵌卡片”升级为更接近 macOS 菜单栏工具的吸附式弹出面板。技术方案分为两层：一方面在 Rust 宿主层把 tray 点击从简单的 `show()/hide()` 升级为“基于菜单栏图标位置计算弹出坐标、边缘收敛、异常回退、失焦隐藏”的原生窗口策略；另一方面在 React 壳层把当前外层灰色/渐变背景与双层容器收敛为单一白色面板本体，并在重新打开时回到主额度面板视图。实现上优先复用现有单窗口、偏好持久化、面板/设置双视图与 E2E 驱动，不新增存储层，不依赖 macOS 私有透明 API；同时要求在壳层重构后继续保留刷新、设置、额度摘要与空/加载/断开/陈旧/失败等真实用户状态的可见性。重点改动集中在 `src-tauri/src/tray/`、`src-tauri/src/lib.rs`、`src-tauri/tauri.conf.json`、`src/app/shell/AppShell.tsx`、相关样式与真实壳层验证脚本。

## 技术上下文

**语言/版本**：Rust stable（edition 2021）、TypeScript 5.x、Node.js 24 LTS  
**主要依赖**：Tauri 2、React 19、Tailwind CSS 4、Vitest、React Testing Library、Playwright、现有 macOS Swift E2E 辅助脚本  
**存储**：沿用现有 `preferences.json` 与 `snapshot-cache.json` 本地持久化；新增“上一次成功弹出位置”仅作为宿主内存态缓存，不新增持久化文件  
**测试**：`npm test`、`cargo test`、`npm run test:e2e:tauri`、`npm run test:e2e:screenshots`，必要时补充 tray/placement 的宿主单测  
**目标平台**：Tauri 桌面应用，主要验收环境为 macOS 菜单栏面板；Windows 与其他非 macOS 平台保持现有窗口契约不被破坏  
**项目类型**：桌面应用（Tauri 2 宿主 + React 前端）  
**性能目标**：主面板重新打开后 1 秒内可直接交互；tray 点击定位稳定、不出现明显跳变；视觉上仅保留单一白色面板本体；内容较少时无明显多余空白，内容较多时不超出可视工作区  
**约束**：不得新增凭证路径或扩张可信边界；不得新增持久化层；优先通过无装饰单一面板达成视觉目标，不依赖 macOS 私有透明窗口 API；必须保持失焦隐藏、Esc 关闭、重新打开回到主面板；该特性不能只靠 JSDOM 判定完成，必须经过真实壳层验证  
**规模/范围**：1 个主窗口、1 套宿主定位策略、2 个内部视图（panel/settings）、1 套壳层视觉收敛、现有 E2E/截图验证链路扩展；不引入新业务服务或新宿主命令族

## 宪章检查

*门禁：必须在 Phase 0 研究前通过，并在 Phase 1 设计后重新检查。*

### I. 宿主边界安全 —— 通过

本特性不引入新的凭证读取、CLI 解析或第三方网络路径。所有 tray 点击、窗口定位、关闭/失焦隐藏以及异常回退都继续由 Tauri 宿主层负责；前端只消费既有归一化状态，并重构可视壳层。

**可信边界声明**：Rust 宿主仍是菜单栏图标事件、窗口位置计算、窗口生命周期与偏好持久化的唯一可信边界。React 不直接读取 tray 几何信息，也不自行决定最终窗口屏幕坐标。

**明确非目标**：新增远端配置、把窗口定位逻辑搬到前端、引入真实透明窗口所需的 macOS 私有能力、在此特性中新增手动拖动窗口能力。

### II. 契约优先的桌面表面 —— 通过

本计划先定义稳定契约，再展开实现：
- [contracts/menubar-popover-ui-contract.md](./contracts/menubar-popover-ui-contract.md) 固化 tray 触发、弹出定位、边缘收敛、异常回退、Esc/失焦关闭和单一面板视觉契约。
- [data-model.md](./data-model.md) 定义宿主定位决策、内存态回退缓存、壳层视图状态与单一表面策略。

本次不要求新增 `invoke` 命令，但会更新 host-owned window behavior 契约，并在需要时评估 `src-tauri/capabilities/default.json` 是否要为前端窗口可见性监听补充权限。

### III. 测试门禁集成 —— 通过

本特性横跨宿主 tray 事件、窗口定位、前端壳层与真实桌面运行时，必须至少包含：
- Rust 单测：定位计算、边缘收敛、回退顺序和显示器/工作区约束
- RTL：壳层单一表面、重新打开回到 panel 视图、Esc 关闭与内部滚动行为
- 真实 Tauri/E2E 与截图：验证主面板在图标下方弹出、边缘不越界、无灰色外衬底、设置页仍可访问

### IV. 真实用户状态 —— 通过

本次设计必须保持“位置与状态都真实”：
- 无法获取本次 tray 几何信息时，明确回退到上一次成功位置；若无缓存，则回退到当前显示器顶部安全默认位
- 重新打开时不伪装为“记住上次次级页面”，而是回到主额度面板
- 视觉收敛不能掩盖刷新、空状态、断开状态、陈旧状态、失败状态和设置交互的真实性

### V. 本地优先、可增量交付 —— 通过

全部改动都建立在现有本地 tray、单窗口和偏好体系之上，不依赖云端基础设施。工作可分成宿主定位、壳层视觉、视图生命周期和真实壳层验证四个切片增量交付，每个切片都能独立形成用户可见价值。

## 项目结构

### 文档（本特性）

```text
specs/014-menubar-popover-panel/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── menubar-popover-ui-contract.md
├── checklists/
│   └── requirements.md
└── tasks.md
```

### 源码（仓库根目录）

```text
src/
├── app/
│   ├── shell/
│   │   ├── AppShell.tsx
│   │   └── AppShell.test.tsx
│   ├── panel/
│   │   ├── PanelView.tsx
│   │   └── PanelView.test.tsx
│   └── settings/
│       ├── SettingsView.tsx
│       └── SettingsView.test.tsx
├── lib/
│   └── tauri/
│       ├── client.ts
│       └── contracts.ts
└── styles/
    └── globals.css

src-tauri/
├── tauri.conf.json
├── capabilities/
│   └── default.json
└── src/
    ├── lib.rs
    ├── tray/
    │   └── mod.rs
    └── state/
        └── mod.rs

tests/
└── e2e/
    ├── tauri-driver.mjs
    ├── tray-panel.spec.mjs
    └── screenshot-review.mjs
```

**结构决策**：继续沿用当前单仓库 Tauri 结构，不新增子应用或新存储模块。宿主层改动集中在 `tray/mod.rs` 与窗口生命周期入口；前端改动集中在 `AppShell` 及现有 panel/settings 视图；验证继续复用既有 macOS Swift E2E 驱动与截图脚本。

## 阶段 0：研究 —— 已完成

完整决策见 [research.md](./research.md)。关键结论如下：

| 决策项 | 选择 | 原因 |
|--------|------|------|
| 定位权威边界 | 由 Rust 宿主根据 tray 事件几何信息计算并应用位置 | tray 图标几何与窗口可视工作区属于原生能力，宿主层更稳定 |
| 视觉实现策略 | 使用无装饰单一面板壳层达成结果，不默认依赖真正透明窗口 | 可以满足“只看到白色面板本体”的视觉结果，同时避免 macOS 私有 API 风险 |
| 横向对齐 | 以菜单栏图标水平中心线为基准，越界时再收敛 | 与 spec 澄清一致，也最符合菜单栏工具直觉 |
| 高度策略 | 内容自适应收紧，超过上限后内部滚动 | 同时满足紧凑感和工作区约束 |
| 兜底策略 | tray 几何可用时优先使用；不可用时回退到上一次成功位置；若两者都不可用则使用当前显示器顶部安全默认位 | 保证异常场景仍稳定可见，避免随机跳位 |
| 视图生命周期 | 重新打开主面板默认回到 panel 视图，并清理与次级视图相关的瞬态状态 | 与 FR-014 对齐，减少用户心智负担 |
| 手动拖动 | 本特性不新增手动拖动能力 | 与“吸附式弹出面板”目标相冲突，也会显著抬高实现和验证成本 |
| 完成门槛 | 必须经过真实桌面会话验证，不能只靠 JSDOM/RTL | 定位、边缘收敛、失焦隐藏与视觉结果都依赖真实运行时 |

## 阶段 1：设计与契约 —— 已完成

已产出以下设计工件：
- **[data-model.md](./data-model.md)**：宿主定位策略、回退缓存、壳层视图状态和单一表面策略
- **[contracts/menubar-popover-ui-contract.md](./contracts/menubar-popover-ui-contract.md)**：tray 交互、窗口行为、视觉结果和关闭路径契约
- **[quickstart.md](./quickstart.md)**：本地验证、GUI 环境检查、E2E 与截图回归流程

## 阶段 2：实现策略

### 切片 1 —— 宿主定位策略与 tray 吸附弹出

范围：
- 将 `toggle_main_window` 从简单的 `show()/hide()` 升级为“读取 tray 触发点 -> 计算目标位置 -> 边缘收敛 -> 显示”
- 在宿主层维护“上一次成功弹出位置”的内存态缓存，用于 tray 几何缺失时的异常回退
- 为首次异常且无缓存时提供顶部安全默认位，保证主面板仍可见
- 保持既有 close-to-hide、blur-to-hide 语义，并确保多显示器下跟随当前点击所在显示器
- 将新的定位/窗口策略限制在 macOS 目标行为内，避免破坏其他平台现有窗口契约

主要文件：
- `src-tauri/src/tray/mod.rs`
- `src-tauri/src/lib.rs`
- `src-tauri/src/state/mod.rs`（如需承载内存态窗口缓存）

测试：
- Rust 单测：中心对齐、左右边缘收敛、显示器工作区约束、回退顺序
- Tauri/E2E：验证主面板在当前显示器的图标下方弹出

### 切片 2 —— 无传统窗口感的单一面板壳层

范围：
- 将主窗口改造成无传统边框/顶栏的菜单栏面板形态
- 移除当前外层灰色/渐变衬底与双层窗口容器感，让白色面板本体成为唯一可见表面
- 收紧外层留白、阴影、圆角与背景 token，确保视觉上只识别到一个面板
- 视需要调整 `tauri.conf.json` 的尺寸、装饰与默认窗口 footprint

主要文件：
- `src-tauri/tauri.conf.json`
- `src/app/shell/AppShell.tsx`
- `src/styles/globals.css`
- `src/app/panel/PanelView.tsx`
- `src/app/settings/SettingsView.tsx`

测试：
- RTL：验证壳层 DOM 结构收敛，不再依赖外层背景容器表达窗口感
- 截图/E2E：验证“只看到白色面板本体”这一视觉结果

### 切片 3 —— 重新打开回到主面板与高度策略落地

范围：
- 主面板隐藏后再次显示时，默认回到 panel 视图
- 清理与 settings/overlay 相关的瞬态状态，避免重新打开时停留在次级页面
- 落实“内容少时收紧、内容多时内部滚动”的高度策略
- 保持 panel/settings 双视图切换的稳定性，不引入新的窗口或分裂交互
- 落实 `Esc` 关闭整个主面板的键盘路径
- 确保额度摘要、刷新入口与空/加载/断开/陈旧/失败状态在打开与重新打开后仍直接可见且不被壳层重构掩盖

主要文件：
- `src/app/shell/AppShell.tsx`
- `src/app/shell/AppShell.test.tsx`
- `src/app/panel/PanelView.tsx`
- `src/app/settings/SettingsView.tsx`
- `src-tauri/capabilities/default.json`（仅在前端窗口 API 监听/隐藏需要额外权限时）

测试：
- RTL：验证重新打开后回到 panel、Esc 关闭、内部滚动与 currentView 重置
- E2E：验证从 settings 打开/关闭/重新打开后的真实行为

### 切片 4 —— 真实桌面验证与 E2E 可观测性补强

范围：
- 扩展现有 `tests/e2e/tray-panel.spec.mjs`，覆盖图标下方弹出、点击外部关闭、切换应用关闭、Esc 关闭、重新打开回到 panel，以及重新打开后 1 秒内可直接使用核心操作
- 扩展 `tests/e2e/screenshot-review.mjs`，增加“无灰色外衬底”“内容收紧”“设置页滚动”截图
- 将“空/加载/断开/陈旧/失败状态不被壳层改造掩盖”与“截图人工评审清单”纳入验证流程
- 如现有驱动不足以验证窗口位置，补充最小必要的窗口几何输出或 test-mode 可观测信息
- 将 GUI 真实会话检查和必要的 `caffeinate -d` 建议纳入 quickstart

主要文件：
- `tests/e2e/tray-panel.spec.mjs`
- `tests/e2e/screenshot-review.mjs`
- `tests/e2e/tauri-driver.mjs`
- `src-tauri/src/lib.rs`（如需 test-mode 下补充观测信息）

测试：
- `npm run test:e2e:tauri`
- `npm run test:e2e:screenshots`
- 必要时结合新增宿主单测，覆盖 tray rect 缺失的异常路径

## 实现风险审查

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| 无装饰窗口后仍残留“窗口里套卡片”的视觉感 | 高 | 在 React 壳层同步移除外层灰色/渐变衬底，把白色面板本体作为唯一可见表面，并以截图验收 |
| tray 图标几何在某些运行态下不可用，导致定位失败或跳位 | 高 | 设计明确回退顺序：tray rect -> 上一次成功位置 -> 当前显示器顶部安全默认位；用宿主单测覆盖 |
| 边缘收敛逻辑在多显示器或缩放场景下出现越界 | 高 | 把工作区收敛逻辑保持为纯函数并做 Rust 单测，再用真实多显示器场景补一轮人工/截图验证 |
| 重新打开仍停留在 settings 或中间态，破坏“快速看一眼”心智 | 中 | 将显示事件与 `currentView` 重置解耦成显式生命周期处理，并在 RTL/E2E 中同时验证 |
| `Esc` 关闭与 blur/hide 交互互相干扰，导致重复隐藏或状态残留 | 中 | 统一关闭路径语义为“隐藏主窗口”，由一个集中逻辑处理，并测试不同关闭来源 |
| 视觉上想达到“只有白色面板”，团队误解为必须使用真正透明窗口 | 中 | 在研究与计划中明确：优先用单一可见面板壳层达成视觉结果，不把透明私有 API 当默认方案 |
| 壳层重构后把空态、加载态或失败态弱化成模糊占位内容 | 高 | 将真实用户状态保真写入规格与测试，并在 panel 级测试和真实截图复核中同时验证 |
| 跨平台窗口配置被 macOS 面板化改动误伤 | 中 | 对窗口策略采用平台条件化约束，并在回归中明确检查非 macOS 契约未发生变化 |
| 真实桌面 UI 改动只靠单元测试通过，遗漏运行时问题 | 高 | 把 `npm run test:e2e:tauri`、`npm run test:e2e:screenshots` 和截图复核列为完成门槛 |

## 设计后宪章复查

### I. 宿主边界安全 —— 通过

Phase 1 设计确认 tray 几何、窗口坐标和关闭路径仍由宿主负责；前端不新增敏感能力或新凭证路径。

### II. 契约优先的桌面表面 —— 通过

窗口行为、视觉结果和回退路径已记录在 [contracts/menubar-popover-ui-contract.md](./contracts/menubar-popover-ui-contract.md)，并用 [data-model.md](./data-model.md) 明确了承载这些行为的状态对象。

### III. 测试门禁集成 —— 通过

设计已把 Rust 定位单测、RTL 壳层回归与真实 Tauri/E2E 截图全部纳入完成门槛，没有把此特性误归类为“仅前端样式调整”。

### IV. 真实用户状态 —— 通过

回退顺序、重新打开的视图策略、失败场景和视觉结果都以明确、可观察的用户状态表达，没有用不透明的“魔法行为”掩盖异常。

### V. 本地优先、可增量交付 —— 通过

方案完全建立在本地 tray、单窗口和本地快照体系之上，可按宿主定位、前端壳层、生命周期、验证链路四个切片递进交付。

## 复杂度跟踪

当前无须记录额外复杂度例外。方案保持在既有 Tauri + React 架构内，通过宿主定位函数、壳层重构与测试扩展完成，不引入新的跨层基础设施。
