# Deus MCP System - Complete Summary

## What We Built

A complete MCP (Model Context Protocol) orchestration system that enables deus to:

1. ✅ **Dynamic MCP Injection**: Inject specific MCP configurations per job/session
2. ✅ **Session Management**: Create isolated orchestration sessions with unique IDs
3. ✅ **Config Generation**: Auto-generate configs for both Claude Code and Codex
4. ✅ **Session Sharing**: Enable both agents to share context via `deus-session` MCP
5. ✅ **Flexible Control**: Read from `.mcp.json` and filter MCPs based on job requirements

## Key Components

### 1. **`.deus` Folder Structure** (Repo Root)

```
.deus/
├── config.json                 # Master configuration
├── sessions/                   # Session management
│   └── <session-id>/
│       ├── manifest.json       # Session metadata
│       ├── claude.json         # Generated Claude Code config
│       └── codex-flags.txt     # Generated Codex flags
└── templates/                  # Job templates
    └── default-mcps.json
```

**Key Feature**: Sessions are in repo `.deus/`, but session data (JSONL) is in `~/.deus/sessions/` for persistence.

### 2. **New Files Created**

| File | Purpose |
|------|---------|
| `src/lib/deus-config.ts` | Session creation, config generation, MCP filtering |
| `src/lib/mcp-orchestrator.ts` | Agent lifecycle management with MCP injection |
| `src/mcp-server/index.ts` | Updated to accept `--session <uuid>` argument |
| `README_MCP_ORCHESTRATION.md` | Complete system documentation |
| `INTEGRATION_GUIDE.md` | How to integrate with existing TUI |
| `examples/mcp-orchestration-example.ts` | Usage examples |

### 3. **How It Works**

```
┌─────────────────────────────────────────────────────────┐
│ 1. User: deus start --job code-review                   │
└─────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────┐
│ 2. MCPOrchestrator:                                     │
│    - Creates session ID (nanoid)                        │
│    - Reads .mcp.json                                    │
│    - Filters MCPs for job                               │
│    - Injects --session <uuid> for deus-session          │
│    - Generates .deus/sessions/<uuid>/claude.json        │
│    - Generates .deus/sessions/<uuid>/codex-flags.txt    │
└─────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────┐
│ 3. Launches Agents:                                     │
│                                                          │
│ Claude Code:                                             │
│   claude --session-id <uuid> \                          │
│         --mcp-config .deus/sessions/<uuid>/claude.json \│
│         --strict-mcp-config                             │
│                                                          │
│ Codex:                                                   │
│   codex -c 'mcp_servers.deus-session.command="node"' \  │
│         -c 'mcp_servers.deus-session.args=[...]' \      │
│         [prompt]                                        │
└─────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────┐
│ 4. Both agents connect to same MCP server:              │
│    node ./core/deus/dist/mcp-server/index.js \         │
│         --session <uuid>                                │
│                                                          │
│ 5. Share context via deus_add_context tool              │
└─────────────────────────────────────────────────────────┘
```

## Command Line Research

### Claude Code

```bash
# MCP config injection
--mcp-config <file.json>         # Load MCP servers from JSON
--strict-mcp-config              # Ignore other MCP configs
--session-id <uuid>              # Claude's internal session ID
```

**Format:**
```json
{
  "mcpServers": {
    "server-name": {
      "command": "executable",
      "args": ["arg1", "arg2"],
      "env": { "VAR": "value" }
    }
  }
}
```

### Codex

```bash
# Config injection via -c flags
-c 'key.path.to.setting=value'   # Override TOML config
```

**Format:**
```bash
codex -c 'mcp_servers.deus-session.command="node"' \
      -c 'mcp_servers.deus-session.args=["path/to/mcp.js","--session","abc123"]'
```

Values are JSON-parsed, fallback to string.

## Usage Examples

### Quick Start

```typescript
import { createMCPOrchestrator } from './lib/mcp-orchestrator.js';

// Create session
const orch = await createMCPOrchestrator({
  jobType: 'code-review',
  mcpServers: ['deus-session', 'playwright'],
});

// Print session info
orch.printSessionInfo();

// Start agents
await orch.startClaudeCode('Review auth code');
await orch.startCodex('Write tests');

// Complete when done
await orch.completeSession();
```

### Manual Launch

```bash
# Get session ID from orchestrator
SESSION_ID="abc123xyz"

# Launch Claude Code
claude --session-id $SESSION_ID \
  --mcp-config .deus/sessions/$SESSION_ID/claude.json \
  --strict-mcp-config

# Launch Codex (copy flags from codex-flags.txt)
codex -c 'mcp_servers.deus-session.command="node"' \
  -c 'mcp_servers.deus-session.args=["./core/deus/dist/mcp-server/index.js","--session","'$SESSION_ID'"]'
```

## MCP Server Integration

### Updated `mcp-server/index.ts`

```typescript
// Accepts --session argument
function parseArgs(): { sessionId?: string } {
  const args = process.argv.slice(2);
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--session' && i + 1 < args.length) {
      return { sessionId: args[i + 1] };
    }
  }
  return {};
}

// Usage
const { sessionId } = parseArgs();
const sessionManager = new SessionManager(sessionId);
```

### Available MCP Tools

Both Claude Code and Codex can use:

- `deus_add_context(key, value)` - Share data between agents
- `deus_get_session()` - Get current session state
- `deus_add_task(content, activeForm)` - Add tasks
- `deus_update_task(taskId, updates)` - Update tasks
- `deus_update_status(status)` - Update session status
- `deus_list_agents()` - List linked agents

## Config Generation Flow

### Reading `.mcp.json`

```typescript
import { readMCPConfig } from './lib/deus-config.js';

const mcpConfig = await readMCPConfig('/path/to/repo');
// Returns: { mcpServers: { "deus-session": {...}, "playwright": {...} } }
```

### Filtering for Job

```typescript
const mcpServers = ['deus-session', 'playwright']; // Job-specific

// Filters .mcp.json to only these servers
// Injects --session <uuid> for deus-session
```

### Generated Claude Code Config

```json
{
  "mcpServers": {
    "deus-session": {
      "command": "node",
      "args": [
        "./core/deus/dist/mcp-server/index.js",
        "--session",
        "abc123xyz"  // ← Injected
      ]
    },
    "playwright": {
      "command": "npx",
      "args": ["@playwright/mcp@latest", "--headless"]
    }
  }
}
```

### Generated Codex Flags

```bash
-c mcp_servers.deus-session.command="node" \
-c mcp_servers.deus-session.args=["./core/deus/dist/mcp-server/index.js","--session","abc123xyz"] \
-c mcp_servers.playwright.command="npx" \
-c mcp_servers.playwright.args=["@playwright/mcp@latest","--headless"]
```

## Session Lifecycle

```
1. Create
   ↓
2. Generate Configs
   ↓
3. Launch Agents
   ↓
4. Agents Share Context
   ↓
5. Complete Session
   ↓
6. Cleanup (after 7 days)
```

## Integration with Existing TUI

### Option 1: Enhanced TUI (Recommended)

```typescript
// Add to existing orchestrator.ts
class Orchestrator {
  private mcpOrchestrator: MCPOrchestrator | null = null;

  constructor(sessionManager?: SessionManager, options?: {
    mcpServers?: string[];
  }) {
    // Existing code...

    if (options?.mcpServers) {
      this.mcpOrchestrator = new MCPOrchestrator(options);
      await this.mcpOrchestrator.initialize();
    }
  }

  async startAgent(agentType: AgentType) {
    const sessionId = this.mcpOrchestrator?.getManifest()?.sessionId;

    // Use session-specific command
    const command = sessionId
      ? `claude --session-id ${sessionId} --mcp-config ...`
      : 'claude'; // fallback

    // Rest of PTY spawning...
  }
}
```

### Option 2: Separate (Manual Control)

```typescript
// Setup MCP first
const mcpOrch = await createMCPOrchestrator({
  mcpServers: ['deus-session'],
});

// Then start TUI
const sessionManager = new SessionManager(mcpOrch.getManifest()?.sessionId);
const tuiOrch = new Orchestrator(sessionManager);

startTUI(tuiOrch);
```

## Key Features

### 1. Session Isolation

Each deus instance gets a unique session ID, ensuring:
- No conflicts between concurrent sessions
- Clean separation of context
- Easy debugging and logging

### 2. MCP Filtering

Only inject MCPs needed for the job:
```typescript
// Code review job
mcpServers: ['deus-session', 'filesystem']

// Testing job
mcpServers: ['deus-session', 'playwright', 'browserbase']
```

### 3. Config Independence

`--strict-mcp-config` ensures agents use ONLY the generated configs, not user's `.mcp.json`.

### 4. Automatic Session ID Injection

System automatically adds `--session <uuid>` to deus-session MCP, ensuring both agents connect to same session.

## File Locations

### Repo `.deus/` (Version Controlled?)

```
.deus/
├── config.json          # Can be version controlled
├── sessions/            # Should be in .gitignore
└── templates/           # Can be version controlled
```

### User `~/.deus/` (Persistent Data)

```
~/.deus/
└── sessions/
    └── <session-id>.jsonl  # Event sourcing data
```

## Testing

### Build MCP Server

```bash
cd core/deus
pnpm build
```

### Test Config Generation

```bash
cd core/deus
node -r esbuild-register examples/mcp-orchestration-example.ts
```

### Verify Configs

```bash
# List sessions
ls -la .deus/sessions/

# Check manifest
cat .deus/sessions/<session-id>/manifest.json | jq

# Check Claude config
cat .deus/sessions/<session-id>/claude.json | jq

# Check Codex flags
cat .deus/sessions/<session-id>/codex-flags.txt
```

### Test MCP Server

```bash
# Test with session ID
node ./core/deus/dist/mcp-server/index.js --session test123

# Should output:
# [Deus MCP] Using session ID from command line: test123
# [Deus MCP] Session initialized: test123
```

## Next Steps

1. **Build the system**:
   ```bash
   cd core/deus
   pnpm build
   ```

2. **Test config generation**:
   ```bash
   node -r esbuild-register examples/mcp-orchestration-example.ts
   ```

3. **Integrate with TUI**:
   - Update `src/lib/orchestrator.ts` to use `MCPOrchestrator`
   - Add CLI commands for session management

4. **Add to CLI**:
   ```bash
   deus mcp init --mcps deus-session,playwright
   deus mcp list
   deus start --session <id>
   ```

## Documentation

- **[README_MCP_ORCHESTRATION.md](./README_MCP_ORCHESTRATION.md)**: Complete system documentation
- **[INTEGRATION_GUIDE.md](./INTEGRATION_GUIDE.md)**: How to integrate with TUI
- **[examples/mcp-orchestration-example.ts](./examples/mcp-orchestration-example.ts)**: Usage examples

## Benefits

1. **Job-Specific MCPs**: Only load MCPs needed for the task
2. **Session Isolation**: Multiple deus instances don't conflict
3. **Shared Context**: Claude Code and Codex communicate seamlessly
4. **Debugging**: Easy to trace session state and configs
5. **Flexibility**: Works with existing TUI or standalone
6. **Security**: `--strict-mcp-config` prevents config pollution

## Architecture Decision Records

### ADR 1: `.deus` in Repo Root

**Decision**: Put `.deus/` in repo root, not home directory

**Rationale**:
- Per-repo configuration
- Can version control templates
- Easy to find and debug

### ADR 2: Separate Session Data

**Decision**: Session data (JSONL) in `~/.deus/sessions/`, configs in repo `.deus/`

**Rationale**:
- Session data persistent across repos
- Configs are repo-specific
- Clean separation of concerns

### ADR 3: Two Orchestrators

**Decision**: Keep TUI orchestrator separate from MCP orchestrator

**Rationale**:
- TUI handles PTY spawning and UI
- MCP handles config generation and injection
- Clean separation, easier to test
- Can use MCPOrchestrator standalone

### ADR 4: Session ID in Arguments

**Decision**: Pass session ID via CLI arguments, not env vars

**Rationale**:
- Explicit and traceable
- Works with both Claude Code and Codex
- Easy to verify in process list

## Summary

You now have a complete MCP orchestration system that:

✅ Creates `.deus/` folder structure in repo root
✅ Reads `.mcp.json` to discover available MCPs
✅ Filters MCPs based on job requirements
✅ Generates session-specific configs for Claude Code and Codex
✅ Injects `--session <uuid>` for deus-session MCP
✅ Launches agents with correct CLI arguments
✅ Enables context sharing between agents
✅ Manages session lifecycle (create, run, complete, cleanup)

Ready to integrate with your TUI and test! 🚀
