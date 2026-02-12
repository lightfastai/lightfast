#!/bin/bash
# Load environment variables from .env.mcp
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
set -a
source "$SCRIPT_DIR/../.env.mcp"
set +a

# Start the Exa MCP server
exec npx -y @anthropic/exa-mcp "$@"
