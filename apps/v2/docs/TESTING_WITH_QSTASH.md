# Testing with Qstash - Quick Guide

## Option 1: Direct URL Mode (Recommended for Testing)

This mode bypasses topic creation and publishes directly to worker URLs.

### 1. Set Environment Variables

Add to your `.env.local`:
```bash
# Enable direct URL mode
QSTASH_DIRECT_URL=true
WORKER_BASE_URL=http://localhost:8090
```

### 2. Start the Server

```bash
# From apps/v2
pnpm dev:direct
```

This starts the server with direct URL publishing enabled.

### 3. Run a Test

```bash
# In another terminal
curl -X POST http://localhost:8090/test/simple
```

### 4. Watch the Events

```bash
# Get the sessionId from the test response
curl -N http://localhost:8090/stream/<sessionId>
```

## Option 2: Use ngrok for External Access

If you need to test with real Qstash webhooks:

### 1. Install ngrok

```bash
brew install ngrok  # macOS
# or download from https://ngrok.com
```

### 2. Start ngrok

```bash
ngrok http 8090
```

You'll see something like:
```
Forwarding  https://abc123.ngrok.io -> http://localhost:8090
```

### 3. Update Environment

```bash
# In .env.local
QSTASH_DIRECT_URL=true
WORKER_BASE_URL=https://abc123.ngrok.io
```

### 4. Restart Server

```bash
pnpm dev:direct
```

## Option 3: Full Topic Setup (Production)

For production-like testing with topics:

### 1. Go to Qstash Console

Visit: https://console.upstash.com/qstash

### 2. Create Topics

Create these topics:
- `agent.agent-loop-init`
- `agent.agent-tool-call`
- `agent.tool-execution-complete`
- `agent.tool-execution-failed`

### 3. Add Endpoints

For each topic, add your ngrok URL as endpoint:
- Topic: `agent.agent-loop-init` → `https://abc123.ngrok.io/workers/agent-loop`
- Topic: `agent.agent-tool-call` → `https://abc123.ngrok.io/workers/tool-executor`
- etc.

### 4. Disable Direct Mode

```bash
# In .env.local
QSTASH_DIRECT_URL=false  # or remove the line
```

## Monitoring

### Check Qstash Console

Visit https://console.upstash.com/qstash to see:
- Published messages
- Delivery status
- Failed deliveries
- Retry attempts

### Check Server Logs

```bash
# The server logs show all events
tail -f /tmp/v2-server.log
```

### Check Event History

```bash
# List events for a session
curl http://localhost:8090/events/list/<sessionId>
```

## Common Issues

### "Topic not found"
- You're using topic mode but haven't created topics
- Solution: Use direct URL mode or create topics

### "Connection refused"
- Worker URL is not accessible
- Solution: Check ngrok is running and URL is correct

### Events not processing
- Check server logs for errors
- Verify Qstash token is correct
- Check worker endpoints are returning 200 OK

## Testing Checklist

- [ ] Server running (`pnpm dev:direct`)
- [ ] Environment variables set
- [ ] If using ngrok, it's running and URL is updated
- [ ] Run test scenario
- [ ] Monitor stream for real-time updates
- [ ] Check Qstash console for delivery status