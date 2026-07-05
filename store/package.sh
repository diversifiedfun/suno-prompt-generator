#!/usr/bin/env bash
# Build a Chrome Web Store-ready zip from extension/, excluding dev/test files.
# The zip has manifest.json at its ROOT (store requirement). Run from anywhere.
set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO/extension"

VERSION="$(grep -oE '"version":[[:space:]]*"[^"]+"' manifest.json | grep -oE '[0-9][0-9.]*')"
OUT="$REPO/store/suno-prompt-studio-v${VERSION}.zip"
rm -f "$OUT"

# Include only what ships. Exclude tests, the test harness, and the dev README.
zip -r "$OUT" . \
  -x "*.test.js" \
  -x "test/*" \
  -x "dev/*" \
  -x "README.md" \
  -x ".DS_Store" \
  -x "*/.DS_Store"

echo "Built $OUT"
unzip -l "$OUT" | tail -n +2 | awk '{print $4}' | sed '/^$/d'
