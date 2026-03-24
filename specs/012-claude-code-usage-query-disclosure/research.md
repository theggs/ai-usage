# Research: Claude Code 用度查询告知与启用控制

**Phase**: 0 — Research & Decision Log  
**Feature**: 012-claude-code-usage-query-disclosure  
**Date**: 2026-03-24

## Decision 1 — Claude Code 关闭语义必须在前后端同时生效

**Decision**: 采用“双层硬关闭”策略。前端在初始化、自动刷新、手动刷新和设置联动中不再主动请求 Claude Code；宿主侧 `get_claude_code_panel_state`、`refresh_claude_code_panel_state`、`build_tray_items` 等入口也必须在关闭状态下短路，禁止继续读取凭证、消费缓存或向官方接口发起请求。

**Rationale**: 只在前端做隐藏无法覆盖托盘初始化、宿主命令直调、未来回归路径或测试调用。只有宿主层也明确认领“关闭就停”，才能满足规格中的信任边界要求。

**Alternatives considered**:
- 仅由前端停止调用 Claude 命令：拒绝，无法防住宿主启动与 tray 路径
- 仅由宿主处理关闭，前端继续加载 Claude 状态：拒绝，用户仍会看到多余状态与无效控件

---

## Decision 2 — 新偏好字段直接扩展现有 preferences 契约

**Decision**: 在现有 `UserPreferences` / `PreferencePatch` 上新增 `claudeCodeUsageEnabled` 与 `claudeCodeDisclosureDismissedAt`，两侧默认值统一为：用度查询默认关闭，告知确认时间默认缺失。

**Rationale**: 本项目已经有稳定的本地偏好存储与归一化逻辑，新字段直接扩展现有契约即可满足升级兼容、安全默认值和跨层一致性要求，无需增加新文件或新 store。

**Alternatives considered**:
- 新建单独的 Claude Code 设置文件：拒绝，增加存储复杂度且没有额外收益
- 只在前端 localStorage 保存新字段：拒绝，无法覆盖宿主禁用语义与 tray 初始化路径

---

## Decision 3 — 关闭后保留缓存，但缓存不可见也不可驱动行为

**Decision**: 关闭 Claude Code 用度查询时保留现有 snapshot cache 文件内容，但面板、设置、tray 和刷新链路都不得在关闭状态下消费该缓存。重新启用后允许先用缓存快速恢复界面，再立即触发一次真实刷新。

**Rationale**: 这同时满足两个产品目标：一是“关闭就停”，二是重新启用时仍保持轻量、快速的本地体验。保留缓存还能减少重新启用后第一次渲染的空白期。

**Alternatives considered**:
- 关闭时直接删除缓存：拒绝，会丢掉用户此前的本地快照，重新启用体验更差
- 关闭时继续展示缓存但不刷新：拒绝，违背“关闭就停”的真实状态承诺

---

## Decision 4 — 设置归一化只立即修正当前激活态，不强制抹掉所有历史偏好

**Decision**: 当 Claude Code 被关闭时，当前活跃的 tray 选择必须立即回退，不再允许相关设置项继续暴露 Claude Code；但服务排序可以通过“派生可见服务集合”来隐藏 Claude Code，而不是强制抹掉所有历史顺序信息。

**Rationale**: 用户关闭 Claude Code 后，界面必须立刻真实；但如果把所有历史顺序完全删掉，重新启用时会丢掉用户已有偏好。对当前活跃状态做强归一化、对非活跃排序做派生隐藏，是更平衡的方案。

**Alternatives considered**:
- 关闭后彻底清空所有 Claude 相关偏好：拒绝，重新启用体验会倒退
- 关闭后什么都不改，只靠 UI 置灰：拒绝，仍会留下“已关闭但仍在使用”的矛盾态

---

## Decision 5 — 首次告知复用现有 onboarding，而不是新增阻断式弹层

**Decision**: 复用现有“无服务数据时的 onboarding 表面”，在其中增加一张独立的 Claude Code 说明卡片与 `我知道了` 按钮；确认后只关闭该卡片并持久化，不结束整个 onboarding，也不自动启用 Claude Code。

**Rationale**: 这个方案最符合 PRD 的“轻量无感”目标。用户能在第一次需要理解产品时看到说明，但不会被额外 modal 或二次确认打断主流程。

**Alternatives considered**:
- 在开关切换时弹确认层：拒绝，用户已明确判定为过度设计
- 完全只靠 README / 设置页说明：拒绝，首次接触时透明度不足

---

## Decision 6 — 新增界面文案必须进入现有中英文 i18n 体系

**Decision**: onboarding 卡片、设置页说明和开关文案都纳入现有 `i18n.ts`，随应用语言在中文和英文间切换；README 沿用当前仓库文档语言策略，不额外扩展 README 的多语言体系。

**Rationale**: 这是最小且一致的本地化方案。UI 层新增文案如果不进 i18n，会在英文模式下出现中英混杂，影响既有产品完整度。

**Alternatives considered**:
- 只提供中文 UI 文案：拒绝，与现有语言设置不一致
- 顺带把 README 做成完整双语：拒绝，超出本迭代范围

---

## Decision 7 — 本特性需要真实 Tauri 运行态验证，而不只靠组件测试

**Decision**: 除常规单元/集成测试外，必须使用真实 Tauri onboarding 场景与 E2E 截图/交互验证设置页底部 Claude Code 查询卡片、onboarding 告知卡片、禁用后的 tray/面板归一化和重新启用后的首次查询行为。

**Rationale**: 本特性同时改动首次引导、设置布局、偏好联动和宿主命令路径。JSDOM 能覆盖逻辑，但不能完整证明真实桌面壳中的初始化顺序、视觉排布和 tray 行为。

**Alternatives considered**:
- 仅靠 Vitest/RTL：拒绝，无法覆盖真实启动与桌面表面行为
- 全部依赖人工手测：拒绝，回归成本高且不稳定

---

## Decision 8 — Claude Code 官方请求必须共享统一冷却机制

**Decision**: Claude Code 的开关触发查询、手动刷新和自动刷新共用同一个最小冷却间隔。若距上一次成功查询尚未超过该间隔，则本次实际请求被静默跳过，优先复用已有缓存；如果当前是用户刚开启 Claude Code，则仍需展示“查询中/正在刷新”的可见反馈，但最终不将冷却跳过表现为错误。

**Rationale**: 当前规格已经把“开启即查”“缓存优先恢复”“真实查询中状态”和“避免 429 速率限制”同时作为要求。共享冷却机制是把这几个目标统一起来的最小方案：既不放任重复请求，也不让用户看到启用后毫无反馈或被错误惊扰。

**Alternatives considered**:
- 仅对自动刷新加冷却，开关和手动刷新不受约束：拒绝，会导致快速切换或重复点击仍然触发 429 风险
- 冷却期内直接报错提示“请求过快”：拒绝，这不是用户可操作的故障，会破坏“轻量无感”体验
