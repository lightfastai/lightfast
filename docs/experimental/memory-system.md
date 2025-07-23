# Memory System Guide

Complete guide to the memory system in lightfast-experimental, covering thread-scoped context, Redis storage, and tool integration.

## Architecture Overview

The memory system uses **Upstash Redis** for all environments with the following components:
- **Memory Factory**: `packages/ai/src/mastra/lib/memory-factory.ts` 
- **Agent Memory**: Thread and resource-scoped storage
- **Tool Context**: Automatic threadId/resourceId injection
- **Storage Backend**: Upstash Redis (no LibSQL)

## Tool Context Access

Tools receive threadId and resourceId in their execution context:

```typescript
// Location: packages/ai/src/mastra/tools/my-tool.ts
import { createTool } from "@mastra/core";
import { z } from "zod";

export const myTool = createTool({
  id: "my-tool",
  description: "Thread-aware tool with memory context",
  inputSchema: z.object({ data: z.string() }),
  execute: async ({ context, threadId, resourceId }) => {
    // context: Validated input data
    // threadId: Current conversation thread ID (UUID)
    // resourceId: User/resource ID (from Clerk auth)
    
    // Use threadId for thread-scoped operations
    const filename = `data-${threadId}.json`;
    
    // Use resourceId for user-scoped operations  
    const userPath = `users/${resourceId}/data`;
    
    console.log(`Tool executed for thread: ${threadId}, user: ${resourceId}`);
    
    return { success: true, threadId, resourceId };
  }
});
```

## Passing Context to Agents

```typescript
// New preferred approach (memory configuration)
await agent.generate("Message", {
  memory: {
    thread: "thread-123",
    resource: "user-456",
    options: { /* memory config */ }
  }
});

// Legacy approach (still supported)
await agent.generate("Message", {
  threadId: "thread-123",
  resourceId: "user-456"
});
```

## Thread-Aware Storage Pattern

```typescript
// Example: Saving thread-specific data
const blobPath = `todos/${resourceId || "shared"}/${threadId}/todo.md`;
const blob = await put(blobPath, content, {
  access: "public",
  contentType: "text/markdown",
  metadata: { threadId, resourceId, timestamp }
});
```

## Memory Configuration

### Environment Variables
Required in `apps/www/.env.local`:
```bash
# Upstash Redis (required for memory)
KV_REST_API_URL=your-upstash-redis-url
KV_REST_API_TOKEN=your-upstash-redis-token
```

### Agent Memory Setup  
```typescript
// Location: packages/ai/src/mastra/agents/experimental/a011.ts
import { createEnvironmentMemory } from "../../lib/memory-factory";

const agentMemory = () => createEnvironmentMemory({
  prefix: "mastra:a011-agent:",
  workingMemorySchema: simplifiedWorkingMemorySchema,
  workingMemoryDefault: {
    summary: "Ready for task-led execution.",
    lastUpdated: new Date().toISOString(),
    sandboxId: null,
    sandboxDirectory: "/home/vercel-sandbox",
  },
  lastMessages: 50,
});

export const a011 = new Agent({
  name: "a011",
  memory: agentMemory, // Enable memory
  // ... other config
});
```

## Key Points
- **threadId**: UUID identifying the conversation thread
- **resourceId**: Clerk user ID identifying the user/resource  
- **Redis Storage**: All memory stored in Upstash Redis
- **Thread Scoped**: Each conversation has isolated memory
- **Automatic Injection**: Tools receive context automatically
- **Persistent**: Memory survives across requests and deployments

## API Integration

### Chat API Usage
```typescript  
// Location: apps/www/app/api/chat/[agentId]/[threadId]/route.ts
const options = {
  threadId,           // From URL params
  resourceId: userId, // From Clerk authentication
};

const result = await agent.stream([lastUserMessage], options);
```

### Memory Retrieval
```typescript
// Location: apps/www/app/actions/thread.ts  
const memory = await agent.getMemory();
const result = await memory.query({
  threadId,
  selectBy: { last: 50 },
});

const uiMessages = result.uiMessages; // Ready for frontend
```