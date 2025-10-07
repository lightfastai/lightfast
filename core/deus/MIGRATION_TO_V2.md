# Migration to Deus v2.0 - Complete!

## What Changed

Deus has been completely reworked to use the **Simple Mode** architecture:

### Before (v1.0 - Parallel Mode)
- Both Claude Code and Codex started automatically
- Split-screen UI showing both agents
- Manual agent switching with Tab
- User manually coordinates between agents
- Complex mental model

### After (v2.0 - Simple Mode)
- **Deus starts alone** as smart router
- **Single-view UI** showing only active agent
- **Deus decides** which agent to use
- Automatic view switching
- Simple "back" command to return to Deus
- Clean, focused workflow

## Files Updated

### Components (`src/components/`)

| File | Status | Changes |
|------|--------|---------|
| `app.tsx` | ✅ Updated | Now uses SimpleOrchestrator instead of Orchestrator |
| `status-bar.tsx` | ✅ Updated | Shows active agent, session ID, job type |
| `input-bar.tsx` | ✅ Updated | Context-aware prompts, loading state |
| `agent-panel.tsx` | ❌ Removed | No longer needed (single view) |
| `SimpleUI.tsx` | ❌ Removed | Logic moved to app.tsx |

### New Files Created

| File | Purpose |
|------|---------|
| `src/lib/deus-agent.ts` | Smart router with mocked LLM logic |
| `src/lib/simple-orchestrator.ts` | Sequential agent orchestration |
| `src/lib/mcp-orchestrator.ts` | MCP config injection |
| `src/lib/deus-config.ts` | Session and config management |

### Updated Files

| File | Changes |
|------|---------|
| `src/index.ts` | Added exports for v2.0 components |
| `src/cli.tsx` | No changes (still renders `<App />`) |

### Removed Files

- `src/components/agent-panel.tsx` (split screen no longer needed)
- `src/components/SimpleUI.tsx` (merged into app.tsx)
- `src/index-simple.tsx` (not needed, using main entry point)

## How to Use

### Start Deus

```bash
cd core/deus
pnpm build
pnpm dev
# Or: node dist/cli.js
```

### User Flow

```
1. Deus starts → Only Deus running
   🎭 Deus: Welcome! Tell me what you need help with.

2. User: "Review the authentication code"
   → Deus decides to use Claude Code

3. Deus creates MCP session
   → Generates configs with code-review MCPs

4. Deus launches Claude Code
   → UI switches to Claude Code view

5. User works with Claude Code
   🤖 Claude Code: [reviewing code...]

6. User: "back"
   → Claude Code stops
   → UI switches back to Deus

7. Deus: "What's next?"
   → Ready for next task
```

## Architecture

```
SimpleOrchestrator
├── state.activeAgent: 'deus' | 'claude-code' | 'codex'
├── DeusAgent (routing decisions)
├── MCPOrchestrator (config generation)
└── PTY spawners (Claude Code/Codex)
```

### State Management

```typescript
interface OrchestratorState {
  activeAgent: ActiveAgent;        // Only ONE active at a time
  messages: AgentMessage[];        // All messages
  sessionId: string | null;        // Deus session ID
  jobType: string | null;          // Current job type
  mcpServers: string[];            // Active MCP servers
}
```

### Routing Logic (Mocked)

```typescript
// In deus-agent.ts
const ROUTING_PATTERNS = [
  {
    keywords: ['review', 'code review'],
    agent: 'claude-code',
    jobType: 'code-review',
    mcpServers: ['deus-session', 'filesystem'],
  },
  {
    keywords: ['test', 'testing'],
    agent: 'codex',
    jobType: 'testing',
    mcpServers: ['deus-session', 'playwright'],
  },
  // ... more patterns
];
```

## Key Commands

### In Deus Chat

| Command | Action |
|---------|--------|
| Natural language | Deus routes to appropriate agent |
| `start code-review` | Explicitly start code review job |
| `help` | Show available commands |
| `status` | Show current status |

### In Agent Chat (Claude Code or Codex)

| Command | Action |
|---------|--------|
| `back` | Return to Deus |
| `Ctrl+B` | Same as "back" |
| `Ctrl+C` | Exit Deus completely |

## UI Changes

### Status Bar

**Before:**
```
Active: Claude Code | Session: abc123... | Tab to switch
```

**After:**
```
🎭 DEUS v2.0 - Deus Router
Session: abc123...
Ctrl+C exit
```

### Input Bar

**Before:**
```
▶ Claude Code (Tab to switch • Coordinates with Deus)
▸ [your message]
```

**After:**
```
🎭 Deus
▸ Tell me what you need help with...
Ready
```

## Testing

### Build and Run

```bash
cd core/deus
pnpm install
pnpm build
pnpm dev
```

### Test Flow

1. Start Deus
2. Type: "review the code"
3. Deus should start Claude Code
4. UI should switch to Claude Code
5. Type: "back"
6. Should return to Deus

## Backward Compatibility

The old `Orchestrator` is still exported for backward compatibility:

```typescript
// Still works (legacy)
import { Orchestrator } from '@lightfastai/deus';

// New way (v2.0)
import { SimpleOrchestrator } from '@lightfastai/deus';
```

## Next Steps

1. ✅ **Migration Complete** - All components updated
2. 🔜 **Test the UI** - Run `pnpm dev` and test the flow
3. 🔜 **LLM Integration** - Replace mocked routing with actual LLM
4. 🔜 **Job Templates** - Add predefined MCP configurations
5. 🔜 **Enhanced Routing** - Learn from user patterns

## Troubleshooting

### "Cannot find SimpleOrchestrator"

```bash
cd core/deus
pnpm build
```

### "UI doesn't switch"

Check that SimpleOrchestrator is properly subscribed in app.tsx.

### "Agents don't start"

Ensure:
- `.mcp.json` exists in repo root
- `deus-session` MCP is configured
- `claude` and `codex` CLIs are installed

## Documentation

- **[SIMPLE_MODE.md](./SIMPLE_MODE.md)** - Complete v2.0 architecture
- **[QUICKSTART_V2.md](./QUICKSTART_V2.md)** - Quick start guide
- **[README_MCP_ORCHESTRATION.md](./README_MCP_ORCHESTRATION.md)** - MCP details

## Summary

✅ Deus v2.0 is now the default!

- Single CLI entry point (`pnpm dev`)
- Deus as smart router
- Simple, focused UI
- No split screen
- Clean workflow

**Try it:**
```bash
cd core/deus
pnpm dev
```

🎭 Welcome to Deus v2.0!
