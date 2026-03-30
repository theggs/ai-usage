# Coding Conventions

**Analysis Date:** 2026-03-31

## Naming Patterns

**Files:**
- TypeScript/React: PascalCase for component files (`ServiceCard.tsx`, `AppShell.tsx`), camelCase for utility files (`summary.ts`, `i18n.ts`)
- Rust: snake_case for module files (`claude_code/mod.rs`, `snapshot.rs`, `codex/mod.rs`)
- Test files: Same name as source file with `.test.ts`, `.test.tsx`, or `.spec.ts` suffix

**Functions:**
- TypeScript/React: camelCase (`formatTraySummary`, `getVisibleServiceScope`, `localizeBadgeLabel`)
- Rust: snake_case (`start_e2e_control_loop`, `statusToConnectionState`, `now_unix`)
- Component functions: Exported as const arrows: `export const ServiceCard = ({...}) => {...}`
- Prefix with descriptive verbs: `get*`, `format*`, `resolve*`, `derive*`, `localize*`, `seed*`, `apply*`

**Variables:**
- camelCase in TypeScript (`remainingPercent`, `shouldShowBadge`, `serviceId`)
- snake_case in Rust (`pause_state`, `rate_limit_cooldown_secs`, `UNIX_EPOCH`)
- Constants: UPPER_SNAKE_CASE in Rust (`RATE_LIMIT_COOLDOWN_SECS`, `AUTO_SCAN_INTERVAL_SECS`), camelCase or UPPER_CASE in TypeScript based on usage
- Booleans prefixed with `is*`, `have*`, `should*`: `isFresh()`, `hasVisibleClaudeCode`, `shouldShowBadge`

**Types:**
- PascalCase: `SnapshotStatus`, `ServiceSnapshot`, `CopyTree`, `PromotionDisplayDecision`, `UserPreferences`, `QuotaDimension`
- Type files: match domain (`contracts.ts` for Tauri contracts, `types.ts` for feature types)
- Discriminated unions use `kind` tag for serialization: `#[serde(tag = "kind")]`

## Code Style

**Formatting:**
- No explicit formatter configured; follow TypeScript strict mode and Rust edition 2021 conventions
- Line length guidance: ~80 characters for readability, but not enforced
- Indentation: 2 spaces (TypeScript), standard Rust (4 spaces)

**Linting:**
- TypeScript: Strict mode enabled (`"strict": true` in tsconfig.app.json)
- Type checking: Explicit `noEmit` in build pipeline
- No ESLint or Prettier config found; relies on IDE defaults and manual review
- Rust: Standard clippy conventions

## Import Organization

**Order:**
1. Type imports (`import type { ... } from "..."`)
2. Value imports from external packages (`import React from "react"`, `import { describe, expect } from "vitest"`)
3. Value imports from sibling/parent modules
4. Local file imports grouped by domain

**Example from `src/app/shell/AppShell.test.tsx`:**
```typescript
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AppShell } from "./AppShell";
import { formatPromotionDetailTiming, getCopy } from "../shared/i18n";
import { createDemoPanelState } from "../../features/demo-services/demoData";
import { defaultPreferences } from "../../features/preferences/defaultPreferences";
import type { CodexPanelState, UserPreferences } from "../../lib/tauri/contracts";
import { resolvePromotionDisplayDecision } from "../../features/promotions/resolver";
```

**Path Aliases:**
- None configured; all imports use relative paths (`../../lib/tauri/...`)

## Error Handling

**Patterns:**
- TypeScript: Explicit return type annotations; null/undefined returned for missing values
- Example from `src/lib/tauri/summary.ts`:
  ```typescript
  const parseTimestamp = (value?: string) => {
    if (!value) return undefined;
    const timestamp = /^\d+$/.test(value) ? Number(value) * 1000 : Date.parse(value);
    return Number.isNaN(timestamp) ? undefined : timestamp;
  };
  ```
- Discriminated unions via `kind` tag for state management (e.g., `SnapshotStatus`)
- No throw statements in data transformation functions; return early with fallback values
- Rust: Pattern matching on enums, explicit error types (`ApiError`, `ProxyResolutionError`)
- Example from `src-tauri/src/snapshot.rs`:
  ```rust
  pub enum SnapshotStatus {
    Fresh,
    CliNotFound,
    NotLoggedIn,
    SessionRecovery,
    RateLimited { retry_after_minutes: u32 },
    AccessDenied,
    TemporarilyUnavailable { detail: String },
    // ...
  }
  ```

## Logging

**Framework:** console methods in TypeScript (no wrapper), Rust uses println/eprintln for debugging

**Patterns:**
- No centralized logging library; console output used for development
- Rust: Use descriptive comments and doc comments (`///`) for public APIs
- TypeScript: Comments only when logic is non-obvious; prefer clear function names

**Example from `src-tauri/src/claude_code/mod.rs`:**
```rust
// Claude Code quota integration module.
// Reads OAuth credentials from the host system and calls the Anthropic usage API.
// The OAuth token is never stored in app memory between refresh cycles.
```

## Comments

**When to Comment:**
- Algorithm explanation (e.g., threshold-based sorting, time zone formatting)
- Non-obvious state machine logic (e.g., pause states in `claude_code/mod.rs`)
- Module-level documentation for public APIs

**JSDoc/TSDoc:**
- Not consistently used; function names are self-documenting
- Type annotations preferred over comments
- Example of clear naming: `getVisibleServiceScope`, `decorateQuotaDimension`, `getPanelHealthSummary`

## Function Design

**Size:**
- Prefer small, composable functions (50-150 lines typical)
- Example: `summary.ts` has 20+ utility functions, each with single responsibility

**Parameters:**
- Use object parameters for functions with 2+ params (destructured in signature)
- Example from `ServiceCard.tsx`:
  ```typescript
  export const ServiceCard = ({
    service,
    copy,
    showLastRefreshed = true
  }: {
    service: PanelPlaceholderItem;
    copy: CopyTree;
    showLastRefreshed?: boolean;
  }) => { ... }
  ```

**Return Values:**
- Explicit return types on all functions
- Discriminated unions for state (`kind` field in Rust enums)
- Null/undefined for missing values (not exceptions)

## Module Design

**Exports:**
- Named exports preferred over default exports
- Example: `export const formatTraySummary = (...)` in `summary.ts`
- Re-export shared types at module boundaries

**Barrel Files:**
- Not used; imports use direct file paths
- Each module file explicitly lists its dependencies

**Component Structure:**
- Each React component: single file with one export
- Props type defined inline with component using destructuring
- Example: `ServiceCard.tsx` defines component props inline

## Styling (CSS)

**Framework:** Tailwind CSS 4 utility classes in TSX/HTML

**Patterns:**
- Inline Tailwind classes, no CSS files for component styling
- Example from `ServiceCard.tsx`:
  ```typescript
  const cardClass =
    alertLevel === "danger"
      ? "border-rose-200 bg-rose-50/70 shadow-rose-100"
      : alertLevel === "warning"
        ? "border-amber-200 bg-amber-50/70 shadow-amber-100"
        : "border-slate-200 bg-white shadow-slate-200";
  ```
- Color system: emerald (success), amber (warning), rose (danger), slate (neutral)
- Responsive: Not heavily used in current codebase (compact fixed-size UI)
- No inline styles except dynamic values

## State Management

**Patterns:**
- React hooks + TypeScript for frontend state
- Tauri commands for backend state sync
- Local storage for persistence (`localStorage.setItem`, `localStorage.getItem`)
- Immutable updates: spread operator (`{...state, field: newValue}`)
- Discriminated unions for UI states

**Example from `AppShell.tsx` usage:**
```typescript
const [preferences, setPreferences] = useState<UserPreferences | null>(null);
const [codexState, setCodexState] = useState<CodexPanelState | null>(null);
// Updates via immutable spread:
setPreferences({ ...preferences, refreshIntervalMinutes: newValue });
```

---

*Convention analysis: 2026-03-31*
