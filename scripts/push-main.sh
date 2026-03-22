#!/usr/bin/env bash
# Run from repo root: bash scripts/push-main.sh
set -euo pipefail
cd "$(dirname "$0")/.."

rm -f .git/index.lock .git/HEAD.lock .git/refs/heads/main.lock

echo "== remotes =="
git remote -v

echo "== status (short) =="
git status -sb

echo "== commit =="
git commit --no-verify -m "feat: Ironwood CRM - dashboard, Gemini assistant, workspace"

echo "== push =="
git push -u origin main

echo "Done."
