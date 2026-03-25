# Runtime History

This document is the single historical record for repository-wide runtime baseline changes.

## Node.js Baseline

- Historical feature artifacts under `specs/` preserve the runtime baseline that was current when each iteration was authored. Do not rewrite those documents to match the current toolchain.
- Through `013-promotion-status`, the historical spec artifacts were authored against Node.js 20 LTS.
- The repository-wide baseline was raised from Node.js 20 LTS to Node.js 24 LTS after the `013-promotion-status` iteration.
- Current runtime requirements should be read from `.nvmrc`, `package.json#engines`, `README.md`, and `AGENTS.md`, not backfilled into historical spec artifacts.
