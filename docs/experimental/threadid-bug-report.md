# ThreadId Bug in NewAgentNetwork

## Issue Summary
NewAgentNetwork fails to pass `threadId` from API requests to individual agent tools, causing files to be saved to `threads/no-thread/` instead of the correct thread directory.

## Evidence

### API Request (Correct)
```json
{
  "message": "Save a simple test file called test.txt with content Hello World",
  "threadId": "debug-thread-789",
  "resourceId": "v1-network",
  "stream": false
}
```

### Tool Execution (Broken)
```
[fileWriteTool] Debug - Received context: { 
  threadId: undefined, 
  resourceId: undefined, 
  filename: 'test.txt' 
}
```

### Expected vs Actual File Paths
- **Expected**: `threads/debug-thread-789/test.txt`
- **Actual**: `threads/no-thread/test.txt`

## Reproduction Steps
1. Start Mastra server: `pnpm dev`
2. Send POST to `/api/networks/v-next/v1-network/stream` with threadId
3. Request file save through Artifact agent
4. Observe threadId is undefined in tool execution logs

## Impact
- Files cannot be organized by conversation threads
- Cross-network memory context is broken
- Thread-scoped file operations fail

## Investigation Status
- ✅ Confirmed network receives threadId correctly
- ✅ Confirmed agent tools receive undefined threadId
- ✅ Verified this affects all network-delegated tool calls
- ❌ Root cause in NewAgentNetwork implementation pending

## Next Steps
1. Investigate NewAgentNetwork source code in node_modules
2. Check how threadId is passed from network to agent contexts
3. Implement fix or workaround in network or agent configuration

## Tested With
- Network: v1-network
- Agents: Planner → Artifact
- Tools: fileWriteTool, fileReadTool
- API Pattern: `/api/networks/v-next/{network-id}/stream`