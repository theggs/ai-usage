# Phase 6: About Page - Context

**Gathered:** 2026-04-02
**Status:** Ready for planning

<domain>
## Phase Boundary

Standalone About page showing app version, GitHub link, Apache 2.0 license, and a build-time dependency license audit summary. Accessible from the Settings footer, rendered as a third view with the same slide animation pattern. Does NOT modify Settings content or Panel behavior.

</domain>

<decisions>
## Implementation Decisions

### Navigation & Access
- **D-01:** About page is reached via a footer link in SettingsView ("About AIUsage >"). No header icon or tab bar.
- **D-02:** About page slides in from the right using the same CSS translate animation as the panel-to-settings transition. View state flow: panel -> settings -> about.
- **D-03:** Back arrow in About header returns to Settings (not Panel). Same back-arrow + title pattern as Settings header.
- **D-04:** No keyboard shortcut for the About page. F6/S and F7/B remain unchanged.
- **D-05:** On window blur, if currentView is "about", reset to "panel" on next open (same behavior as Settings).

### Visual Layout
- **D-06:** Layout is app-icon hero (existing app icon asset from src-tauri/icons/) + app name + version at top, followed by a key-value list below (License, GitHub, Dependencies).
- **D-07:** Key-value list pattern is extensible — adding future fields (website, author email) means adding new rows, no structural changes. Satisfies ABOUT-06.
- **D-08:** GitHub URL row opens the link in the default browser via Tauri shell.open API (cross-platform).
- **D-09:** All labels (Version, License, GitHub, Dependencies) are localized via i18n.ts, consistent with the rest of the app.
- **D-10:** Version number is sourced from Tauri package metadata (app.version API), matching the binary version in tauri.conf.json.

### License & Dependency Audit
- **D-11:** App license is Apache 2.0. A LICENSE file must be created in the project root.
- **D-12:** Dependency license summary shows total count + copyleft flag status (e.g., "87 packages / All permissive" or "87 packages / 1 copyleft"). No full scrollable list in-app.
- **D-13:** Audit covers both Rust crates (Cargo.lock) and npm packages (package-lock.json).
- **D-14:** Build-time audit generates a JSON summary file that is bundled via Vite static import. No Tauri command needed for license data delivery.

### Claude's Discretion
- Build script tooling choice for license audit (cargo-license, license-checker, or custom script)
- Exact icon sizing and spacing in the hero section
- Color treatment for copyleft warning indicator
- Whether to show "0 copyleft" explicitly or only flag when copyleft is found

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### App Configuration
- `src-tauri/tauri.conf.json` — Version field ("0.1.0"), productName, identifier; source of truth for app metadata
- `src-tauri/Cargo.toml` — Rust dependency list (audited for licenses)
- `package.json` — npm dependency list (audited for licenses)

### Existing View Patterns
- `src/app/shell/AppShell.tsx` — View switching logic (currentView state, slide animation, blur-to-panel reset, keyboard shortcuts)
- `src/app/settings/SettingsView.tsx` — Settings view (footer link will be added here; header pattern to replicate)
- `src/app/panel/PanelView.tsx` — Panel view (reference for consistent component structure)

### Shared Infrastructure
- `src/app/shared/i18n.ts` — Localization system (add About page copy here)
- `src/app/shared/appState.ts` — App state context (may need currentView type update)
- `src/lib/tauri/contracts.ts` — TypeScript type definitions

### Assets
- `src-tauri/icons/` — App icon assets (hero section source)
- `src/assets/` — Frontend static assets

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `AppShell.tsx` slide animation: `translate-x` CSS transition on a flex container — can be extended from 2-view (200%) to 3-view (300%) width
- `BackIcon` component: Already defined in AppShell.tsx, reusable for About header
- `SettingsIcon` / gear button pattern: Reference for consistent header styling
- `i18n.ts getCopy()`: Existing localization pattern for adding About page strings

### Established Patterns
- View state is a union type (`"panel" | "settings"`) — extend to `"panel" | "settings" | "about"`
- Header renders conditionally based on `currentView` — add "about" branch
- Window blur resets view to "panel" (line ~135 in AppShell.tsx) — already handles non-panel views

### Integration Points
- `SettingsView.tsx` footer: Add "About AIUsage >" link with onClick handler calling `openAbout()` (new context method)
- `AppShell.tsx`: Extend currentView type, add About view import, extend slide container width
- `appState.ts`: Add `openAbout` / `closeAbout` to context if needed
- `i18n.ts`: Add About page copy tree entries

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches within the decisions above.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 06-about-page*
*Context gathered: 2026-04-02*
