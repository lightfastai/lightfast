# Deus - AI Agent Orchestrator

> Terminal-based UI for orchestrating multiple AI agents (Claude Code & Codex) in a single interface

## Overview

Deus is a TUI (Terminal User Interface) application built with Ink (React for CLIs) that provides a dual-panel interface for orchestrating and coordinating multiple AI agents simultaneously. It enables developers to work with Claude Code and Codex side-by-side, share context between them, and manage their interactions seamlessly.

## Features

- **Dual-Panel Layout**: Side-by-side view of Claude Code and Codex agents
- **Active Agent Indication**: Double border and highlighted header for the active agent
- **Real-Time Status**: Live indicators showing agent state (idle, running, waiting, error)
- **Message History**: Last 5 messages displayed per agent
- **Keyboard Controls**: Quick navigation and context sharing
- **Process Integration**: Spawns and communicates with real agent processes
- **Agent Coordination**: Messages to one agent notify the other agent automatically
- **Context Sharing**: Share information between agents with Ctrl+S
- **Customizable Commands**: Override default commands via environment variables

## Quick Start

```bash
# Navigate to deus directory
cd core/deus

# Install dependencies
pnpm install

# Run the TUI (spawns 'claude' and 'codex' processes)
pnpm dev
```

## Keyboard Shortcuts

- **Tab** - Switch between Claude Code and Codex (UI updates to show active agent)
- **Enter** - Send message to active agent (automatically coordinates with other agent)
- **Ctrl+C** - Exit application
- **Ctrl+S** - Share context between agents
- **Ctrl+K** - Clear active agent messages

## How Coordination Works

When you send a message to one agent (e.g., Claude Code), Deus automatically:
1. Sends your message to the active agent
2. Notifies the other agent (e.g., Codex) with a system message
3. Shares the message context in the orchestrator's shared state
4. When the active agent responds, notifies the other agent about the response

This enables both agents to be aware of what the other is doing, facilitating coordinated work.

## Configuration

Deus uses these commands by default:
- **Claude Code**: `claude`
- **Codex**: `codex`

To override with custom commands, set environment variables:

```bash
# Custom Claude Code command
export CLAUDE_CODE_COMMAND=/path/to/custom-claude
# or
export CLAUDE_COMMAND=/path/to/custom-claude

# Custom Codex command
export CODEX_COMMAND=/path/to/custom-codex
```

## Architecture

- **Ink v6.3.1** - React for building terminal interfaces
- **React 19.1.1** - UI component model
- **Execa** - Process spawning and management
- **Zod** - Runtime type validation
- **TypeScript** - Type safety

## Project Structure

```
core/deus/
├── src/
│   ├── components/      # React components (agent-panel, input-bar, etc.)
│   ├── lib/            # Core logic (orchestrator)
│   ├── types/          # Zod schemas & TypeScript types
│   ├── cli.tsx         # CLI entry point
│   └── index.ts        # Library exports
├── package.json
├── tsconfig.json
└── tsup.config.ts
```

## Documentation

See [SETUP.md](./SETUP.md) for detailed setup instructions, integration status, and development guide.

## Session Management

Deus now includes persistent session management that tracks the progress and state of your orchestration sessions.

### Session Storage

All sessions are stored at:
```
~/.deus/sessions/<session-id>.jsonl
```

Each line is a session event in JSON format using event sourcing:
```jsonl
{"type":"session_created","timestamp":"2025-01-06T...","metadata":{"cwd":"/path"}}
{"type":"agent_linked","timestamp":"2025-01-06T...","agentType":"claude-code","sessionId":"abc123","filePath":"..."}
{"type":"task_added","timestamp":"2025-01-06T...","task":{"id":"xyz","content":"Implement auth"}}
{"type":"context_shared","timestamp":"2025-01-06T...","key":"deployment","value":"production"}
```

### What Gets Tracked

- **Linked Agents**: References to Claude Code and Codex sessions (UUIDs + file paths)
- **Session Status**: `active`, `paused`, `awaiting_input`, or `completed`
- **Tasks**: Structured task list with status tracking
- **Shared Context**: Key-value pairs shared between agents
- **Agent Switches**: History of which agent was active when

**Note**: Individual agent messages are stored in their own files:
- Claude Code: `~/.claude/projects/<project>/<session-id>.jsonl`
- Codex: `~/.codex/sessions/YYYY/MM/DD/rollout-<timestamp>-<session-id>.jsonl`

### Session Resume

When you restart Deus, it automatically loads the most recent session and restores:
- All linked agent sessions
- Task list and status
- Shared context
- Session metadata

## MCP Server

Deus provides a Model Context Protocol (MCP) server that allows Claude Code and Codex to interact with the session directly using MCP tools.

### Starting the MCP Server

The MCP server runs as a separate process and connects via stdio:

```bash
# After building
node ./dist/mcp-server/index.js
```

### MCP Configuration

Add to your `.mcp.json`:

```json
{
  "mcpServers": {
    "deus-session": {
      "command": "node",
      "args": ["./core/deus/dist/mcp-server/index.js"]
    }
  }
}
```

### Available MCP Tools

#### `deus_add_context`
Add a key-value pair to the shared session context.

```typescript
await useMcpTool('deus_add_context', {
  key: 'user-preference',
  value: { theme: 'dark', verbose: true }
})
```

#### `deus_get_session`
Get the current Deus session state including linked agents, tasks, and context.

```typescript
const session = await useMcpTool('deus_get_session')
// Returns: { sessionId, status, linkedAgents, tasks, sharedContext, createdAt, updatedAt, metadata }
```

#### `deus_add_task`
Add a task to the session that all agents can see.

```typescript
await useMcpTool('deus_add_task', {
  content: 'Implement authentication',
  activeForm: 'Implementing authentication'
})
```

#### `deus_update_task`
Update an existing task's status or content.

```typescript
await useMcpTool('deus_update_task', {
  taskId: 'task-id',
  status: 'completed',
  content: 'Updated task description'
})
```

#### `deus_update_status`
Update the Deus session status.

```typescript
await useMcpTool('deus_update_status', {
  status: 'paused' // 'active' | 'paused' | 'awaiting_input' | 'completed'
})
```

#### `deus_list_agents`
List all agent sessions linked to this Deus session.

```typescript
const agents = await useMcpTool('deus_list_agents')
// Returns: [{ agentType: 'claude-code', sessionId: '...', filePath: '...', linkedAt: '...' }]
```

### Use Cases

**Cross-Agent Collaboration**:
```typescript
// Claude Code adds context
await useMcpTool('deus_add_context', {
  key: 'api-design',
  value: { endpoint: '/auth', method: 'POST' }
})

// Codex retrieves it later
const session = await useMcpTool('deus_get_session')
console.log(session.sharedContext['api-design'])
```

**Task Tracking**:
```typescript
// Add task from Claude Code
const taskId = await useMcpTool('deus_add_task', {
  content: 'Deploy to staging',
  activeForm: 'Deploying to staging'
})

// Codex can update it when done
await useMcpTool('deus_update_task', {
  taskId,
  status: 'completed'
})
```

## Event Sourcing Architecture

Deus uses event sourcing for session state management:

1. **Immutable Events**: All state changes are append-only events
2. **State Reconstruction**: Current state is rebuilt by replaying events
3. **Audit Trail**: Complete history of what happened and when
4. **Time Travel**: Can reconstruct state at any point in time

### Session Events

- `session_created` - New session initialized
- `agent_linked` - Agent session linked to Deus
- `agent_unlinked` - Agent session unlinked
- `status_changed` - Session status updated
- `task_added` - New task created
- `task_updated` - Task status/content changed
- `context_shared` - Context key-value added
- `agent_switched` - Active agent changed

## Programmatic Usage

```typescript
import { SessionManager } from '@lightfastai/deus'

// Create or load session
const session = new SessionManager()
await session.initialize()

// Add tasks
await session.addTask('Implement feature', 'Implementing feature')

// Share context
await session.shareContext('deployment-target', 'production')

// Get current state
const state = session.getState()
console.log(state.tasks, state.sharedContext)

// Link agents (usually done automatically)
await session.linkAgent('claude-code', 'session-uuid', '/path/to/session.jsonl')

// Update status
await session.updateStatus('paused')
```

## Inspiration

Based on [sst/opencode](https://github.com/sst/opencode) architecture, adapted to TypeScript/JavaScript ecosystem using Ink instead of Bubble Tea (Go). Extended with persistent session management and MCP integration for agent coordination.

## License

Part of the Lightfast AI project.
