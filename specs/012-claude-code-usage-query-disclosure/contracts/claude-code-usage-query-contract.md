# 契约：Claude Code 用度查询告知与启用控制

**特性**：012-claude-code-usage-query-disclosure  
**日期**：2026-03-24

本文档定义本特性中受影响的偏好契约、宿主命令语义，以及首次引导、设置页和 README 的稳定用户可见行为。

---

## 1. 偏好契约

### `UserPreferences` 新增字段

| Field | Type | Default | Meaning |
|-------|------|---------|---------|
| `claudeCodeUsageEnabled` | `boolean` | `false` | 是否允许 AIUsage 使用本机现有 Claude Code 登录凭证查询官方额度 |
| `claudeCodeDisclosureDismissedAt` | `string?` | `undefined` | 是否已确认过 onboarding 中的 Claude Code 说明卡片 |

### `PreferencePatch` 新增字段

| Field | Type | Effect |
|-------|------|--------|
| `claudeCodeUsageEnabled` | `boolean?` | 直接切换 Claude Code 用度查询启用态 |
| `claudeCodeDisclosureDismissedAt` | `string?` | 记录用户点击 `我知道了` 的确认时间 |

### 兼容性要求

- 旧偏好文件缺少新增字段时，读取结果必须自动补齐安全默认值。
- `claudeCodeUsageEnabled` 缺失时，必须按 `false` 处理。
- `claudeCodeDisclosureDismissedAt` 缺失时，必须按“尚未确认说明卡片”处理。

---

## 2. Claude Code 命令语义契约

### `get_preferences`

- 返回值必须包含 `claudeCodeUsageEnabled` 与 `claudeCodeDisclosureDismissedAt`。
- 前端不得自行猜测这两个字段的默认值；以宿主返回值为准。

### `save_preferences`

- 当 patch 中包含 `claudeCodeUsageEnabled` 时，保存必须在同一次请求周期内更新宿主内存态与持久化文件。
- 当关闭 Claude Code 且当前菜单栏正在使用 `claude-code` 时，返回的偏好结果必须已经完成当前激活态归一化。
- 当 patch 中包含 `claudeCodeDisclosureDismissedAt` 时，仅影响 onboarding 中的说明卡片显示，不得自动启用 Claude Code。
- 当用户从关闭切到开启时，宿主或前端编排必须在同一次交互中进入查询中状态；若命中共享冷却间隔，可跳过本次实际请求并直接复用缓存/最近结果。

### `get_claude_code_panel_state`

- 当 `claudeCodeUsageEnabled = true` 时，保持现有契约：可返回 live/cached/empty/failed/pending 等规范状态。
- 当 `claudeCodeUsageEnabled = false` 时，命令不得读取 Claude Code 登录凭证，不得发起 Claude 官方请求，也不得从关闭态缓存中构造可见服务结果。
- 如在关闭状态下仍被调用，命令必须返回一个安全的空形状 `CodexPanelState`，其 `items` 为空；前端不得把该结果渲染为“已启用的 Claude Code 服务”。

### `refresh_claude_code_panel_state`

- 当 `claudeCodeUsageEnabled = true` 时，触发真实刷新。
- 当 `claudeCodeUsageEnabled = false` 时，不得读取凭证、不得请求官方接口、不得刷新 Claude cache。
- 当 `claudeCodeUsageEnabled = true` 且距最近一次成功查询尚未超过最小冷却间隔时，命令必须静默跳过本次实际请求，允许调用方复用已有缓存或当前结果，不得将该情况表现为错误。

### 共享冷却约束

- Claude Code 的开关触发查询、手动刷新和自动刷新必须共用同一个最小冷却间隔。
- 冷却命中只影响“是否发起新的官方请求”，不影响前端是否进入一次明确的查询中/刷新中反馈。
- 冷却命中后，如存在缓存或最近成功结果，应返回可复用的安全状态；如不存在缓存，也不得伪造成功数据。

---

## 3. 缓存与可见性契约

- Claude Code 关闭后，已有 snapshot cache 可以保留在本地。
- 关闭期间，缓存不得：
  - 出现在主面板可见服务集合中
  - 驱动 tray summary 或 tooltip
  - 触发宿主对 Claude Code stale cache 的重新播种
- 重新启用后，可以先用缓存快速恢复 Claude Code 初始面板状态，再立即发起一次真实刷新。
- 重新启用或手动刷新时若命中冷却间隔，可以保留缓存/当前结果，但必须保持 truthful state：缓存显示时要伴随刷新中指示，不得把旧缓存伪装为最新结果。

---

## 4. 首次引导表面契约

### 显示条件

- 当现有 onboarding 表面出现，且 `claudeCodeDisclosureDismissedAt` 为空时，必须额外显示一张独立的 Claude Code 查询说明卡片。

### 卡片内容

- 醒目标识：`Claude Code 查询`
- 正文必须传达以下语义：
  - 使用本机现有 Claude Code 登录凭证
  - 仅用于向 Claude 官方接口查询额度状态
  - 不会主动发送到 AIUsage 自己的服务或其他非官方接口
  - 部分地区可能需要代理，程序默认自动检测并使用可用代理配置
- 按钮文案：`我知道了`

### 交互

- 点击 `我知道了` 后，只关闭这张说明卡片。
- 说明卡片的确认状态必须持久化。
- 点击 `我知道了` 不得关闭整个 onboarding，不得自动启用 Claude Code。

---

## 5. 设置页表面契约

### 放置规则

- Claude Code 独立卡片必须位于设置页最底部，且与主设置卡片同级。
- 原有设置项顺序不得变动。

### 卡片结构

- 卡片标题为 `Claude Code 查询`。
- 启用开关位于标题右侧，为直接切换的 `Switch`，不弹确认层。
- 说明正文位于标题行下方。
- 语义必须与 onboarding/README 对齐。
- 在英文界面下必须显示英文版本，不得中英混杂。
- 默认值为关闭。
- 开启后必须立即进入查询中状态，并在允许时触发首次查询；若命中冷却间隔，则直接复用缓存或当前结果。
- 关闭后必须立即停止 Claude Code 查询链路。

### 相关设置项联动

- 当 Claude Code 关闭时，`菜单栏服务` 不再提供 `Claude Code` 作为可选项。
- 当 Claude Code 关闭时，`面板顺序` 不再展示 Claude Code 排序入口。
- 当 Claude Code 再次开启时，可恢复其在可见集合中的位置与查询能力。

---

## 6. README 表面契约

- README 必须包含独立的 Claude Code 查询说明小节。
- 小节必须明确以下 4 类信息：
  - 读取本机现有 Claude Code 登录凭证
  - 仅用于查询 Claude 官方额度状态
  - 不会主动发送到 AIUsage 自己的服务或其他非官方接口
  - 部分地区可能需要代理，程序默认自动检测并使用可用代理配置

---

## 7. 国际化契约

- onboarding 卡片、设置页说明和开关文案都必须进入现有中英文 i18n 体系。
- 中文与英文必须表达相同的行为边界，不允许一边缺少“只用于官方额度查询”或“不会主动发送到非官方接口”等关键信息。
