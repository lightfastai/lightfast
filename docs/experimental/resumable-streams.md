# Resumable Streams Integration

This project now includes support for resumable streams using Upstash Redis, allowing chat conversations to be resumed if the connection is interrupted.

## Setup

1. **Configure Upstash Redis**: Add your Upstash credentials to your `.env.local` file:
   ```env
   UPSTASH_REDIS_REST_URL=your-upstash-redis-url
   UPSTASH_REDIS_REST_TOKEN=your-upstash-redis-token
   ```

2. **Verify Installation**: The `resumable-stream` package has been added to your dependencies.

## How It Works

### Server-Side

The chat API route (`/api/chat/[agentId]/[threadId]`) now automatically:
1. Creates a unique stream ID for each chat session
2. Stores the stream data in Upstash Redis
3. Returns the stream ID in the `X-Stream-Id` response header
4. Allows resumption via the `/api/chat/resume/[streamId]` endpoint

### Client-Side

Two utilities are provided for handling resumable streams:

#### 1. ResumableStreamClient
```typescript
import { ResumableStreamClient } from "@/lib/resumable-stream-client";

const client = new ResumableStreamClient({
  onMessage: (message) => {
    console.log("Received:", message);
  },
  onError: (error) => {
    console.error("Stream error:", error);
  },
  onComplete: () => {
    console.log("Stream completed");
  },
  maxRetries: 5,
  retryDelay: 2000,
});

// Start streaming
await client.start("/api/chat/agentId/threadId", {
  messages: [{ role: "user", content: "Hello" }],
  threadId: "thread-123",
});
```

#### 2. useResumableStream Hook
```typescript
import { useResumableStream } from "@/hooks/use-resumable-stream";

function ChatComponent() {
  const { startStream, abort, isStreaming, error } = useResumableStream({
    onMessage: (message) => {
      // Handle incoming message
    },
    maxRetries: 5,
  });

  const handleSendMessage = async (content: string) => {
    await startStream("/api/chat/agentId/threadId", {
      messages: [{ role: "user", content }],
      threadId: "thread-123",
    });
  };

  return (
    <div>
      {isStreaming && <button onClick={abort}>Stop</button>}
      {error && <div>Error: {error.message}</div>}
    </div>
  );
}
```

## Features

- **Automatic Resumption**: If a stream is interrupted, the client automatically attempts to resume
- **Configurable Retries**: Set maximum retry attempts and delay between retries
- **Stream Identification**: Each stream gets a unique ID for tracking
- **Graceful Degradation**: Falls back to regular streaming if Upstash is not configured

## API Endpoints

### POST `/api/chat/[agentId]/[threadId]`
Starts a new chat stream. Returns `X-Stream-Id` header if resumable streams are enabled.

### GET `/api/chat/resume/[streamId]`
Resumes an existing stream. Returns:
- `404` if stream not found
- `410` if stream has completed
- `503` if resumable streams not configured

## Implementation Details

Based on Vercel's AI chatbot implementation, the integration:
1. Uses the `resumable-stream` package (v2.2.1)
2. Leverages Upstash Redis for stream persistence
3. Handles text/binary stream conversion for SSE compatibility
4. Provides automatic retry logic on connection failure

## Testing

To test resumable streams:
1. Start a chat conversation
2. Interrupt the connection (e.g., disconnect network)
3. Reconnect - the stream should automatically resume
4. Check browser console for retry attempts and stream ID