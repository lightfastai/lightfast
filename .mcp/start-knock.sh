#!/bin/bash
# Load environment variables from .env.mcp
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$SCRIPT_DIR/../.env.mcp"

if [[ -f "$ENV_FILE" ]]; then
  set -a
  source "$ENV_FILE"
  set +a
fi

if [[ -z "${KNOCK_SERVICE_TOKEN:-}" ]]; then
  echo "Missing KNOCK_SERVICE_TOKEN. Set it in .env.mcp or your shell environment." >&2
  exit 1
fi

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
