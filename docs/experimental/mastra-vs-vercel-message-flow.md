# Mastra vs Vercel AI Chatbot Message Flow

## Key Discovery: Different Message Saving Approaches

After deep-diving into both implementations, there are **fundamental differences** in how messages are saved to the database.

## Vercel AI Chatbot Approach (Manual Message Management)

### Message Flow:
1. **User Message**: Saved IMMEDIATELY before streaming starts (line 136-147)
2. **Stream ID**: Created and stored in database (line 149-150) 
3. **Streaming**: Uses `createUIMessageStream` with explicit `onFinish` callback
4. **Assistant Message**: Saved ONLY when streaming completes via `onFinish` (line 193-204)

### Code Pattern:
```typescript
// 1. Save user message BEFORE streaming
await saveMessages({
  messages: [{
    chatId: id,
    id: message.id,
    role: 'user',
    parts: message.parts,
    attachments: [],
    createdAt: new Date(),
  }],
});

// 2. Create stream ID
const streamId = generateUUID();
await createStreamId({ streamId, chatId: id });

// 3. Stream with onFinish callback
const stream = createUIMessageStream({
  execute: ({ writer: dataStream }) => {
    // Streaming logic...
  },
  onFinish: async ({ messages }) => {
    // 4. Save assistant messages when done
    await saveMessages({
      messages: messages.map((message) => ({
        id: message.id,
        role: message.role,
        parts: message.parts,
        createdAt: new Date(),
        attachments: [],
        chatId: id,
      })),
    });
  },
});
```

### Characteristics:
- ✅ **Explicit Control**: Developer controls exactly when messages are saved
- ✅ **Resumable Compatible**: Can store stream ID and resume later
- ✅ **Error Handling**: Can handle partial completions
- ❌ **Manual Work**: Requires explicit message management

## Mastra Approach (Automatic Memory Management)

### Message Flow:
1. **Agent.stream()**: Called with user message and options (threadId, resourceId)
2. **Automatic Saving**: Mastra automatically handles saving both user AND assistant messages
3. **Memory Integration**: Messages saved via Memory.saveMessages() with working memory processing
4. **Timing**: Unclear exactly when messages are saved (investigation needed)

### Code Pattern:
```typescript
// Simple call - Mastra handles everything internally
const result = await agent.stream([lastUserMessage], {
  threadId,
  resourceId: userId,
});

return result.toUIMessageStreamResponse();
```

### Characteristics:
- ✅ **Automatic**: No explicit message management needed
- ✅ **Memory Integration**: Automatic working memory, embeddings, etc.
- ✅ **Simple API**: Very clean developer experience  
- ❓ **Resumable Unknown**: How does this work with resumable streams?
- ❓ **Timing Unknown**: When exactly are messages saved?

## Critical Implications for Resumable Streams

### 1. Message Duplication Risk
If Mastra automatically saves messages AND we implement resumable streams that also save messages, we could get duplicates.

### 2. Stream ID Coordination
We need to understand exactly when Mastra saves messages so we can:
- Store stream ID at the right time
- Ensure stream resumption doesn't conflict with Mastra's saving

### 3. Partial Message Handling
If streaming is interrupted:
- Vercel approach: Assistant message not saved until completion
- Mastra approach: Unknown - might save partial messages?

## Required Investigation

### 1. Mastra Message Save Timing
**Need to determine**: When does `agent.stream()` actually call `memory.saveMessages()`?
- Before streaming starts?
- During streaming?
- After streaming completes?
- On errors?

### 2. Mastra Internal Hooks
**Need to find**: Does Mastra have internal hooks/callbacks we can use?
- onStart, onFinish, onError callbacks?
- Can we intercept the saving process?
- Can we add stream ID storage to the flow?

### 3. Memory State During Streaming
**Need to test**: What happens to memory state during streaming?
```typescript
// Before streaming
const beforeMemory = await agent.getMemory().query({threadId, selectBy: {last: 10}});

// Start streaming
const stream = agent.stream([message], options);

// During streaming (is user message already saved?)
const duringMemory = await agent.getMemory().query({threadId, selectBy: {last: 10}});

// After completion (are both messages saved?)
const afterMemory = await agent.getMemory().query({threadId, selectBy: {last: 10}});
```

## Resumable Streams Integration Strategy

### Option 1: Hook into Mastra's Flow
- Find where Mastra calls memory.saveMessages()
- Add stream ID storage at that point
- Minimal changes to existing architecture

### Option 2: Override Message Saving
- Disable Mastra's automatic message saving
- Implement manual saving like Vercel chatbot
- Full control but more complex

### Option 3: Hybrid Approach
- Let Mastra handle user message saving
- Intercept assistant message saving for stream ID coordination
- Balance between automatic and manual control

## Next Steps

1. **Live Testing**: Monitor Redis during `agent.stream()` to see save timing
2. **Code Exploration**: Find Mastra's message saving implementation
3. **Hook Discovery**: Look for callbacks/hooks in Mastra streaming
4. **Prototype**: Test resumable stream integration with minimal changes

## Conclusion

The fundamental difference is:
- **Vercel**: Manual, explicit message management with full control
- **Mastra**: Automatic memory management with simpler API

For resumable streams, we need to understand Mastra's automatic flow and either:
1. Hook into it elegantly, or 
2. Override it for explicit control

The investigation continues to determine the best integration approach.