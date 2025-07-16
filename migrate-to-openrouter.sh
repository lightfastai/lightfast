#!/bin/bash

# List of files to update
files=(
  "mastra/agents/complex-math-agent.ts"
  "mastra/agents/searcher.ts"
  "mastra/agents/sandbox.ts"
  "mastra/agents/planner.ts"
  "mastra/agents/browser.ts"
  "mastra/agents/simple-math-agent.ts"
  "mastra/networks/example.ts"
  "mastra/networks/unified-researcher.ts"
  "mastra/networks/adaptive-executor.ts"
  "mastra/networks/unified-executor.ts"
)

# Update imports and model references
for file in "${files[@]}"; do
  if [ -f "$file" ]; then
    echo "Updating $file..."
    
    # Replace import statement
    sed -i 's/import { anthropic } from "@ai-sdk\/anthropic";/import { openrouter, models } from "..\/lib\/openrouter";/' "$file"
    
    # For network files, adjust the import path
    sed -i 's/import { openrouter, models } from "..\/lib\/openrouter";/import { openrouter, models } from "..\/lib\/openrouter";/' "$file"
    
    # Replace model usage
    sed -i 's/anthropic("claude-4-sonnet-20250514")/openrouter(models.claude4Sonnet)/g' "$file"
    
    echo "✓ Updated $file"
  else
    echo "✗ File not found: $file"
  fi
done

echo "Migration complete!"