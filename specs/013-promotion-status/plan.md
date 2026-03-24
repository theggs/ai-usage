# 实施计划：优惠活动提示

**分支**：`013-promotion-status` | **日期**：2026-03-25 | **规格**：[spec.md](./spec.md)  
**输入**：来自 `/specs/013-promotion-status/spec.md` 的功能规格说明

## 摘要

本次工作把“当前是否值得优先使用某个服务”收敛成主界面头部下方的一条轻量促销提示，并将促销活动作为独立产品域纳入前端本地目录管理。技术方案分两层推进：一方面在 `src/features/promotions/` 内建立可追溯的活动目录、生命周期与时间/资格解析器，支持当前 Claude Code 与 Codex 活动并为未来活动保留历史；另一方面将头部副行升级为“默认紧凑胶囊 + 同区域锚定浮层”的双层表达，其中默认视图只显示值得关注的服务，展开详情按“每服务两行信息块”呈现更完整的结论、优惠幅度与时间说明。Claude Code 的详情第二行统一显示“活动日期范围 + 用户本地优惠窗口”，Codex 则显示“当前持续优惠时段”，从而在真实壳层宽度下兼顾一眼扫读与可信比较。

## 技术上下文

**语言/版本**：Rust stable（edition 2021）、TypeScript 5.x、Node.js 20 LTS  
**主要依赖**：Tauri 2、React 19、Tailwind CSS 4、Vitest、React Testing Library、Playwright  
**存储**：沿用现有 `preferences.json` 与 `snapshot-cache.json` 本地持久化；促销目录作为源码内静态数据维护；不新增存储层  
**测试**：`npm test`、定向 Vitest/RTL、Tauri E2E、截图回归；若宿主层未改动则不把 `cargo test` 作为首要验收项  
**目标平台**：Tauri 桌面应用，主要验收环境为 macOS 菜单栏面板，同时保持现有跨平台契约不破坏  
**项目类型**：桌面应用（Tauri 2 宿主 + React 前端）  
**性能目标**：默认头部副行保持 1 秒内可扫读；展开浮层在真实壳层中无明显抖动、跳动或重叠；促销判断为纯本地派生，不引入额外网络依赖  
**约束**：不得新增宿主敏感边界或远端配置；状态表达必须 truthful；颜色不能成为唯一语义；完整信息必须继续锚定在标题下方同一区域；Claude 第二行必须显示“活动日期范围 + 用户本地优惠窗口”；Codex 第二行必须使用“当前持续优惠时段”这类语义化表达  
**规模/范围**：当前覆盖 2 个服务（Claude Code、Codex）、1 个独立促销模块、1 条头部副行、1 个同区域完整浮层、1 份促销维护指南；不引入新服务端接口或后台管理系统

## 宪章检查

*门禁：必须在 Phase 0 研究前通过，并在 Phase 1 设计后重新检查。*

### I. 宿主边界安全 —— 通过

本特性不引入新的凭证读取、CLI 执行、第三方请求或操作系统能力路径。促销判断完全基于前端本地目录、现有偏好和已归一化的可见服务状态；React 侧只处理 UI 派生逻辑，不扩张 Tauri 宿主边界。

**可信边界声明**：Rust 宿主继续负责现有服务数据采集、偏好持久化和菜单栏窗口生命周期；促销模块只消费宿主已经提供的归一化前端状态，不接触任何新增敏感数据。

**明确非目标**：不新增网络抓取帮助中心页面、不增加远端配置中心、不把营销规则下沉到宿主层、不引入促销通知或推送。

### II. 契约优先的桌面表面 —— 通过

在实现前先定义稳定契约：
- [data-model.md](./data-model.md) 规定促销目录、资格规则、时间窗口、两行详情块所需的派生字段与浮层状态机
- [contracts/promotion-status-ui-contract.md](./contracts/promotion-status-ui-contract.md) 规定头部副行、小胶囊、完整浮层、hover/focus/click 行为与文案语义
- 当前实现继续消费归一化的 `PromotionDisplayDecision`，而不是在 `AppShell` 中拼接原始文案

### III. 测试门禁集成 —— 通过

本特性虽以前端为主，但涉及头部密集布局、时间与资格解析、真实壳层交互和可读性门槛，因此必须同时包含：
- 解析层单元测试：活动目录校验、时区换算、资格判断、历史过滤
- 组件与壳层测试：默认胶囊、两行详情块、hover/focus 预览、click 稳定展开、外部点击与 `Esc` 关闭
- 真实运行态验证：Tauri E2E 与截图回归，确认真实面板宽度下的一行可读性和浮层稳定性

### IV. 真实用户状态 —— 通过

设计明确区分并要求 truthful 呈现以下状态：
- `正在优惠时段`
- `不在优惠时段`
- `优惠资格待确认`
- `无优惠活动`

同时要求默认胶囊与完整浮层的语义保持一致，不得把资格未知伪装成生效、不得把 Codex 写成用户无法理解的机械时间串，也不得让颜色替代文本结论。

### V. 本地优先、可增量交付 —— 通过

全部能力都基于本地促销目录、前端派生逻辑和现有桌面表面完成，不依赖新增云基础设施。交付可以按促销域建模、头部交互、历史/维护文档和真实壳层验证四个切片逐步完成，每个切片都能形成可独立验证的用户价值。

### 设计后宪章复查 —— 通过

Phase 1 设计产物已经覆盖关键门槛：
- `data-model.md` 明确了活动目录、时间窗口、详情第二行与浮层状态的规范对象
- `contracts/promotion-status-ui-contract.md` 固化了头部副行和完整浮层的用户可见契约
- `quickstart.md` 给出了逻辑测试、真实壳层截图与促销维护文档的验证流程

## 项目结构

### 文档（本特性）

```text
specs/013-promotion-status/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── promotion-update-guide.md
├── contracts/
│   └── promotion-status-ui-contract.md
├── checklists/
│   └── requirements.md
└── tasks.md
```

### 源码（仓库根目录）

```text
src/
├── app/
│   ├── shared/
│   │   └── i18n.ts
│   └── shell/
│       ├── AppShell.tsx
│       └── AppShell.test.tsx
├── assets/
│   └── icons/
│       ├── service-claude-code.svg
│       └── service-codex.svg
├── components/
│   └── panel/
│       ├── PromotionStatusLine.tsx
│       └── PromotionStatusLine.test.tsx
├── features/
│   └── promotions/
│       ├── catalog.ts
│       ├── catalog.test.ts
│       ├── resolver.ts
│       ├── resolver.test.ts
│       └── types.ts
└── styles/
    └── globals.css

tests/
├── contract/
├── integration/
└── e2e/
    ├── screenshot-review.mjs
    └── tray-panel.spec.mjs
```

**结构决策**：继续沿用当前单仓库 Tauri 结构，不新增包或宿主模块。促销能力作为前端独立 feature module 落在 `src/features/promotions/`，UI 接入集中在 `PromotionStatusLine` 与 `AppShell`，验证继续复用现有 Vitest 与 Tauri E2E 路径。

## 阶段 0：研究 —— 已完成

完整结论见 [research.md](./research.md)。关键决策如下：

| 决策项 | 选择 | 原因 |
|--------|------|------|
| 活动权威来源 | 源码内独立促销目录 | 满足 local-first、可留痕与历史保留 |
| 解析边界 | 前端纯解析器，不新增宿主命令 | 促销判断是纯本地派生逻辑，无需扩张宿主边界 |
| 头部表达 | 两级头部 + 默认胶囊 + 同区域浮层 | 兼顾低打扰与多服务比较 |
| 交互模型 | hover/focus 预览，click 固定展开，外部点击/Esc 关闭 | 在菜单栏面板中更稳定，也更可验证 |
| 未知资格 | 单独建模为中性状态 | 避免误导，同时不隐藏服务 |
| 时间能力 | 使用原生时间能力 + 固定样例测试 | 当前规则复杂度不足以 justify 新库 |
| 真实验证 | 必须覆盖真实 Tauri 壳层 | 一行胶囊与浮层行为不能只靠 JSDOM 证明 |
| 详情结构 | 展开浮层按“两行信息块”展示，Claude 第二行显示“活动日期范围 + 用户本地优惠窗口” | 让用户在窄面板中仍能快速理解时间语义 |

## 阶段 1：设计与契约 —— 已完成

已产出以下设计工件：
- **[data-model.md](./data-model.md)**：促销目录、资格规则、时间窗口、两行详情块派生字段与浮层状态机
- **[contracts/promotion-status-ui-contract.md](./contracts/promotion-status-ui-contract.md)**：头部副行、小胶囊、完整浮层及状态文案契约
- **[quickstart.md](./quickstart.md)**：本地开发、时间/资格边界验证、真实壳层截图与交互检查流程

## 阶段 2：实现策略

### 切片 1 —— 促销域建模与当前活动目录

范围：
- 在 `src/features/promotions/` 中定义稳定的类型、活动目录与生命周期规则
- 纳入当前 Claude March 2026 usage promotion 与 Codex limited-time promotion
- 明确保留已结束/归档活动与来源信息，避免后续更新覆盖历史
- 为未来活动保留 `promotionType`、`lifecycle`、`historyNote` 和来源字段

主要文件：
- `src/features/promotions/types.ts`
- `src/features/promotions/catalog.ts`
- `src/features/promotions/catalog.test.ts`

测试：
- 目录唯一性、生命周期保留、当前活动与历史活动并存、来源字段保留

### 切片 2 —— 解析器与真实状态语义

范围：
- 构建纯前端解析器，根据当前时间、可见服务、资格信息和活动目录生成 `PromotionDisplayDecision`
- 支持 `正在优惠时段`、`不在优惠时段`、`优惠资格待确认`、`无优惠活动`
- 对 Codex 按“连续优惠时段”处理，并在完整浮层中提供 `2x`
- 对 Claude 解析工作日窗口命中情况，并为详情第二行派生“活动日期范围 + 用户本地优惠窗口”
- 为 Codex 详情第二行派生“当前持续优惠时段”

主要文件：
- `src/features/promotions/resolver.ts`
- `src/features/promotions/resolver.test.ts`
- `src/app/shared/i18n.ts`

测试：
- 时区换算、工作日窗口边界、资格未知、默认/完整视图过滤、详情第二行派生文本

### 切片 3 —— 头部胶囊与同区域完整浮层

范围：
- 将头部副行收敛为默认紧凑胶囊表达
- 将完整信息设计为锚定在同一区域的浮层
- 默认支持 hover/focus 预览、click 稳定展开、外部点击和 `Esc` 关闭
- 浮层中每个服务使用两行信息块：
  - 第一行：图标 + 服务名 + 结论 + 幅度
  - 第二行：时间信息或时段说明
- 保证默认副行仍保持一行紧凑可扫读，不引入显式 `...` 或独立说明块

主要文件：
- `src/components/panel/PromotionStatusLine.tsx`
- `src/components/panel/PromotionStatusLine.test.tsx`
- `src/app/shell/AppShell.tsx`
- `src/app/shell/AppShell.test.tsx`
- `src/styles/globals.css`

测试：
- 胶囊短文案、图标与颜色非唯一语义、两行详情块渲染、hover/focus/click 交互与关闭路径

### 切片 4 —— 历史保留、维护指南与真实壳层验证

范围：
- 补齐 `promotion-update-guide.md`，指导后续新增活动、结束活动、归档和规则修订
- 在 quickstart 中固化更新后验证流程
- 用真实 Tauri 壳层检查默认副行和完整浮层在窄面板中的稳定性
- 确认中英文下都不会因第二行信息过长而导致明显视觉抖动或重叠

主要文件：
- `specs/013-promotion-status/promotion-update-guide.md`
- `specs/013-promotion-status/quickstart.md`
- `tests/e2e/tray-panel.spec.mjs`
- `tests/e2e/screenshot-review.mjs`

测试：
- `npm test`
- `npm run test:e2e:tauri`
- `npm run test:e2e:screenshots`
- 按维护指南走一次活动更新与回归验证流程

## 实现风险审查

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| 头部副行空间极窄，默认胶囊和完整浮层容易互相挤压 | 高 | 默认视图严格只保留极短结论；完整信息移到同区域浮层；用真实壳层截图验证两种语言 |
| Claude 活动含官方时区与工作日规则，若直接暴露原始规则会增加用户理解成本 | 高 | 解析器派生“活动日期范围 + 用户本地优惠窗口”，避免把 ET/PT 规则原样抛给用户 |
| Codex 当前活动若继续用模糊表述，会导致“是否在优惠时段”心智不统一 | 中 | 产品语义统一按连续优惠时段处理，并在完整浮层中补 `2x` 幅度 |
| 浮层只靠 hover 会在菜单栏面板中出现抖动或无法稳定查看 | 高 | 交互模型固定为 hover/focus 预览、click 固定展开、外部点击/Esc 关闭 |
| 历史活动若被直接覆盖，后续维护者无法判断旧规则为何下线 | 中 | 目录实体显式保留 `lifecycle`、`historyNote`、来源字段和 review 时间 |
| 第二行时间信息过长可能在真实壳层中出现折行和密度失控 | 中 | 将第二行限制为语义化短句；Claude 只展示日期范围和本地窗口，Codex 只展示持续时段；截图回归作为完成门槛 |

## 复杂度跟踪

当前无须记录额外复杂度例外。方案保持在既有 Tauri + React 架构内，通过前端独立 feature module 和稳定 UI 契约完成，不引入新的跨层抽象或基础设施。
