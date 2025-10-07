# Deus Library Architecture

This directory contains the core orchestration logic for Deus, the AI agent coordinator.

## 📁 Directory Structure

```
lib/
├── config/
│   └── deus-config.ts          # Configuration management for .deus sessions
│
├── session/
│   └── session-manager.ts      # Event-sourced session state management
│
├── spawners/
│   ├── base-spawner.ts         # Abstract PTY spawner (shared logic)
│   ├── claude-spawner.ts       # Claude Code PTY spawner
│   └── codex-spawner.ts        # Codex PTY spawner
│
├── sync/
│   ├── claude-sync.ts          # Claude conversation file watching
│   └── codex-sync.ts           # Codex session file watching
│
├── utils/
│   └── headless.ts             # Headless mode for CLI usage
│
├── orchestrator.ts             # Main Orchestrator v2.0 (with Deus router)
├── mcp-orchestrator.ts         # MCP configuration manager
└── router.ts                   # Deus agent (smart routing logic)
```

## 🎯 Main Entry Points

### 1. `Orchestrator` - **MAIN ORCHESTRATOR (v2.0)**

```typescript
import { Orchestrator } from './lib/orchestrator.js';

// Interactive mode (TUI)
const orchestrator = new Orchestrator();
await orchestrator.initialize();
await orchestrator.handleUserMessage('Review the code');

// Headless mode (CLI)
import { runHeadless } from './lib/utils/headless.js';
const result = await runHeadless({ message: 'Review the code' });
```

**Use cases:**
- ✅ Interactive TUI mode
- ✅ Headless CLI mode with smart routing
- ✅ Multi-agent workflows with Deus as coordinator
- ✅ MCP integration and session management
- ✅ Smart routing (Deus decides which agent to use)

**Features:**
- Deus router analyzes user intent and picks the right agent
- Sequential execution (one agent active at a time)
- "back" command to return to Deus (in interactive mode)
- Full session persistence and event sourcing
- Supports both interactive and headless modes

---

### 2. `MCPOrchestrator` - **ADVANCED USE ONLY**

```typescript
import { MCPOrchestrator } from './lib/mcp-orchestrator.js';

const mcp = new MCPOrchestrator({ mcpServers: ['playwright'] });
await mcp.initialize();
await mcp.startClaudeCode();
```

**Use cases:**
- ⚠️ Advanced: Manual MCP session management
- ⚠️ Custom agent spawning with MCP config
- ⚠️ Testing MCP configurations

**Note:** Most users should use `Orchestrator` instead, which handles MCP automatically.

---

## 🏗️ Architecture Components

### Spawners (`spawners/`)

PTY-based agent spawners that run agents in full interactive mode.

- **`BasePtySpawner`** - Abstract base class with shared logic:
  - PTY lifecycle (start, stop, cleanup)
  - Ready state detection
  - Character-by-character typing simulation
  - Session ID detection

- **`ClaudePtySpawner`** - Claude Code spawner:
  - Watches `~/.claude/projects/` for conversation files
  - Parses JSONL conversation format
  - Supports slash commands and tab completion

- **`CodexPtySpawner`** - Codex spawner:
  - Watches `~/.codex/sessions/` for session files
  - Handles cursor position queries
  - Parses session event format

**Shared logic eliminated**: ~400 lines of duplication removed by using abstract base class.

---

### Session Management (`session/`)

Event-sourced session state using JSONL append-only log.

**`SessionManager`** - Manages Deus sessions:
- Stores in `~/.deus/sessions/{id}.jsonl`
- Event types: `session_created`, `agent_linked`, `task_added`, etc.
- Reconstructs state from events (event sourcing pattern)
- Supports session recovery and replay

**Example events:**
```jsonl
{"type":"session_created","timestamp":"2025-10-07T14:00:00Z","metadata":{"cwd":"/path"}}
{"type":"agent_linked","timestamp":"2025-10-07T14:01:00Z","agentType":"claude-code","sessionId":"abc123"}
{"type":"task_added","timestamp":"2025-10-07T14:02:00Z","task":{"id":"t1","content":"Review code"}}
```

---

### Sync Utilities (`sync/`)

File watching utilities for agent conversation/session files.

**`claude-sync.ts`** - Claude Code conversation watching:
- Watches `~/.claude/projects/{encoded-path}/{sessionId}.jsonl`
- Parses message events in real-time
- Extracts user/assistant messages

**`codex-sync.ts`** - Codex session watching:
- Watches `~/.codex/sessions/{year}/{month}/{day}/rollout-*.jsonl`
- Parses session events
- Handles session metadata

---

### Configuration (`config/`)

**`deus-config.ts`** - Configuration and session directory management:
- Creates `.deus/` directory structure
- Manages session manifests
- Generates MCP config files for agents
- Session cleanup and retention

**Directory structure:**
```
.deus/
├── config.json
├── sessions/
│   ├── {session-id}/
│   │   ├── manifest.json
│   │   ├── claude.json      # MCP config for Claude
│   │   └── codex-flags.txt  # MCP flags for Codex
│   └── ...
└── templates/
```

---

### Router (`router.ts`)

**`DeusAgent`** - Smart routing logic (currently pattern-based, future: LLM-powered):

```typescript
const deus = new DeusAgent();
const response = await deus.processMessage('Review the auth code');
// => {
//   response: "I'll start Claude Code to review the code",
//   action: {
//     type: 'start-claude-code',
//     config: { jobType: 'code-review', mcpServers: [] }
//   }
// }
```

**Routing patterns:**
- Code review → Claude Code
- Testing → Codex
- Web automation → Codex + Playwright MCP
- Debugging → Claude Code

**Future:** Replace pattern matching with LLM-based routing for smarter decisions.

---

## 🔄 Flow Diagrams

### Orchestrator Flow (Interactive Mode)

```
User Input
    ↓
Orchestrator.handleUserMessage()
    ↓
Is Deus active? ──Yes──→ DeusAgent.processMessage()
    │                         ↓
    │                    Analyze intent
    │                         ↓
    │                    Return action (start agent)
    │                         ↓
    │                    Create MCP session (if needed)
    │                         ↓
    │                    Start agent PTY
    │                         ↓
    │                    Switch active agent
    │
    No
    ↓
Forward to active agent
    ↓
Agent PTY.write(message)
```

### Orchestrator Flow (Headless Mode)

```
User Code
    ↓
Orchestrator.startAgent(type)
    ↓
Create PTY spawner
    ↓
Start PTY process
    ↓
Watch conversation/session files
    ↓
Orchestrator.sendToAgent(type, message)
    ↓
PTY.write(message)
    ↓
Conversation file updated
    ↓
File watcher detects change
    ↓
Parse message
    ↓
Emit to subscribers
```

---

## 🧪 Testing Strategy

### Unit Tests
- `BasePtySpawner` - Test PTY lifecycle, typing simulation
- `SessionManager` - Test event sourcing, state reconstruction
- `DeusAgent` - Test routing patterns, action generation

### Integration Tests
- `Orchestrator` - Test full workflow with mock agents
- `Orchestrator` - Test headless mode end-to-end
- File watchers - Test conversation/session file parsing

### E2E Tests
- Full Deus TUI flow
- Headless CLI usage
- MCP integration

---

## 📊 Code Metrics

| Module | Lines of Code | Complexity |
|--------|--------------|------------|
| `spawners/` | 515 | Medium |
| `session/` | 444 | Medium |
| `sync/` | 544 | Low |
| `config/` | 368 | Medium |
| `orchestrator.ts` | 539 | High |
| `mcp-orchestrator.ts` | 386 | Medium |
| `router.ts` | 380 | Low |
| **Total** | **~3,176 lines** | |

**Duplication eliminated**: ~400 lines removed by extracting `BasePtySpawner`

---

## 🚀 Future Improvements

### Short-term
- [ ] Add comprehensive unit tests
- [ ] Improve error handling and recovery
- [ ] Add logging and debugging utilities
- [ ] Document MCP server integration

### Medium-term
- [ ] Replace DeusAgent pattern matching with LLM-based routing
- [ ] Add support for parallel agent execution
- [ ] Implement agent state persistence and recovery
- [ ] Add metrics and observability

### Long-term
- [ ] Support for custom agent types
- [ ] Plugin system for routing strategies
- [ ] Distributed orchestration (multi-machine)
- [ ] Web UI for session management

---

## 📚 Related Documentation

- [Deus Specification](../../../../SPEC.md) - Product vision and goals
- [Claude Code](https://claude.com/claude-code) - Agent documentation
- [Codex](https://github.com/anthropics/codex) - Agent documentation
- [MCP Protocol](https://modelcontextprotocol.io) - MCP specification

---

## ❓ FAQ

**Q: Which orchestrator should I use?**
A: Use `Orchestrator` - it supports both interactive TUI mode and headless CLI mode with smart Deus routing. Use `runHeadless()` helper for headless mode.

**Q: How do I add a new agent type?**
A: 1) Create a new PTY spawner extending `BasePtySpawner`, 2) Add to `AgentType` enum, 3) Update routing logic in `DeusAgent`.

**Q: Can I run multiple agents in parallel?**
A: Not currently. Both orchestrators use sequential execution. This is a future enhancement.

**Q: Where are sessions stored?**
A: Deus sessions: `~/.deus/sessions/{id}.jsonl`, Claude: `~/.claude/projects/`, Codex: `~/.codex/sessions/`

**Q: How do I debug PTY issues?**
A: Set `DEBUG=1` environment variable to see PTY output and spawner logs.

---

**Last Updated:** October 7, 2025
**Version:** 2.0
