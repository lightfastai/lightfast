#!/bin/bash

# Exit on error
set -e

# Increase ulimit to handle EMFILE errors
if [[ "$OSTYPE" == "darwin"* ]]; then
  # macOS
  ulimit -n 2048 || echo "Could not increase file descriptor limit. Proceeding anyway."
else
  # Linux
  ulimit -n 4096 || echo "Could not increase file descriptor limit. Proceeding anyway."
fi

echo "Building media server..."
pnpm build

echo "Cleaning wrangler cache to prevent issues..."
rm -rf .wrangler || true
rm -rf node_modules/.cache || true

echo "Deploying media server to Cloudflare Workers..."
# Use retry logic for deployment to handle potential EMFILE errors
MAX_RETRIES=3
RETRY_COUNT=0

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
  if NODE_OPTIONS="--max-old-space-size=4096" npx wrangler deploy src/server.ts --no-minify; then
    echo "Deployment successful!"
    exit 0
  else
    RETRY_COUNT=$((RETRY_COUNT+1))
    if [ $RETRY_COUNT -lt $MAX_RETRIES ]; then
      echo "Deployment failed. Retrying in 10 seconds... (Attempt $RETRY_COUNT of $MAX_RETRIES)"
      sleep 10
    else
      echo "Deployment failed after $MAX_RETRIES attempts."
      exit 1
    fi
  fi
done 