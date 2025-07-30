# V2 Runtime Architecture

## Overview

The V2 Runtime provides a clean separation between:
1. **Orchestration**: Worker-to-worker communication via HTTP/QStash
2. **Execution**: Running agent loops and tools
3. **Tracking**: Event streaming for monitoring and observability

## Key Components

### Event Systems

We have two distinct event systems serving different purposes:

#### 1. Orchestration Events (`events/schemas.ts`)
- Used for worker-to-worker communication
- Events like `agent.loop.init`, `agent.loop.step`, `agent.tool.call`
- Sent via QStash to coordinate distributed execution
- Zod-validated schemas for type safety

#### 2. Tracking Events (`server/events/types.ts`)
- Used for monitoring agent execution
- Events like `agent.loop.start`, `agent.tool.call`, `agent.error`
- Streamed via Redis pub/sub for real-time observability
- Strongly typed with discriminated unions

### Runtime Interface

The `Runtime` interface bridges orchestration and tracking:

```typescript
interface Runtime {
  // Initialize a new agent loop
  initAgentLoop(params: {
    event: AgentLoopInitEvent;  // Orchestration event
    agent: Agent;
    baseUrl: string;
  }): Promise<void>;

  // Continue agent loop after tools
  executeAgentStep(params: {
    event: AgentLoopStepEvent;  // Orchestration event
    agent: Agent;
    baseUrl: string;
  }): Promise<void>;

  // Execute a tool call
  executeTool(params: {
    event: AgentToolCallEvent;  // Orchestration event
    toolRegistry: ToolRegistry;
    baseUrl: string;
  }): Promise<void>;
}
```

### State Machine Flow

The agent loop is a state machine with discrete HTTP operations:

```
User Message
    ↓
POST /workers/agent-loop-init
    ↓
[Agent makes decision]
    ↓
If no tools needed:
    → POST /workers/agent-loop-complete
    
If tools needed:
    → POST /workers/agent-tool-call (for each tool)
        ↓
    [Tool executes]
        ↓
    All tools complete
        ↓
    POST /workers/agent-loop-step
        ↓
    [Back to Agent makes decision]
```

### Key Design Decisions

1. **Simplified AgentDecision**: Just contains optional tool call, no content/reasoning
   - Content comes from the streaming response
   - Decision object only controls flow (tool or no tool)

2. **Session State in Redis**: Maintains conversation state between steps
   - Messages array
   - Step index
   - Pending tool calls
   - Timing information

3. **Event Writer Integration**: Runtime emits tracking events at each step
   - Loop start/complete
   - Step start/complete
   - Tool call/result
   - Errors with context

4. **QStash for Orchestration**: Reliable message passing between workers
   - Each worker completes and publishes next event
   - No long-running processes
   - Stateless workers

### Benefits

- **Clean Separation**: Orchestration vs execution vs tracking
- **Testability**: Each component can be tested independently
- **Observability**: Full event stream for debugging and monitoring
- **Scalability**: Stateless workers can scale horizontally
- **Reliability**: QStash ensures message delivery

### Future Improvements

- [ ] Add retry logic for failed tool calls
- [ ] Implement timeout handling
- [ ] Add event replay capabilities
- [ ] Create dashboard for event visualization