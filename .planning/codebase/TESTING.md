# Testing Patterns

**Analysis Date:** 2026-03-31

## Test Framework

**Runner:**
- Vitest 3.0.8
- Config: `vitest.config.ts`
- Environment: jsdom (browser simulation for React testing)
- Globals enabled: `describe`, `it`, `expect` available without imports

**Assertion Library:**
- Vitest built-in expectations (compatible with Jest)
- React Testing Library for component assertions
- Testing Library Jest DOM matchers (`@testing-library/jest-dom/vitest`)

**Run Commands:**
```bash
npm test              # Run all tests once
npm run test:watch   # Watch mode with re-run on changes
npm run test:e2e     # Playwright e2e tests
npm run test:e2e:tauri  # Tauri integration e2e tests
```

## Test File Organization

**Location:**
- Co-located: Test files live beside source files (`src/**/*.test.ts`, `src/**/*.test.tsx`)
- Integration tests: `tests/integration/*.test.ts`
- Contract tests: `tests/contract/*.test.ts`
- E2E tests: `tests/e2e/*.spec.ts` (Playwright)

**Naming:**
- Component tests: `ComponentName.test.tsx`
- Utility/function tests: `functionModule.test.ts`
- E2E tests: `descriptive-name.spec.ts` (Playwright convention)

**Setup:**
```
src/test/setup.ts  # Vitest global setup
├── Imports "@testing-library/jest-dom/vitest"
├── Configures DOM matchers (toBeInTheDocument, etc)
```

## Test Structure

**Suite Organization:**
```typescript
import { describe, expect, it } from "vitest";
import { Component } from "./Component";

describe("Component", () => {
  beforeEach(() => {
    // Setup for each test
    localStorage.clear();
  });

  it("specific behavior description", () => {
    // Arrange
    const data = { /* ... */ };

    // Act
    const result = functionUnderTest(data);

    // Assert
    expect(result).toBe(expectedValue);
  });
});
```

**Patterns:**

1. **Unit Tests (Pure Functions):**
   - Single assertion per test or grouped assertions on same object
   - Example from `src/lib/tauri/summary.test.ts`:
     ```typescript
     describe("formatTraySummary", () => {
       it("uses the lowest remaining percentage for lowest-remaining mode", () => {
         expect(formatTraySummary("lowest-remaining", items)).toBe("6%");
       });

       it("selects the 5h window when requested", () => {
         expect(formatTraySummary("window-5h", items)).toBe("52%");
       });
     });
     ```

2. **Component Tests (React):**
   - Setup mocks first via `vi.hoisted()` and `vi.mock()`
   - Render component with minimal required props
   - Query DOM using Testing Library queries (`screen.getByRole`, `screen.getByText`)
   - Example from `src/components/panel/ServiceCard.test.tsx`:
     ```typescript
     it("shows the service name once and trims repeated service prefixes", () => {
       render(
         <ServiceCard
           copy={getCopy("en-US")}
           service={{ /* ... */ }}
         />
       );

       expect(screen.getByRole("heading", { name: "Claude Code" })).toBeInTheDocument();
       expect(screen.getByText("5h limits")).toBeInTheDocument();
     });
     ```

3. **Integration Tests:**
   - Test cross-module behavior with real module interactions
   - Example from `tests/integration/preferences-persistence.test.ts`:
     ```typescript
     it("saves and restores preferences", () => {
       const saved = savePreferences({
         refreshIntervalMinutes: 25,
         language: "en-US",
         // ...
       });
       const loaded = loadPreferences();

       expect(saved.refreshIntervalMinutes).toBe(25);
       expect(loaded.language).toBe("en-US");
     });
     ```

4. **Contract/API Tests:**
   - Verify Tauri command contracts and return shapes
   - Example from `tests/contract/demo-panel.contract.test.ts`:
     ```typescript
     it("returns codex session state without requiring manual account setup", async () => {
       const state = await tauriClient.getCodexPanelState();

       expect(state.status).toBeDefined();
       expect(typeof state.status.kind).toBe("string");
       expect(state.enabledAccountCount).toBe(0);
     });
     ```

## Mocking

**Framework:** Vitest's `vi` object (compatible with Jest)

**Patterns:**

1. **Module Mocking with `vi.hoisted()` + `vi.mock()`:**
   ```typescript
   const {
     loadPanelState,
     refreshPanelState,
     getPreferences,
     persistPreferences
   } = vi.hoisted(() => ({
     loadPanelState: vi.fn(),
     refreshPanelState: vi.fn(),
     getPreferences: vi.fn(),
     persistPreferences: vi.fn()
   }));

   vi.mock("../../features/demo-services/panelController", () => ({
     loadPanelState,
     refreshPanelState
   }));

   vi.mock("../../features/preferences/preferencesController", () => ({
     getPreferences,
     persistPreferences
   }));
   ```

2. **Function Mocks with Return Values:**
   ```typescript
   loadPanelState.mockReset().mockResolvedValue(createDemoPanelState());
   getPreferences.mockReset().mockResolvedValue(makePreferences());
   ```

3. **Spy on Global Functions:**
   ```typescript
   const setIntervalSpy = vi
     .spyOn(window, "setInterval")
     .mockImplementation(((callback) => 1) as typeof window.setInterval);
   // Later:
   setIntervalSpy.mockRestore();
   ```

4. **Fake/Real Timers:**
   ```typescript
   vi.useFakeTimers();
   vi.setSystemTime(new Date("2026-03-24T16:00:00Z"));
   // Later:
   vi.useRealTimers();
   ```

**What to Mock:**
- External service calls (Tauri commands, API calls)
- Browser APIs with side effects (setInterval, localStorage for isolation)
- Modules with complex dependencies

**What NOT to Mock:**
- Pure utility functions (unless testing is expensive)
- React hooks from React Testing Library (RTL handles them)
- Date/time unless testing time-dependent logic

## Fixtures and Factories

**Test Data:**
```typescript
// Factory function pattern from tests/
const makePreferences = (overrides: Partial<UserPreferences> = {}): UserPreferences => ({
  ...defaultPreferences,
  claudeCodeUsageEnabled: false,
  ...overrides
});

const makeClaudePanelState = (overrides: Partial<CodexPanelState> = {}): CodexPanelState => {
  const base = createDemoPanelState();
  return {
    ...base,
    ...overrides,
    items: overrides.items ?? base.items.map((item) => ({ /* ... */ }))
  };
};
```

**Helper Functions:**
```typescript
// Deferred promise pattern for async testing
const createDeferred = <T,>() => {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((innerResolve, innerReject) => {
    resolve = innerResolve;
    reject = innerReject;
  });
  return { promise, resolve, reject };
};
```

**Location:**
- Inline in test files for single-use fixtures
- `src/features/demo-services/demoData.ts` for reusable demo data
- Factory functions preferred over large static fixtures

## Coverage

**Requirements:** Not enforced (no coverage threshold in vitest.config.ts)

**Current State:**
- Unit tests: High coverage for pure functions (`summary.ts`, `i18n.ts`)
- Component tests: Behavioral coverage (rendering, user interactions)
- E2E tests: Critical paths only (tray interactions, panel workflows)

**View Coverage:**
```bash
# Currently: manual test execution, no built-in coverage reporter configured
# To add: npm install --save-dev @vitest/coverage-v8 && vitest run --coverage
```

## Test Types

**Unit Tests:**
- Scope: Single function or hook
- Approach: Pure function testing with varied inputs
- Files: `src/**/*.test.ts` (utilities, formatters, resolvers)
- Example: `summary.test.ts` tests `formatTraySummary`, `getQuotaStatus`, `getPanelHealthSummary`

**Component Tests:**
- Scope: React component rendering and user interaction
- Approach: Render with React Testing Library, query by role/text, simulate events
- Files: `src/**/*.test.tsx`
- Example: `ServiceCard.test.tsx` tests rendering with different quota statuses
- Uses `screen` queries (preferred) and `container` (for CSS class assertions)

**Integration Tests:**
- Scope: Multiple modules working together
- Approach: Test persistence, state flow, module contracts
- Files: `tests/integration/*.test.ts`
- Example: `preferences-persistence.test.ts` tests save/load cycle with localStorage

**Contract Tests:**
- Scope: Tauri command interfaces and return shapes
- Approach: Call Tauri commands, verify response structure
- Files: `tests/contract/*.test.ts`
- Example: `demo-panel.contract.test.ts` verifies `getCodexPanelState()` returns expected shape

**E2E Tests:**
- Scope: Full application workflows (tray icon, panels, windows)
- Framework: Playwright (not yet visible in source; see `npm run test:e2e`)
- Files: `tests/e2e/*.spec.ts`
- Approach: Control Tauri app via E2E control file, screenshot validation

## Common Patterns

**Async Testing:**
```typescript
// Promise-based async
it("loads cached Claude state and triggers refresh", async () => {
  const refreshDeferred = createDeferred<CodexPanelState>();
  loadClaudeCodePanelState.mockResolvedValue(cachedState);
  refreshClaudeCodePanelState.mockReturnValue(refreshDeferred.promise);

  render(<AppShell />);
  await screen.findByRole("button", { name: "设置" });

  await userEvent.click(screen.getByRole("switch", { name: "启用 Claude Code 查询" }));

  await waitFor(() => expect(refreshClaudeCodePanelState).toHaveBeenCalledTimes(1));

  // Control promise resolution
  await act(async () => {
    refreshDeferred.resolve(newState);
    await refreshDeferred.promise;
  });

  await waitFor(() => expect(screen.queryByText("刷新中...")).not.toBeInTheDocument());
});

// Fake timers for interval-based code
it("keeps Claude Code out of auto-refresh loop when disabled", async () => {
  vi.useFakeTimers();
  const setIntervalSpy = vi.spyOn(window, "setInterval");

  render(<AppShell />);
  await screen.findByRole("button", { name: "设置" });

  const intervalCallback = setIntervalSpy.mock.calls[0]?.[0] as (() => void) | undefined;

  await act(async () => {
    intervalCallback?.();
    await Promise.resolve();
  });

  expect(refreshClaudeCodePanelState).not.toHaveBeenCalled();
  vi.useRealTimers();
});
```

**Error Testing:**
```typescript
// Via status enum (no exceptions thrown)
it("renders error state for invalid proxy configuration", () => {
  render(
    <ServiceCard
      service={{
        // ...
        status: "failed"
      }}
    />
  );

  expect(screen.getByText("代理配置错误")).toBeInTheDocument();
});
```

**User Interaction:**
```typescript
// RTL userEvent (preferred over fireEvent)
await userEvent.click(screen.getByRole("button", { name: "Save" }));
await userEvent.type(screen.getByRole("textbox"), "new value");
await userEvent.hover(screen.getByTestId("promotion-status-trigger"));

// fireEvent for synthetic events (when necessary)
fireEvent.mouseEnter(screen.getByTestId("promotion-status-trigger"));
fireEvent.keyDown(window, { key: "Escape" });
```

**Localization Testing:**
```typescript
// Pass locale-specific copy to components
const en = getCopy("en-US");
const zh = getCopy("zh-CN");

render(<ServiceCard copy={zh} service={/* ... */} />);
expect(screen.getByText("正在刷新")).toBeInTheDocument();

render(<ServiceCard copy={en} service={/* ... */} />);
expect(screen.getByText("Refreshing")).toBeInTheDocument();
```

---

*Testing analysis: 2026-03-31*
