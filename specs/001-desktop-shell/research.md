# Research: Iteration 1 Desktop Shell

## Decision 1: Use Tauri 2 as the desktop host

- **Decision**: Implement the first iteration as a Tauri 2 desktop application with a web-based UI layer.
- **Rationale**: The PRD already prioritizes lightweight cross-platform delivery, native tray integration, and small package size. Tauri best matches those goals while keeping one shared UI codebase.
- **Alternatives considered**: Electron was rejected because it increases baseline memory footprint. Native-only macOS and Windows shells were rejected because they would slow down validation of cross-platform parity.

## Decision 2: Use React for panel and settings surfaces

- **Decision**: Build the panel and settings surfaces as React views styled with Tailwind CSS.
- **Rationale**: The PRD explicitly names React and Tailwind, and React is well-suited for rapidly iterating on stateful UI shells such as a tray panel plus settings form.
- **Alternatives considered**: Static HTML was rejected because settings state and module growth would become harder to manage. Other SPA frameworks were rejected to stay aligned with the stated product direction.

## Decision 3: Persist only local preferences in Iteration 1

- **Decision**: Store only local UI preferences and demo-state metadata in the first iteration; do not connect to any remote API or cloud service.
- **Rationale**: This preserves the “no real service integration” scope while still validating that settings survive restart and that the shell can manage user state.
- **Alternatives considered**: Using volatile in-memory state only was rejected because restart persistence is an explicit requirement. Adding early backend sync was rejected because it expands scope without helping the shell validation goal.

## Decision 4: Model demo services using future-compatible quota card shapes

- **Decision**: Represent demo service cards with the same conceptual fields needed by future real integrations: service identity, account label, quota dimensions, refresh timestamp, and status label.
- **Rationale**: This lets Iteration 2 replace the data source while keeping the panel UI contract stable.
- **Alternatives considered**: Free-form mock cards were rejected because they would likely require a UI rewrite once real service data arrives.

## Decision 5: Validate system integrations behind explicit host commands

- **Decision**: Expose tray interactions, autostart toggling, preference persistence, and test notifications through discrete host commands instead of allowing the UI layer to manage them implicitly.
- **Rationale**: This creates a clean boundary between the web UI and the desktop host, which improves testability and reduces coupling.
- **Alternatives considered**: Putting all logic in the frontend was rejected because system-level features such as autostart and notifications belong to the native host layer.

## Decision 6: Use layered automated validation

- **Decision**: Combine frontend component tests, desktop-aware integration tests, and GitHub Actions build verification.
- **Rationale**: Iteration 1 is mainly about shell behavior and packaging confidence, so testing must cover both UI correctness and distributable outputs.
- **Alternatives considered**: Unit-only testing was rejected because it would not validate tray, packaging, or startup behavior. Manual-only validation was rejected because CI deliverables are part of the iteration scope.
