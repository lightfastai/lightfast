# Mastra Agent Testing Guide

Quick reference for testing Mastra agents via API and UI.

## API Testing (Direct)

### Basic Command
```bash
curl -X POST http://localhost:4111/api/agents/<agentName>/stream \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [{"role": "user", "content": "Your message"}],
    "threadId": "test-thread",
    "resourceId": "<agentName>",
    "stream": true
  }'
```

### Required Fields
- `messages`: Array with `role` and `content`
- `threadId`: Unique conversation ID
- `resourceId`: Must match agent name
- `stream`: Enable streaming (true/false)

### Container-Use Endpoints
- **Internal**: `http://<container-id>:4111`
- **External**: `http://127.0.0.1:<port>` (from `environment_run_cmd` output)

## Playwright Testing (UI)

### Setup
```yaml
# Already configured in .mcp.json
# Auto-starts with Claude Code
```

### Test Flow
1. **Navigate**: `mcp__playwright-mastra__browser_navigate`
   - URL: `http://localhost:4111/agents/<agentName>`
2. **Input**: `mcp__playwright-mastra__browser_type`
   - Find textbox reference
   - Enter test message
3. **Send**: `mcp__playwright-mastra__browser_click`
   - Click Send button
4. **Wait**: `mcp__playwright-mastra__browser_wait_for`
   - Wait for response
5. **Close**: `mcp__playwright-mastra__browser_close`

### Common Issues
- **UI not responding**: Test API directly first
- **Missing API keys**: Check environment config
- **Wrong endpoint**: Use external port for browser

## Testing Examples

### Math Agent
```bash
# API
curl -X POST http://localhost:4111/api/agents/mathAgent/stream \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"Calculate 15 * 7"}],"threadId":"test","resourceId":"mathAgent","stream":true}'

# Playwright
Navigate → Type "Calculate 15 * 7" → Send → Wait
```

### Complex Operations
- **Quadratic**: "Solve x² + 5x + 6 = 0"
- **Statistics**: "Find mean of [1,2,3,4,5]"
- **Matrix**: "Transpose [[1,2],[3,4]]"

## Debug Tips
- Check server logs: `container-use log <env-id>`
- Test API first, then UI
- Verify agent in `mastra/index.ts`
- Confirm tools registered in agent file