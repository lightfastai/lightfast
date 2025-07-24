# Mastra Message Flow Investigation

## Goal
Understand exactly when and how Mastra saves user and assistant messages to Redis/storage during the streaming process.

## Key Findings from Code Analysis

### 1. Memory System Architecture
From `@mastra/memory/src/index.ts`, the Memory class has a `saveMessages()` method that:
- Takes an array of messages (user/assistant)
- Strips working memory tags from content
- Saves to storage via `this.storage.saveMessages()`
- If semantic recall is enabled, creates embeddings and stores in vector DB
- The storage adapter (Upstash in our case) handles actual persistence

### 2. Agent Configuration
Our a011 agent is configured with:
```typescript
const agentMemory = () => createEnvironmentMemory({
  prefix: "mastra:a011-agent:",
  workingMemorySchema: simplifiedWorkingMemorySchema,
  workingMemoryDefault: { /* ... */ },
  lastMessages: 50, // Stores last 50 messages
});
```

### 3. Message Flow in API Route
1. API receives user message: `POST /api/chat/[agentId]/[threadId]`
2. Agent is called: `const result = await agent.stream([lastUserMessage], options);`
3. Response returned: `return result.toUIMessageStreamResponse();`

## Key Questions to Investigate

### Q1: When does `agent.stream()` save the user message?
- **Hypothesis**: User message is saved immediately when `agent.stream()` is called
- **Evidence needed**: Check if Redis contains the user message before streaming starts

### Q2: When does the assistant message get saved?
- **Hypothesis**: Assistant message is saved incrementally during streaming OR at the end
- **Evidence needed**: Monitor Redis during streaming to see when assistant message appears

### Q3: What triggers the `saveMessages()` call?
- **Hypothesis**: Mastra internally calls memory.saveMessages() during the streaming process
- **Evidence needed**: Find where in Mastra core this happens

### Q4: How does the "flush" mechanism work?
- **Hypothesis**: Messages are buffered and flushed periodically or at completion
- **Evidence needed**: Understand the timing of persistence

## Investigation Methods

### Method 1: Redis Monitoring
Monitor Redis during a chat session to see exactly when keys are written:
```bash
redis-cli monitor
```

### Method 2: Memory Query Before/After
Query memory state before and after agent.stream() call:
```typescript
// Before
const beforeMessages = await agent.getMemory().query({
  threadId,
  selectBy: { last: 10 }
});

// After streaming starts
const afterMessages = await agent.getMemory().query({
  threadId, 
  selectBy: { last: 10 }
});
```

### Method 3: Mastra Core Analysis
Look for where saveMessages is called in the streaming process:
- Check `agent.stream()` implementation
- Look for memory hooks in streaming
- Find message persistence points

## Current Understanding

### What We Know:
1. ✅ Memory system uses Redis via Upstash for storage
2. ✅ Messages are saved via `memory.saveMessages()` method
3. ✅ Working memory is stripped before saving
4. ✅ Each agent has a memory instance with thread/resource scoping
5. ✅ Last 50 messages are kept in memory by default

### What We Need to Learn:
1. ❓ **Exact timing**: When during `agent.stream()` are messages saved?
2. ❓ **User message timing**: Is user message saved immediately or after validation?
3. ❓ **Assistant message timing**: Saved during streaming or at completion?
4. ❓ **Stream chunks**: Are partial assistant messages saved or only complete ones?
5. ❓ **Error handling**: What happens to messages if streaming fails?

## Implications for Resumable Streams

Understanding this flow is critical because:

1. **Stream ID Storage**: We need to store stream IDs when streaming starts
2. **Message Coordination**: Resumable streams must not conflict with Mastra's message saving
3. **Partial Messages**: Need to handle case where stream resumes mid-assistant-message
4. **Memory Consistency**: Ensure resumed streams don't create duplicate messages in memory

## Next Steps

1. ✅ **Live Investigation**: Monitor Redis during chat to see save timing
2. ✅ **Code Deep Dive**: Find saveMessages calls in Mastra agent streaming
3. ✅ **Test Scenarios**: Create test cases for different streaming states
4. ✅ **Integration Plan**: Design resumable streams to work with Mastra's flow

## Test Plan

### Test 1: Basic Message Flow
1. Clear Redis for test thread
2. Send user message via API
3. Monitor Redis keys during streaming
4. Document when user/assistant messages appear

### Test 2: Streaming Interruption
1. Start streaming assistant response
2. Interrupt connection mid-stream
3. Check what's saved in Redis
4. Attempt to resume and see message state

### Test 3: Multiple Messages
1. Send multiple messages in sequence
2. Verify message ordering and storage
3. Check memory query results vs Redis contents

This investigation will inform our resumable streams implementation to ensure compatibility with Mastra's message persistence system.