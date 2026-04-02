---
name: release
description: Prepare a release by generating bilingual changelog from commits, then run the release script to bump versions, tag, and push.
---

# Release Preparation

You are preparing a release for AIUsage. The version is: $ARGUMENTS

If no version argument is provided, ask the user for the target version before proceeding.

## Step 1: Validate

- Confirm on `master` branch with clean working tree
- Identify the last version tag: `git describe --tags --abbrev=0`
- Confirm the target version tag does not already exist

## Step 2: Collect Commits

Run `git log <last-tag>..HEAD --oneline --no-merges` to get all commits since the last release.

Filter to only `feat:`, `fix:`, and `chore:` prefixed commits (skip `docs:`, `test:`, and planning-only commits).

## Step 3: Generate Changelog Entries

From the filtered commits, write **user-facing** changelog entries (not raw commit messages) in [Keep a Changelog](https://keepachangelog.com/) format.

Group entries under these headings (omit empty groups):
- `### Added` — new features and capabilities
- `### Changed` — changes to existing behavior
- `### Fixed` — bug fixes

Rules:
- Write from the **user's perspective**, not the developer's. Describe what changed for the user, not how the code changed internally.
- Do NOT include implementation details (TDD, refactoring, trait names, pipeline internals).
- Do NOT include test-only or docs-only changes.
- Combine related commits into single entries where appropriate (e.g. multiple commits for one feature → one entry).
- Use `**bold lead**` for feature names, followed by ` — ` and a short description.
- Keep each entry to one line.

## Step 4: Write to Both Changelog Files

Write the generated entries into the `## [Unreleased]` section of `CHANGELOG.md` (English) and the `## [未发布]` section of `CHANGELOG.zh-CN.md` (Chinese translation).

- The Chinese version should be a natural translation, not a word-for-word mapping.
- Preserve existing content structure and formatting.
- Replace existing `[Unreleased]` / `[未发布]` content (it will be finalized by the release script).

## Step 5: Show Draft for Review

Display the changelog entries for both languages to the user. Ask:

> Review the changelog entries above. Should I adjust anything, or proceed with the release?

Wait for user confirmation before proceeding.

## Step 6: Run Release Script

After user approves, run:

```bash
./scripts/release.sh <version>
```

The script handles: version bump (package.json + tauri.conf.json), changelog section rename with date, commit, tag, and push confirmation.

**Do NOT run the script until the user explicitly approves the changelog.**
