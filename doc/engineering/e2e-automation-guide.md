# Tauri 2 macOS 自动化 E2E 测试实践指南

**背景**：为 Tauri 2 macOS 菜单栏应用实现自动化 UI 测试（截图审查 + 功能冒烟测试）。
**适用场景**：macOS 上的 Tauri 2 桌面应用，尤其是菜单栏/托盘面板类 UI。

---

## 一、方案选型：走过的弯路

### 1.1 Playwright 浏览器模式 ❌

**思路**：用 Playwright 打开 Vite dev server（localhost:5173），截图审查。

**问题**：Tauri 应用检测 `window.__TAURI_INTERNALS__` 判断运行环境。浏览器模式下该对象不存在，应用降级为 demo 数据路径（`createDemoPanelState()`），导致截图拿到的是 demo 页面而非真实产品。

**教训**：
- 如果应用有 Tauri/非 Tauri 双路径，浏览器模式测试的不是真实产品
- 浏览器窗口尺寸、生命周期行为也与 Tauri 窗口不同
- 对于菜单栏应用，浏览器模式甚至无法复现"从托盘图标弹出"的交互

### 1.2 tauri-driver (WebDriver) ❌

**思路**：`tauri-driver` 是 Tauri 官方 WebDriver 桥接工具，配合 WebdriverIO 进行自动化测试。

**问题**：
- `tauri-driver` 在当前 macOS（Darwin 25.x）上报 `"not supported on this platform"`
- Tauri 2 在 macOS 上使用 WKWebView（Safari 内核），而非 Chromium。Playwright 基于 CDP（Chrome DevTools Protocol），无法连接 WKWebView
- `safaridriver` 理论上可以，但 `tauri-driver` 的封装层未适配当前平台

**教训**：
- 不要假设官方工具在所有平台都可用，先实际运行验证
- Tauri 2 的 WebView 引擎因平台而异（macOS = WKWebView, Windows = WebView2, Linux = WebKitGTK），测试方案必须适配

### 1.3 Python CoreGraphics (pyobjc) ❌

**思路**：用 Python 调用 macOS CoreGraphics API 查找窗口。

**问题**：系统 Python（Homebrew Python 3.14）未安装 PyObjC，且 `pip install pyobjc` 在较新 Python 上可能编译失败。

**教训**：macOS 原生 API 优先考虑 Swift/ObjC，而非 Python 绑定。

### 1.4 坐标点击 ❌

**思路**：用 `cliclick` 工具按屏幕坐标点击按钮。

**问题**：
- 坐标受标题栏高度、窗口位置、缩放比例影响，极度脆弱
- 尝试了多个 Y 偏移（22/40/50/70），均无法稳定命中目标
- 不同分辨率、不同 macOS 版本下坐标会漂移

**教训**：永远不要用绝对坐标做 UI 自动化，使用语义化标识（accessibility label）。

---

## 二、最终方案：macOS 原生 API

### 2.1 架构总览

```
Node.js 测试脚本
    ├── launchApp()        → spawn Tauri 二进制（AIUSAGE_E2E=1）
    ├── findWindow()       → Swift: CoreGraphics CGWindowListCopyWindowInfo
    ├── screenshot()       → macOS screencapture -l <windowId>
    ├── clickButton()      → Swift: Accessibility API (AXUIElement)
    └── shutdown()         → SIGTERM → SIGKILL
```

### 2.2 关键技术点

#### a) 测试模式环境变量

Tauri 菜单栏应用默认窗口隐藏、失焦即收起。自动化测试需要窗口持续可见。

**做法**：在 Rust 入口添加 `AIUSAGE_E2E=1` 环境变量检测：

```rust
let test_mode = std::env::var("AIUSAGE_E2E").unwrap_or_default() == "1";
if let Some(window) = app.get_webview_window("main") {
    if !test_mode {
        // 正常模式：注册隐藏行为
        window.on_window_event(move |event| match event {
            WindowEvent::CloseRequested { api, .. } => {
                api.prevent_close();
                let _ = window_handle.hide();
            }
            WindowEvent::Focused(is_focused) if should_hide(*is_focused) => {
                let _ = window_handle.hide();
            }
            _ => {}
        });
        let _ = window.hide();
    } else {
        // 测试模式：窗口立即显示，不注册隐藏行为
        let _ = window.show();
        let _ = window.set_focus();
    }
}
```

**要点**：测试模式通过"不注册"隐藏事件来保持窗口可见，而非注册后再 override。这样更干净，不会引入竞态。

#### b) 窗口查找（CoreGraphics）

用 Swift 调用 `CGWindowListCopyWindowInfo` 枚举所有屏幕窗口，按进程名 + 窗口尺寸过滤。

```swift
let windowList = CGWindowListCopyWindowInfo(
    [.optionOnScreenOnly, .excludeDesktopElements],
    kCGNullWindowID
) as? [[String: Any]] ?? []

for window in windowList {
    guard let owner = window[kCGWindowOwnerName as String] as? String else { continue }
    guard owner.lowercased().contains("ai_usage") else { continue }
    // 按尺寸过滤，排除隐藏辅助窗口
    guard w > 100 && w < 500 && h > 400 && h < 900 else { continue }
    // 输出 JSON: {"id":123,"owner":"ai_usage","bounds":{...}}
}
```

**踩坑**：Tauri 可能创建多个窗口（包括不可见的辅助窗口）。必须按尺寸过滤，否则 `screencapture` 会捕获错误的窗口，报 "could not create image from window"。

#### c) 截图（screencapture）

```bash
screencapture -l <windowId> -o output.png
```

- `-l` 参数接受 CGWindowID（从 CoreGraphics 拿到的整数）
- `-o` 禁止截图声音
- 需要 macOS **屏幕录制**权限

#### d) 按钮点击（Accessibility API）

用 Swift 通过 `AXUIElement` API 递归搜索 UI 树，按 accessibility label 找到按钮并触发点击。

```swift
func findButton(_ element: AXUIElement, label: String) -> AXUIElement? {
    var roleRef: CFTypeRef?
    AXUIElementCopyAttributeValue(element, kAXRoleAttribute as CFString, &roleRef)
    let role = roleRef as? String ?? ""

    var titleRef: CFTypeRef?
    AXUIElementCopyAttributeValue(element, kAXTitleAttribute as CFString, &titleRef)
    let title = titleRef as? String ?? ""

    // 匹配 AXButton 或 AXLink 的 title 或 description
    if (role == "AXButton" || role == "AXLink") && (title == label || desc == label) {
        return element
    }

    // 递归搜索子元素
    // ...
}

// 找到后执行点击
AXUIElementPerformAction(button, kAXPressAction as CFString)
```

**要点**：
- 需要终端应用（如 Warp、Terminal.app、iTerm2）在 macOS 系统设置 → 隐私与安全性 → 辅助功能 中获得权限
- Web 端按钮如果没有显式 `aria-label`，WKWebView 会用按钮的文本内容作为 accessibility title
- `AXLink` 也要匹配——HTML `<a>` 标签在 accessibility 树中是 Link 而非 Button
- 国际化应用中按钮文本可能是中文或英文，测试脚本应两种都尝试：
  ```javascript
  const clicked = await clickButton("设置") || await clickButton("Settings");
  ```

#### e) Swift 辅助工具的编译管理

Swift 文件在首次使用时自动编译为二进制，后续仅在源码更新时重新编译：

```javascript
function compileIfNeeded(swiftFile, outputBin) {
  if (!existsSync(outputBin) ||
      statSync(outputBin).mtimeMs < statSync(swiftFile).mtimeMs) {
    execSync(`swiftc -O -o "${outputBin}" "${swiftFile}"`);
  }
}
```

编译产物放在同目录下以 `.` 开头（`.find-window`、`.click-button`），加入 `.gitignore`。

---

## 三、测试脚本组织

```
tests/e2e/
├── tauri-driver.mjs          # 驱动模块（launchApp/screenshot/clickButton/shutdown）
├── find-window.swift         # CoreGraphics 窗口查找
├── click-button.swift        # Accessibility API 按钮点击
├── tray-panel.spec.mjs       # 功能冒烟测试
├── screenshot-review.mjs     # 截图审查脚本
├── screenshots/              # 截图输出目录（.gitignore）
├── .find-window              # 编译产物（.gitignore）
└── .click-button             # 编译产物（.gitignore）
```

npm scripts：

```json
{
  "test:e2e:build": "npx vite build && cd src-tauri && cargo build",
  "test:e2e:tauri": "AIUSAGE_E2E=1 node tests/e2e/tray-panel.spec.mjs",
  "test:e2e:screenshots": "AIUSAGE_E2E=1 node tests/e2e/screenshot-review.mjs"
}
```

---

## 四、权限清单

首次在新机器上运行需授权：

| 权限 | 位置 | 用途 |
|------|------|------|
| 辅助功能 | 系统设置 → 隐私与安全性 → 辅助功能 | AXUIElement 按钮点击 |
| 屏幕录制 | 系统设置 → 隐私与安全性 → 屏幕录制 | screencapture -l |

**注意**：需要授权的是**运行测试的终端应用**（Warp / Terminal.app / iTerm2），不是测试脚本本身。

---

## 五、环境注意事项

### 5.1 代理环境

如果开发机配置了 HTTP 代理（如 `http_proxy=http://127.0.0.1:7897`），可能干扰本地连接。测试脚本不涉及 HTTP，但如果后续扩展为 WebDriver 方案，需设置 `NO_PROXY=127.0.0.1,localhost`。

### 5.2 多窗口应用

Tauri 可能创建不可见的辅助窗口（helper window、devtools 等）。窗口查找必须加尺寸过滤或 layer 过滤，不能简单取"第一个匹配进程名的窗口"。

### 5.3 Retina 显示屏

`screencapture` 在 Retina 屏上默认捕获 2x 分辨率。截图文件会比窗口逻辑尺寸大一倍。如果需要像素级对比，需统一处理 DPI。

### 5.4 CI 环境

此方案依赖 macOS 窗口系统（WindowServer），无法在 headless Linux CI 中运行。macOS CI runner（如 GitHub Actions macOS、CircleCI macOS）需要额外配置辅助功能和屏幕录制权限，通常通过 TCC 数据库预授权：

```bash
# CI 中预授权（需 root）
sudo sqlite3 /Library/Application\ Support/com.apple.TCC/TCC.db \
  "INSERT OR REPLACE INTO access VALUES('kTCCServiceAccessibility','com.apple.Terminal',0,2,4,1,NULL,NULL,0,'UNUSED',NULL,0,0);"
```

---

## 六、适用性与局限

### 适用

- macOS 上的 Tauri 2 应用（WKWebView）
- 菜单栏/托盘面板类应用（需测试模式绕过隐藏行为）
- 需要测试真实后端数据路径的场景
- 截图审查、冒烟测试、视觉回归

### 不适用

- 跨平台统一测试方案（Windows/Linux 需各自实现）
- 细粒度 DOM 断言（拿不到 DOM，只能按 accessibility label 交互）
- 大量复杂交互测试（每次交互需 Swift 进程调用，开销较大）

### 可扩展方向

- **视觉回归**：将截图与基线图做像素对比（如 pixelmatch），集成到 CI
- **文本断言**：通过 Accessibility API 读取 `AXValue`/`AXTitle` 做内容断言，不仅限于点击
- **键盘输入**：通过 CGEvent 注入键盘事件，测试输入框交互
- **跨平台**：Windows 可用 UI Automation API，Linux 可用 AT-SPI，但需分别实现
