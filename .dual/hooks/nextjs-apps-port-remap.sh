#!/bin/bash

# port-remap.sh - Automatically remap service PORTs when worktree is created
#
# This hook runs on postWorktreeCreate and outputs environment variable overrides
# in the format dual expects:
#   - GLOBAL:KEY=VALUE for global overrides (all services)
#   - service:KEY=VALUE for service-specific overrides
#
# dual will parse these outputs and:
#   1. Store them in the registry (.dual/registry.json)
#   2. Generate service-local .env files (.dual/.local/service/<service>/.env)

set -e

# Verify this is the correct event
if [ "$DUAL_EVENT" != "postWorktreeCreate" ]; then
  echo "[port-remap] ERROR: This hook should only run on postWorktreeCreate (got: $DUAL_EVENT)" >&2
  exit 1
fi

echo "[port-remap] Remapping PORTs for context: $DUAL_CONTEXT_NAME" >&2
echo "[port-remap] Worktree path: $DUAL_CONTEXT_PATH" >&2
echo "[port-remap] Project root: $DUAL_PROJECT_ROOT" >&2

# Remap offset - add 100 to each base port
REMAP_OFFSET=100

echo "[port-remap] Using remap offset: +$REMAP_OFFSET" >&2

# Remap each service's PORT based on packages/app-urls/src/env.ts
# Output to stdout in the format: service:PORT=value
# These will be captured by dual and written to the registry

# www: 4101 -> 4201
WWW_PORT=$((4101 + REMAP_OFFSET))
echo "[port-remap]   www: PORT 4101 → $WWW_PORT" >&2
echo "www:PORT=$WWW_PORT"
echo "www:NEXT_PUBLIC_WWW_PORT=$WWW_PORT"

# cloud: 4103 -> 4203
CLOUD_PORT=$((4103 + REMAP_OFFSET))
echo "[port-remap]   cloud: PORT 4103 → $CLOUD_PORT" >&2
echo "cloud:PORT=$CLOUD_PORT"
echo "cloud:NEXT_PUBLIC_CLOUD_PORT=$CLOUD_PORT"

# auth: 4104 -> 4204
AUTH_PORT=$((4104 + REMAP_OFFSET))
echo "[port-remap]   auth: PORT 4104 → $AUTH_PORT" >&2
echo "auth:PORT=$AUTH_PORT"
echo "auth:NEXT_PUBLIC_AUTH_PORT=$AUTH_PORT"

# playground: 4105 -> 4205
PLAYGROUND_PORT=$((4105 + REMAP_OFFSET))
echo "[port-remap]   playground: PORT 4105 → $PLAYGROUND_PORT" >&2
echo "playground:PORT=$PLAYGROUND_PORT"
echo "playground:NEXT_PUBLIC_PLAYGROUND_PORT=$PLAYGROUND_PORT"

# chat: 4106 -> 4206
CHAT_PORT=$((4106 + REMAP_OFFSET))
echo "[port-remap]   chat: PORT 4106 → $CHAT_PORT" >&2
echo "chat:PORT=$CHAT_PORT"
echo "chat:NEXT_PUBLIC_CHAT_PORT=$CHAT_PORT"

# deus: 4107 -> 4207
DEUS_PORT=$((4107 + REMAP_OFFSET))
echo "[port-remap]   deus: PORT 4107 → $DEUS_PORT" >&2
echo "deus:PORT=$DEUS_PORT"
echo "deus:NEXT_PUBLIC_DEUS_PORT=$DEUS_PORT"

# docs: 3002 -> 3102
DOCS_PORT=$((3002 + REMAP_OFFSET))
echo "[port-remap]   docs: PORT 3002 → $DOCS_PORT" >&2
echo "docs:PORT=$DOCS_PORT"
echo "docs:NEXT_PUBLIC_DOCS_PORT=$DOCS_PORT"

# experimental: 3001 -> 3101
EXPERIMENTAL_PORT=$((3001 + REMAP_OFFSET))
echo "[port-remap]   experimental: PORT 3001 → $EXPERIMENTAL_PORT" >&2
echo "experimental:PORT=$EXPERIMENTAL_PORT"
echo "experimental:NEXT_PUBLIC_EXPERIMENTAL_PORT=$EXPERIMENTAL_PORT"

# Also set global NEXT_PUBLIC port variables for cross-app references
# These are needed when one app needs to reference another app's URL
echo "GLOBAL:NEXT_PUBLIC_WWW_PORT=$WWW_PORT"
echo "GLOBAL:NEXT_PUBLIC_CLOUD_PORT=$CLOUD_PORT"
echo "GLOBAL:NEXT_PUBLIC_AUTH_PORT=$AUTH_PORT"
echo "GLOBAL:NEXT_PUBLIC_PLAYGROUND_PORT=$PLAYGROUND_PORT"
echo "GLOBAL:NEXT_PUBLIC_CHAT_PORT=$CHAT_PORT"
echo "GLOBAL:NEXT_PUBLIC_DEUS_PORT=$DEUS_PORT"
echo "GLOBAL:NEXT_PUBLIC_DOCS_PORT=$DOCS_PORT"
echo "GLOBAL:NEXT_PUBLIC_EXPERIMENTAL_PORT=$EXPERIMENTAL_PORT"

echo "[port-remap] PORT remapping complete!" >&2
echo "[port-remap] Services will use remapped ports (base + $REMAP_OFFSET)" >&2
echo "[port-remap] dual will write these overrides to the registry and generate .env files" >&2
