#!/bin/bash
# Load environment variables from .env.mcp
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
set -a
source "$SCRIPT_DIR/../.env.mcp"
set +a

# Start the Lightfast MCP server
exec npx -y @lightfastai/mcp --api-key "$LIGHTFAST_API_KEY" "$@"
