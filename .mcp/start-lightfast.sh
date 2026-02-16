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

# Start the Lightfast MCP server
exec npx -y @lightfastai/mcp --api-key "$LIGHTFAST_API_KEY" "$@"
