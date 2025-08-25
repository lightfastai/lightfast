# Lightfast Core

Production-ready AI agent framework with built-in observability, caching, and type safety.

## Installation

```bash
npm install lightfast
# or
pnpm add lightfast
# or  
yarn add lightfast
```

## Quick Start

```typescript
import { createAgent } from 'lightfast/agent';
import { createTool } from 'lightfast/tool';
import { z } from 'zod';

// Define your runtime context type
interface AppRuntimeContext {
  userId: string;
  agentId: string;
}

// Create a tool with context awareness
const searchTool = createTool<AppRuntimeContext>({
  description: 'Search the web',
  inputSchema: z.object({
    query: z.string(),
  }),
  execute: async ({ query }, context) => {
    console.log(`User ${context.userId} searching for: ${query}`);
    // Your search implementation
    return `Search results for: ${query}`;
  },
});

// Create your tools object
const tools = {
  webSearch: searchTool,
};

// Create an agent with strong typing
const agent = createAgent<AppRuntimeContext, typeof tools>({
  name: 'assistant',
  system: 'You are a helpful AI assistant.',
  tools,
  model: gateway('anthropic/claude-3-sonnet'),
  createRuntimeContext: ({ sessionId, resourceId }) => ({
    userId: resourceId,
    agentId: 'assistant',
  }),
});
```

## Production Setup

### 1. Environment Configuration

Create environment variables for production:

```env
# AI Gateway
AI_GATEWAY_API_KEY=your-gateway-key

# Redis for memory/caching
KV_REST_API_URL=https://your-redis-url.upstash.io
KV_REST_API_TOKEN=your-redis-token

# Observability (Braintrust)
BRAINTRUST_API_KEY=your-braintrust-key
BRAINTRUST_PROJECT_NAME=your-project-name

# OpenTelemetry (optional)
OTEL_EXPORTER_OTLP_ENDPOINT=https://api.braintrust.dev/otel
OTEL_EXPORTER_OTLP_HEADERS=api-key=your-key
```

### 2. Complete Production Example

```typescript
import { gateway } from '@ai-sdk/gateway';
import { createAgent } from 'lightfast/agent';
import { fetchRequestHandler } from 'lightfast/server/adapters/fetch';
import { RedisMemory } from 'lightfast/memory/adapters/redis';
import { AnthropicProviderCache, ClineConversationStrategy } from 'lightfast/cache';
import { smoothStream, stepCountIs, wrapLanguageModel } from 'ai';
import { BraintrustMiddleware, initLogger, traced } from 'braintrust';
import { getBraintrustConfig, isOtelEnabled } from 'lightfast/v2/braintrust-env';
import { uuidv4 } from 'lightfast/v2/utils';

// Initialize observability
const braintrustConfig = getBraintrustConfig();
initLogger({
  apiKey: braintrustConfig.apiKey,
  projectName: braintrustConfig.projectName || 'my-app',
});

// Define your tools
const tools = {
  // Your tool implementations
};

// Production-ready route handler
export async function POST(req: Request) {
  const { sessionId, agentId } = await req.json();
  
  // Initialize memory with Redis
  const memory = new RedisMemory({
    url: process.env.KV_REST_API_URL,
    token: process.env.KV_REST_API_TOKEN,
  });

  // Wrap handler with tracing
  return traced(
    async () => {
      return fetchRequestHandler({
        agent: createAgent<AppRuntimeContext, typeof tools>({
          name: agentId,
          system: 'Your system prompt here',
          tools,
          
          // Production caching strategy (proven with Claude)
          cache: new AnthropicProviderCache({
            strategy: new ClineConversationStrategy({
              cacheSystemPrompt: true,
              recentUserMessagesToCache: 2,
            }),
          }),
          
          // Runtime context creation
          createRuntimeContext: ({ sessionId, resourceId }) => ({
            userId: resourceId,
            agentId,
          }),
          
          // Model with observability middleware
          model: wrapLanguageModel({
            model: gateway('anthropic/claude-3-sonnet'),
            middleware: BraintrustMiddleware({ debug: true }),
          }),
          
          // Anthropic-specific options (thinking mode)
          providerOptions: {
            anthropic: {
              thinking: {
                type: 'enabled',
                budgetTokens: 32000, // Generous budget for complex reasoning
              },
            },
          },
          
          // Streaming configuration
          experimental_transform: smoothStream({
            delayInMs: 25,
            chunking: 'word',
          }),
          
          // Step limits
          stopWhen: stepCountIs(30),
          
          // OpenTelemetry configuration
          experimental_telemetry: {
            isEnabled: isOtelEnabled(),
            metadata: {
              agentId,
              sessionId,
              userId: 'user-id',
            },
          },
          
          // Type-safe event handlers
          onChunk({ chunk }) {
            if (chunk.type === 'tool-call') {
              // TypeScript knows your exact tool names here
              console.log(`Tool called: ${chunk.toolName}`);
            }
          },
          
          onFinish({ finishReason, usage, reasoningText }) {
            console.log('Stream finished', {
              reason: finishReason,
              totalTokens: usage?.totalTokens,
              hasReasoning: !!reasoningText,
            });
          },
          
          onError(error) {
            console.error('Agent error:', error);
            // Send to error tracking service
          },
        }),
        sessionId,
        memory,
        req,
        resourceId: 'user-id',
        generateId: uuidv4,
        enableResume: true, // Enable stream resumption
      });
    },
    {
      type: 'function',
      name: `POST /api/agent/${agentId}`,
    }
  );
}
```

### 3. Caching Strategies

#### Anthropic Cache Control (Recommended for Claude)

```typescript
import { AnthropicProviderCache, ClineConversationStrategy } from 'lightfast/cache';

// Proven strategy from Cline AI assistant
const cache = new AnthropicProviderCache({
  strategy: new ClineConversationStrategy({
    cacheSystemPrompt: true,          // Cache system prompt
    recentUserMessagesToCache: 2,     // Cache last 2 user messages
  }),
});
```

This strategy:
- Caches the system prompt (stable, reused across conversations)
- Caches recent user messages (often referenced in follow-ups)
- Optimizes for token efficiency with Claude models

### 4. Memory Adapters

#### Redis Memory (Production)

```typescript
import { RedisMemory } from 'lightfast/memory/adapters/redis';

const memory = new RedisMemory({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});
```

#### In-Memory (Development)

```typescript
import { InMemoryMemory } from 'lightfast/memory/adapters/in-memory';

const memory = new InMemoryMemory();
```

### 5. Tool Development

#### Type-Safe Tool Creation

```typescript
import { createTool } from 'lightfast/tool';
import { z } from 'zod';

// Tools receive merged context: SystemContext & RequestContext & AppRuntimeContext
const fileWriteTool = createTool<AppRuntimeContext>({
  description: 'Write content to a file',
  inputSchema: z.object({
    path: z.string(),
    content: z.string(),
  }),
  execute: async ({ path, content }, context) => {
    // Access full context
    console.log(`User ${context.userId} writing to ${path}`);
    console.log(`Session: ${context.sessionId}`); // From SystemContext
    
    // Your file write logic
    await fs.writeFile(path, content);
    return `File written: ${path}`;
  },
});
```

### 6. Observability & Monitoring

#### Braintrust Integration

```typescript
import { initLogger, traced } from 'braintrust';

// Initialize once at app startup
initLogger({
  apiKey: process.env.BRAINTRUST_API_KEY,
  projectName: 'my-app',
});

// Wrap handlers with tracing
const response = await traced(
  async () => {
    // Your agent logic
  },
  {
    type: 'function',
    name: 'agent-handler',
  }
);
```

#### OpenTelemetry Support

```typescript
experimental_telemetry: {
  isEnabled: !!process.env.OTEL_EXPORTER_OTLP_HEADERS,
  metadata: {
    agentId,
    sessionId,
    userId,
    // Custom metadata for tracing
  },
}
```

### 7. Advanced Features

#### Stream Resumption

Enable clients to resume interrupted streams:

```typescript
fetchRequestHandler({
  // ... other config
  enableResume: true,
  generateId: uuidv4, // Consistent ID generation
});
```

#### Thinking Models (Claude)

Enable Claude's thinking mode for complex reasoning:

```typescript
providerOptions: {
  anthropic: {
    thinking: {
      type: 'enabled',
      budgetTokens: 32000, // Token budget for thinking
    },
  },
}
```

#### Custom Streaming

Control streaming behavior:

```typescript
experimental_transform: smoothStream({
  delayInMs: 25,      // Delay between chunks
  chunking: 'word',   // Chunk by word boundaries
})
```

### 8. Type Safety

The agent system provides full type safety for tools:

```typescript
const tools = {
  search: searchTool,
  write: writeTool,
};

const agent = createAgent<AppRuntimeContext, typeof tools>({
  // ... config
  onChunk({ chunk }) {
    if (chunk.type === 'tool-call') {
      // TypeScript knows toolName can only be "search" | "write"
      if (chunk.toolName === 'search') {
        // Handle search tool
      }
      // chunk.toolName === 'unknown' would cause TypeScript error
    }
  },
});
```

## API Reference

### `createAgent<TRuntimeContext, TTools>(options)`

Creates a strongly-typed agent with tool support.

#### Type Parameters
- `TRuntimeContext` - Your app-specific context type
- `TTools` - The tools object type (inferred from `typeof tools`)

#### Options
- `name: string` - Agent identifier
- `system: string` - System prompt
- `tools?: TTools` - Tools available to the agent
- `model: LanguageModel` - The AI model to use
- `cache?: ProviderCache` - Caching strategy
- `createRuntimeContext?: (params) => TRuntimeContext` - Context factory
- `onChunk?: (event) => void` - Stream chunk handler
- `onFinish?: (event) => void` - Completion handler
- `onError?: (error) => void` - Error handler
- Plus all Vercel AI SDK options

### `createTool<TContext>(options)`

Creates a context-aware tool.

#### Type Parameters
- `TContext` - The runtime context type

#### Options
- `description: string` - Tool description for the model
- `inputSchema: ZodSchema` - Input validation schema
- `execute: (input, context) => Promise<string>` - Tool implementation

### `fetchRequestHandler(options)`

Handles HTTP requests for agent streaming.

#### Options
- `agent: Agent` - The agent instance
- `sessionId: string` - Session identifier
- `memory: Memory` - Memory adapter
- `req: Request` - The HTTP request
- `resourceId: string` - Resource/user identifier
- `generateId?: () => string` - ID generator
- `enableResume?: boolean` - Enable stream resumption

## Best Practices

1. **Always use environment variables** for sensitive configuration
2. **Implement proper error handling** in tool execute functions
3. **Use caching strategies** appropriate for your model provider
4. **Enable observability** from day one with Braintrust or OpenTelemetry
5. **Leverage TypeScript** for type-safe tool definitions
6. **Set reasonable step limits** to prevent infinite loops
7. **Use Redis memory** for production deployments
8. **Implement stream resumption** for better reliability
9. **Monitor token usage** through the onFinish handler
10. **Test tools thoroughly** with comprehensive input validation

## License

MIT