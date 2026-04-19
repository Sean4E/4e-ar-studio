#!/usr/bin/env bash
# bump-version.sh — single-command version bump for ALL versioned files.
#
# Every file with <meta name="version" content="..."> is bumped
# atomically so studio, player, spatial editors, and ImageTargetStudio
# always report the same version number.
#
# Usage:
#   ./bump-version.sh 3.17.1
#
# Runs in git bash on Windows, macOS, Linux.

set -euo pipefail

if [ $# -ne 1 ]; then
  echo "Usage: $0 <new-version>"
  echo "Example: $0 3.17.1"
  exit 1
fi

NEW="$1"

# Strict semver check
if ! echo "$NEW" | grep -qE '^[0-9]+\.[0-9]+\.[0-9]+$'; then
  echo "ERROR: version must be semver X.Y.Z (no leading 'v', no pre-release)"
  exit 1
fi

ROOT="$(cd "$(dirname "$0")" && pwd)"

# All files that carry <meta name="version">
FILES=(
  "$ROOT/studio/index.html"
  "$ROOT/player-v2.html"
  "$ROOT/spatial/spatial-v7.html"
  "$ROOT/spatial/spatial-mobile.html"
  "$ROOT/ImageTargetStudio/4e-image-target-studio-v15.html"
)

for f in "${FILES[@]}"; do
  if [ ! -f "$f" ]; then
    echo "WARNING: $f not found — skipping"
    continue
  fi
done

# In-place replace the version in the meta tag.
update_meta() {
  local file="$1"
  local new="$2"
  if [ ! -f "$file" ]; then return; fi
  local tmp="${file}.tmp"
  sed -E "s|<meta name=\"version\" content=\"[^\"]+\">|<meta name=\"version\" content=\"$new\">|" \
    "$file" > "$tmp"
  if ! grep -q "<meta name=\"version\" content=\"$new\">" "$tmp"; then
    rm -f "$tmp"
    echo "ERROR: version meta tag not updated in $file"
    exit 1
  fi
  mv "$tmp" "$file"
  local short="${file#$ROOT/}"
  echo "✓ Bumped $short → v$NEW"
}

for f in "${FILES[@]}"; do
  update_meta "$f" "$NEW"
done

echo ""
echo "Current meta tags:"
for f in "${FILES[@]}"; do
  [ -f "$f" ] && grep -h "name=\"version\"" "$f" | sed 's/^[[:space:]]*/  /'
done
echo ""
echo "Next steps:"
echo "  git add studio/index.html player-v2.html spatial/spatial-v7.html spatial/spatial-mobile.html ImageTargetStudio/4e-image-target-studio-v15.html"
echo "  git commit -m \"v$NEW: <summary>\""
echo "  git push"
