#!/usr/bin/env bash
#
# Deploy Ironwood Planner to Google Cloud Run from the repo root.
#
# Prerequisites: gcloud CLI, Node 20+, this repo on main with a clean or acknowledged tree.
# Config: copy .env.cloudrun.local.example → .env.cloudrun.local and set GCP_PROJECT
#   (or run: gcloud config set project YOUR_PROJECT_ID).
#
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

if [[ -f "$REPO_ROOT/.env.cloudrun.local" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$REPO_ROOT/.env.cloudrun.local"
  set +a
fi

CLOUD_RUN_REGION="${CLOUD_RUN_REGION:-us-central1}"
CLOUD_RUN_SERVICE="${CLOUD_RUN_SERVICE:-ironwood-planner}"
CLOUD_RUN_URL="${CLOUD_RUN_URL:-https://ironwood-planner-316650805051.us-central1.run.app/}"

prompt_yn() {
  local message="$1"
  local default_no="${2:-1}"
  local hint="[y/N]"
  [[ "$default_no" == "0" ]] && hint="[Y/n]"
  read -r -p "$message $hint: " _ans || return 1
  _ans="$(printf '%s' "$_ans" | tr '[:upper:]' '[:lower:]')"
  if [[ -z "$_ans" ]]; then
    [[ "$default_no" == "1" ]] && return 1
    return 0
  fi
  [[ "$_ans" == "y" || "$_ans" == "yes" ]]
}

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "error: missing required command: $1" >&2
    exit 1
  }
}

require_cmd git
require_cmd npm
require_cmd gcloud

if [[ -n $(git status --porcelain 2>/dev/null) ]]; then
  echo "warning: git working tree is not clean."
  if ! prompt_yn "Continue deploy anyway?"; then
    echo "aborted."
    exit 1
  fi
fi

current_branch="$(git branch --show-current 2>/dev/null || true)"
if [[ "$current_branch" != "main" ]]; then
  echo "Current branch: ${current_branch:-detached}"
  if ! prompt_yn "Checkout main and pull? (recommended)" 0; then
    echo "aborted."
    exit 1
  fi
  git checkout main
fi

echo "→ git fetch origin && git pull --ff-only"
git fetch origin
if ! git pull --ff-only origin main; then
  echo "error: could not fast-forward main. Resolve locally, then re-run." >&2
  exit 1
fi

echo "→ npm ci"
npm ci

set +e
npm run lint
lint_status=$?
set -e
if [[ "$lint_status" -ne 0 ]]; then
  echo "eslint reported issues (exit $lint_status)."
  if ! prompt_yn "Continue to deploy anyway?"; then
    echo "aborted."
    exit 1
  fi
fi

echo "→ npm run build"
npm run build

PROJECT="${GCP_PROJECT:-}"
if [[ -z "$PROJECT" ]]; then
  PROJECT="$(gcloud config get-value project 2>/dev/null || true)"
fi
if [[ -z "$PROJECT" || "$PROJECT" == "(unset)" ]]; then
  echo "error: set GCP_PROJECT in .env.cloudrun.local or run: gcloud config set project YOUR_PROJECT_ID" >&2
  exit 1
fi

echo "→ gcloud run deploy $CLOUD_RUN_SERVICE (region $CLOUD_RUN_REGION, project $PROJECT)"
gcloud run deploy "$CLOUD_RUN_SERVICE" \
  --region "$CLOUD_RUN_REGION" \
  --source "$REPO_ROOT" \
  --project "$PROJECT"

echo ""
echo "Deploy finished."
if [[ -n "$CLOUD_RUN_URL" ]]; then
  echo "Expected URL: $CLOUD_RUN_URL"
  base="${CLOUD_RUN_URL%/}"
  if command -v curl >/dev/null 2>&1; then
    echo "→ curl -sfI $base"
    if curl -sfI "$base" >/dev/null; then
      echo "Smoke check: OK (HTTP response received)"
    else
      echo "Smoke check: request failed (service may still be warming up; check Cloud Console)"
    fi
  fi
fi
