# Resumable Streams Implementation

This implementation provides a resilient streaming experience for AI chat responses that can survive disconnections, page refreshes, and network interruptions.

## Architecture Overview

The resumable stream feature follows a three-part architecture pattern inspired by Vercel AI SDK and Upstash:

1. **Stream Generator** - The AI response generation that writes chunks to Convex database
2. **Stream State Tracking** - Stores individual chunks with unique IDs for resumption
3. **Client Connection Management** - React hooks that handle disconnections and resumptions

## Key Features

- **Automatic Resumption**: If a user loses connection, the stream automatically resumes from the last received chunk
- **Multi-device Support**: Multiple devices can connect to the same stream simultaneously
- **Zero Message Loss**: All chunks are persisted in the database, ensuring no data is lost
- **Graceful Degradation**: Falls back to standard streaming if resumable features aren't needed

## How It Works

### 1. Stream Generation (Backend)

When generating AI responses, each chunk is stored individually with a unique ID:

```typescript
// In generateAIResponse
for await (const chunk of textStream) {
  const chunkId = `chunk_${streamId}_${chunkIndex}_${Date.now()}`

  await ctx.runMutation(internal.messages.appendStreamChunk, {
    messageId,
    chunk,
    chunkId,
  })
}
```

### 2. Client-Side Resumption

The `useResumableStream` hook tracks the last received chunk and queries for new chunks:

```typescript
const streamData = useQuery(
  api.messages.getStreamChunks,
  {
    streamId,
    sinceChunkId: lastChunkIdRef.current, // Resume from last chunk
  }
)
```

### 3. Seamless UI Updates

The UI automatically shows streaming text with visual indicators:

```typescript
<StreamingMessage
  message={message}
  className="text-sm leading-relaxed"
/>
```

## Benefits

1. **Reliability**: Streams continue even if the user closes their browser
2. **Performance**: Only new chunks are sent on reconnection
3. **User Experience**: No need to restart conversations after network issues
4. **Scalability**: Multiple users can view the same stream simultaneously

## Usage

The feature is automatically enabled for all AI responses. No additional configuration is needed. When a message is streaming:

1. The chunks are stored in the database
2. Clients automatically resume from their last position
3. The UI shows real-time updates with "Streaming..." indicators

## Technical Details

### Database Schema

Messages now include:
- `streamChunks`: Array of chunks with IDs and timestamps
- `lastChunkId`: ID of the most recent chunk
- `streamVersion`: Version counter for change detection

### API Endpoints

- `getStreamChunks`: Query to fetch chunks since a specific ID
- `appendStreamChunk`: Mutation to add new chunks
- `createStreamingMessage`: Initialize a resumable message

### React Hooks

- `useResumableStream`: Main hook for managing resumable streams
- `useResumableChat`: Helper for managing multiple streams

## Future Enhancements

1. **Chunk Compression**: Store compressed chunks to reduce storage
2. **Chunk Expiration**: Automatically clean up old chunks
3. **Stream Analytics**: Track reconnection patterns and performance
4. **Custom Chunk Sizes**: Configure chunk granularity per use case
