# 促销活动更新指南

**特性**：013-promotion-status  
**更新时间**：2026-03-25

## 目标

这份指南用于后续维护者更新促销活动目录，同时继续满足本特性的产品目标：

- 展示所有服务的可用优惠信息，帮助用户选择当前更适合使用的服务
- 保持标题下方同一提示区域内的轻量、真实、可比较表达
- 在活动开始、结束、修订后保留历史留痕
- 保持默认胶囊视图与完整浮层视图的交互心智稳定

## 活动目录位置

- 当前活动目录：`/Users/chasewang/01workspace/projects/ai-usage/src/features/promotions/catalog.ts`
- 类型定义：`/Users/chasewang/01workspace/projects/ai-usage/src/features/promotions/types.ts`
- 解析逻辑：`/Users/chasewang/01workspace/projects/ai-usage/src/features/promotions/resolver.ts`

## 关键字段说明

- `id`
  - 必须全局唯一，历史版本不可复用
- `serviceId`
  - 当前支持 `codex`、`claude-code`
- `promotionType`
  - `time-window`：能判断当前是否命中优惠时段
  - `limited-time`：活动来源本身是限时促销；只有在官方信息足以支持连续或明确时段判断时，才允许通过 `windows` 建模为“正在优惠时段”
- `benefitLabel`
  - 用于展示明确优惠幅度，如 `2x`
  - 如果官方公开了稳定、可直接展示的优惠形式，应显式填写；不要只在文案层硬编码
- `startsAt` / `endsAt`
  - 使用可解析的 ISO 时间
- `lifecycle`
  - `active`：当前活动
  - `ended` / `archived`：历史活动，不能再影响当前 UI
- `windows`
  - 用于表达活动的日内规则
  - `continuous`：当前版本会被解析为连续优惠时段，详情第二行会落到“全天优惠”
  - `recurring-off-peak`：当前版本用于 Claude Code 这类“工作日某窗口外优惠”的规则
- `eligibility`
  - 维护官方已知适用计划、不适用计划和未知口径
  - 如果资格规则不完整，必须保留保守表达，不要伪造“所有用户都适用”
- `sourceLabel` / `sourceUrl`
  - 必须保留官方来源，方便后续复核
- `lastReviewedAt`
  - 记录最近一次人工复核时间
- `historyNote`
  - 用于记录修订背景或归档原因

## 何时新增、结束、归档、追加版本

### 新增活动

- 官方已公开新的促销活动
- 活动需要纳入当前 UI 的展示与判断范围
- 为新活动创建新 `id`，不要覆盖历史记录

### 结束活动

- 官方明确活动结束，或当前时间已越过确定结束时间
- 将该活动调整为 `ended` 或保留到期时间，使解析器不再把它视为当前活动

### 归档历史

- 活动已经结束，且仅需要保留留痕与回溯信息
- 使用 `archived`，不要删除旧记录

### 追加规则版本

- 官方说明页面变更了规则、资格、时区或结束时间
- 不要把“规则修订”直接抹平到旧记录上
- 保留旧记录或旧审阅快照，并新增/更新带有 `historyNote` 的新版本

## 时间与时区校验

- 所有时间判断必须先尊重官方规则声明的时区
- 浮层第二行的时间与时区文案不在目录中手填
- 这类文案由 `/Users/chasewang/01workspace/projects/ai-usage/src/features/promotions/resolver.ts` 根据官方规则时区和用户本地时区动态派生
- `time-window` 活动必须验证：
  - 总体开始/结束时间
  - 日内窗口或排除窗口
  - 工作日/周末差异
- 更新后至少人工验证这三类样例：
  - 窗口内
  - 窗口外
  - 跨时区边界

## 默认视图与完整浮层验证

- 默认 `focused` 视图只承载两类服务：
  - `正在优惠时段`
  - `优惠资格待确认`
- 若默认 `focused` 视图没有可显示的服务，则统一显示 `当前无优惠活动`
- 默认 `focused` 视图应以“服务图标 + 极短状态文案”的小胶囊展示，不显示固定“促销信息：”前缀
- 如果当前活动存在明确 `benefitLabel`，默认胶囊文案可优先显示优惠幅度本身，例如 `2x`
- `all` 视图必须显示所有当前可见服务状态，包括：
  - `不在优惠时段`
  - `无优惠活动`
- `all` 视图应以“两行信息块”逐项展示每个服务
- 第一行：`图标 + 服务名 + 更完整结论 + 可选优惠幅度`
- 第二行：时间信息或时段说明
- Claude Code 第二行：`2026.03.13-2026.03.28 · 工作日 20:00-02:00 (UTC+08:00) 之外`
  - 这里的时间与时区必须按用户当前本地时区实时换算，不能写死 `UTC+08:00`
- Codex 第二行：`全天优惠`
- 完整状态默认可通过 hover 预览，但必须同时验证 focus/click 也能等效进入
- click 打开的完整状态必须保持展开，直到点击外部区域或按 `Esc` 关闭
- 完整状态展开后，内容必须仍锚定在标题下方同一提示区域内，不得跳到新的独立区块
- 胶囊颜色只能辅助表达，不能替代图标与短文案
- 若未来服务增多导致空间紧张，优先压缩服务简称和状态短语，不要自行扩展为新区域

## 更新后必须执行的验证

### 单元/组件测试

- `npm test`

重点关注：

- `src/features/promotions/catalog.test.ts`
- `src/features/promotions/resolver.test.ts`
- `src/components/panel/PromotionStatusLine.test.tsx`
- `src/app/shell/AppShell.test.tsx`
- `src/app/shared/i18n.test.ts`

### 真实壳层与截图

- `npm run test:e2e:screenshots`
- `npm run test:e2e:tauri`

重点检查：

- 默认聚焦视图是否仍是一行紧凑表达
- 当前活动若有明确优惠幅度，默认胶囊是否优先显示 `2x` 等幅度信息
- 胶囊是否用图标、短文案和辅助颜色共同表达状态
- hover 与 focus/click 是否都能稳定打开完整状态
- click 打开的完整状态是否会持续存在，并且只能通过点击外部或按 `Esc` 关闭
- 完整状态是否仍在标题下方同一区域锚定展开
- 完整状态是否已从紧凑胶囊切换为更完整的逐行信息
- 两行信息块的第二行是否仍保持易扫读，没有退化成长段说明
- Claude Code 第二行是否显示“日期范围 + 本地时间范围 + 时区”
- Codex 第二行是否显示“全天优惠”
- 中英文下是否有溢出或重叠

## 常见错误

- 未先校验 `windows` 语义，就武断把 `limited-time` 活动写成“当前处于优惠时段”或完全降级成“只有活动没有时段”
- 直接删除旧活动，而不是保留历史记录
- 在 `AppShell` 里硬编码促销规则
- 为了塞下更多信息，把头部副文案扩成新卡片或说明段落
- 只靠 hover 进入完整信息，导致键盘用户不可达或浮层不稳定
- 把胶囊颜色当成唯一状态语义
- 漏填 `benefitLabel`，导致活动存在但 UI 丢失 `2x` 等幅度信息
- 更新目录后不做真实壳层验证
