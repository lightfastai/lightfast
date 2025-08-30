# Agent Chat Example

This example demonstrates how to use Lightfast to define multiple AI agents and view them using the CLI dev server.

## Setup

```bash
# Install dependencies
pnpm install

# Start the dev server
pnpm dev
```

## What's Included

### `lightfast.config.ts`
Defines four AI agents:
- **Customer Support Agent** - Handles customer inquiries with tools and caching
- **Code Review Assistant** - Reviews code with security focus
- **Data Analysis Agent** - Analyzes data using GPT-4
- **Content Writer** - Creates engaging content with high creativity

### Viewing Agents

1. Start the dev server: `pnpm dev`
2. Open http://localhost:3000 in your browser
3. Navigate to the **Agents** page to see all configured agents
4. The agents are loaded from `lightfast.config.ts` automatically

## How It Works

1. The `@lightfastai/cli` package provides the dev server
2. The dev server discovers `lightfast.config.ts` in the project root
3. The configuration is loaded and exposed via API at `/api/agents`
4. The web UI fetches and displays the agents

## Testing the API

```bash
# Get all agents
curl http://localhost:3000/api/agents | jq .

# Get specific agent (if implemented)
curl http://localhost:3000/api/agents/customerSupport | jq .
```

## Project Structure

```
1-agent-chat/
├── lightfast.config.ts  # Agent definitions
├── package.json         # Dependencies
├── tsconfig.json        # TypeScript config
└── README.md           # This file
```