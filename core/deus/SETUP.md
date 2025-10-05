# Deus Setup & Usage

## Current Status

✅ **Completed:**
- TypeScript + Ink v6 TUI project structure
- React 19.1.1 compatibility
- Dual-panel layout components (agent-panel, input-bar, status-bar)
- Orchestrator logic for managing both agents
- Type-safe state management with Zod
- Complete component hierarchy
- Custom components using Ink's built-in primitives
- **Real agent process integration with stdin/stdout communication**
- **Process lifecycle management (start, stop, cleanup)**
- **Configurable agent commands via environment variables**

✅ **Working TUI:**
- Ink v6.3.1 + React 19.1.1 fully functional
- Removed external component dependencies (ink-spinner, ink-text-input)
- Built custom Spinner and TextInput using Ink's primitives
- Status bar, dual agent panels, and input bar all rendering correctly
- **Spawns real agent processes by default (`claude` and `codex` commands)**

## Project Structure

```
core/deus/
├── src/
│   ├── components/
│   │   ├── App.tsx           # Main application with dual panels
│   │   ├── AgentPanel.tsx    # Individual agent display
│   │   ├── InputBar.tsx      # Shared input component
│   │   └── StatusBar.tsx     # Status display
│   ├── lib/
│   │   └── orchestrator.ts   # Core orchestration logic
│   ├── types/
│   │   └── index.ts          # Zod schemas & TypeScript types
│   ├── cli.tsx               # CLI entry point
│   └── index.ts              # Library exports
├── package.json
├── tsconfig.json
└── tsup.config.ts
```

## Features Implemented

### 1. Dual-Panel Layout
- Split-screen design showing Claude Code and Codex side-by-side
- Active agent highlighting with double border (╔══╗) and inverse header
- Color-coded borders: cyan for active, gray for inactive, green/red/yellow for status
- Real-time status indicators (running/idle/error/waiting)
- Message history per agent (last 5 messages visible)
- System messages show coordination between agents

### 2. Keyboard Controls
- **Tab** - Switch between Claude Code and Codex (UI shows active agent with double border)
- **Ctrl+C** - Exit application
- **Ctrl+S** - Share context between agents
- **Ctrl+K** - Clear active agent messages
- **Enter** - Send message to active agent (coordinates with other agent)

### 3. Orchestrator
- Centralized state management
- Message routing between agents
- **Agent coordination**: Messages to one agent automatically notify the other
- Shared context management with automatic context sharing
- Process lifecycle management
- Event-driven updates with subscription model

### 4. Type Safety
- Zod schemas for runtime validation
- Full TypeScript types
- Type-safe message passing
- Validated agent states

## Running Deus

```bash
# From root directory
cd core/deus

# Install dependencies (already done if you ran pnpm install from root)
pnpm install

# Run the TUI (spawns 'claude' and 'codex' processes)
pnpm dev
```

The TUI will display:
- **Status Bar**: Shows current status, message counts, and shared context
- **Agent Panels**: Side-by-side view of Claude Code and Codex with status indicators
- **Input Bar**: Active agent selector and text input with keyboard shortcuts

### Agent Configuration

Deus spawns real agent processes by default:
- **Claude Code**: Uses `claude` command
- **Codex**: Uses `codex` command

To override with custom commands, set environment variables:

```bash
# Custom Claude Code command
export CLAUDE_CODE_COMMAND=/path/to/custom-claude
# or
export CLAUDE_COMMAND=/path/to/custom-claude

# Custom Codex command
export CODEX_COMMAND=/path/to/custom-codex

# Run Deus
pnpm dev
```

**Note:** The TUI requires an interactive terminal. If you see "Raw mode is not supported" error, ensure you're running in a proper terminal (not in background or redirected stdin).

## Integration Status

✅ **Phase 1 - Real Agent Processes** (Complete)
   - Spawn actual Claude Code and Codex processes via environment variables
   - Capture stdout/stderr for message display
   - Bidirectional communication via stdin/stdout
   - Process lifecycle management (start, stop, cleanup)

⏳ **Phase 2 - Lightfast Orchestration Engine** (Next)
   - Resource scheduling (sandboxes, API quotas)
   - State machine workflows
   - Human-in-the-loop controls

⏳ **Phase 3 - Context Sharing** (Planned)
   - File-level context exchange
   - Variable/state synchronization
   - Conversation branching

## Development

```bash
# Install dependencies (when React versions align)
pnpm install

# Run in dev mode
pnpm dev

# Build for production
pnpm build

# Type check
pnpm typecheck

# Lint
pnpm lint
```

## Next Steps

1. ~~**Immediate:** Resolve React version conflict~~ ✅ Complete (Ink v6.3.1 + React 19.1.1)
2. ~~**Phase 1:** Real process integration (Claude Code/Codex)~~ ✅ Complete
3. **Phase 2:** Context sharing implementation (In Progress)
4. **Phase 3:** Lightfast orchestration integration
5. **Phase 4:** Advanced features (session persistence, replay, metrics)

## Technologies Used

- **Ink** - React for CLIs
- **TypeScript** - Type safety
- **Zod** - Runtime validation
- **Execa** - Process management
- **Chalk** - Terminal colors
- **React** - Component model

## Architecture Inspiration

Based on [sst/opencode](https://github.com/sst/opencode) which uses:
- Bubble Tea (Go) for TUI
- Lip Gloss for styling
- Client-server architecture
- Event streaming (SSE)

Deus adapts this to TypeScript/JavaScript ecosystem using Ink.
