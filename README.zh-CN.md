<p align="center">
  <img src="src-tauri/icons/128x128@2x.png" width="128" height="128" alt="AIUsage 图标" />
</p>

<h1 align="center">AIUsage</h1>

<p align="center">
  随时掌握 AI 编程助手配额余量 —— 无需打开应用。
</p>

<p align="center">
  <a href="https://github.com/anthropics/ai-usage/releases/latest"><img src="https://img.shields.io/github/v/release/anthropics/ai-usage?style=flat-square" alt="最新版本" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-Apache--2.0-blue?style=flat-square" alt="许可证" /></a>
</p>

<p align="center">
  简体中文 | <a href="README.md">English</a>
</p>

---

AIUsage 是一款 macOS 和 Windows 上的**菜单栏桌面应用**，可实时追踪 AI 编程助手的使用配额。只需瞥一眼菜单栏，即可了解所有服务的剩余额度 —— 无需切换上下文。

<p align="center">
  <img src="screenshots/menu-bar.png" alt="菜单栏配额概览" />
</p>

## 功能特性

**多服务配额追踪** —— 在一个面板中同时监控 Claude Code、Codex、Kimi Code 和 GLM 编程助手的使用情况。

<table>
  <tr>
    <td align="center"><strong>配额面板</strong></td>
    <td align="center"><strong>设置页面</strong></td>
  </tr>
  <tr>
    <td align="center">
      <img src="screenshots/panel-en.png" alt="面板视图" width="320" />
    </td>
    <td align="center">
      <img src="screenshots/setting-en.png" alt="设置视图" width="320" />
    </td>
  </tr>
</table>

**消耗速率预测** —— 根据当前使用速率预判配额是否会在重置前耗尽，仅在速率存在风险时显示警告。

**智能严重性告警** —— 综合剩余百分比和消耗速率评估配额健康状态，托盘图标颜色反映最紧迫的服务状态。

**自动菜单栏服务** —— 自动检测当前活跃的编程助手，并在菜单栏中高亮显示其配额信息。

**可配置且已本地化** —— 刷新间隔、面板顺序、代理设置、语言（English / 中文）以及各服务的开关，均可在设置面板中调整。

## 安装

从 [GitHub Releases](https://github.com/anthropics/ai-usage/releases) 页面下载适合你平台的最新版本。

| 平台 | 文件 | 说明 |
|------|------|------|
| macOS | `AIUsage_<version>_macos.zip` | 解压后将 `AIUsage.app` 移至 `/Applications` |
| Windows | `AIUsage_<version>_x64-setup.exe` | 运行安装程序 |

> **macOS 提示：** 应用尚未进行代码签名。如果 macOS 阻止打开，请运行：
> ```bash
> sudo xattr -d com.apple.quarantine "/Applications/AIUsage.app"
> ```

## 快速上手

1. **启动 AIUsage** —— 应用常驻菜单栏（不会出现在 Dock 中）。
2. **启用服务** —— 在设置中开启你使用的服务。
3. **认证** —— 各服务通过其标准方式认证：
   - **Codex** —— 在终端中运行 `codex login`
   - **Claude Code** —— 从 macOS 钥匙串或 `~/.claude/.credentials.json` 读取凭据
   - **Kimi Code / GLM 编程助手** —— 在设置中输入 API Token
4. **完成** —— 配额卡片按设定间隔自动刷新（默认 15 分钟）。

## Claude Code 查询声明

AIUsage 读取设备上已有的 Claude Code 凭据，仅用于向 Claude 官方 API 查询配额状态。应用**不会**存储、修改或转发该凭据至任何非官方端点。

> **注意：** 根据 Anthropic 消费者服务条款（第 3.3、3.7 条），通过第三方软件访问 Claude Code 速率限制信息可能导致账户风险。Claude Code 功能**默认关闭** —— 仅在你接受此风险后再开启。

部分地区可能需要网络代理。应用会自动检测系统代理设置。

## 从源码构建

依赖：Node.js 24+、Rust stable、平台构建工具（macOS 需要 Xcode 命令行工具，Windows 需要 Visual Studio Build Tools）。

```bash
git clone https://github.com/anthropics/ai-usage.git
cd ai-usage
npm ci
npm run tauri:dev    # 开发模式
npm run tauri:build  # 生产构建
```

<details>
<summary>项目结构</summary>

```text
src/              React 前端（视图、组件、功能模块）
src-tauri/        Rust 后端（命令、状态、托盘、Provider）
tests/            E2E 和集成测试
screenshots/      UI 参考截图
doc/              工程文档
```

</details>

<details>
<summary>测试</summary>

```bash
npm test                                    # Vitest 单元测试
npm run lint                                # TypeScript 类型检查
cargo test --manifest-path src-tauri/Cargo.toml  # Rust 测试
npm run test:e2e                            # Playwright E2E
npm run tauri:build                         # 完整生产构建
```

</details>

## 参与贡献

欢迎贡献。对于较大的改动，请先创建 Issue 以对齐实现方案。

- 提交 PR 前请运行测试
- 遵循 `type: lowercase description` 提交信息格式
- 桌面 UI 改动需保留真实运行时验证

## 更新日志

查看 [CHANGELOG.md](CHANGELOG.md) 了解版本发布历史。

## 许可证

[Apache-2.0](LICENSE)
