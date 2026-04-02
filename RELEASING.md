# Release Workflow

This document describes how to publish a new version of AIUsage.

## Quick Reference

```bash
# In Claude Code:
/release v2.0.0

# The skill will:
#   1. Collect commits since last tag
#   2. Generate bilingual changelog entries (EN + zh-CN)
#   3. Write them to [Unreleased] in both CHANGELOG files
#   4. Show you a draft for review
#   5. After you approve, run scripts/release.sh which:
#      - Bumps version in package.json + tauri.conf.json
#      - Moves [Unreleased] → [v2.0.0] with today's date
#      - Commits and tags
#      - Asks to push — GitHub Actions builds and publishes the release
```

## Detailed Steps

### 1. Run the Release Skill

In a Claude Code session on the master branch:

```
/release v2.0.0
```

The `/release` skill (defined in `.claude/commands/release.md`) will:
- Validate you're on master with a clean working tree
- Run `git log <last-tag>..HEAD` to collect all commits
- Generate user-facing changelog entries in Added / Changed / Fixed categories
- Write entries to both `CHANGELOG.md` (English) and `CHANGELOG.zh-CN.md` (Chinese)
- Show you the draft for review

Review the entries. Ask to adjust wording if needed.

After you approve, the skill runs `scripts/release.sh` automatically.

### 2. What the Release Script Does

The script performs pre-flight checks, then:

| Step | What happens |
|------|-------------|
| Version bump | Updates `package.json` and `src-tauri/tauri.conf.json` |
| Changelog finalize | Renames `[Unreleased]` → `[v2.0.0] - YYYY-MM-DD` in both files, adds fresh empty `[Unreleased]` section, updates comparison links |
| Commit | `release: v2.0.0` |
| Tag | `v2.0.0` (annotated) |
| Push | Asks for confirmation, then pushes commit + tag |

### 3. GitHub Actions Takes Over

Once the `v*` tag is pushed, the `desktop-release` workflow:

1. Builds macOS (.app → .zip) and Windows (.exe) installers
2. Extracts the changelog section for this version from `CHANGELOG.md`
3. Creates a GitHub Release with the assets and changelog as the release body

The release page is available at:
`https://github.com/anthropics/ai-usage/releases/tag/v2.0.0`

## Pre-flight Checks

The release script enforces:

- **Clean working tree** — no uncommitted changes
- **On master branch** — releases always cut from master
- **Tag doesn't exist** — prevents accidental re-release
- **Changelog not empty** — `[Unreleased]` must have content

## Files Modified by the Script

| File | Change |
|------|--------|
| `package.json` | `version` field |
| `src-tauri/tauri.conf.json` | `version` field |
| `CHANGELOG.md` | Section rename + new empty `[Unreleased]` + links |
| `CHANGELOG.zh-CN.md` | Same as above (Chinese labels) |

## Troubleshooting

**Script says "[Unreleased] section is empty"**
Run `/release <version>` in Claude Code to generate changelog entries first.

**Tag already exists**
Delete it with `git tag -d v2.0.0` (local) and `git push origin :refs/tags/v2.0.0` (remote) if the release was never published.

**GitHub Actions build failed after push**
Fix the issue, then either:
- Delete the tag and release, fix, and re-release
- Or upload fixed assets manually with `gh release upload`
