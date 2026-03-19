# Feature Specification: macOS Menu Bar Agent Mode

**Feature Branch**: `003-macos-menubar-agent`
**Created**: 2026-03-19
**Status**: Draft
**Input**: User description: "Make the app behave as a true macOS menu bar application: no Dock icon, no terminal window on launch"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - App Launches as Invisible Background Agent (Priority: P1)

As a user, when I launch AIUsage, the app should start silently as a menu bar (tray) application. No Dock icon should appear, and no terminal or console window should be visible. The only visible presence of the app is its tray icon in the macOS menu bar.

**Why this priority**: This is the core ask. A menu bar utility that shows a Dock icon and terminal window fundamentally breaks the expected UX pattern for this category of application. Users expect menu bar apps to be unobtrusive.

**Independent Test**: Launch the built application on macOS. Verify that only the tray icon appears in the menu bar, with no Dock icon and no terminal/console window visible.

**Acceptance Scenarios**:

1. **Given** the app is not running, **When** the user launches AIUsage, **Then** the app appears only as a tray icon in the macOS menu bar with no Dock icon visible.
2. **Given** the app is not running, **When** the user launches AIUsage, **Then** no terminal, console, or other window is displayed on screen.
3. **Given** the app is running as a menu bar agent, **When** the user opens Mission Control or Cmd+Tab app switcher, **Then** AIUsage does not appear in the app switcher or Mission Control.

---

### User Story 2 - Tray Interaction Remains Functional (Priority: P1)

As a user, after the app launches in agent mode, all existing tray icon interactions (click to show/hide panel, context menu) must continue to work exactly as before.

**Why this priority**: Equal to P1 because hiding the Dock icon must not break the primary interaction model. The tray is the only entry point for the user.

**Independent Test**: Launch the app, click the tray icon, verify the usage panel appears. Right-click for context menu. Verify all existing tray interactions work.

**Acceptance Scenarios**:

1. **Given** the app is running in agent mode, **When** the user clicks the tray icon, **Then** the usage panel window appears as expected.
2. **Given** the usage panel is visible, **When** the user clicks the tray icon again or clicks outside the panel, **Then** the panel hides.
3. **Given** the app is running in agent mode, **When** the user interacts with the tray context menu, **Then** all menu actions (preferences, quit, etc.) work correctly.

---

### Edge Cases

- What happens when the app is launched from a terminal manually (e.g., `./AIUsage`)? The app should still behave as an agent with no extra windows.
- What happens on non-macOS platforms? This feature is macOS-specific. On other platforms (Linux, Windows), the existing behavior should be preserved with no regressions.
- What happens during development mode (`npm run tauri dev`)? The development experience may differ — a visible window for dev tools is acceptable during development.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The application MUST be configured as a macOS UI Element Agent so the system hides it from the Dock and app switcher.
- **FR-002**: The application MUST NOT display any terminal or console window upon launch on macOS.
- **FR-003**: The application MUST NOT appear in the macOS Dock when running.
- **FR-004**: The application MUST NOT appear in the Cmd+Tab application switcher.
- **FR-005**: All existing tray icon interactions MUST continue to function identically after this change.
- **FR-006**: This behavior change MUST only affect macOS builds. Other platform builds MUST remain unaffected.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: On macOS, after launching the app, zero windows (terminal or otherwise) are visible on screen — only the tray icon is present in the menu bar.
- **SC-002**: On macOS, the app does not appear in the Dock or Cmd+Tab switcher at any point during normal operation.
- **SC-003**: All existing tray-based user interactions (show panel, hide panel, context menu actions) pass their current acceptance tests without modification.
- **SC-004**: On non-macOS platforms, all existing tests pass without modification (no regression).

## Assumptions

- The Tauri 2.0 framework supports setting macOS Info.plist properties via its configuration file.
- No additional application code changes are needed beyond configuration — the framework handles the Info.plist generation automatically.
- The `bundle.active = false` setting does not prevent agent-mode properties from taking effect during development builds.
