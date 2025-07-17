# Mastra Network Testing Guide

Comprehensive guide for testing multi-agent networks in Mastra.

## Network Access

### UI Testing
Navigate to networks using the v-next URL pattern:
```
http://localhost:4111/networks/v-next/<network-id>/chat
```

Example for v1 network:
```
http://localhost:4111/networks/v-next/v1-network/chat
```

### API Testing
Networks use a different API structure than regular agents:

```bash
# Network API endpoint pattern
curl -X POST http://localhost:4111/api/networks/v-next/<network-id>/stream \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [{"role": "user", "content": "Your message"}],
    "threadId": "unique-thread-id",
    "stream": true
  }'
```

## V1 Network Architecture

### Agent Composition
- **Planner** (PRIMARY - always called first)
- **Searcher** (web research)
- **Browser** (automation & downloads)
- **Vision** (image analysis)
- **Artifact** (file management)

### Routing Rules
1. **ALWAYS START WITH PLANNER** - Network enforces planner-first execution
2. Planner creates task list in working memory
3. Other agents execute based on plan
4. Each agent updates task progress

## Testing Scenarios

### 1. Planning Verification
Test that planner runs first:
```
"Create a website analysis report for example.com"
```
Expected: Planner creates task list → Other agents execute

### 2. Multi-Agent Coordination
Test agent handoffs:
```
"Research AI trends, download relevant papers, and create a summary report"
```
Expected flow:
- Planner → creates task breakdown
- Searcher → finds information
- Browser → downloads papers
- Artifact → saves report

### 3. Memory & Context
Test working memory persistence:
```
"What tasks have we completed so far?"
```
Expected: Network recalls task list from working memory

### 4. File Operations
Test artifact integration:
```
"Save the previous analysis to analysis/ai-trends/summary.md"
```
Expected: Artifact agent handles file storage

## Playwright Testing

### Basic Network Test
```javascript
// Navigate to network
await page.goto('http://localhost:4111/networks/v-next/v1-network/chat');

// Type message
await page.type('textbox', 'Create a plan to analyze a website');

// Send message
await page.click('button:has-text("Send")');

// Wait for response
await page.waitForSelector('text=/Planner/');
```

### Verify Agent Execution Order
1. Check for "Planner" badge first
2. Verify task list creation
3. Monitor subsequent agent calls

## Common Issues & Solutions

### Network Not Found
- **Issue**: 404 or "Network not found" errors
- **Solution**: Use v-next URL pattern: `/networks/v-next/<network-id>`

### Planner Not Running First
- **Issue**: Other agents called before planner
- **Diagnosis**: Check network routing rules
- **Solution**: Verify CRITICAL ROUTING RULES in network instructions

### Memory Not Persisting
- **Issue**: Task list not maintained between messages
- **Diagnosis**: Check memory configuration
- **Solution**: Ensure LibSQLStore is properly initialized

### Agent Tools Not Working
- **Issue**: Tool execution failures
- **Diagnosis**: Check tool registration in agents
- **Solution**: Verify tools are properly imported and registered

## Testing Checklist

### Pre-Test Setup
- [ ] Dev server running (`pnpm dev`)
- [ ] Database initialized (check mastra.db)
- [ ] Environment variables set (especially BLOB_READ_WRITE_TOKEN)
- [ ] All agents registered in mastra/index.ts

### Network Functionality
- [ ] Planner runs first on new conversations
- [ ] Task list appears in working memory
- [ ] Agents execute in logical order
- [ ] Progress updates reflected in task list
- [ ] File operations work via Artifact agent

### Performance & Reliability
- [ ] Response times acceptable (<5s for simple tasks)
- [ ] No timeout errors
- [ ] Graceful error handling
- [ ] Memory cleanup between conversations

## Debug Commands

### Check Network Registration
```bash
# List all registered networks
curl http://localhost:4111/api/networks/v-next
```

### Monitor Network Execution
```bash
# Watch server logs for agent execution order
pnpm dev | grep -E "(Planner|Searcher|Browser|Vision|Artifact)"
```

### Test Individual Agents
Before testing network, verify each agent works:
```bash
# Test each agent individually
for agent in Planner Searcher Browser Vision Artifact; do
  echo "Testing $agent..."
  curl -X POST http://localhost:4111/api/agents/$agent/stream \
    -H "Content-Type: application/json" \
    -d '{"messages":[{"role":"user","content":"test"}],"threadId":"test","resourceId":"'$agent'","stream":true}'
done
```

## Example Test Prompts

### Basic Planning
- "Create a plan to learn about quantum computing"
- "Help me organize a research project on climate change"

### Multi-Agent Tasks
- "Research the top 5 AI companies and create a comparison report"
- "Analyze the Mastra documentation website and suggest improvements"
- "Download images of modern architecture and create a visual analysis"

### File Management
- "Save our conversation summary to docs/meetings/today.md"
- "Create a JSON file with the task list at data/tasks/current.json"
- "Read the previous report from reports/2025-01-17/artifact-test.md"

### Error Testing
- "Complete this task without planning" (should still invoke planner)
- "Skip the planner and search directly" (should enforce planner-first)
- "Delete a non-existent file" (should handle gracefully)

## Best Practices

1. **Always test planner-first enforcement**
2. **Verify task list updates after each agent action**
3. **Check file paths follow organization guidelines**
4. **Monitor memory usage for long conversations**
5. **Test error scenarios and edge cases**
6. **Validate cross-agent data sharing**

Remember: The v1 network is designed for complex, multi-step tasks that benefit from planning and coordination between specialized agents.