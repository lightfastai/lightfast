# Mastra Agent Testing Guide

Quick reference for testing Mastra agents via API and UI in the lightfast-experimental monorepo.

## Monorepo Structure
- **Web App**: `apps/www/` - Next.js application with chat interface
- **AI Package**: `packages/ai/` - Contains all agents and tools
  - Agents: `packages/ai/src/mastra/agents/`
  - Tools: `packages/ai/src/mastra/tools/`
- **Types**: `packages/types/` - Shared TypeScript types
- **Evaluations**: `packages/evals/` - Agent evaluation framework

## Development Setup

### Start Mastra Server
```bash
# From project root
pnpm dev:mastra

# Or from AI package
cd packages/ai && pnpm dev:mastra
```

### Start Web Application
```bash
# From project root
pnpm dev:www

# Or from web app
cd apps/www && pnpm dev
```

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

### Web UI Testing
1. **Navigate**: Open `http://localhost:3000` (web app)
2. **Agent Selection**: Choose agent from dropdown (a010, a011, etc.)
3. **Chat Interface**: Test through the web chat interface
4. **Thread Management**: Each conversation gets a unique thread ID

### Mastra Playground Testing  
1. **Navigate**: Open `http://localhost:4111/agents/<agentName>` (Mastra server)
2. **Direct Testing**: Use the Mastra playground interface
3. **API Testing**: Direct agent API calls via playground

### Common Issues
- **UI not responding**: Test API directly first
- **Missing API keys**: Check environment config
- **Wrong endpoint**: Use external port for browser

## Testing Examples

### Available Agents
- **a010**: Comprehensive agent with full toolset (web search, files, sandbox, browser)
- **a011**: Task-led workflow agent with structured task management
- **c010**: Pure conversational agent
- **Vision Agent**: Image analysis and understanding
- **Voice Agent**: Text-to-speech capabilities
- **Browser Agent**: Web automation and scraping
- **Sandbox Agent**: Code execution in isolated environments

### Example API Calls
```bash
# Test A011 Task Agent
curl -X POST http://localhost:4111/api/agents/a011/stream \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"Create a Python script to calculate fibonacci numbers"}],"threadId":"test-123","resourceId":"a011","stream":true}'

# Test A010 Comprehensive Agent  
curl -X POST http://localhost:4111/api/agents/a010/stream \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"Search for latest AI news and summarize"}],"threadId":"test-456","resourceId":"a010","stream":true}'
```

### Complex Test Scenarios
- **Multi-step tasks**: "Research company X, create a summary document, and save it"
- **Code execution**: "Write and run Python code to analyze this dataset"
- **Web automation**: "Visit website Y, extract information, and format as JSON"
- **File operations**: "Create multiple files with different content types"

## Debug Tips
- Check server logs: `container-use log <env-id>`
- Test API first, then UI
- Verify agent in `packages/ai/src/mastra/index.ts`
- Confirm tools registered in agent file
- Agent files: `packages/ai/src/mastra/agents/`

## Evaluation Testing

The evaluation framework uses Braintrust for comprehensive agent testing with metrics:

### Run Evaluations
```bash
# From project root
cd packages/evals

# Run A011 evaluation with development UI
pnpm eval:a011:dev

# Run production evaluation
pnpm eval:a011

# Set current run as baseline
pnpm eval:a011:baseline

# List recent experiments
pnpm eval:list

# Show current baseline
pnpm eval:baseline
```

### Environment Setup
Evaluations use environment variables from `apps/www/.env.local`:
- Requires `BRAINTRUST_API_KEY` and `BRAINTRUST_PROJECT_ID`
- All agent API keys must be configured
- Uses same environment as web application

### Evaluation Metrics
- Answer relevancy and completeness
- Prompt alignment and toxicity detection
- Content similarity and keyword coverage
- Custom task-specific metrics

See evaluation configurations in `packages/evals/src/agents/experimental/a011/`