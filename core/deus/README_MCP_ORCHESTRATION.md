# Deus MCP Orchestration System

## Overview

The Deus MCP Orchestration System enables dynamic MCP (Model Context Protocol) configuration injection for Claude Code and Codex agents. This system allows deus to:

1. **Manage Sessions**: Create isolated orchestration sessions with unique IDs
2. **Dynamic MCP Injection**: Inject specific MCP servers based on job requirements
3. **Share Context**: Enable communication between Claude Code and Codex through the `deus-session` MCP
4. **Flexible Configuration**: Read from `.mcp.json` and filter MCPs per session

## Architecture

### Directory Structure

```
.deus/                          # Created in repo root (NOT ~/.deus)
├── config.json                 # Master deus configuration
├── sessions/                   # Active session management
│   ├── <session-id>/          # Per-session directory
│   │   ├── manifest.json      # Session metadata & job config
│   │   ├── claude.json        # Claude Code MCP config (generated)
│   │   ├── codex-flags.txt    # Codex CLI flags (generated)
│   │   └── logs/              # Session logs (future)
│   │       ├── claude.log
│   │       └── codex.log
└── templates/                  # Reusable job templates
    └── default-mcps.json      # Default MCP configurations
```

### Session Data

Session data is stored in `~/.deus/sessions/<session-id>.jsonl` using event sourcing (managed by `session-manager.ts`).

## Configuration Files

### 1. Session Manifest (`.deus/sessions/<session-id>/manifest.json`)

```json
{
  "sessionId": "abc123xyz",
  "jobType": "code-review",
  "createdAt": "2025-10-07T10:30:00Z",
  "status": "active",
  "agents": {
    "claudeCode": {
      "enabled": true,
      "sessionId": "claude-session-123",
      "pid": 12345
    },
    "codex": {
      "enabled": true,
      "sessionId": "codex-session-456",
      "pid": 12346
    }
  },
  "mcpServers": ["deus-session", "playwright"],
  "metadata": {
    "cwd": "/Users/user/project",
    "branch": "feature/xyz"
  }
}
```

### 2. Generated Claude Code Config (`.deus/sessions/<session-id>/claude.json`)

```json
{
  "mcpServers": {
    "deus-session": {
      "command": "node",
      "args": [
        "./core/deus/dist/mcp-server/index.js",
        "--session",
        "abc123xyz"
      ]
    },
    "playwright": {
      "command": "npx",
      "args": ["@playwright/mcp@latest", "--headless"]
    }
  }
}
```

### 3. Generated Codex Flags (`.deus/sessions/<session-id>/codex-flags.txt`)

```bash
-c mcp_servers.deus-session.command="node" \
  -c mcp_servers.deus-session.args=["./core/deus/dist/mcp-server/index.js","--session","abc123xyz"] \
  -c mcp_servers.playwright.command="npx" \
  -c mcp_servers.playwright.args=["@playwright/mcp@latest","--headless"]
```

## Usage

### Programmatic API

```typescript
import { createMCPOrchestrator } from './lib/mcp-orchestrator.js';

// Create a new orchestration session
const orchestrator = await createMCPOrchestrator({
  repoRoot: '/path/to/repo',
  jobType: 'code-review',
  mcpServers: ['deus-session', 'playwright'],
});

// Print session info
orchestrator.printSessionInfo();

// Start agents
await orchestrator.startClaudeCode('Review the authentication code');
await orchestrator.startCodex('Help with testing');

// Get manual commands (for debugging)
console.log('Claude Code command:', orchestrator.getClaudeCodeCommand());
console.log('Codex command:', await orchestrator.getCodexCommand());

// Stop agents when done
await orchestrator.completeSession();
```

### Loading Existing Session

```typescript
import { loadMCPOrchestrator } from './lib/mcp-orchestrator.js';

const orchestrator = await loadMCPOrchestrator('abc123xyz', '/path/to/repo');
orchestrator.printSessionInfo();
```

### Manual Agent Launch

You can also launch agents manually using the generated configs:

**Claude Code:**
```bash
# Get session ID from orchestrator
cd /path/to/repo
claude --session-id abc123xyz \
  --mcp-config .deus/sessions/abc123xyz/claude.json \
  --strict-mcp-config
```

**Codex:**
```bash
# Copy flags from .deus/sessions/<session-id>/codex-flags.txt
codex -c 'mcp_servers.deus-session.command="node"' \
  -c 'mcp_servers.deus-session.args=["./core/deus/dist/mcp-server/index.js","--session","abc123xyz"]' \
  "Review the code"
```

## MCP Server Integration

### Session Argument Support

The `deus-session` MCP server now accepts a `--session` argument:

```bash
node ./core/deus/dist/mcp-server/index.js --session abc123xyz
```

This ensures that Claude Code and Codex share the same session state.

### Available MCP Tools

When using the `deus-session` MCP, both agents have access to:

- `deus_add_context` - Share context between agents
- `deus_get_session` - Get current session state
- `deus_add_task` - Add tasks to shared task list
- `deus_update_task` - Update task status
- `deus_update_status` - Update session status
- `deus_list_agents` - List all linked agents

## Configuration Management

### Reading .mcp.json

The system reads `.mcp.json` from the repo root to discover available MCP servers:

```typescript
import { readMCPConfig } from './lib/deus-config.js';

const mcpConfig = await readMCPConfig('/path/to/repo');
console.log('Available MCPs:', Object.keys(mcpConfig.mcpServers));
```

### Filtering MCPs per Job

When creating a session, specify which MCP servers to include:

```typescript
const orchestrator = await createMCPOrchestrator({
  mcpServers: ['deus-session'], // Only essential MCPs for this job
});
```

The system will:
1. Read `.mcp.json`
2. Filter to only the specified servers
3. Inject `--session <uuid>` for `deus-session`
4. Generate configs for both Claude Code and Codex

## Session Lifecycle

### 1. Create Session

```typescript
const orchestrator = await createMCPOrchestrator({
  jobType: 'refactoring',
  mcpServers: ['deus-session', 'filesystem'],
});
```

This:
- Generates a unique session ID (nanoid)
- Creates `.deus/sessions/<session-id>/` directory
- Generates MCP configs for both agents
- Saves session manifest

### 2. Launch Agents

```typescript
await orchestrator.startClaudeCode('Refactor auth module');
await orchestrator.startCodex();
```

Agents are launched with:
- Claude Code: `--session-id`, `--mcp-config`, `--strict-mcp-config`
- Codex: Multiple `-c` flags for MCP configuration
- Both: `DEUS_SESSION_ID` environment variable

### 3. Share Context

Both agents can use the `deus_add_context` MCP tool:

```
// In Claude Code or Codex
Use deus_add_context to share:
- key: "current-file"
- value: "src/auth/login.ts"
```

### 4. Complete Session

```typescript
await orchestrator.completeSession();
```

This:
- Stops all running agents
- Updates manifest status to "completed"
- Preserves session data for future reference

### 5. Cleanup Old Sessions

```typescript
import { cleanupOldSessions } from './lib/deus-config.js';

await cleanupOldSessions(7); // Remove sessions older than 7 days
```

## Implementation Details

### Key Files

- `src/lib/deus-config.ts` - Session management, config generation
- `src/lib/mcp-orchestrator.ts` - Agent lifecycle orchestration
- `src/lib/session-manager.ts` - Event sourcing for session state
- `src/mcp-server/index.ts` - MCP server with session support

### Session ID Injection

The system automatically injects session IDs:

**For deus-session MCP:**
```json
{
  "command": "node",
  "args": ["./core/deus/dist/mcp-server/index.js", "--session", "<session-id>"]
}
```

**For other MCPs:**
```json
{
  "command": "npx",
  "args": ["@playwright/mcp@latest", "--headless"]
}
```

### Command Line Flag Generation

**Claude Code:**
- Uses `--mcp-config` with a JSON file
- Uses `--strict-mcp-config` to ignore other configs
- Uses `--session-id` for Claude's internal session tracking

**Codex:**
- Uses multiple `-c` flags to override config values
- Format: `-c 'mcp_servers.<name>.command="..."'`
- Values are JSON-parsed by Codex

## Examples

### Example 1: Simple Session

```typescript
import { createMCPOrchestrator } from './lib/mcp-orchestrator.js';

// Create session
const orch = await createMCPOrchestrator({
  mcpServers: ['deus-session'],
});

orch.printSessionInfo();
// Output:
// === Deus MCP Session Info ===
// Session ID: abc123xyz
// Job Type: general
// Status: active
// MCP Servers: deus-session
// ...

// Start Claude Code
await orch.startClaudeCode('Help me debug this code');
```

### Example 2: Multi-MCP Session

```typescript
const orch = await createMCPOrchestrator({
  jobType: 'testing',
  mcpServers: ['deus-session', 'playwright', 'filesystem'],
});

// Start both agents
await orch.startClaudeCode();
await orch.startCodex();

// Later, stop specific agent
await orch.stopAgent('codex');

// Complete when done
await orch.completeSession();
```

### Example 3: Load and Resume

```typescript
import { listActiveSessions, loadMCPOrchestrator } from './lib/deus-config.js';

// List all active sessions
const sessions = await listActiveSessions();
console.log('Active sessions:', sessions.map(s => s.sessionId));

// Load specific session
const orch = await loadMCPOrchestrator(sessions[0].sessionId);
orch.printSessionInfo();
```

## Best Practices

1. **Always use session IDs**: Ensures agents share the same context
2. **Filter MCPs per job**: Only include necessary MCPs to reduce overhead
3. **Use `--strict-mcp-config`**: Prevents conflicts with user's `.mcp.json`
4. **Clean up old sessions**: Run cleanup periodically to save disk space
5. **Check manifest**: Review `.deus/sessions/<id>/manifest.json` to debug issues

## Troubleshooting

### MCP Server Not Starting

Check that the MCP server is built:
```bash
cd core/deus
pnpm build
```

### Session Not Found

List sessions to verify:
```bash
ls -la .deus/sessions/
```

### Agents Not Sharing Context

Verify both agents are using the same session ID:
```bash
cat .deus/sessions/<session-id>/manifest.json
```

### Config Not Loading

Check `.mcp.json` format:
```bash
cat .mcp.json | jq .
```

## Future Enhancements

- [ ] CLI commands for session management (`deus start`, `deus list`, etc.)
- [ ] Job templates with predefined MCP sets
- [ ] Session logs (`claude.log`, `codex.log`)
- [ ] Web UI for session monitoring
- [ ] Automatic session cleanup on completion
- [ ] Session sharing across multiple repos
- [ ] MCP server discovery from registry

## See Also

- [Session Manager Documentation](./src/lib/session-manager.ts)
- [MCP Server Implementation](./src/mcp-server/index.ts)
- [Deus Types](./src/types/index.ts)
