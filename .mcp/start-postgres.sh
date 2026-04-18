#!/bin/bash
# Load database credentials from the app's Vercel env
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$SCRIPT_DIR/.."
ENV_FILE="$REPO_ROOT/apps/app/.vercel/.env.development.local"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing env file at $ENV_FILE" >&2
  echo "Run: cd apps/app && vercel env pull" >&2
  exit 1
fi

# Source the env file to get DATABASE_HOST, DATABASE_USERNAME, DATABASE_PASSWORD
set -a
source "$ENV_FILE"
set +a

if [[ -z "${DATABASE_HOST:-}" || -z "${DATABASE_USERNAME:-}" || -z "${DATABASE_PASSWORD:-}" ]]; then
  echo "Missing DATABASE_HOST, DATABASE_USERNAME, or DATABASE_PASSWORD in $ENV_FILE" >&2
  exit 1
fi

# Assemble the Postgres connection URL (matches db/app/src/client.ts)
DATABASE_URL="postgresql://${DATABASE_USERNAME}:${DATABASE_PASSWORD}@${DATABASE_HOST}:5432/postgres?sslmode=require"

exec npx -y @modelcontextprotocol/server-postgres "$DATABASE_URL"
