# V2 Resumable LLM Streams

This implementation follows the architecture described in the [Upstash blog post on resumable LLM streams](https://upstash.com/blog/resumable-llm-streams).

## Architecture

The system consists of three decoupled components:

1. **Stream Generator** - Generates LLM output and writes to Redis streams
2. **Stream Consumer** - Reads from Redis and delivers to clients via SSE
3. **Client Hook** - Auto-reconnecting React hook for seamless streaming

## Key Features

- **Resilient**: Streams survive network interruptions, page refreshes, and crashes
- **Resumable**: Clients automatically resume from where they left off
- **Decoupled**: Generator runs independently of client connections
- **Persistent**: All stream data stored in Redis for replay

## Implementation

### Server Components

- `server/types.ts` - Message types and schemas
- `server/stream-generator.ts` - LLM → Redis stream writer
- `server/stream-consumer.ts` - Redis → SSE consumer

### Client Components

- `react/use-resumable-stream.ts` - Auto-reconnecting React hook

## Usage

```typescript
// Client-side
const { messages, status, error } = useResumableStream(sessionId);

// Server-side (generate)
const generator = new StreamGenerator(redis);
await generator.generate(sessionId, prompt);

// Server-side (consume)
const consumer = new StreamConsumer(redis);
const stream = consumer.createSSEStream(sessionId);
```