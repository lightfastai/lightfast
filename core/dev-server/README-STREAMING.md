# AI Streaming Integration in Dev Server

## Overview

The dev-server now includes full AI streaming functionality for serving Lightfast agents. This allows developers to test and interact with their agents during development without needing a separate backend.

## ✅ What's Working

### Infrastructure
- **Agent Discovery**: Automatically loads agents from `lightfast.config.ts`
- **Hot Reload**: Changes to config files are compiled and loaded automatically (~5ms)
- **API Endpoints**:
  - `GET /api/agents` - List all configured agents with metadata
  - `POST /api/stream` - Stream agent responses
  - `GET /api/stream?sessionId={id}` - Retrieve session history
  - `DELETE /api/stream?sessionId={id}` - Clear session
- **Session Management**: In-memory storage for development (no Redis required)
- **Protocol Compliance**: Uses production `fetchRequestHandler` from `lightfast/server`
- **Message Format**: Correctly implements AI SDK v5 structure with `parts` array

## ⚠️ Authentication Requirements

Agents using AI providers require API keys to function:

### For AI Gateway (`gateway()`)
```bash
# Option 1: Vercel OIDC Token (auto-refreshed)
export VERCEL_OIDC_TOKEN="your-token"
# Obtain via: vercel env pull

# Option 2: AI Gateway API Key  
export AI_GATEWAY_API_KEY="your-api-key"
```

### For Direct Providers
```bash
export OPENAI_API_KEY="sk-..."
export ANTHROPIC_API_KEY="sk-ant-..."
export GOOGLE_GENERATIVE_AI_API_KEY="..."
```

## Architecture

### Key Components

1. **Agent Discovery Service** (`src/server/agent-discovery.ts`)
   - Discovers and loads `lightfast.config.ts` from the project root
   - Caches configuration for performance
   - Provides metadata for UI display

2. **Agent Loader Service** (`src/server/agent-loader.ts`)
   - Loads compiled agent instances from `.lightfast/lightfast.config.mjs`
   - Manages agent cache with hot-reload support
   - Returns actual `Agent` instances that can be executed

3. **Streaming API Route** (`src/routes/api/stream.ts`)
   - Handles agent chat interactions via `fetchRequestHandler`
   - Uses `InMemoryMemory` for session storage during development
   - Supports GET (history), POST (chat), and DELETE (clear) operations

## How It Works

### 1. Configuration Discovery
When the dev server starts:
- CLI compiles `lightfast.config.ts` → `.lightfast/lightfast.config.mjs`
- Dev server discovers the compiled config
- Agents are extracted and made available for execution

### 2. Agent Loading
When a request comes in:
- `AgentLoaderService` loads the compiled agent module
- Extracts agent instances using various strategies:
  - `lightfast.getAgents()` method
  - `lightfast.agents` property
  - `lightfast.getConfig().agents`
- Caches agents for 1 second (hot reload support)

### 3. Streaming Execution
When a chat request is made:
- Request is routed to `/api/stream`
- Agent is loaded via `AgentLoaderService`
- `fetchRequestHandler` from `lightfast/server` handles:
  - Message processing
  - Session management
  - Stream generation
  - Error handling

## API Endpoints

### `GET /api/agents`
Returns all configured agents with metadata.

### `POST /api/stream`
Initiates a streaming chat with an agent.

**Request Body:**
```json
{
  "agentId": "customerSupport",
  "sessionId": "unique-session-id",
  "messages": [
    {
      "role": "user",
      "content": "Hello!"
    }
  ]
}
```

**Response:**
Server-Sent Events (SSE) stream with AI responses.

### `GET /api/stream?agentId=xxx&sessionId=xxx`
Returns session history for debugging.

### `DELETE /api/stream?sessionId=xxx`
Clears a session (development only).

## Memory Management

The dev server uses `InMemoryMemory` from `lightfast/memory`:
- Sessions persist during the dev server lifetime
- Messages are stored in memory
- Useful for testing without external dependencies
- Automatically cleared on server restart

## Testing

Use the provided test script:
```bash
# Start the dev server
pnpm dev

# In another terminal, run the test
node test-streaming.js
```

The test script will:
1. Fetch available agents
2. Create a test session
3. Send a message and read the stream
4. Verify session history

## Integration with CLI

The CLI `dev` command (`cli-core/src/commands/dev.ts`):
1. Compiles TypeScript config with hot reload
2. Sets `LIGHTFAST_PROJECT_ROOT` environment variable
3. Starts the dev server
4. Watches for config changes

## Benefits

1. **Zero Configuration**: Works automatically when `lightfast.config.ts` is present
2. **Hot Reload**: Changes to agents are reflected without restart
3. **Development-First**: In-memory storage, detailed logging
4. **Production-Ready Pattern**: Uses the same `fetchRequestHandler` as production
5. **Type-Safe**: Full TypeScript support throughout

## Example Usage

### Define Agents (`lightfast.config.ts`)
```typescript
import { createLightfast } from "lightfast/client"
import { createAgent } from "lightfast/agent"

const myAgent = createAgent({
  name: "assistant",
  system: "You are a helpful assistant",
  model: gateway("claude-3-5-sonnet"),
})

export default createLightfast({
  agents: { myAgent }
})
```

### Run Dev Server
```bash
cli dev
# or
pnpm dev
```

### Chat with Agent
The dev server UI at `http://localhost:3000` will show your agents and allow interaction.

### Programmatic Access
```javascript
// Stream chat
const response = await fetch('http://localhost:3000/api/stream', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    agentId: 'myAgent',
    sessionId: 'test-123',
    messages: [{ role: 'user', content: 'Hello!' }]
  })
})

// Read SSE stream
const reader = response.body.getReader()
// ... process stream
```

## Future Enhancements

1. **Persistent Storage**: Add Redis/SQLite support for session persistence
2. **Multiple Users**: Support user authentication and isolation
3. **WebSocket Support**: Alternative to SSE for bidirectional communication
4. **Tool Execution**: Visual debugging of tool calls
5. **Message History UI**: Browse and manage chat sessions
6. **Export/Import**: Save and load conversation histories

## Troubleshooting

### "No agents configured"
- Ensure `lightfast.config.ts` exists and exports agents
- Check that the config compiles without errors
- Verify `.lightfast/lightfast.config.mjs` is generated

### "Agent not found"
- Check the agent ID matches the key in your config
- Run `curl http://localhost:3000/api/agents` to see available agents

### Stream not working
- Ensure the agent has a valid model configuration
- Check browser console for CORS or network errors
- Verify the dev server is running on the expected port

## Implementation Notes

- Uses TanStack Start's file-based routing
- Leverages `fetchRequestHandler` for protocol compliance
- Implements the same streaming pattern as production apps
- Hot reload via dynamic imports with cache busting
- TypeScript-first with full type safety