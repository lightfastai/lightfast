# Qstash Setup Guide for V2 Architecture

This guide explains how to set up Qstash for the V2 event-driven architecture.

## Overview

The V2 architecture uses Qstash to handle event routing between different components:
- Agent Loop Worker
- Tool Executor
- Tool Result Handler

## Option 1: Direct URL Publishing (Recommended for Testing)

This is the simplest approach for testing without setting up topics.

### 1. Expose Your Local Server

Use ngrok or a similar tool to expose your local server:

```bash
ngrok http 8090
```

You'll get a URL like: `https://abc123.ngrok.io`

### 2. Set Environment Variable

```bash
export WORKER_BASE_URL=https://abc123.ngrok.io
```

### 3. Modify Event Emitter (Temporary)

For testing, you can modify the event emitter to use direct URLs instead of topics:

```typescript
// In packages/ai/src/core/v2/events/emitter.ts
private async publishEvent(event: Event): Promise<void> {
    // For testing: use direct URL publishing
    const endpoint = this.getEndpointForEvent(event.type);
    const url = `${process.env.WORKER_BASE_URL}${endpoint}`;
    
    try {
        await this.client.publishJSON({
            url,  // Direct URL instead of topic
            body: event,
            retries: 3,
            delay: "10s",
            headers: {
                "x-event-id": event.id,
                "x-event-type": event.type,
                "x-session-id": event.sessionId,
            },
        });
    } catch (error) {
        console.error(`Failed to publish event ${event.type}:`, error);
        throw error;
    }
}

private getEndpointForEvent(eventType: string): string {
    const endpoints: Record<string, string> = {
        "agent.loop.init": "/workers/agent-loop",
        "agent.tool.call": "/workers/tool-executor",
        "tool.execution.complete": "/workers/tool-result-complete",
        "tool.execution.failed": "/workers/tool-result-failed",
    };
    return endpoints[eventType] || "/workers/unknown";
}
```

## Option 2: Topic-Based Publishing (Production)

### 1. Create Topics in Qstash Console

Go to [Qstash Console](https://console.upstash.com/qstash) and create these topics:

| Topic Name | Description |
|------------|-------------|
| `agent.agent-loop-init` | Triggers agent loop processing |
| `agent.agent-tool-call` | Triggers tool execution |
| `agent.tool-execution-complete` | Handles successful tool results |
| `agent.tool-execution-failed` | Handles failed tool results |

### 2. Add Endpoints to Topics

For each topic, add an endpoint:

1. Click on the topic
2. Click "Add Endpoint"
3. Enter your webhook URL:
   - For ngrok: `https://abc123.ngrok.io/workers/agent-loop`
   - For production: `https://your-app.vercel.app/api/v2/workers/agent-loop`

### 3. Configure Webhook Settings

- **Method**: POST
- **Headers**: 
  - `Content-Type: application/json`
- **Retries**: 3
- **Retry Delay**: 10s

## Testing Your Setup

### 1. Test Event Publishing

```bash
# From the v2 app directory
pnpm tsx src/setup-qstash.ts
```

### 2. Run a Test Scenario

```bash
# Start your server
pnpm dev

# In another terminal
curl -X POST http://localhost:8090/test/simple
```

### 3. Monitor Qstash Console

Check the Qstash console for:
- Published messages
- Delivery status
- Any errors

## Troubleshooting

### "Topic not found" Error

This means the topic hasn't been created yet. Either:
1. Create it manually in the Qstash console
2. Publish to it once (Qstash auto-creates topics on first publish)

### Authentication Errors

Make sure your `QSTASH_TOKEN` is correct and has the necessary permissions.

### Webhook Failures

1. Check that your server is accessible from the internet
2. Verify the endpoint URLs are correct
3. Check the server logs for incoming requests

## Production Configuration

For production, update your environment variables:

```bash
# .env.production
QSTASH_URL=https://qstash.upstash.io
QSTASH_TOKEN=your-production-token
QSTASH_TOPIC_PREFIX=prod-agent  # Use different prefix for prod
WORKER_BASE_URL=https://your-app.vercel.app/api/v2
```

## Security Considerations

1. **Verify Qstash Signatures**: In production, verify that requests are coming from Qstash
2. **Use HTTPS**: Always use HTTPS endpoints
3. **Rate Limiting**: Implement rate limiting on your worker endpoints
4. **Monitoring**: Set up alerts for failed deliveries