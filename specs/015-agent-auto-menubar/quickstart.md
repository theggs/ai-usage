# Quickstart：菜单栏自动服务跟随

## 目标

验证 AIUsage 在“菜单栏服务 = 自动”时，能够基于本机被动活动痕迹自动决定当前菜单栏显示对象，并在显示某个服务余量时同步切换到该服务图标。

## 前置条件

- Node.js 24 LTS 已安装
- Rust stable toolchain 已安装
- Tauri 桌面依赖已可正常运行
- 若要做真实 tray 验证，当前桌面会话必须处于可交互状态：显示器已唤醒、已解锁、不是纯 CLI 远程环境
- 如需验证真实本地活动跟随，机器上至少已存在一个可读取的 `~/.codex` 或 `~/.claude` 本地活动目录

## GUI 会话预检查

1. 运行 `pmset -g assertions`，确认当前不是明显的“用户不活跃/显示器睡眠”状态。
2. 如需长时间观察 tray 轮播或截图，可使用 `caffeinate -d` 保持显示器唤醒。
3. 若要运行 Tauri E2E 或截图流程，先确认当前终端有足够的桌面会话访问能力。

## 命令

```bash
npm test
cargo test
npm run test:e2e:tauri
npm run test:e2e:screenshots
```

## 推荐验证顺序

1. 先运行 `npm test`，验证设置页选项、可见服务范围和前端摘要辅助逻辑。
2. 再运行 `cargo test`，验证宿主活动信号读取、自动选择规则、偏好归一化和 tray 图标/摘要决策。
3. 然后运行 `npm run test:e2e:tauri`，检查真实 tray 与主窗口联动没有回退。
4. 最后运行 `npm run test:e2e:screenshots`，确认服务图标在实际菜单栏尺度下可辨识且不与数字错位；重点查看 `tests/e2e/screenshots/tray-auto-codex.png`、`tests/e2e/screenshots/tray-auto-claude-code.png` 与 `tests/e2e/screenshots/tray-auto-neutral.png`。

## 手工验证清单

### 设置与持久化

1. 打开设置页，确认“菜单栏服务”下拉框包含 `Codex`、`Claude Code`、`自动`。
2. 选择 `自动` 后关闭并重新打开应用，确认该设置被保留。
3. 当 Claude Code 查询关闭时，确认手动 `Claude Code` 选项不可见，但 `自动` 仍可见。

### 自动跟随

1. 在只有 Codex 存在近期活动的场景下，确认菜单栏稳定显示 Codex 余量与 Codex 图标。
2. 在只有 Claude Code 存在近期活动的场景下，确认菜单栏稳定显示 Claude Code 余量与 Claude Code 图标。
3. 在两个服务都处于近期活跃且都可显示余量时，确认菜单栏以大约 15 秒一次的低频节奏在两者之间轮播，而不是高频闪动。
4. 在自动模式已形成显示结果后，让两个服务都停止产生新活动，确认菜单栏保留上一次显示结果，而不是跳回空态。
5. 在刚进入自动模式且当前没有任何可读取近期活动的场景下，确认菜单栏使用中性图标，不伪造某个服务。
6. 关闭并重新启动应用，确认 `自动` 模式会恢复，并重新根据本机活动痕迹选择当前菜单栏显示对象。

### 图标与数字同步

1. 当菜单栏数字从 Codex 切到 Claude Code 时，确认图标同步切换到 Claude Code。
2. 当菜单栏数字从 Claude Code 切回 Codex 时，确认图标同步切换到 Codex。
3. 确认不存在“数字已切换但图标仍停留在旧服务”的短暂错位。
4. 结合 `tests/e2e/screenshots/tray-auto-*.png` 复核 Codex、Claude Code 和中性态 3 种图标都与当前数字/空态语义一致。

### 手动模式回退

1. 从 `自动` 切回 `Codex`，确认菜单栏立即稳定为 Codex，不再受活动信号影响。
2. 从 `自动` 切回 `Claude Code`，确认菜单栏立即稳定为 Claude Code，不再轮播。
3. 确认自动模式不会改变主面板中的服务顺序或卡片内容。

## 回归关注点

- 自动模式只改变 tray，不改变 panel 卡片顺序和内容
- 活动扫描不会触发新的远端额度刷新请求
- Claude Code 查询关闭时，Claude 本地活动文件不会让 tray 错误切到 Claude Code
- 无近期活动时，tray 不会在中性态和旧服务之间抖动
- 服务图标在真实菜单栏尺寸下仍可辨认，不被严重度着色完全吞没
