# Resumable Streams Implementation Plan

## Overview

Based on analysis of the Vercel AI chatbot (branch jrmy/v5), this document outlines the implementation plan for adding resumable stream support to our application. This feature will enable AI responses to survive disconnections, page refreshes, and network interruptions, significantly improving user experience.

## Current State vs Target State

### Current Implementation
- **AI SDK**: `5.0.0-beta.14` 
- **React SDK**: `@ai-sdk/react@2.0.0-beta.23`
- **Streaming**: Basic streaming without resumption capability
- **Storage**: Upstash Redis for memory, no stream persistence
- **UX**: Lost streams on refresh/disconnect

### Target Implementation (from Vercel AI chatbot)
- **AI SDK**: `5.0.0-beta.6` (close to our version)
- **React SDK**: `@ai-sdk/react@2.0.0-beta.6` 
- **Resumable Package**: `resumable-stream@^2.0.0`
- **Storage**: Redis + PostgreSQL for stream IDs
- **UX**: Automatic stream resumption on reconnect

## Technical Architecture

### 1. Database Schema Changes

Add a new table to track stream IDs:

```sql
CREATE TABLE IF NOT EXISTS "Stream" (
    "id" uuid DEFAULT gen_random_uuid() NOT NULL,
    "chatId" uuid NOT NULL,
    "createdAt" timestamp NOT NULL,
    CONSTRAINT "Stream_id_pk" PRIMARY KEY("id")
);

ALTER TABLE "Stream" ADD CONSTRAINT "Stream_chatId_Chat_id_fk" 
FOREIGN KEY ("chatId") REFERENCES "public"."Chat"("id") 
ON DELETE CASCADE ON UPDATE NO ACTION;
```

### 2. Server-Side Implementation

#### ResumableStreamContext Setup

```typescript
// app/api/chat/[agentId]/[threadId]/route.ts
import { createResumableStreamContext, type ResumableStreamContext } from 'resumable-stream';
import { after } from 'next/server';

let globalStreamContext: ResumableStreamContext | null = null;

export function getStreamContext() {
  if (!globalStreamContext) {
    try {
      globalStreamContext = createResumableStreamContext({
        waitUntil: after,
      });
    } catch (error: any) {
      if (error.message.includes('REDIS_URL')) {
        console.log('Resumable streams disabled - missing REDIS_URL');
      } else {
        console.error(error);
      }
    }
  }
  return globalStreamContext;
}
```

#### Modified POST Handler

```typescript
export async function POST(request: NextRequest, { params }) {
  // ... existing auth and validation ...
  
  // Generate stream ID
  const streamId = generateUUID();
  await createStreamId({ streamId, chatId: threadId });
  
  // Get Mastra agent result
  const result = await agent.stream([lastUserMessage], options);
  
  // Wrap with resumable stream context
  const streamContext = getStreamContext();
  
  if (streamContext) {
    return new Response(
      await streamContext.resumableStream(streamId, () =>
        result.toUIMessageStreamResponse().body
      )
    );
  } else {
    // Fallback to non-resumable
    return result.toUIMessageStreamResponse();
  }
}
```

#### Add Stream Resume Endpoint

```typescript
// app/api/chat/[agentId]/[threadId]/stream/route.ts
export async function GET(request: NextRequest, { params }) {
  const { agentId, threadId } = await params;
  const streamContext = getStreamContext();
  
  if (!streamContext) {
    return new Response(null, { status: 204 });
  }
  
  // Get most recent stream ID for this thread
  const streamIds = await getStreamIdsByChatId({ chatId: threadId });
  const recentStreamId = streamIds.at(-1);
  
  if (!recentStreamId) {
    return new Response(null, { status: 404 });
  }
  
  // Resume the stream
  const stream = await streamContext.resumableStream(recentStreamId, () =>
    new ReadableStream() // Empty stream for resumption
  );
  
  if (!stream) {
    // Handle concluded streams with fallback logic
    const messages = await getMessagesByChatId({ id: threadId });
    const mostRecentMessage = messages.at(-1);
    
    if (mostRecentMessage?.role === 'assistant' && 
        differenceInSeconds(new Date(), mostRecentMessage.createdAt) < 15) {
      // Return the last message if it's recent
      return createRestoredMessageResponse(mostRecentMessage);
    }
    
    return new Response(null, { status: 204 });
  }
  
  return new Response(stream, { status: 200 });
}
```

### 3. Client-Side Implementation

#### Auto-Resume Hook

```typescript
// hooks/use-auto-resume.ts
'use client';

import { useEffect } from 'react';
import type { UseChatHelpers } from '@ai-sdk/react';
import type { LightfastUIMessage } from '@lightfast/types';

export interface UseAutoResumeParams {
  autoResume: boolean;
  initialMessages: LightfastUIMessage[];
  resumeStream: UseChatHelpers<LightfastUIMessage>['resumeStream'];
  setMessages: UseChatHelpers<LightfastUIMessage>['setMessages'];
}

export function useAutoResume({
  autoResume,
  initialMessages,
  resumeStream,
  setMessages,
}: UseAutoResumeParams) {
  useEffect(() => {
    if (!autoResume) return;
    
    const mostRecentMessage = initialMessages.at(-1);
    
    // Resume if last message was from user (indicating incomplete response)
    if (mostRecentMessage?.role === 'user') {
      resumeStream();
    }
  }, []); // Run once on mount
  
  // Handle restored messages from server
  useEffect(() => {
    // Logic to handle data stream events for restored messages
  }, [initialMessages, setMessages]);
}
```

#### Updated Chat Component

```typescript
// components/chat/chat-input-section.tsx
export function ChatInputSection({ agentId, threadId, initialMessages = [] }) {
  const transport = useChatTransport({ threadId, agentId });
  
  const {
    messages,
    sendMessage: vercelSendMessage,
    status,
    resumeStream, // New: resumeStream function
  } = useChat<LightfastUIMessage>({
    id: threadId,
    transport,
    messages: initialMessages,
    resume: `/api/chat/${agentId}/${threadId}/stream`, // Resume endpoint
  });
  
  // Enable auto-resume for existing chats
  const autoResume = initialMessages.length > 0;
  
  useAutoResume({
    autoResume,
    initialMessages,
    resumeStream,
    setMessages,
  });
  
  // ... rest of component
}
```

## Implementation Steps

### Phase 1: Infrastructure Setup
1. [ ] Install `resumable-stream@^2.0.0` package
2. [ ] Add Stream table to database schema
3. [ ] Create database migration
4. [ ] Update database queries module

### Phase 2: Server Implementation
1. [ ] Add ResumableStreamContext setup
2. [ ] Modify POST handler to use resumable streams
3. [ ] Implement stream ID storage
4. [ ] Add GET endpoint for stream resumption
5. [ ] Handle edge cases (concluded streams, timeouts)

### Phase 3: Client Implementation
1. [ ] Create useAutoResume hook
2. [ ] Update chat transport configuration
3. [ ] Modify ChatInputSection to support resumption
4. [ ] Add resume URL to useChat configuration
5. [ ] Test auto-resume behavior

### Phase 4: Testing & Polish
1. [ ] Test disconnection scenarios
2. [ ] Test page refresh during streaming
3. [ ] Test multiple device connections
4. [ ] Add proper error handling
5. [ ] Performance optimization

## Key Differences from Our Current Setup

1. **Mastra Integration**: Work around Mastra's automatic message saving (don't interfere with it)
2. **Storage**: Use Redis for stream IDs, let Mastra handle message persistence via memory system
3. **Memory Coordination**: Ensure resumable streams don't conflict with Mastra's memory system
4. **Authentication**: Already using Clerk auth (compatible)

## Critical Discovery: Mastra vs Vercel Message Handling

### Vercel Approach (Manual)
- Saves user messages immediately before streaming
- Uses `onFinish` callbacks to save assistant messages when complete
- Explicit control over message persistence timing

### Mastra Approach (Automatic)  
- `agent.stream()` handles ALL message saving internally via memory system
- No explicit control over save timing
- Automatic working memory processing and embeddings

### Integration Strategy
Rather than override Mastra's system, we'll implement a **hybrid approach**:
1. Store stream IDs before calling `agent.stream()`
2. Wrap `agent.stream()` result with resumable context
3. Let Mastra continue handling message persistence automatically
4. Use Mastra's memory for fallback when streams conclude

## Testing Scenarios

1. **Basic Resumption**
   - Start a stream
   - Refresh the page mid-stream
   - Verify stream resumes from last position

2. **Network Interruption**
   - Start a stream
   - Disconnect network
   - Reconnect network
   - Verify automatic resumption

3. **Multi-Device**
   - Start stream on device A
   - Open same chat on device B
   - Verify both see the same stream

4. **Edge Cases**
   - Resume after stream completes
   - Resume after 15+ seconds (timeout)
   - Resume with missing stream ID

## Environment Variables

Add to `.env.local`:
```bash
# Required for resumable streams
REDIS_URL=<existing-upstash-url>
DATABASE_URL=<postgres-connection-string>  # New requirement
```

## Migration Checklist

- [ ] Review and approve implementation plan
- [ ] Set up PostgreSQL database (or adapt to Redis-only)
- [ ] Install dependencies
- [ ] Implement server-side changes
- [ ] Implement client-side changes
- [ ] Write tests
- [ ] Update documentation
- [ ] Deploy to preview environment
- [ ] Test in production-like conditions
- [ ] Deploy to production

## Benefits

1. **Improved UX**: No lost messages on disconnection
2. **Better Reliability**: Handles network issues gracefully  
3. **Enhanced Performance**: Only fetches new chunks on resume
4. **Multi-Device Support**: Seamless experience across devices

## Potential Challenges

1. **Database Dependency**: Need PostgreSQL or adaptation for Redis-only
2. **Mastra Compatibility**: May need custom integration with Mastra's streaming
3. **State Management**: Complex interactions between memory and resumable streams
4. **Performance**: Additional database calls for stream tracking

## Alternative Approaches

1. **Redis-Only**: Store stream IDs in Redis instead of PostgreSQL
2. **In-Memory**: Use in-memory storage for development/testing
3. **Custom Implementation**: Build resumable functionality into Mastra directly

## References

- [Vercel AI SDK Resumable Streams](https://sdk.vercel.ai/docs/ai-sdk-ui/resumable-streams)
- [resumable-stream package](https://www.npmjs.com/package/resumable-stream)
- Original implementation: `/tmp/repo/ai-chatbot` (branch jrmy/v5)