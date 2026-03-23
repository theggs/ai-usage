# 数据模型：设置页面重设计

**特性**：011-settings-redesign  
**日期**：2026-03-23  
**规格**：[spec.md](./spec.md)

## 概述

本特性不引入新的持久化实体，核心是复用现有 `UserPreferences` / `PreferencePatch`，并新增少量前端派生视图模型来支撑“单卡片行布局”“代理自动保存”和“胶囊排序”。

---

## 复用的规范实体

### `UserPreferences`

Rust 与 TypeScript 共享的持久化偏好契约，本特性继续复用以下字段：

| 字段 | 类型 | 在本特性中的用途 |
|------|------|------------------|
| `traySummaryMode` | 枚举 | 行内 select 即时保存 |
| `menubarService` | `string` | 行内 select 即时保存 |
| `serviceOrder` | `string[]` | 胶囊排序的持久化目标 |
| `language` | `"zh-CN" \| "en-US"` | 行内 select 即时保存，并驱动文案 |
| `autostartEnabled` | `boolean` | 右对齐 toggle 即时保存 |
| `refreshIntervalMinutes` | `number` | UI 改为预设 select，但底层仍保持数值 |
| `networkProxyMode` | `"system" \| "manual" \| "off"` | 代理模式行内 select |
| `networkProxyUrl` | `string` | 手动代理输入值 |

约束：
- 本特性不新增字段
- 现有默认值与向后兼容策略保持不变
- 所有更改必须继续通过宿主命令落盘，不允许前端绕开持久化边界

### `PreferencePatch`

前端写入偏好时使用的补丁对象。

本特性要求：
- 立即保存的设置项必须构造最小 patch，而不是提交整份偏好
- 代理模式与代理 URL 可以分两次 patch 提交
- `serviceOrder` 变更在 drop 完成后一次性提交

---

## 新增派生视图模型

### `SettingsRowModel`

统一设置列表中每一行的前端展示模型。

```ts
type SettingsRowKind =
  | "select"
  | "switch"
  | "reorder"
  | "proxy";

interface SettingsRowModel {
  id: string;
  label: string;
  kind: SettingsRowKind;
  description?: string;
  inlineError?: string;
  disabled?: boolean;
}
```

用途：
- 统一单卡片内部各行的结构表达
- 控制是否显示次级说明或行内错误
- 让 `PreferenceField` 能从“块级字段”收敛为“统一行”

### `RefreshIntervalOption`

刷新间隔 select 的固定选项模型。

```ts
interface RefreshIntervalOption {
  value: 5 | 10 | 15 | 30;
  label: string;
}
```

规则：
- UI 只能展示这 4 个预设值
- 底层保存仍写入 `refreshIntervalMinutes: number`
- 如果旧偏好中存在不在预设内的值，实现阶段需决定是回退到最近合法值还是临时补一个只读 fallback 选项

### `ProxyDraftState`

代理设置在前端的临时输入状态。

```ts
interface ProxyDraftState {
  mode: UserPreferences["networkProxyMode"];
  url: string;
  validationError?: string;
  dirty: boolean;
}
```

状态规则：
- 选择 `system` / `off` 后应立即保存，并同步清理 `validationError`
- 选择 `manual` 后展开 URL 输入框
- URL 输入中允许临时无效值存在于本地草稿中
- 只有在 blur / submit 时才进行校验并尝试持久化

### `InlineServiceOrderState`

单行胶囊拖拽排序的瞬时 UI 状态。

```ts
interface InlineServiceOrderState {
  orderedIds: string[];
  draggedId?: string;
  overId?: string;
  isDragging: boolean;
}
```

规则：
- `orderedIds` 必须始终与已知服务集合一致且无重复
- 单服务时 `isDragging` 恒为 `false`
- drop 成功后立即提交 `serviceOrder`
- 持久化失败时恢复到上一次已确认的顺序

### `SettingsSurfaceState`

设置页整体反馈状态，复用现有 header 保存文案。

```ts
type SettingsSurfaceStatus = "idle" | "saving" | "saved" | "error";

interface SettingsSurfaceState {
  headerStatus: SettingsSurfaceStatus;
  pageError?: string;
}
```

规则：
- 成功保存任一设置项后，header 短暂显示“已保存”
- 失败时必须显示真实错误，不能仅在局部控件上静默失败
- “状态区”被删除后，页面级反馈只承担保存/校验错误，而不承担服务诊断展示

---

## 校验规则

### 代理 URL 校验

- 继续沿用现有逻辑：必须是完整 URL
- 允许协议：`http:`、`https:`、`socks5:`
- 校验失败时不得持久化到宿主
- 错误提示必须以内联方式留在“网络代理”设置项上下文内

### 排序校验

- 仅允许已知服务 ID 参与排序
- 单服务时不能触发拖拽提交
- 失败回滚后 UI 顺序必须与持久化状态重新一致

### 刷新间隔校验

- UI 层只允许选择 `5 / 10 / 15 / 30`
- 传给宿主的值必须是数字分钟值

---

## 状态迁移

### 代理设置

```text
system/off selected -> immediate save -> saved | error
manual selected -> mode saved + input expanded
manual url editing -> local draft only
manual url blur/submit -> validate -> saved | inline error | save error
```

### 排序设置

```text
idle -> drag start -> preview reorder -> drop
drop -> persist order -> saved
drop -> persist failed -> rollback -> error
```

### 页面反馈

```text
idle -> saving -> saved -> idle
idle -> saving -> error
error -> saving -> saved -> idle
```
