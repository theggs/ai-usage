# 快速开始：UI/UX 审查遗留项完成

**特性**：010-ui-ux-completion  
**日期**：2026-03-23

> 变更说明（回退）：
> tray 黄/红状态图标需求已放弃，不再作为迭代 10 的验收项。菜单栏图标应保持默认应用图标。

## 前置条件

- 通过 `nvm use` 使用 Node.js 20 LTS
- 已安装 Rust stable toolchain
- 具备 macOS 环境，以便验证真实菜单栏与 Pointer 排序行为
- 如需验证真实状态而非模拟快照，可选配置本地 Codex / Claude Code 环境

## 开发工作流

```bash
# 前端 + 宿主壳层
npm run tauri:dev

# 前端单元/集成测试
npm test

# Rust 宿主测试
cargo test

# 定向 Tauri 壳层检查
npm run test:e2e:tauri
npm run test:e2e:screenshots
```

## 验证清单

### 1. 面板正确性与可读性

1. 使用 healthy、warning、danger 三类样例状态打开面板。
2. 确认每条额度行只显示一条百分比标签。
3. 确认标签在填充区与未填充区上都清晰可读。
4. 确认 warning/danger 卡片的左侧强调条沿整卡高度展示，且顶部没有空白。

### 2. 菜单栏同步与默认图标

1. 在面板中触发一次手动刷新。
2. 确认菜单栏标题更新为与面板最新数据一致的百分比。
3. 悬停菜单栏图标，确认 tooltip 包含当前选中服务名称。
4. 将状态从 healthy 切换为 warning/danger，确认 tray 标题与 tooltip 仍同步；菜单栏图标保持默认应用图标。

### 3. 面板与设置页视觉一致性

1. 在面板与设置页之间来回切换。
2. 确认 header 操作按钮都使用相同的中性圆形风格。
3. 确认设置页返回操作是纯图标按钮，且与面板 header 对齐。
4. 确认两个视图中的卡片宽度与底部留白一致。

### 4. 设置页可用性与真实状态

1. 打开设置页，确认托盘摘要模式和菜单栏服务位于首屏可视区域。
2. 确认语言和开机自启等低频设置已下移。
3. 确认状态区域展示所有支持服务，且来源/会话信息有效。
4. 确认“发送测试通知”按钮已不再渲染。

### 5. Pointer 排序可靠性

1. 在 macOS 设置页中通过拖拽手柄拖动某个服务。
2. 确认列表在指针移动过程中实时重排。
3. 松手后确认新顺序立即持久化。
4. 返回面板后确认卡片顺序已同步，无需重启应用。

### 6. 空状态与首次引导

1. 在全新、未连接任何服务的状态下启动应用。
2. 确认先显示 2-3 步首次引导覆盖层，而不是直接显示按服务占位卡。
3. 跳过首次引导后重新打开面板。
4. 确认覆盖层保持隐藏，改为显示按服务的引导占位卡。

### 7. 无障碍与语言环境检查

1. 将一个服务设为 warning，另一个服务设为 danger。
2. 确认界面通过文本标签或图标表达紧急状态，而不仅靠颜色。
3. 切换到英文界面，确认 header 摘要完整显示，无省略号。

## 最可能改动的文件

| 文件 | 预期改动 |
|------|----------|
| `src/components/panel/QuotaSummary.tsx` | 单一 in-bar 标签、对比度处理、严重程度文本/图标 |
| `src/components/panel/ServiceCard.tsx` | 强调条布局、纯文本服务头部、占位引导 |
| `src/app/panel/PanelView.tsx` | 首次引导 gating、空状态流转、底部留白 |
| `src/app/settings/SettingsView.tsx` | 分组顺序、Pointer 排序、服务状态卡、代理应用按钮强调 |
| `src/app/shared/i18n.ts` | 更短的英文摘要与新增占位/引导文案 |
| `src/lib/persistence/preferencesStore.ts` | 首次引导关闭字段的归一化 |
| `src/lib/tauri/contracts.ts` | 偏好/契约扩展与归一化状态形状 |
| `src-tauri/src/commands/mod.rs` | 刷新成功后的 tray 重同步 hook |
| `src-tauri/src/tray/mod.rs` | 服务名 tooltip 与默认应用图标策略 |
| `src-tauri/src/state/mod.rs` | 首次引导字段默认值与向后兼容 |

## 回归重点

- 成功刷新后，菜单栏与面板绝不能出现不一致
- 旧版偏好文件在缺少新字段时必须能正常反序列化
- Pointer 排序必须在真实 Tauri 壳层中可靠工作，而不仅是在浏览器测试里通过
- empty、disconnected、stale、failed 状态必须保持可区分
- 英文 header 文案必须通过布局与文案共同保证不截断
