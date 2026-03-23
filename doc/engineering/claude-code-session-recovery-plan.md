# Claude Code 会话恢复问题说明与建议方案

**Created**: 2026-03-22  
**Context**: Claude Code 额度展示中的会话失效与自动恢复策略

## 背景

最近在 Claude Code 额度接入过程中，连续出现了两类现象：

1. 请求拿到 `429`
2. 在 `429` 之后过了一段时间，请求又拿到 `401`

本次文档只聚焦后者背后的“Claude Code 本机会话恢复”问题，不再讨论代理支持本身。

## 现象与调查记录

### 1. 已排除项：代理不是本轮问题的根因

在后续验证中，请求已经实际拿到了：

- `http_status=429`

这说明请求已经成功到达 Claude 服务端。  
因此，对“本轮 401 / 会话恢复问题”来说，代理不是直接根因，已经从本次研究范围中排除。

### 2. 限流现象

`429` 表示 Claude Code 额度接口存在较严格的频率限制。  
这与 [doc/claude-code-research.md](/Users/chasewang/01workspace/projects/ai-usage/doc/claude-code-research.md) 中记录的结论一致：`/api/oauth/usage` 在请求较频繁时可能返回限流。

因此，`429` 应被视为单独状态：

- 不是凭证失效
- 应采用冷却和缓存兜底，而不是继续高频重试

### 3. 401 现象

在 `429` 之后过了一段时间，再次请求时拿到了：

- `http_status=401`

结合 [doc/claude-code-research.md](/Users/chasewang/01workspace/projects/ai-usage/doc/claude-code-research.md) 的调研结果，可以确认：

- macOS 下 Claude Code 的主凭证来源是 `Keychain`
- Windows / Linux 才主要依赖 `~/.claude/.credentials.json`
- 持久化 OAuth 凭证包含 `accessToken`、`refreshToken`、`expiresAt`

这意味着，macOS 上不能把“`keychain` 失败时退到 file”作为主方案，因为很多情况下并不存在第二份更可靠的文件凭证。

## 问题本质

从产品视角看，这类 `401` 更适合被理解为：

**Claude Code 本机会话待恢复**

而不是：

- “AIUsage 读 token 失败”
- “请用户自己排查 keychain / token source”
- “让用户手动刷新才能知道会不会恢复”

更具体地说：

1. 本应用的设计初衷是读取主机已有的 Claude Code 会话并展示额度
2. 本应用并不负责 OAuth 登录或刷新 token
3. Claude Code 如果长时间未运行，本地持久化 access token 可能过期
4. 用户重新启动 Claude Code 后，会话有机会被 Claude Code 自身恢复
5. AIUsage 应该做的是“识别这种状态并自动等待恢复”，而不是把内部技术细节甩给用户

## 当前代码中已验证的结论

### 已适合保留的行为

- `429` 需要单独冷却处理
- `403` 应继续作为高风险拒绝信号，暂停自动刷新

### 不适合作为长期方案的思路

- `401 + keychain -> file fallback once`

原因是该思路隐含了“Keychain 和 file 同时存在且 file 可能更新”的前提，但根据调研，这在 macOS 上不是可靠假设。

## 建议方案

### 方案目标

把 `401 / accessToken 已过期` 处理成“会话待恢复”路径，并保证：

- 不暴露底层凭证来源细节
- 不要求用户手动刷新才能恢复
- 在用户重新打开 Claude Code 后，额度能自动回来

### 核心策略

#### 1. 引入单独的会话恢复状态

在 Claude Code 后端状态里新增专门状态，例如：

- `Normal`
- `SessionRefreshRequired`
- `RateLimitedUntil`
- `AccessDenied`

其中 `SessionRefreshRequired` 对应两类情况：

- 本地凭证里的 `expiresAt` 已过期
- 请求实际返回 `401`

#### 2. 先看 `expiresAt`，再决定是否请求

读取 Claude Code 凭证时，不只取 `accessToken`，还要读取：

- `expiresAt`

若 `expiresAt` 已明确过期，则不必继续请求 `/api/oauth/usage`，直接进入 `SessionRefreshRequired`。

这样有两个好处：

- 避免无意义的 `401`
- 代码结构更清晰：先判断本地会话状态，再决定是否请求远端

#### 3. 不完全暂停自动刷新，而是切换到低频恢复探测

这是本次讨论中最重要的修正点。

如果进入恢复态后彻底暂停自动刷新，会出现一个不好的体验：

- 用户已经重新启动 Claude Code
- 但 AIUsage 长时间不恢复
- 还得靠手动刷新

因此建议：

- 正常状态继续按全局刷新周期运行
- `SessionRefreshRequired` 状态下，不再按正常频率请求
- 但保留一个独立的低频恢复探测，例如每 60 秒一次
- 一旦恢复成功，立即退出恢复态，回到正常刷新节奏

#### 4. 文案改成产品语言

不要向用户展示：

- `keychain`
- `token rejected`
- `token_source`

建议改成：

- “Claude Code 当前会话不可用”
- “打开 Claude Code 后通常会自动恢复”
- “应用会在后台自动重试”

#### 5. 保持状态职责清晰

建议将三类状态明确分开：

- `401 / expiresAt expired`
  表示会话待恢复，进入低频探测
- `429`
  表示限流，进入冷却期
- `403`
  表示访问被拒绝，保持严格暂停策略

不要把这三类情况都塞进同一个 failed / stale 分支里处理。

## 推荐实现结构

### Rust 后端

建议在 [src-tauri/src/claude_code/mod.rs](/Users/chasewang/01workspace/projects/ai-usage/src-tauri/src/claude_code/mod.rs) 内收口出三个小层次：

1. `ClaudeCredential`
   负责承载 token 与过期时间
2. `ClaudeAccessState`
   负责表达 `Normal / SessionRefreshRequired / RateLimitedUntil / AccessDenied`
3. `build_claude_code_snapshot(...)`
   统一把内部状态映射成前端可展示的 snapshot

这样能避免状态判断散落在读取凭证、发请求、构造文案等多个位置。

### 前端

建议保持结构简单：

- [src/app/shell/AppShell.tsx](/Users/chasewang/01workspace/projects/ai-usage/src/app/shell/AppShell.tsx)
  继续负责调度定时刷新
- 新增一个 Claude Code 专用的小 helper
  判断当前是否处于 `SessionRefreshRequired`
- `AppShell` 中为 Claude Code 单独加一个“恢复探测” effect

这样可以避免把一堆 Claude Code 特例散在多个组件里。

## 实施顺序建议

1. 后端扩展 Claude 凭证结构，读取 `expiresAt`
2. 新增 `SessionRefreshRequired` 内部状态
3. 将 `401` 和“本地凭证已过期”统一映射到该状态
4. 将用户可见文案收口为产品语言
5. 在前端增加 Claude Code 的低频恢复探测
6. 补测试，验证恢复探测与 `403/429` 不互相回归

## 结论

本次问题的最终判断是：

- `429` 与 `403` 已经有合理处理方向
- `401` 的本质更接近“Claude Code 本地会话待恢复”

因此，后续不应继续沿“凭证源切换”方向深挖，而应转向：

**以产品语义建模 Claude Code 会话恢复，并通过低频自动探测实现无感恢复。**
