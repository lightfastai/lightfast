# Deus v2.0 - Simple Mode

## Overview

Deus v2.0 introduces a completely redesigned architecture with **Simple Mode** - a sequential, single-agent orchestration system where Deus acts as an intelligent router.

### Key Principles

1. **Deus is the Router**: Deus doesn't just coordinate - it decides which agent to use
2. **Sequential Execution**: Only ONE agent active at a time (Deus OR Claude Code OR Codex)
3. **Smart View Switching**: UI automatically switches to the active agent
4. **Simple Handoff**: Type "back" to return control to Deus

## Architecture

### Flow

```
┌──────────────────────────────────────────────────┐
│ 1. User starts `deus`                            │
│    → Only Deus agent running                     │
│    → UI shows Deus chat                          │
└──────────────────────────────────────────────────┘
                    ↓
┌──────────────────────────────────────────────────┐
│ 2. User chats with Deus                          │
│    User: "start code-review"                     │
└──────────────────────────────────────────────────┘
                    ↓
┌──────────────────────────────────────────────────┐
│ 3. Deus (with mocked LLM) decides:               │
│    "I need Claude Code for this"                 │
│    → Creates MCP session                         │
│    → Generates configs                           │
│    → Launches Claude Code with MCPs              │
└──────────────────────────────────────────────────┘
                    ↓
┌──────────────────────────────────────────────────┐
│ 4. UI switches to Claude Code                    │
│    → User now chats with Claude Code             │
│    → Full terminal interaction                   │
└──────────────────────────────────────────────────┘
                    ↓
┌──────────────────────────────────────────────────┐
│ 5. When done:                                    │
│    User: "back"                                  │
│    → Claude Code stops                           │
│    → UI switches back to Deus                    │
│    → Deus asks: "What's next?"                   │
└──────────────────────────────────────────────────┘
                    ↓
┌──────────────────────────────────────────────────┐
│ 6. Repeat for next task                          │
│    User: "write tests"                           │
│    → Deus starts Codex with testing MCPs         │
│    → UI switches to Codex                        │
└──────────────────────────────────────────────────┘
```

## Components

### 1. Deus Agent (`src/lib/deus-agent.ts`)

**Role**: Smart router that decides which agent to use

**Routing Logic** (currently mocked, will use LLM):
- "code review" → Claude Code with filesystem
- "testing" → Codex with Playwright
- "debugging" → Claude Code
- "web automation" → Codex with Browserbase
- "documentation" → Claude Code

**Example**:
```typescript
const deus = new DeusAgent();
const response = await deus.processMessage("Review the auth code");

// Returns:
{
  response: "I'll start Claude Code to review the code.",
  action: {
    type: 'start-claude-code',
    config: {
      jobType: 'code-review',
      mcpServers: ['deus-session', 'filesystem'],
      prompt: "Review the auth code"
    }
  }
}
```

### 2. Simple Orchestrator (`src/lib/simple-orchestrator.ts`)

**Role**: Coordinates Deus and spawned agents sequentially

**Key Features**:
- Only one agent active at a time
- Automatic view switching
- Message history per agent
- Handoff protocol

**Example**:
```typescript
const orch = new SimpleOrchestrator();
await orch.initialize();

// User message to Deus
await orch.handleUserMessage("start code-review");
// → Deus decides to start Claude Code
// → state.activeAgent changes to 'claude-code'

// User message to Claude Code
await orch.handleUserMessage("Review src/auth/login.ts");
// → Forwarded to Claude Code

// User returns to Deus
await orch.handleUserMessage("back");
// → Claude Code stops
// → state.activeAgent changes to 'deus'
```

### 3. Simple UI (`src/components/SimpleUI.tsx`)

**Role**: Single-view UI that switches between agents

**Views**:
- **Deus View**: Shows Deus chat, routing suggestions
- **Claude Code View**: Shows Claude Code interaction
- **Codex View**: Shows Codex interaction

**Keyboard Shortcuts**:
- `Ctrl+B` - Return to Deus
- `Ctrl+C` - Exit
- Type "back" - Return to Deus

### 4. MCP Orchestrator (Reused)

**Role**: Generates MCP configs and manages agent launch

**Integration**:
```typescript
// In SimpleOrchestrator
const mcpOrch = new MCPOrchestrator({
  jobType: 'code-review',
  mcpServers: ['deus-session', 'filesystem'],
});

await mcpOrch.initialize();

// Then start PTY with generated configs
const sessionId = mcpOrch.getManifest()?.sessionId;
const command = `claude --session-id ${sessionId} --mcp-config ...`;
```

## User Experience

### Example Session

```
┌─────────────────────────────────────────┐
│ 🎭 Deus                                 │
│ Session: abc123...                      │
└─────────────────────────────────────────┘

🎭 Deus: Welcome to Deus v2.0!
Tell me what you need help with.

→ You: Review the authentication code

🎭 Deus: I'll start Claude Code to review the code.
[Creating MCP session...]
[Session created: abc123...]
[Starting Claude Code...]

┌─────────────────────────────────────────┐
│ 🤖 Claude Code • code-review            │
│ Session: abc123...                      │
└─────────────────────────────────────────┘

✓ Claude Code started. Type "back" to return to Deus.

→ You: Review src/auth/login.ts

🤖 Claude Code: I'll review the authentication code in src/auth/login.ts...
[... Claude Code's response ...]

→ You: back

🤖 Claude Code: Returning to Deus...

┌─────────────────────────────────────────┐
│ 🎭 Deus                                 │
│ Session: abc123...                      │
└─────────────────────────────────────────┘

✓ Task completed. Claude Code stopped. What's next?

→ You: Write tests for the auth module

🎭 Deus: I'll start Codex to help with testing.
[Creating MCP session...]

┌─────────────────────────────────────────┐
│ ⚡ Codex • testing                      │
│ Session: xyz789...                      │
└─────────────────────────────────────────┘

✓ Codex started. Type "back" to return to Deus.
```

## Routing Patterns

### Current (Mocked) Routing

```typescript
const ROUTING_PATTERNS = [
  {
    keywords: ['review', 'code review', 'check code'],
    jobType: 'code-review',
    agent: 'claude-code',
    mcpServers: ['deus-session', 'filesystem'],
  },
  {
    keywords: ['test', 'testing', 'write tests'],
    jobType: 'testing',
    agent: 'codex',
    mcpServers: ['deus-session', 'playwright'],
  },
  // ... more patterns
];
```

### Future (LLM-based) Routing

```typescript
// When ready, replace pattern matching with LLM call
async routeWithLLM(message: string): Promise<DeusAction | null> {
  const systemPrompt = `You are Deus, an AI orchestrator.
  Analyze the user's request and decide which agent to use:
  - Claude Code: For code review, debugging, refactoring
  - Codex: For testing, web automation, browser tasks

  Return JSON: { agent: "claude-code" | "codex", jobType: string, mcpServers: string[] }
  `;

  const llmResponse = await callLLM({
    system: systemPrompt,
    messages: this.conversationHistory,
    userMessage: message,
  });

  return JSON.parse(llmResponse);
}
```

## Commands

### Explicit Commands

```bash
# In Deus chat:
start code-review      # Start code review job
start testing          # Start testing job
help                   # Show help
status                 # Show status
back                   # (When in agent) Return to Deus
```

### Natural Language

```bash
# Deus understands natural language:
"Review the authentication code"
"Help me write tests for the API"
"Debug the login flow"
"Scrape data from this website"
```

## Handoff Protocol

### From Deus to Agent

1. User sends message to Deus
2. Deus matches intent to agent
3. Deus creates MCP session
4. Deus launches agent with correct MCPs
5. UI switches to agent view
6. User now chats with agent

### From Agent back to Deus

1. User types "back" (or presses Ctrl+B)
2. Agent PTY stops
3. MCP session completes
4. UI switches back to Deus
5. Deus says "What's next?"

## State Management

### Orchestrator State

```typescript
interface OrchestratorState {
  activeAgent: 'deus' | 'claude-code' | 'codex';
  messages: AgentMessage[];
  sessionId: string | null;
  jobType: string | null;
  mcpServers: string[];
}
```

### Message Format

```typescript
interface AgentMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  agent: ActiveAgent;  // Which agent this message is from
}
```

## Benefits

### vs. Previous TUI Orchestrator

| Feature | Old (Parallel) | New (Simple) |
|---------|---------------|--------------|
| **Agents Running** | Both at once | One at a time |
| **UI Complexity** | Split screen | Single view |
| **Routing** | Manual switching | Deus decides |
| **Context** | Shared context | Clean handoff |
| **User Cognitive Load** | High (track both) | Low (focus on one) |

### Advantages

1. **Simpler Mental Model**: One conversation at a time
2. **Clear Routing**: Deus makes decisions
3. **Less Overwhelming**: No split screen
4. **Easier to Debug**: One active agent
5. **Natural Workflow**: Ask Deus → Work with agent → Return to Deus

## Implementation Status

### ✅ Implemented

- [x] Deus Agent with mocked routing
- [x] Simple Orchestrator for sequential execution
- [x] Simple UI with view switching
- [x] Handoff protocol ("back" command)
- [x] MCP config generation
- [x] PTY spawning for agents
- [x] Message history per agent

### 🔜 TODO

- [ ] LLM-based routing (replace mocked patterns)
- [ ] Job templates (predefined MCP sets)
- [ ] Session persistence across restarts
- [ ] Better error handling
- [ ] Logs per session
- [ ] CLI commands (deus start, deus list, etc.)

## Usage

### Start Deus

```bash
cd core/deus
pnpm build
node dist/index-simple.js
```

### Workflow

1. **Chat with Deus**:
   ```
   → You: Review the authentication code
   ```

2. **Deus routes to Claude Code**:
   ```
   🎭 Deus: I'll start Claude Code to review the code.
   ```

3. **Work with Claude Code**:
   ```
   → You: Check src/auth/login.ts
   🤖 Claude Code: [reviews code...]
   ```

4. **Return to Deus**:
   ```
   → You: back
   🎭 Deus: ✓ Task completed. What's next?
   ```

5. **Start next task**:
   ```
   → You: Write tests
   🎭 Deus: I'll start Codex to help with testing.
   ```

## Testing

### Unit Tests

```typescript
import { DeusAgent } from './lib/deus-agent.js';

test('Deus routes code review to Claude Code', async () => {
  const deus = new DeusAgent();
  const response = await deus.processMessage("Review the code");

  expect(response.action).toBeDefined();
  expect(response.action?.type).toBe('start-claude-code');
  expect(response.action?.config.jobType).toBe('code-review');
});
```

### Integration Tests

```typescript
import { SimpleOrchestrator } from './lib/simple-orchestrator.js';

test('Handoff protocol works', async () => {
  const orch = new SimpleOrchestrator();
  await orch.initialize();

  // Start with Deus
  expect(orch.getState().activeAgent).toBe('deus');

  // Trigger Claude Code start
  await orch.handleUserMessage("start code-review");
  expect(orch.getState().activeAgent).toBe('claude-code');

  // Return to Deus
  await orch.handleUserMessage("back");
  expect(orch.getState().activeAgent).toBe('deus');
});
```

## Migration from Old TUI

### Old Approach (Parallel)

```typescript
// Start both agents at once
orchestrator.startAgent('claude-code');
orchestrator.startAgent('codex');

// User has to manually switch
orchestrator.switchAgent();
```

### New Approach (Sequential)

```typescript
// Start only Deus
const orch = new SimpleOrchestrator();
await orch.initialize();

// Deus decides when to start agents
await orch.handleUserMessage("start code-review");
// → Deus starts Claude Code

// Handoff back to Deus
await orch.handleUserMessage("back");
// → Claude Code stops, Deus active
```

## Future: LLM Integration

When ready to add LLM routing:

```typescript
// In deus-agent.ts
import { callLLM } from './llm-client.js';

class DeusAgent {
  async processMessage(message: string): Promise<DeusResponse> {
    // Try LLM routing first
    const llmRoute = await this.routeWithLLM(message);

    if (llmRoute) {
      return {
        response: this.generateResponseFor(llmRoute),
        action: llmRoute,
      };
    }

    // Fallback to pattern matching
    return this.matchRoutingPattern(message);
  }

  private async routeWithLLM(message: string): Promise<DeusAction | null> {
    const decision = await callLLM({
      system: ROUTING_SYSTEM_PROMPT,
      messages: this.conversationHistory,
      userMessage: message,
    });

    return decision; // { type, config }
  }
}
```

## Summary

Deus v2.0 Simple Mode provides:

✅ **Deus as Smart Router** - Decides which agent to use
✅ **Sequential Execution** - One agent at a time
✅ **Automatic View Switching** - UI follows active agent
✅ **Simple Handoff** - Type "back" to return
✅ **MCP Integration** - Automatic config generation
✅ **Clean UX** - No split screen, no confusion

**Result**: A simpler, clearer, more natural workflow for AI-assisted development.
