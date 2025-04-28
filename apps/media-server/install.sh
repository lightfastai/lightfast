#!/bin/bash

# Increase ulimit (file descriptor limit) for this shell session
# This helps prevent EMFILE errors during npm/pnpm install
if [[ "$OSTYPE" == "darwin"* ]]; then
  echo "Running on macOS - setting higher ulimit"
  # macOS has different ulimit syntax
  ulimit -n 4096 || echo "Failed to set ulimit, continuing anyway"
else
  echo "Running on Linux/other - setting higher ulimit"
  ulimit -n 65536 || echo "Failed to set ulimit, continuing anyway"
fi

# For pnpm
echo "Setting up installation environment..."
export NODE_OPTIONS="--max-old-space-size=4096"

# Clean node_modules if it exists
if [ -d "node_modules" ]; then
  echo "Removing existing node_modules..."
  rm -rf node_modules
fi

# Perform the installation in batches to reduce concurrency
echo "Installing dependencies with reduced concurrency..."
# First install critical dependencies
pnpm install --no-frozen-lockfile --prefer-offline --network-concurrency=1 hono zod dotenv

# Then install the rest
pnpm install --no-frozen-lockfile --prefer-offline --network-concurrency=1

echo "Installation complete!" 