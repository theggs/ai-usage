# 更新日志

本文件记录项目的所有重要变更。

格式基于 [Keep a Changelog](https://keepachangelog.com/)，版本号遵循 [语义化版本](https://semver.org/)。

[English Version](CHANGELOG.md)

## [未发布]

### 新增

- **Provider 架构** —— 统一的 ProviderDescriptor 注册表，覆盖 Rust 和 TypeScript 端，支持动态 Provider 映射
- **获取管道** —— ProviderFetcher trait 与通用 IPC 命令，替换原有逐服务命令绑定
- **新增服务** —— 支持 Kimi Code 和 GLM 编程助手
- **消耗速率预测** —— 基于使用节奏的预测引擎，持久化采样历史；面板仅在速率存在风险时显示消耗预警
- **智能严重性告警** —— 综合剩余百分比与消耗速率的配额健康分类器；托盘图标颜色反映最紧迫的服务状态
- **关于页面** —— 应用版本、构建元数据、许可证审计展示，可从设置页底部导航进入
- **多策略扩展点** —— ProviderFetcher 管道支持每个 Provider 配置多种获取策略

### 变更

- 所有视图和状态迁移至动态 Provider 映射（注册表驱动）
- Provider 感知的 i18n 文案和占位符路由
- 重新设计服务排序设置，增加拖拽操作提示
- 面板摘要与配额节奏健康度对齐

### 修复

- Windows：弹窗定位不再限制为 macOS 专属；增加 USERPROFILE 存储路径回退
- 推广弹窗徽章在服务名称下方正确换行
- 重置倒计时格式化移至 UI 层
- Claude 推广策略状态正确刷新
- Provider 配额顺序标准化
- 关于页底部文案与许可证本地化收紧

## [v1.0.0] - 2026-03-31

### 新增

- **桌面应用** —— Tauri 2 + React 19 桌面应用，菜单栏模式（不显示在 Dock 中）
- **Codex 配额追踪** —— 通过 Codex CLI 实时获取使用限额（`codex app-server` + `account/rateLimits/read`）
- **Claude Code 配额追踪** —— OAuth API 集成，支持系统代理；从 macOS 钥匙串或 `~/.claude/.credentials.json` 读取凭据
- **菜单栏代理** —— macOS 菜单栏模式，使用 `NSApplicationActivationPolicy::Accessory`；紧凑弹窗面板
- **菜单栏 UI 重构** —— 带阈值着色的进度条、国际化（English / 中文）、弹窗生命周期管理
- **自动菜单栏服务** —— 通过 SQLite 元数据和文件活动检测活跃的编程助手，自动在菜单栏高亮显示
- **会话恢复** —— HTTP 401 视为瞬态错误；保留过期缓存；下次刷新自动重试
- **快照缓存** —— 磁盘持久化面板状态以加速重启；`SnapshotStatus` 标签联合类型实现穷举状态处理
- **推广系统** —— 服务推广的胶囊徽章和详情弹窗
- **Claude Code 查询声明** —— 带隐私声明的主动开启控制；默认关闭
- **设置** —— 可配置刷新间隔、面板顺序、语言、开机启动、代理（通过 `scutil --proxy` 自动检测）、各服务开关
- **CI/CD** —— GitHub Actions 桌面构建（PR 验证）和发布（标签触发 + 每日构建）

### 修复

- Windows：启动时隐藏控制台窗口 (#2)
- 跨平台 Codex CLI 快照测试
- 自动刷新正确绑定 `refresh_interval_minutes`
- 推广测试时区安全性
- Claude Code 共享状态测试序列化

[未发布]: https://github.com/anthropics/ai-usage/compare/v1.0.0...HEAD
[v1.0.0]: https://github.com/anthropics/ai-usage/releases/tag/v1.0.0
