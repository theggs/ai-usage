# Quickstart: Claude Code 用度查询告知与启用控制

**Feature**: 012-claude-code-usage-query-disclosure  
**Date**: 2026-03-24

本文档给出实现本特性后的本地验证流程，覆盖首次引导、设置页、宿主禁用语义和真实 Tauri 运行态。

---

## 1. 安装与基础命令

在仓库根目录执行：

```bash
npm install
npm test
cargo test
```

如果只想先跑受影响的前端测试，可以使用：

```bash
npx vitest run \
  src/app/panel/PanelView.test.tsx \
  src/app/settings/SettingsView.test.tsx \
  tests/integration/preferences-persistence.test.ts \
  tests/contract/claude-code-panel-state.test.ts
```

---

## 2. 首次引导真实场景验证

使用已存在的 onboarding 启动脚本拉起真实 Tauri 窗口：

```bash
npm run tauri:dev:onboarding
```

验证点：

1. 当没有任何服务数据、且尚未确认说明卡片时，首次引导中会出现独立的 Claude Code 查询说明卡片，并能看到 `Claude Code 查询` 标识。
2. 点击 `我知道了` 后，只关闭该卡片，不关闭整个 onboarding。
3. 关闭并重新进入相同 onboarding 场景后，该卡片不再重复出现。

---

## 3. 设置页验证

启动常规开发窗口：

```bash
npm run tauri:dev
```

验证点：

1. Claude Code 新卡片位于设置页最底部，且与主设置卡片同级；原有设置顺序不变。
2. 卡片标题为 `Claude Code 查询`，右侧开关默认关闭。
3. 开关开启后，立即进入查询中状态，并触发一次 Claude Code 查询或命中冷却后复用缓存。
4. 若本地已有 Claude Code 缓存，开启后会先显示缓存，并伴随明确的刷新中状态。
5. 开关关闭后，`菜单栏服务` 和 `面板顺序` 中不再出现 Claude Code。
6. 中英文切换后，新增说明和开关文案均完整翻译。

---

## 4. 宿主禁用语义验证

建议在已有 Claude Code 登录凭证和缓存的环境中验证：

1. 先开启 Claude Code，用真实数据生成一次缓存。
2. 关闭 Claude Code 开关。
3. 执行应用重启、自动刷新等待、手动刷新。
4. 确认：
   - 不再读取 Claude Code 登录凭证
   - 不再发起 Claude 官方额度请求
   - 面板与 tray 中不再把 Claude Code 当作可见或活跃服务
   - 缓存文件仍可保留，但不会被 UI 使用

---

## 5. 重新启用验证

1. 在已存在本地缓存的前提下重新开启 Claude Code。
2. 确认面板可先恢复缓存态，并伴随刷新中指示。
3. 若不在冷却期内，确认同一次开启动作中会立即触发刷新，并更新为真实状态或真实不可用状态。
4. 若在冷却期内，确认不会再发起新的官方请求，而是直接复用缓存或当前结果，且不报错。

---

## 6. 冷却机制验证

1. 开启 Claude Code 并完成一次成功查询。
2. 在最小冷却间隔内连续执行一次手动刷新、一次自动刷新等待或一次关闭后立即重新开启。
3. 确认：
   - 不会产生新的 Claude 官方额度请求
   - 界面仍保持真实的查询中/刷新中反馈或缓存态反馈
   - 不会出现 429 相关错误提示
   - 冷却结束后再次刷新可以恢复真实请求

---

## 7. 回归检查

重点回归以下已有功能不被破坏：

1. Codex 面板加载与刷新
2. 代理设置保存与应用
3. onboarding 原有跳过逻辑
4. tray summary 与 tooltip
5. 设置页保存状态反馈

如有 E2E 变更，补充运行：

```bash
npm run test:e2e:tauri
npm run test:e2e:screenshots
```
