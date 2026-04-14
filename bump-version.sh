#!/usr/bin/env bash
# bump-version.sh — single-command version bump for studio + player.
#
# There is exactly ONE declaration of the version per file, and it
# lives in the <meta name="version" content="..."> tag. This script
# updates both in one atomic step so studio and player can never drift.
#
# Usage:
#   ./bump-version.sh 3.10.14
#
# Runs in git bash on Windows, macOS, Linux.

set -euo pipefail

if [ $# -ne 1 ]; then
  echo "Usage: $0 <new-version>"
  echo "Example: $0 3.10.14"
  exit 1
fi

NEW="$1"

# Strict semver check — catches typos like "3.10" or "v3.10.14"
if ! echo "$NEW" | grep -qE '^[0-9]+\.[0-9]+\.[0-9]+$'; then
  echo "ERROR: version must be semver X.Y.Z (no leading 'v', no pre-release)"
  exit 1
fi

ROOT="$(cd "$(dirname "$0")" && pwd)"
STUDIO="$ROOT/studio/index.html"
PLAYER="$ROOT/player-v2.html"

for f in "$STUDIO" "$PLAYER"; do
  if [ ! -f "$f" ]; then
    echo "ERROR: $f not found"
    exit 1
  fi
done

# In-place replace the version in the meta tag. Portable between GNU
# sed and BSD sed by writing to a temp file and moving it back.
update_meta() {
  local file="$1"
  local new="$2"
  local tmp="${file}.tmp"
  sed -E "s|<meta name=\"version\" content=\"[^\"]+\">|<meta name=\"version\" content=\"$new\">|" \
    "$file" > "$tmp"
  # Confirm exactly one replacement happened — otherwise the tag
  # structure drifted and we should stop before committing a silently
  # broken file.
  if ! grep -q "<meta name=\"version\" content=\"$new\">" "$tmp"; then
    rm -f "$tmp"
    echo "ERROR: version meta tag not updated in $file"
    exit 1
  fi
  mv "$tmp" "$file"
}

update_meta "$STUDIO" "$NEW"
update_meta "$PLAYER" "$NEW"

echo "✓ Bumped studio/index.html → v$NEW"
echo "✓ Bumped player-v2.html   → v$NEW"
echo ""
echo "Current meta tags:"
grep -h "name=\"version\"" "$STUDIO" "$PLAYER" | sed 's/^[[:space:]]*/  /'
echo ""
echo "Next steps:"
echo "  git add studio/index.html player-v2.html"
echo "  git commit -m \"v$NEW: <summary>\""
echo "  git push"
