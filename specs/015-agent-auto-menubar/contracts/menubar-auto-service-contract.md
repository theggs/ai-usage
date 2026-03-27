# 契约：菜单栏自动服务跟随

**特性**：015-agent-auto-menubar  
**日期**：2026-03-27

本文档定义本特性中受影响的偏好契约、宿主自动判断语义，以及菜单栏图标与数字的稳定用户可见行为。

---

## 1. 偏好契约

### `UserPreferences.menubarService`

| Value | Meaning |
|-------|---------|
| `codex` | 手动固定显示 Codex |
| `claude-code` | 手动固定显示 Claude Code |
| `auto` | 自动模式；由宿主根据最近活动痕迹决定菜单栏当前显示对象 |

兼容性要求：

- 旧偏好文件缺少 `menubarService` 时，默认值仍为 `codex`。
- 新版本必须能读取并保留 `auto`，不得在序列化或反序列化阶段把它视为非法值。
- 当 `claudeCodeUsageEnabled = false` 时，`menubarService = "auto"` 仍然合法，但 Claude Code 不得进入自动模式候选集合。

### `PreferencePatch.menubarService`

- 设置页选择 `自动` 时，`save_preferences` 必须接受 `{ menubarService: "auto" }`。
- `save_preferences` 返回值必须包含已经持久化后的 `menubarService`，前端不得自行猜测保存结果。
- 手动模式与自动模式之间的切换必须在同一次交互周期内生效，并立即更新 tray 显示。

---

## 2. Host Command Contract

本特性默认不新增新的公开 `invoke` 命令，继续复用现有偏好与 panel 命令；自动模式的活动扫描与轮播是宿主内部运行时行为。

| Command | Input | Output | Behavior change in this feature |
|--------|-------|--------|----------------------------------|
| `get_preferences` | None | `UserPreferences` | 返回值中的 `menubarService` 现在可能是 `auto` |
| `save_preferences` | `PreferencePatch` | `UserPreferences` | 接受并持久化 `menubarService = "auto"`；保存后立即重算 tray 当前显示结果 |
| `get_codex_panel_state` | None | `CodexPanelState` | 无新增字段；其 `items` 继续作为 Codex tray 数字数据来源 |
| `get_claude_code_panel_state` | None | `CodexPanelState` | 无新增字段；只有在 Claude Code 可见时才进入自动候选集合 |

约束：

- 自动模式的活动信号读取必须在宿主层完成，不得把 `~/.codex` / `~/.claude` 的解析下放到前端。
- 自动模式不得引入新的远端额度请求命令；活动扫描与 quota refresh 必须保持解耦。

---

## 3. 自动模式判断契约

### 活动来源

- 自动模式只允许使用本机可读取的活动痕迹：
  - Codex：`state_5.sqlite`、`session_index.jsonl`、`logs_1.sqlite`、`sessions/**/*.jsonl`
  - Claude Code：`projects/**/*.jsonl`、`history.jsonl`、`session-env/<sessionId>/`
- 不得要求用户额外授予 Accessibility 权限、安装 shell hook 或改变日常命令。
- 不得读取正文内容来做语义判断；只允许消费结构化时间字段、mtime 和必要元数据。

### 选择规则

| Scenario | Expected behavior |
|---------|-------------------|
| 只有一个服务存在明确近期活动且可显示余量 | 稳定显示该单一服务 |
| 两个服务都存在近期活动且都可显示余量 | 进入低频轮播（不短于 15 秒一次），只在这两个服务之间切换 |
| 两个服务都没有新的近期活动，但之前已有显示结果 | 保留上一次显示的服务数字与图标 |
| 用户刚进入自动模式，且尚未形成过任何显示结果 | 显示中性图标，不伪造某个服务为当前对象 |
| 某服务最近有活动，但当前没有可显示余量数据 | 该服务不得进入自动轮播集合 |
| Claude Code 查询已关闭 | Claude Code 不得进入自动判断候选集合，即使本地活动文件仍有更新 |

### 轮播规则

- 轮播集合只允许包含同时满足“近期活跃”与“可显示余量”的服务。
- 轮播必须是低频、稳定、可预测的；不得高频闪烁或随机跳变。
- 当轮播集合收敛为单一服务时，必须退出轮播并稳定显示剩余服务。

---

## 4. 菜单栏显示契约

### 数字与图标同步

- 当菜单栏显示 Codex 余量时，图标必须是 Codex 图标。
- 当菜单栏显示 Claude Code 余量时，图标必须是 Claude Code 图标。
- 图标与数字归属服务必须在同一次显示更新中同步切换，不得出现短暂错位。

### 中性态

- 只有在“当前尚未形成任何可显示的服务对象”时，菜单栏才允许使用中性应用图标。
- 中性态不得误用某个服务图标暗示当前显示对象。

### 严重度表达

- 当前已有的 tray 严重度表达能力必须继续保留，但它只能修饰当前显示对象，不得覆盖“图标代表哪个服务”的基本语义。
- 自动模式不得因为切换服务图标而丢失 `warning` / `danger` 的既有视觉提示。

### Tooltip

- tooltip 中的服务名必须与当前显示对象一致。
- 中性态下 tooltip 不得伪装成某个服务。

---

## 5. 设置页契约

- “菜单栏服务”下拉框必须始终提供 `自动` 选项。
- 当 Claude Code 查询已关闭时：
  - 下拉框中仍保留 `自动`
  - 手动 `Claude Code` 选项不可见
- 当 Claude Code 查询重新开启时，`Claude Code` 手动选项恢复可见。
- 选择 `自动` 不改变主面板服务卡片的顺序设置。

---

## 6. Out of Scope

- 根据前台窗口、Accessibility 或终端 UI 直接识别当前 agent
- 新增云端活动同步或远端用户画像
- 改造主面板中的服务排序、卡片布局或刷新入口位置
- 新增用户可配置的活动阈值、轮播节奏或高级自动化规则
