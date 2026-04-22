#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

if [[ "$(git rev-parse --abbrev-ref HEAD)" != "main" ]]; then
  echo "Run this from the main branch."
  exit 1
fi

if [[ -n "$(git status --porcelain)" ]]; then
  echo "Working tree is not clean. Commit or stash changes first."
  exit 1
fi

echo "== Pull latest main =="
git pull origin main

echo "== Bump patch version (creates commit + tag) =="
npm version patch

echo "== Push main and tags =="
git push origin main
git push origin --tags

VERSION="$(node -p "require('./package.json').version")"
RELEASE_URL="https://github.com/Rob-code-94/ironwood-crm/releases/tag/v${VERSION}"

echo "Desktop release triggered for v${VERSION}."
echo "Watch Actions: https://github.com/Rob-code-94/ironwood-crm/actions"
echo "Release page: ${RELEASE_URL}"

if command -v open >/dev/null 2>&1; then
  open "${RELEASE_URL}" || true
fi
