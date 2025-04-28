#!/bin/bash

# This script generates .dev.vars from .env.development.local

ENV_FILE="./.internal/.env.development.local"

if [ ! -f "$ENV_FILE" ]; then
  echo "Error: $ENV_FILE does not exist!"
  echo "Please create this file with your environment variables first."
  exit 1
fi

echo "Generating .dev.vars from $ENV_FILE..."

# Create .dev.vars file or clear existing one
> .dev.vars

# Process each line from the .env file to create Cloudflare compatible vars
while IFS= read -r line || [[ -n "$line" ]]; do
  # Skip empty lines and comments
  if [[ -z "$line" ]] || [[ "$line" =~ ^# ]]; then
    continue
  fi
  
  # Extract variable name and value
  if [[ "$line" =~ ^([A-Za-z0-9_]+)=(.*)$ ]]; then
    var_name="${BASH_REMATCH[1]}"
    var_value="${BASH_REMATCH[2]}"
    
    # Remove surrounding quotes if they exist
    var_value=$(echo "$var_value" | sed -E 's/^"(.*)"$/\1/')
    var_value=$(echo "$var_value" | sed -E "s/^'(.*)'$/\1/")
    
    # Add the variable to .dev.vars with proper formatting
    echo "$var_name = \"$var_value\"" >> .dev.vars
  fi
done < "$ENV_FILE"

# Always set the bucket name to the development bucket
grep -v "R2_BUCKET_NAME" .dev.vars > .dev.vars.tmp
echo "R2_BUCKET_NAME = \"lightfast-media-server-dev\"" >> .dev.vars.tmp
mv .dev.vars.tmp .dev.vars

# Always set NODE_ENV to development
grep -v "NODE_ENV" .dev.vars > .dev.vars.tmp
echo "NODE_ENV = \"development\"" >> .dev.vars.tmp
mv .dev.vars.tmp .dev.vars

# Check if BASE_URL exists, if not add it
if ! grep -q "BASE_URL" .dev.vars; then
  echo "BASE_URL = \"http://localhost:4104\"" >> .dev.vars
fi

echo "Environment variables have been set up successfully!"
echo ".dev.vars created with $(grep -c '=' .dev.vars) variables"
echo "You can now run 'pnpm dev' to start the development server." 