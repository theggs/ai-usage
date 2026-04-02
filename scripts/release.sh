#!/usr/bin/env bash
#
# release.sh — Automate the mechanical parts of a release.
#
# Usage: ./scripts/release.sh <version>
#   e.g. ./scripts/release.sh v2.0.0
#
# Prerequisites:
#   - Working tree is clean (no uncommitted changes)
#   - On the master branch
#   - [Unreleased] section in CHANGELOG.md is already populated
#     (use Claude Code to generate changelog entries before running this)
#
# What it does:
#   1. Pre-flight checks
#   2. Bump version in package.json + src-tauri/tauri.conf.json
#   3. Rename [Unreleased] → [<version>] with today's date in both changelog files
#   4. Add fresh [Unreleased] section
#   5. Update comparison links at bottom of changelogs
#   6. Commit "release: <version>"
#   7. Create git tag
#   8. Push (with confirmation)

set -euo pipefail

# ── Helpers ──────────────────────────────────────────────────────────

red()    { printf '\033[0;31m%s\033[0m\n' "$*"; }
green()  { printf '\033[0;32m%s\033[0m\n' "$*"; }
yellow() { printf '\033[0;33m%s\033[0m\n' "$*"; }
bold()   { printf '\033[1m%s\033[0m\n' "$*"; }

die() { red "Error: $*" >&2; exit 1; }

# ── Parse args ───────────────────────────────────────────────────────

VERSION="${1:-}"
if [[ -z "$VERSION" ]]; then
  echo "Usage: $0 <version>"
  echo "  e.g. $0 v2.0.0"
  exit 1
fi

# Normalize: ensure version starts with 'v'
[[ "$VERSION" == v* ]] || VERSION="v${VERSION}"

# Bare version without 'v' prefix (for package.json / tauri.conf.json)
BARE_VERSION="${VERSION#v}"
TODAY="$(date +%Y-%m-%d)"

bold "Preparing release ${VERSION} (${TODAY})"
echo

# ── Pre-flight checks ───────────────────────────────────────────────

# Must be on master
BRANCH="$(git rev-parse --abbrev-ref HEAD)"
if [[ "$BRANCH" != "master" ]]; then
  die "Must be on master branch (currently on '${BRANCH}')"
fi

# Working tree must be clean
if [[ -n "$(git status --porcelain)" ]]; then
  die "Working tree is not clean. Commit or stash changes first."
fi

# Tag must not already exist
if git rev-parse "$VERSION" >/dev/null 2>&1; then
  die "Tag ${VERSION} already exists"
fi

# Changelog must have [Unreleased] content
UNRELEASED_CONTENT="$(awk '
  /^## \[Unreleased\]/ { found=1; next }
  /^## \[/ { if (found) exit }
  found && /^[^[:space:]]/ { has_content=1 }
  END { print (has_content ? "yes" : "no") }
' CHANGELOG.md)"

if [[ "$UNRELEASED_CONTENT" != "yes" ]]; then
  die "[Unreleased] section in CHANGELOG.md is empty. Generate changelog entries first."
fi

green "Pre-flight checks passed"
echo

# ── Bump versions ───────────────────────────────────────────────────

bold "Bumping version to ${BARE_VERSION}..."

# package.json
node -e "
  const fs = require('fs');
  const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  pkg.version = '${BARE_VERSION}';
  fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n');
"

# src-tauri/tauri.conf.json
node -e "
  const fs = require('fs');
  const conf = JSON.parse(fs.readFileSync('src-tauri/tauri.conf.json', 'utf8'));
  conf.version = '${BARE_VERSION}';
  fs.writeFileSync('src-tauri/tauri.conf.json', JSON.stringify(conf, null, 2) + '\n');
"

green "  package.json: ${BARE_VERSION}"
green "  tauri.conf.json: ${BARE_VERSION}"

# ── Update changelogs ────────────────────────────────────────────────

update_changelog() {
  local file="$1"
  local unreleased_label="$2"  # "Unreleased" or "未发布"
  local repo_url="https://github.com/anthropics/ai-usage"

  bold "Updating ${file}..."

  # Get the previous version tag for link updates
  PREV_TAG="$(git describe --tags --abbrev=0 2>/dev/null || echo "")"

  # Replace [Unreleased/未发布] heading with versioned heading + new empty section
  local tmp
  tmp="$(mktemp)"

  awk -v ver="$VERSION" -v date="$TODAY" -v label="$unreleased_label" -v repo="$repo_url" -v prev="$PREV_TAG" '
    # When we hit the [Unreleased] heading, insert new empty unreleased + version heading
    /^## \[/ && index($0, label) {
      print "## [" label "]"
      print ""
      print "## [" ver "] - " date
      next
    }
    # Update the [Unreleased] comparison link
    /^\[/ && index($0, label) && index($0, "compare") {
      print "[" label "]: " repo "/compare/" ver "...HEAD"
      # Add the new version link
      if (prev != "") {
        print "[" ver "]: " repo "/compare/" prev "..." ver
      } else {
        print "[" ver "]: " repo "/releases/tag/" ver
      }
      next
    }
    # Skip old unreleased link if it was already printed above
    { print }
  ' "$file" > "$tmp"

  mv "$tmp" "$file"
  green "  ${file} updated"
}

update_changelog "CHANGELOG.md" "Unreleased"
update_changelog "CHANGELOG.zh-CN.md" "未发布"

echo

# ── Show summary ─────────────────────────────────────────────────────

bold "Changes to be committed:"
git diff --stat
echo

# ── Commit and tag ───────────────────────────────────────────────────

git add package.json src-tauri/tauri.conf.json CHANGELOG.md CHANGELOG.zh-CN.md
git commit -m "release: ${VERSION}"
git tag -a "$VERSION" -m "$VERSION"

green "Created commit and tag ${VERSION}"
echo

# ── Push ─────────────────────────────────────────────────────────────

yellow "Ready to push commit + tag to origin."
read -rp "Push now? [y/N] " answer
if [[ "$answer" =~ ^[Yy]$ ]]; then
  git push origin master --follow-tags
  green "Pushed! GitHub Actions will build and publish the release."
else
  yellow "Skipped push. Run manually when ready:"
  echo "  git push origin master --follow-tags"
fi
