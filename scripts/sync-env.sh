#!/bin/bash

# Function to safely load environment variables from .env.local
load_env_vars() {
    if [ -f ".env.local" ]; then
        echo "Loading environment variables from .env.local..."
        # Use a more robust approach to load env vars
        # Only process lines that match the KEY=value pattern
        while IFS= read -r line; do
            # Skip empty lines and comments
            [[ -z "$line" || "$line" =~ ^[[:space:]]*# ]] && continue

            # Only process lines that look like KEY=value
            if [[ "$line" =~ ^[A-Za-z_][A-Za-z0-9_]*= ]]; then
                # Strip inline comments (everything after #)
                clean_line=$(echo "$line" | sed 's/[[:space:]]*#.*$//')
                export "$clean_line"
            fi
        done < ".env.local"
    else
        echo "⚠️  .env.local file not found"
        exit 1
    fi
}

# Load environment variables safely
load_env_vars

# Sync specific environment variables to Convex
echo "Syncing environment variables to Convex..."

if [ -n "$OPENAI_API_KEY" ]; then
    npx convex env set OPENAI_API_KEY "$OPENAI_API_KEY"
    echo "✅ Synced OPENAI_API_KEY"
else
    echo "⚠️  OPENAI_API_KEY not found in .env.local"
fi

# Add more variables here as needed
# if [ -n "$ANOTHER_API_KEY" ]; then
#     npx convex env set ANOTHER_API_KEY "$ANOTHER_API_KEY"
#     echo "✅ Synced ANOTHER_API_KEY"
# fi

echo "Environment sync complete!"
