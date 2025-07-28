# V2 Event-Driven Architecture Test Server

A lightweight Hono server for testing the V2 event-driven agent architecture without client-side complexity.

## Quick Start

```bash
# Install dependencies
pnpm install

# Copy environment variables
cp .env.example .env
# Edit .env with your Redis and Qstash credentials

# Run development server
pnpm dev

# Server starts at http://localhost:8080
```

## Architecture Overview

This server simulates the complete event-driven architecture locally:

```
Client → /init → Redis Session + Qstash Event
                       ↓
              Agent Loop Worker
                       ↓
               Tool Execution
                       ↓
              Redis Stream → SSE → Client
```

## API Endpoints

### Session Management

#### POST /init
Initialize a new agent session.

```bash
curl -X POST http://localhost:8080/init \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [{"role": "user", "content": "What is 2 + 2?"}],
    "tools": ["calculator"]
  }'
```

#### GET /init/:sessionId
Get session status.

```bash
curl http://localhost:8080/init/123456
```

### Real-time Streaming

#### GET /stream/:sessionId
Server-Sent Events endpoint for real-time updates.

```bash
curl -N http://localhost:8080/stream/123456
```

### Event Management

#### POST /events/emit
Manually emit any event (for testing).

#### GET /events/list/:sessionId
List recent events for a session.

#### POST /events/test/:type
Emit a test event of specific type.

```bash
curl -X POST http://localhost:8080/events/test/agent.loop.init \
  -H "Content-Type: application/json" \
  -d '{"sessionId": "test-123"}'
```

### Worker Endpoints

#### POST /workers/agent-loop
Agent loop worker endpoint (simulates Qstash worker).

#### POST /workers/tool-executor
Tool executor worker endpoint.

### Test Scenarios

#### GET /test
List available test scenarios.

#### POST /test/:scenario
Run a pre-configured test scenario.

```bash
# Run simple calculator test
curl -X POST http://localhost:8080/test/simple

# Run multi-tool test
curl -X POST http://localhost:8080/test/multiTool
```

## Local Testing Flow

1. **Start the server**:
   ```bash
   LOCAL_WORKERS=true pnpm dev
   ```

2. **Run a test scenario**:
   ```bash
   # In another terminal
   curl -X POST http://localhost:8080/test/simple
   ```

3. **Watch the stream**:
   ```bash
   # In another terminal
   curl -N http://localhost:8080/stream/<sessionId>
   ```

## Environment Variables

Required:
- `KV_REST_API_URL` - Upstash Redis URL
- `KV_REST_API_TOKEN` - Upstash Redis token
- `QSTASH_URL` - Qstash URL (default: https://qstash.upstash.io)
- `QSTASH_TOKEN` - Qstash token
- `AI_GATEWAY_API_KEY` - Vercel AI Gateway key

Optional:
- `PORT` - Server port (default: 8080)
- `LOCAL_WORKERS` - Set to "true" to auto-invoke workers locally
- `AGENT_MAX_ITERATIONS` - Max agent loop iterations (default: 10)
- `TOOL_EXECUTION_TIMEOUT` - Tool timeout in ms (default: 30000)
- `STREAM_TTL_SECONDS` - Stream TTL (default: 3600)

## Testing Without Qstash

Set `LOCAL_WORKERS=true` to have the test server automatically invoke worker endpoints locally, simulating Qstash behavior without needing actual Qstash setup.

## Example: Complete Flow

```bash
# 1. Start server with local workers
LOCAL_WORKERS=true pnpm dev

# 2. Run test scenario (returns sessionId)
SESSION_ID=$(curl -s -X POST http://localhost:8080/test/simple | jq -r .sessionId)

# 3. Watch the stream in real-time
curl -N http://localhost:8080/stream/$SESSION_ID

# 4. Check session status
curl http://localhost:8080/init/$SESSION_ID

# 5. List events
curl http://localhost:8080/events/list/$SESSION_ID

# 6. Clean up
curl -X DELETE http://localhost:8080/test/$SESSION_ID
```

## Development

```bash
# Type checking
pnpm typecheck

# Linting
pnpm lint

# Build
pnpm build
```