# Phase 6: About Page - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-02
**Phase:** 06-about-page
**Areas discussed:** Navigation & access, Visual layout, License & dep audit display

---

## Navigation & Access

### How should users reach the About page?

| Option | Description | Selected |
|--------|-------------|----------|
| Link in Settings footer | Add "About AIUsage" link at bottom of SettingsView. Minimal UI change. | ✓ |
| Info icon in header | Small (i) icon next to gear icon on panel header. Adds clutter. | |
| Three-way view switcher | Segmented control (Panel / Settings / About). Heavy UI change. | |

**User's choice:** Link in Settings footer
**Notes:** Recommended option — keeps header clean, natural discovery path.

### How should the About page appear when tapped?

| Option | Description | Selected |
|--------|-------------|----------|
| Slide right (same animation) | About slides in from right, like Settings does from Panel. | ✓ |
| Replace in-place (no animation) | Instant content swap within scrollable area. | |
| Modal overlay | Centered card overlay on top of Settings. | |

**User's choice:** Slide right (same animation)
**Notes:** Consistent with existing panel-to-settings transition pattern.

### Keyboard shortcuts for About page?

| Option | Description | Selected |
|--------|-------------|----------|
| No shortcut needed | About is rarely visited. Navigate via Settings link. | ✓ |
| Add a shortcut from Settings | E.g., 'A' or 'I' while in Settings navigates to About. | |

**User's choice:** No shortcut needed
**Notes:** None.

### Window blur behavior on About page?

| Option | Description | Selected |
|--------|-------------|----------|
| Return to Panel | Same as Settings behavior — popover reappears on Panel. | ✓ |
| Stay on About | Preserve About view across blur/focus cycles. | |

**User's choice:** Return to Panel
**Notes:** None.

### About page header style?

| Option | Description | Selected |
|--------|-------------|----------|
| Same back-arrow + title | "< About" header, matching Settings header pattern. | ✓ |
| No header (scroll into hero) | Hero section is the top, floating back button in corner. | |
| Minimal close button | Small x in top-right, no title text. | |

**User's choice:** Same back-arrow + title
**Notes:** Visually consistent with Settings.

---

## Visual Layout

### Overall layout style?

| Option | Description | Selected |
|--------|-------------|----------|
| App icon hero + key-value list | Icon/name at top, clean key-value list below. Extensible. | ✓ |
| Simple key-value list (no hero) | Plain labeled rows, no visual flair. | |
| Sectioned cards | Separate cards per section, takes more vertical space. | |

**User's choice:** App icon hero + key-value list
**Notes:** Fits compact popover well, extensible for future fields.

### App icon source?

| Option | Description | Selected |
|--------|-------------|----------|
| Existing app icon asset | Use app icon from src-tauri/icons/. No new artwork. | ✓ |
| Text-only (no icon) | Styled text only, no image. | |
| Custom About icon | New illustration for About page hero. | |

**User's choice:** Existing app icon asset
**Notes:** None.

### GitHub URL behavior?

| Option | Description | Selected |
|--------|-------------|----------|
| Open in default browser | Tauri shell.open API, cross-platform. | ✓ |
| Copy to clipboard | Copy URL with brief toast. | |

**User's choice:** Open in default browser
**Notes:** Standard desktop app behavior.

### Localize About page labels?

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, localize labels | Follow existing i18n pattern. Consistent with Settings. | ✓ |
| English-only labels | Labels stay English regardless of language. | |

**User's choice:** Yes, localize labels
**Notes:** Consistent with fully localized Settings view.

### Version number source?

| Option | Description | Selected |
|--------|-------------|----------|
| Tauri package metadata | Read from tauri.conf.json via app.version API. Single source of truth. | ✓ |
| Git tag / build info | Include commit hash or build date. More complexity. | |
| You decide | Claude's discretion. | |

**User's choice:** Tauri package metadata
**Notes:** Already available at "0.1.0".

---

## License & Dep Audit Display

### App license?

| Option | Description | Selected |
|--------|-------------|----------|
| MIT | Permissive, widely used. | |
| Apache 2.0 | Permissive with patent grant. | ✓ |
| GPL v3 | Copyleft, limits commercial use. | |

**User's choice:** Apache 2.0 (user corrected from initial MIT selection)
**Notes:** LICENSE file to be created in project root.

### Dependency license detail level?

| Option | Description | Selected |
|--------|-------------|----------|
| Summary count + copyleft flags | Total count + copyleft warning. Compact. | ✓ |
| Expandable full list | Summary with "Show all" toggle for scrollable list. | |
| Link to external file | Opens THIRD_PARTY_LICENSES.txt in OS text editor. | |

**User's choice:** Summary count + copyleft flags
**Notes:** No full list in-app.

### Ecosystem coverage?

| Option | Description | Selected |
|--------|-------------|----------|
| Both Rust + npm | Audit Cargo.lock and package-lock.json. Combined count. | ✓ |
| Rust crates only | Frontend npm packages less visible to users. | |
| You decide | Claude's discretion. | |

**User's choice:** Both Rust + npm
**Notes:** App ships both ecosystems.

### License data delivery mechanism?

| Option | Description | Selected |
|--------|-------------|----------|
| JSON file bundled at build | Build script generates JSON summary, Vite static import. | ✓ |
| Tauri command reads generated file | IPC command reads file at runtime. | |
| You decide | Claude's discretion. | |

**User's choice:** JSON file bundled at build
**Notes:** No Tauri command needed.

---

## Claude's Discretion

- Build script tooling choice for license audit
- Exact icon sizing and spacing in hero section
- Color treatment for copyleft warning indicator
- Whether to show "0 copyleft" explicitly or only flag when found

## Deferred Ideas

None — discussion stayed within phase scope.
