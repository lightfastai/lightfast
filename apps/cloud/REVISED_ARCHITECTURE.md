# Revised Agent Execution Architecture - Tool-Only Execution

## Key Insight
**Only tools execute user code, not the entire agent.** We can safely extract agent configuration and use it directly with fetchRequestHandler, then secure only tool execution.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Next.js /api/execute                     │
├─────────────────────────────────────────────────────────────┤
│ 1. Parse bundle → extract agent config (safe)               │
│ 2. Create real agent with fetchRequestHandler               │
│ 3. Stream AI response natively                             │
│ 4. When tool called → secure execution via /api/tool       │
└─────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────┐
│                 /api/tool (Vercel Function)                 │
├─────────────────────────────────────────────────────────────┤
│ • VM2 sandboxing for tool execution only                   │
│ • Node.js runtime (full capabilities)                      │
│ • Resource limits (memory/time)                            │
│ • Network restrictions                                      │
└─────────────────────────────────────────────────────────────┘
```

## Implementation Strategy

### Phase 1: Safe Config Extraction
```typescript
// Parse bundle to extract agent configuration WITHOUT executing user code
function parseAgentBundle(bundleCode: string): AgentConfig {
  // Use AST parsing or safe evaluation to extract:
  // - name, system prompt, model
  // - tool definitions (but not implementations)
  
  const ast = parseScript(bundleCode) // Use @babel/parser
  // Extract createAgent() calls
  // Return sanitized configuration
}
```

### Phase 2: Direct Agent Creation
```typescript
// /api/execute route
export async function POST(request: NextRequest) {
  const { bundleUrl, input, agentName } = await request.json()
  
  // 1. Fetch bundle
  const bundleCode = await fetch(bundleUrl).then(r => r.text())
  
  // 2. Extract config safely (no code execution)
  const agentConfig = parseAgentBundle(bundleCode)
  const selectedAgent = agentConfig.agents[agentName]
  
  // 3. Create real agent with tool proxy
  const agent = createAgent({
    name: selectedAgent.name,
    system: selectedAgent.system,
    model: gateway(selectedAgent.model),
    tools: createProxiedTools(selectedAgent.tools, bundleCode) // Proxy to /api/tool
  })
  
  // 4. Use fetchRequestHandler directly (native streaming)
  return fetchRequestHandler({
    agent,
    sessionId: uuidv4(),
    memory: new InMemoryMemory(),
    req: request,
    resourceId: organizationId
  })
}
```

### Phase 3: Secure Tool Execution
```typescript
// /api/tool route (separate Vercel function)
export async function POST(request: NextRequest) {
  const { toolName, toolCode, parameters, bundleCode } = await request.json()
  
  // Execute ONLY the specific tool in VM2 sandbox
  const vm = new NodeVM({
    console: 'redirect',
    timeout: 10000, // 10 second limit
    eval: false,
    wasm: false,
    require: {
      external: ['node:crypto', 'node:util'], // Limited allowed modules
      restrict: false
    }
  })
  
  try {
    // Execute only the tool function, not entire bundle
    const toolResult = vm.run(`
      ${toolCode}
      module.exports = ${toolName}(${JSON.stringify(parameters)})
    `)
    
    return Response.json({ result: toolResult })
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }
}

// Force Node.js runtime for VM2 compatibility  
export const runtime = 'nodejs'
```

### Phase 4: Tool Proxying
```typescript
// Create tools that proxy to /api/tool
function createProxiedTools(toolDefinitions: any, bundleCode: string) {
  const proxiedTools = {}
  
  for (const [toolName, toolDef] of Object.entries(toolDefinitions)) {
    proxiedTools[toolName] = {
      ...toolDef,
      execute: async (parameters: any) => {
        // Extract just this tool's code from bundle
        const toolCode = extractToolCode(bundleCode, toolName)
        
        // Call secure execution endpoint
        const response = await fetch('/api/tool', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            toolName,
            toolCode,
            parameters,
            bundleCode // For context if needed
          })
        })
        
        const result = await response.json()
        if (!response.ok) throw new Error(result.error)
        return result.result
      }
    }
  }
  
  return proxiedTools
}
```

## Security Model

### Bundle Parsing (Safe)
- AST parsing only, no code execution
- Extract configuration data structure
- Sanitize and validate all extracted values

### Agent Creation (Safe)  
- Use extracted config with real Lightfast components
- Native fetchRequestHandler streaming
- No user code execution at this stage

### Tool Execution (Sandboxed)
- VM2 isolation in separate Vercel function
- Execute only individual tool functions
- Resource limits: 10s timeout, limited memory
- Restricted module access

## Benefits of This Approach

✅ **Vercel-only deployment** - no external services
✅ **Full Node.js capabilities** in tool execution  
✅ **Native streaming** via fetchRequestHandler
✅ **Minimal attack surface** - only tools run user code
✅ **Better performance** - no proxy overhead
✅ **Simpler architecture** - single deployment target

## Implementation Steps

1. **Day 1**: Implement AST-based bundle parsing
2. **Day 2**: Create /api/tool secure execution endpoint  
3. **Day 3**: Build tool proxying system
4. **Day 4**: Integration testing and security validation
5. **Day 5**: Performance optimization and monitoring

## Example Bundle Processing

Input bundle:
```javascript
const myTool = (params) => {
  // User code that needs sandboxing
  return processData(params)
}

module.exports = createLightfast({
  agents: {
    myAgent: createAgent({
      name: 'assistant',
      system: 'You are helpful',
      model: gateway('gpt-4'),
      tools: { myTool }
    })
  }
})
```

Processing:
1. **Parse** → Extract agent config + tool definitions
2. **Create** → Real agent with proxied tools  
3. **Stream** → Native AI responses via fetchRequestHandler
4. **Execute** → Tools in VM2 sandbox when called

This architecture is **much simpler**, **more secure**, and **Vercel-native**.