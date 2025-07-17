# Memory System Guide

## Tool Context Access

Tools receive threadId and resourceId in their execution context:

```typescript
export const myTool = createTool({
  id: "my-tool",
  description: "Thread-aware tool",
  inputSchema: z.object({ data: z.string() }),
  execute: async ({ context, threadId, resourceId }) => {
    // context: Validated input data
    // threadId: Current conversation thread ID
    // resourceId: User/resource ID
    
    // Use threadId for thread-scoped operations
    const filename = `data-${threadId}.json`;
    
    // Use resourceId for user-scoped operations
    const userPath = `users/${resourceId}/data`;
    
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

## Key Points
- **threadId** identifies the conversation thread
- **resourceId** identifies the user/resource
- Both are optional but recommended for context
- Tools automatically receive these from agent calls
- Use for scoped storage, personalization, and tracking