# AI Agent 活跃度自动切换技术调研

**日期：** 2026-03-27  
**状态：** 调研

---

## 1. 技术调研项目

### 1.1 调研目标

评估是否可以通过**纯被动监控本地日志 / 会话文件**的方式，自动判断最近活跃的 AI agent，并据此切换菜单栏显示的余量服务。

### 1.2 调研范围

本轮只调研以下内容：

- Codex 与 Claude Code 是否存在可持续观测的本地活动痕迹
- 哪些痕迹适合作为“最近活跃”信号
- 是否可以在**不要求用户额外操作**的前提下落地

本轮不展开以下路线，仅在结论中保留简短判断：

- 前台程序 / 窗口焦点识别
- Accessibility / 终端 UI 识别
- shell hook / wrapper 主动上报
- 进程树 / TTY / 前台 job 推断

### 1.3 目标定义

本方案的目标定义为：

**根据最近本地活跃痕迹自动选择菜单栏显示对象。**

本方案不以以下目标为交付承诺：

**精确识别用户此刻唯一正在使用的 agent。**

---

## 2. 技术调研内容

### 2.1 调研方法

本轮主要基于以下信息进行判断：

- 仓库现有文档与既有集成边界
- 当前机器上的 `~/.claude` 与 `~/.codex` 目录结构
- 文件时间戳、字段名、SQLite 表结构

本轮没有展开敏感正文内容，只提取与“最近是否活跃”相关的结构信息。

### 2.2 与当前项目边界的关系

当前项目边界与本方向兼容，依据如下：

1. Codex 已经采用宿主侧本地读取路径，而不是前端直接解析或抓取外部页面。
2. Codex 现有模型已经有 `active local session` 的概念。
3. Claude 的路线图本身就写过“本地日志（`~/.claude/`）+ API”。

参考文档：

- [specs/002-openai-codex-support/research.md](/Users/chasewang/01workspace/projects/ai-usage/specs/002-openai-codex-support/research.md)
- [specs/002-openai-codex-support/contracts/codex-usage-contract.md](/Users/chasewang/01workspace/projects/ai-usage/specs/002-openai-codex-support/contracts/codex-usage-contract.md)
- [doc/ai-usage-prd](/Users/chasewang/01workspace/projects/ai-usage/doc/ai-usage-prd)
- [doc/engineering/claude-code-research.md](/Users/chasewang/01workspace/projects/ai-usage/doc/engineering/claude-code-research.md)

### 2.3 Claude Code 本地信号

当前机器上观察到的主要目录：

- `~/.claude/history.jsonl`
- `~/.claude/projects/**/*.jsonl`
- `~/.claude/session-env/<sessionId>/`
- `~/.claude/debug/`
- `~/.claude/telemetry/`

其中最有价值的是前 3 类。

#### `history.jsonl`

样本记录字段包含：

- `display`
- `pastedContents`
- `project`
- `sessionId`
- `timestamp`

#### `projects/**/*.jsonl`

样本记录字段至少包含：

- `type`
- `timestamp`
- `sessionId`
- `operation`
- `content`

另外也观察到更完整的记录，字段还包括：

- `cwd`
- `entrypoint`
- `gitBranch`
- `message`
- `uuid`
- `version`

#### `session-env/<sessionId>/`

观察结果：

- 目录存在，并按 `sessionId` 分组
- 目录 mtime 会变化
- 当前未观察到稳定、统一的同层文件结构

### 2.4 Codex 本地信号

当前机器上观察到的主要目录与文件：

- `~/.codex/session_index.jsonl`
- `~/.codex/state_5.sqlite`
- `~/.codex/logs_1.sqlite`
- `~/.codex/sessions/**/*.jsonl`
- `~/.codex/archived_sessions/**/*.jsonl`
- `~/.codex/history.jsonl`

其中最有价值的是前 4 类。

#### `session_index.jsonl`

样本记录字段包含：

- `id`
- `thread_name`
- `updated_at`

#### `state_5.sqlite`

`threads` 表字段包含：

- `id`
- `rollout_path`
- `created_at`
- `updated_at`
- `source`
- `model_provider`
- `cwd`
- `title`
- `archived`
- `git_sha`
- `git_branch`

#### `logs_1.sqlite`

`logs` 表字段包含：

- `ts`
- `ts_nanos`
- `level`
- `target`
- `thread_id`
- `process_uuid`

#### `sessions/**/*.jsonl`

观察结果：

- 路径中带日期
- 文件 mtime 会持续推进
- 能提供当前会话层级的最近更新时间

---

## 3. 技术调研结果

### 3.1 Claude Code

Claude 侧存在可消费的本地活动痕迹，但主信号分散。

推荐信号顺序：

1. `projects/**/*.jsonl` 最新文件 mtime
2. `history.jsonl` 最新 `timestamp`
3. `session-env/<sessionId>` 目录 mtime

结果判断：

- `projects/**/*.jsonl` 最接近具体项目会话的持续写入
- `history.jsonl` 适合作为全局辅助时间线
- `session-env` 只能作为弱辅助信号

### 3.2 Codex

Codex 侧存在多个结构化且互相印证的本地活动信号。

推荐信号顺序：

1. `state_5.sqlite` 中 `threads.updated_at`
2. `session_index.jsonl` 中 `updated_at`
3. `logs_1.sqlite` 中最新 `ts`
4. `sessions/**/*.jsonl` 最新文件 mtime

结果判断：

- `threads.updated_at` 是最强结构化时间信号
- `session_index.jsonl` 适合作为低成本索引信号
- `logs_1.sqlite` 更适合作为“仍在活跃”的辅助判断
- `sessions/**/*.jsonl` 可作为降级补充

### 3.3 推荐判定模型

推荐按服务维护统一的最近活动时间，而不是直接定义“当前唯一活跃 agent”。

建议宿主侧使用统一结构：

```ts
type AgentActivity = {
  serviceId: "codex" | "claude-code";
  lastActivityAt?: number;
  signalSource: string;
  confidence: "high" | "medium" | "low";
};
```

推荐判定流程：

1. 分别读取 Codex 与 Claude 的主信号
2. 若主信号不可读，则按各自回退链路降级
3. 得到两个服务各自的 `lastActivityAt`
4. 比较两者时间差
5. 若其中一方明显更新，则切换菜单栏显示对象
6. 若差值不明显，则保持当前选择

推荐去抖参数：

- 轮询周期：5-15 秒
- 活跃窗口：60-120 秒
- 切换阈值：另一方领先至少 15-30 秒，或拥有更高置信度信号的显著更新

推荐回退规则：

- 两边长期无活动时，回退到手动模式或上次稳定结果
- 两边都只能拿到低置信度弱信号时，不自动切换
- 主信号结构明显异常或缺失时，不自动切换

### 3.4 不建议作为主判据的内容

- 凭证文件
- telemetry / debug 文件
- 正文内容语义判断
- 只看文件是否存在

---

## 4. 技术判断

### 4.1 可行性判断

- **Codex：高可行**
- **Claude Code：中等可行**
- **用于“最近活跃 agent 自动切换”：可行**
- **用于“精确判断此刻唯一正在使用的 agent”：不应承诺**

### 4.2 风险判断

共同风险：

- “最近有文件写入”不等于“用户此刻唯一主要在用它”
- 后台恢复、同步或 subagent 也可能推动时间戳
- 版本升级后目录结构、表结构、字段名可能变化

Codex 风险：

- `state_5.sqlite`、`logs_1.sqlite`、`session_index.jsonl` 更像内部实现，不是公开长期契约

Claude 风险：

- 主信号更分散，需要组合判断
- `history.jsonl` 与 `projects/**/*.jsonl` 覆盖的交互层级可能不同
- 未来版本可能调整目录或记录格式

### 4.3 用户影响判断

这条路线的优点是用户侧可以保持零操作：

- 不需要权限弹窗
- 不需要安装 hook
- 不需要替换命令
- 不需要改变使用习惯

需要明确给用户的产品边界：

- 这是“根据最近活跃痕迹自动切换”
- 不是“对当前唯一使用对象做绝对真相判断”

### 4.4 排除项判断

本轮不作为主方案的路线如下：

- 前台程序 / 窗口焦点识别
- Accessibility / 终端 UI 识别
- shell hook / wrapper 主动上报
- 进程树 / TTY / 前台 job 推断

排除原因统一为：

- 与“对用户要求最小优先”的目标不一致，或
- 不适合作为当前主方案

---

## 5. 后续建议

若后续进入实现设计，建议优先做以下验证：

1. 验证 Codex 的 `state_5.sqlite` 与 `session_index.jsonl` 在不同工作流下是否稳定推进
2. 验证 Claude 的 `projects/**/*.jsonl` 与 `history.jsonl` 在不同工作流下是否稳定推进
3. 定义统一的宿主侧 `last_activity_at` 契约
4. 实现基于“最近活动时间 + 粘滞窗口”的菜单栏切换逻辑
5. 保留手动模式作为明确回退

---

## 6. 参考

### 仓库内文档

- [specs/002-openai-codex-support/research.md](/Users/chasewang/01workspace/projects/ai-usage/specs/002-openai-codex-support/research.md)
- [specs/002-openai-codex-support/contracts/codex-usage-contract.md](/Users/chasewang/01workspace/projects/ai-usage/specs/002-openai-codex-support/contracts/codex-usage-contract.md)
- [doc/ai-usage-prd](/Users/chasewang/01workspace/projects/ai-usage/doc/ai-usage-prd)
- [doc/engineering/claude-code-research.md](/Users/chasewang/01workspace/projects/ai-usage/doc/engineering/claude-code-research.md)

### 外部旁证

- [Anthropic Claude Code issue: Duplicate entries in session .jsonl files](https://github.com/anthropics/claude-code/issues/5034)
- [Anthropic Claude Code issue: History accumulation in .claude.json causes performance issues](https://github.com/anthropics/claude-code/issues/5024)

