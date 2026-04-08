#!/bin/bash
# Load environment variables from .env.mcp
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$SCRIPT_DIR/../.env.mcp"

if [[ -f "$ENV_FILE" ]]; then
  set -a
  source "$ENV_FILE"
  set +a
fi

if [[ -z "${LIGHTFAST_API_KEY:-}" ]]; then
  echo "Missing LIGHTFAST_API_KEY. Set it in .env.mcp or your shell environment." >&2
  exit 1
fi

# Local dev mode: run the local build instead of the published npm package
if [[ "${LIGHTFAST_MCP_LOCAL:-}" == "true" ]]; then
  LOCAL_BUILD="$SCRIPT_DIR/../core/mcp/dist/index.mjs"
  if [[ ! -f "$LOCAL_BUILD" ]]; then
    echo "Local build not found at $LOCAL_BUILD" >&2
    echo "Run: pnpm --filter @lightfastai/mcp build" >&2
    exit 1
  fi
  export LIGHTFAST_BASE_URL="${LIGHTFAST_BASE_URL:-http://localhost:3024}"
  exec node "$LOCAL_BUILD" "$@"
fi

# Production mode: use the published npm package
# LIGHTFAST_API_KEY is already exported via set -a; the server reads process.env directly
exec npx -y @lightfastai/mcp "$@"
