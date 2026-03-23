# 调研报告: Claude Code 额度数据获取方案

**Created**: 2026-03-20
**Feature**: 004-claude-code-support

## 1. Claude Code `/usage` TUI 命令

Claude Code 的交互式 TUI 中提供 `/usage` 命令，显示套餐使用情况。输出格式为**已使用百分比**：

```
Current session: 37% used (resets 4:59pm)
Current week (all): 54% used (resets Jan 26 at 1:59pm)
Current week (Sonnet): 0% used
```

此命令仅在 TUI 中可用，**没有对应的 CLI 子命令或 flag**（如 `claude --usage` 或 `claude quota`）。社区 feature request [GitHub #13585](https://github.com/anthropics/claude-code/issues/13585) 提议增加 `claude quota --json`，截至 2026-03 尚未实现。

## 2. 内部 HTTP API

Claude Code 内部通过以下 API 获取额度数据：

**Endpoint**: `GET https://api.anthropic.com/api/oauth/usage`

**Required Headers**:
```
Authorization: Bearer <oauth_access_token>
anthropic-beta: oauth-2025-04-20
User-Agent: claude-code/<version>
```

**Response 示例**:
```json
{
  "five_hour": {
    "utilization": 2.0,
    "resets_at": "2026-02-08T12:00:00+00:00"
  },
  "seven_day": {
    "utilization": 35.0,
    "resets_at": "2026-02-12T03:00:00+00:00"
  },
  "seven_day_sonnet": {
    "utilization": 3.0,
    "resets_at": "2026-02-12T19:00:00+00:00"
  },
  "seven_day_opus": null
}
```

**字段说明**:
- `utilization`: 已使用百分比（0-100），需 `100 - utilization` 转换为剩余百分比
- `resets_at`: ISO 8601 格式的重置时间
- 维度为 `null` 表示当前套餐不包含该模型
- API 有频率限制，约 5 次请求/token 后可能返回 429（[GitHub #30930](https://github.com/anthropics/claude-code/issues/30930)）

**维度映射到 UI 标签建议**:

| API 字段 | 含义 | 建议标签 |
|----------|------|----------|
| `five_hour` | 5 小时滚动窗口 | `Claude Code / 5h` |
| `seven_day` | 7 天全模型 | `Claude Code / week` |
| `seven_day_sonnet` | 7 天 Sonnet | `Claude Code / week (Sonnet)` |
| `seven_day_opus` | 7 天 Opus | `Claude Code / week (Opus)` |

## 3. OAuth Token 存储（跨平台）

Claude Code 使用两层凭据存储：优先使用系统原生存储，失败时回退到明文文件。

### 3.1 macOS — Keychain

- **Service name**: `Claude Code-credentials`
- **Account name**: 当前 Unix 用户名（`$USER`），fallback 为 `claude-code-user`
- **数据格式**: hex 编码的 JSON 字符串

**读取方式**:
```bash
security find-generic-password -a "$USER" -w -s "Claude Code-credentials"
```

返回值为 hex 编码字符串，解码后得到 JSON。

**Service name 构造规则**:
```
"Claude Code" + OAUTH_FILE_SUFFIX + "-credentials" + configDirHash
```
- `OAUTH_FILE_SUFFIX`: 生产环境为空字符串
- `configDirHash`: 仅当设置了 `CLAUDE_CONFIG_DIR` 时追加 `-<sha256前8位>`
- 默认值即为 `Claude Code-credentials`

**缓存**: 5 秒内存缓存，避免频繁 Keychain 查询。

### 3.2 Windows — 明文 JSON 文件

- **无原生凭据管理器集成**（不使用 Windows Credential Manager、DPAPI 等）
- `security` 命令不存在 → Keychain 层始终失败 → 回退到明文文件
- **文件路径**: `%USERPROFILE%\.claude\.credentials.json`
- 文件权限设为 `0o600`（在 Windows 上效果有限）

### 3.3 Linux — 明文 JSON 文件

- **无原生 keyring 集成**（不使用 libsecret、gnome-keyring、kwallet 等）
- 同样回退到明文文件
- **文件路径**: `~/.claude/.credentials.json`
- 文件权限设为 `0o600`

### 3.4 环境变量覆盖

可通过 `CLAUDE_CODE_OAUTH_TOKEN` 环境变量直接提供 OAuth Token，优先级高于文件/Keychain 存储。

### 3.5 凭据 JSON 结构

```json
{
  "claudeAiOauth": {
    "accessToken": "sk-ant-oat-...",
    "refreshToken": "...",
    "expiresAt": "2026-03-20T12:00:00Z",
    "scopes": ["..."],
    "subscriptionType": "max",
    "rateLimitTier": "..."
  }
}
```

目标字段: `claudeAiOauth.accessToken`

## 4. 与 Codex 的对比

| 维度 | Codex | Claude Code |
|------|-------|-------------|
| 数据获取方式 | `codex app-server` JSON-RPC（本地进程通信） | HTTP API `api.anthropic.com/api/oauth/usage`（网络请求） |
| 数据语义 | `usedPercent`（已用百分比） | `utilization`（已用百分比） |
| 转换方式 | `100 - usedPercent` → 剩余 | `100 - utilization` → 剩余 |
| 认证方式 | CLI 内部管理（进程级） | OAuth Token（需从系统凭据存储读取） |
| CLI 命令支持 | 有 `codex app-server` 子命令 | 无 CLI 子命令，仅 TUI `/usage` |
| 时间窗口 | primary + secondary（动态标签） | 固定: `five_hour`, `seven_day`, `seven_day_sonnet`, `seven_day_opus` |
| 网络依赖 | 本地进程，无网络 | 需要访问 `api.anthropic.com` |

## 5. 实现建议

### 5.1 数据获取模块（Rust 后端）

需要新建 `src-tauri/src/claude_code/mod.rs`，核心逻辑：

1. **读取 OAuth Token**:
   - macOS: 调用 `security find-generic-password` → hex 解码 → 解析 JSON → 提取 `claudeAiOauth.accessToken`
   - Windows/Linux: 读取 `~/.claude/.credentials.json` → 解析 JSON → 提取 `claudeAiOauth.accessToken`
   - 检查 `CLAUDE_CODE_OAUTH_TOKEN` 环境变量（最高优先级）

2. **调用 API**:
   - `GET https://api.anthropic.com/api/oauth/usage`
   - Headers: `Authorization: Bearer <token>`, `anthropic-beta: oauth-2025-04-20`
   - 超时: 建议 5-10 秒

3. **数据转换**:
   - 遍历 response 的各维度（`five_hour`, `seven_day`, `seven_day_sonnet`, `seven_day_opus`）
   - 跳过 `null` 维度
   - `remainingPercent = 100 - utilization`
   - `resetHint` 从 `resets_at` 计算相对时间

4. **错误处理**:
   - Token 不存在 → `connection_state: "unavailable"`
   - Token 过期 → `connection_state: "disconnected"`（需提示用户重新登录 Claude Code）
   - API 429 → `snapshot_state: "stale"`（使用上次缓存数据）
   - 网络错误 → `connection_state: "failed"`

### 5.2 已知问题与注意事项

- `/usage` TUI 命令已知 bug: 长时间空闲后可能卡在 "Loading..." 状态（[GitHub #21637](https://github.com/anthropics/claude-code/issues/21637)）
- API 频率限制较严格，建议刷新间隔不低于用户设置的全局刷新间隔（默认 15 分钟）
- macOS Keychain 中的 hex 编码需要正确解码，格式为连续的十六进制字符串（每字节 2 位）
- `CLAUDE_CONFIG_DIR` 环境变量会影响 Keychain service name 的哈希后缀，实现时需考虑
