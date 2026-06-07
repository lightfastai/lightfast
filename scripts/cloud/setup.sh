#!/usr/bin/env bash
#
# Shared cloud-sandbox setup for Claude Code web (claude.ai/code) AND Codex cloud.
# Single source of truth: both clouds invoke `bash scripts/cloud/setup.sh`.
#
# ID-free by design: this file contains NO Vercel org/project ids. All Vercel
# identifiers are read from the environment, so nothing sensitive is committed.
#   - Locally:  export the vars below in ~/.zshrc
#   - In cloud: set them as environment secrets in the Claude / Codex cloud UI
#
# NOTE: the linkage vars are namespaced LIGHTFAST_VERCEL_* on purpose. Vercel's own
# reserved vars (VERCEL_ORG_ID / VERCEL_PROJECT_ID) are all-or-nothing: exporting a
# bare VERCEL_ORG_ID poisons EVERY `vercel` command ("you forgot VERCEL_PROJECT_ID").
# We feed our values into .vercel/repo.json instead and let `vercel pull` resolve the
# org/project/team from there (verified to handle multi-team accounts non-interactively).
#
# Required:
#   LIGHTFAST_VERCEL_ORG_ID                 Vercel team id
#   LIGHTFAST_VERCEL_PROJECT_ID_APP         apps/app      project id
#   LIGHTFAST_VERCEL_PROJECT_ID_APP_TANSTACK apps/app-tanstack project id
#   LIGHTFAST_VERCEL_PROJECT_ID_WWW         apps/www      project id
#   LIGHTFAST_VERCEL_PROJECT_ID_PLATFORM    apps/platform project id
#   LIGHTFAST_VERCEL_PROJECT_ID_MCP         apps/mcp      project id
#
# Auth:
#   VERCEL_TOKEN                  Required in cloud. Locally optional — falls back
#                                 to the logged-in `vercel login` session.
#
# Knobs:
#   LIGHTFAST_FORCE_VERCEL_PULL=1     Re-pull env files even if they already exist.
#   LIGHTFAST_CLOUD_SETUP_LINK_ONLY=1 Write .vercel/repo.json and exit (no install/pull).

set -eu
(set -o pipefail) 2>/dev/null || true

# 1. Resolve repo root robustly across harnesses (Codex sets CODEX_WORKTREE_PATH).
ROOT="${CODEX_WORKTREE_PATH:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}"
cd "$ROOT"

# 2. The full set of Vercel-linked apps to hydrate, as "directory|name|projectIdVar".
#    This is the ONE place to maintain when an app is added or removed — keep it in
#    sync with `vercel pull`'s repo.json. app-tanstack and mcp load app's env too
#    (see their with-env scripts), so app is listed first.
APPS="apps/app|lightfast-app|LIGHTFAST_VERCEL_PROJECT_ID_APP
apps/app-tanstack|lightfast-app-tanstack|LIGHTFAST_VERCEL_PROJECT_ID_APP_TANSTACK
apps/www|lightfast-www|LIGHTFAST_VERCEL_PROJECT_ID_WWW
apps/platform|lightfast-platform|LIGHTFAST_VERCEL_PROJECT_ID_PLATFORM
apps/mcp|lightfast-mcp|LIGHTFAST_VERCEL_PROJECT_ID_MCP"

# 3. Require the linkage vars — fail loudly and by name (better than a bare set -u abort).
require() {
  if [ -z "${!1:-}" ]; then
    echo "ERROR: required environment variable '$1' is not set." >&2
    echo "       Set it locally in ~/.zshrc or as a cloud environment secret." >&2
    exit 1
  fi
}
require LIGHTFAST_VERCEL_ORG_ID
while IFS='|' read -r dir name idvar; do
  [ -z "$dir" ] && continue
  require "$idvar"
done <<< "$APPS"

# 4. Establish repo-linked mode by writing .vercel/repo.json from the env vars.
#    The file stays gitignored; downstream (turbo, MFE, vercel pull) is unchanged —
#    only the *source* of the ids differs from the old committed heredoc.
projects=""
while IFS='|' read -r dir name idvar; do
  [ -z "$dir" ] && continue
  id="${!idvar}"
  entry="    {
      \"id\": \"${id}\",
      \"name\": \"${name}\",
      \"directory\": \"${dir}\",
      \"orgId\": \"${LIGHTFAST_VERCEL_ORG_ID}\"
    }"
  if [ -n "$projects" ]; then projects="${projects},
${entry}"; else projects="${entry}"; fi
done <<< "$APPS"

mkdir -p .vercel
cat > .vercel/repo.json <<JSON
{
  "remoteName": "origin",
  "projects": [
${projects}
  ]
}
JSON

if [ "${LIGHTFAST_CLOUD_SETUP_LINK_ONLY:-0}" = "1" ]; then
  echo "Wrote .vercel/repo.json (link-only mode); skipping install + pull."
  exit 0
fi

# 5. Toolchain — match the pinned packageManager.
corepack enable
corepack prepare pnpm@11.1.3 --activate

# 6. Install dependencies.
pnpm install --frozen-lockfile

# 7. Hydrate per-app env from Vercel (skip-if-exists; force with LIGHTFAST_FORCE_VERCEL_PULL=1).
#    An EMPTY VERCEL_TOKEN would make vercel try to auth with a blank token, so unset it
#    and fall back to the logged-in session (local). In cloud, VERCEL_TOKEN is set and used.
[ -z "${VERCEL_TOKEN:-}" ] && unset VERCEL_TOKEN || true

pull_vercel_env() {
  app_path="$1"
  env_file="${app_path}/.vercel/.env.development.local"

  if [ "${LIGHTFAST_FORCE_VERCEL_PULL:-0}" != "1" ] && [ -s "$env_file" ]; then
    echo "Skipping existing env file: $env_file"
    return 0
  fi

  pnpm dlx vercel@latest pull "$app_path" \
    --yes \
    --non-interactive \
    --environment=development
}

while IFS='|' read -r dir name idvar; do
  [ -z "$dir" ] && continue
  pull_vercel_env "$dir"
done <<< "$APPS"

echo "cloud setup complete."
