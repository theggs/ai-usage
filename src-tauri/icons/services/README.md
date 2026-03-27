These PNG assets are rasterized from tray-specific source SVGs in
`src/assets/icons/` for host-side tray usage.

- `service-codex-tray.png` comes from `src/assets/icons/service-codex-tray.svg`
- `service-claude-code-tray.png` comes from `src/assets/icons/service-claude-code-tray.svg`

The tray-specific SVGs intentionally use transparent backgrounds and a single
foreground fill so they read correctly in the macOS menu bar and still support
host-side warning/danger tinting.

The Rust tray layer embeds these files at compile time so service-specific tray
icons remain available without runtime file lookup.
