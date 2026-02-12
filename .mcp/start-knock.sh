#!/bin/bash
# Load environment variables from .env.mcp
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
set -a
source "$SCRIPT_DIR/../.env.mcp"
set +a

# Start the Knock MCP server with expanded tools
# Enable: users, workflows, messages, tenants, objects, environments, channels, commits
exec npx -y @knocklabs/agent-toolkit -p local-mcp \
  --tools \
  users.* \
  workflows.* \
  messages.* \
  tenants.* \
  objects.* \
  environments.* \
  channels.* \
  commits.* \
  "$@"
