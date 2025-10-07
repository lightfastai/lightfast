# Deus MCP System - Quick Reference

## 🚀 Quick Start

```typescript
import { createMCPOrchestrator } from './lib/mcp-orchestrator.js';

// 1. Create session with specific MCPs
const orch = await createMCPOrchestrator({
  jobType: 'code-review',
  mcpServers: ['deus-session', 'playwright'],
});

// 2. Print info
orch.printSessionInfo();

// 3. Start agents
await orch.startClaudeCode('Review auth code');
await orch.startCodex('Write tests');

// 4. Complete
await orch.completeSession();
```

## 📁 File Structure

```
.deus/                              # Repo root
├── sessions/<session-id>/
│   ├── manifest.json              # Session metadata
│   ├── claude.json                # Generated Claude config
│   └── codex-flags.txt            # Generated Codex flags
└── templates/
    └── default-mcps.json

~/.deus/sessions/                   # User home
└── <session-id>.jsonl             # Session event log
```

## 🛠️ API Reference

### Create Session

```typescript
import { createMCPOrchestrator } from './lib/mcp-orchestrator.js';

const orch = await createMCPOrchestrator({
  repoRoot: '/path/to/repo',      // Optional, defaults to cwd
  jobType: 'testing',              // Optional, defaults to 'general'
  mcpServers: ['deus-session'],    // Required MCPs
});
```

### Load Existing Session

```typescript
import { loadMCPOrchestrator } from './lib/mcp-orchestrator.js';

const orch = await loadMCPOrchestrator('session-id', '/path/to/repo');
```

### List Active Sessions

```typescript
import { listActiveSessions } from './lib/deus-config.js';

const sessions = await listActiveSessions('/path/to/repo');
sessions.forEach(s => console.log(s.sessionId, s.jobType));
```

### Start Agents

```typescript
// Claude Code
await orch.startClaudeCode('optional prompt');

// Codex
await orch.startCodex('optional prompt');
```

### Get Manual Commands

```typescript
// For debugging or manual launch
const claudeCmd = orch.getClaudeCodeCommand();
const codexCmd = await orch.getCodexCommand();

console.log('Claude:', claudeCmd);
console.log('Codex:', codexCmd);
```

### Stop Agents

```typescript
// Stop specific agent
await orch.stopAgent('claude-code');
await orch.stopAgent('codex');

// Stop all
await orch.stopAllAgents();
```

### Complete Session

```typescript
// Stops all agents and marks session as completed
await orch.completeSession();
```

## 🔧 Configuration Functions

### Read MCP Config

```typescript
import { readMCPConfig } from './lib/deus-config.js';

const mcpConfig = await readMCPConfig('/path/to/repo');
console.log('Available MCPs:', Object.keys(mcpConfig.mcpServers));
```

### Generate Configs

```typescript
import {
  generateClaudeMCPConfig,
  generateCodexConfigFlags
} from './lib/deus-config.js';

// Claude Code
const claudeConfig = await generateClaudeMCPConfig(
  'session-id',
  ['deus-session', 'playwright'],
  '/path/to/repo'
);

// Codex
const codexFlags = await generateCodexConfigFlags(
  'session-id',
  ['deus-session', 'playwright'],
  '/path/to/repo'
);
```

### Session Management

```typescript
import {
  createSession,
  loadSessionManifest,
  saveSessionManifest,
  cleanupOldSessions,
} from './lib/deus-config.js';

// Create
const manifest = await createSession({
  jobType: 'refactoring',
  mcpServers: ['deus-session'],
  repoRoot: '/path/to/repo',
});

// Load
const loaded = await loadSessionManifest('session-id', '/path/to/repo');

// Save
await saveSessionManifest(manifest, '/path/to/repo');

// Cleanup
await cleanupOldSessions(7, '/path/to/repo'); // 7 days retention
```

## 📝 MCP Tools Available

When using `deus-session` MCP, agents can call:

```typescript
// Add shared context
deus_add_context({
  key: "current-file",
  value: "src/auth/login.ts"
});

// Get session state
const state = deus_get_session();

// Add task
const taskId = deus_add_task({
  content: "Implement authentication",
  activeForm: "Implementing authentication"
});

// Update task
deus_update_task({
  taskId: "task-123",
  status: "completed"
});

// Update session status
deus_update_status({
  status: "awaiting_input"
});

// List linked agents
const agents = deus_list_agents();
```

## 🎯 Common Patterns

### Pattern 1: Simple Session

```typescript
const orch = await createMCPOrchestrator({
  mcpServers: ['deus-session'],
});

await orch.startClaudeCode('Help me debug');
```

### Pattern 2: Multi-MCP Session

```typescript
const orch = await createMCPOrchestrator({
  jobType: 'testing',
  mcpServers: ['deus-session', 'playwright', 'browserbase'],
});

await orch.startClaudeCode();
await orch.startCodex();
```

### Pattern 3: Resume Session

```typescript
const sessions = await listActiveSessions();
const orch = await loadMCPOrchestrator(sessions[0].sessionId);

orch.printSessionInfo();
```

### Pattern 4: Manual Launch

```bash
# Get session from orchestrator
SESSION_ID=$(cat .deus/sessions/*/manifest.json | jq -r .sessionId | head -1)

# Launch manually
claude --session-id $SESSION_ID \
  --mcp-config .deus/sessions/$SESSION_ID/claude.json \
  --strict-mcp-config
```

## 🔍 Debugging

### Check Session Files

```bash
# List sessions
ls -la .deus/sessions/

# View manifest
cat .deus/sessions/<session-id>/manifest.json | jq

# View Claude config
cat .deus/sessions/<session-id>/claude.json | jq

# View Codex flags
cat .deus/sessions/<session-id>/codex-flags.txt

# View session events
cat ~/.deus/sessions/<session-id>.jsonl
```

### Test MCP Server

```bash
# Build first
cd core/deus && pnpm build

# Test with session
node ./dist/mcp-server/index.js --session test-123
```

### Verify MCP Config

```bash
# Check .mcp.json exists
cat .mcp.json | jq

# Verify deus-session is configured
cat .mcp.json | jq '.mcpServers["deus-session"]'
```

## ⚠️ Common Issues

### Issue: "Session not found"

```typescript
// Check if session exists
const sessions = await listActiveSessions();
console.log('Available sessions:', sessions.map(s => s.sessionId));
```

### Issue: "MCP server not found in .mcp.json"

```typescript
// Read MCP config to see what's available
const config = await readMCPConfig();
console.log('Available MCPs:', Object.keys(config.mcpServers));
```

### Issue: "No .deus directory"

```typescript
// Initialize .deus structure
import { initializeDeusDirectory } from './lib/deus-config.js';
await initializeDeusDirectory('/path/to/repo');
```

## 📊 Session Lifecycle

```
┌─────────────┐
│   Create    │  await createMCPOrchestrator()
└─────┬───────┘
      │
      ▼
┌─────────────┐
│  Generate   │  Configs auto-generated
│   Configs   │  (.deus/sessions/<id>/)
└─────┬───────┘
      │
      ▼
┌─────────────┐
│   Launch    │  await orch.startClaudeCode()
│   Agents    │  await orch.startCodex()
└─────┬───────┘
      │
      ▼
┌─────────────┐
│    Work     │  Agents use MCP tools
│             │  Share context
└─────┬───────┘
      │
      ▼
┌─────────────┐
│  Complete   │  await orch.completeSession()
└─────┬───────┘
      │
      ▼
┌─────────────┐
│   Cleanup   │  await cleanupOldSessions(7)
│ (after 7d)  │
└─────────────┘
```

## 🎨 Generated Config Examples

### Claude Code Config

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
    }
  }
}
```

### Codex Flags

```bash
-c mcp_servers.deus-session.command="node" \
-c mcp_servers.deus-session.args=["./core/deus/dist/mcp-server/index.js","--session","abc123xyz"]
```

## 🚦 Status Codes

### Session Status

- `active` - Session is running
- `paused` - Session is paused
- `awaiting_input` - Waiting for user input
- `completed` - Session finished

### Agent Status

- `enabled: true` - Agent is configured
- `pid: 12345` - Agent is running with PID

## 📚 Documentation

- **[MCP_SYSTEM_SUMMARY.md](./MCP_SYSTEM_SUMMARY.md)** - Complete overview
- **[README_MCP_ORCHESTRATION.md](./README_MCP_ORCHESTRATION.md)** - Full documentation
- **[INTEGRATION_GUIDE.md](./INTEGRATION_GUIDE.md)** - TUI integration
- **[examples/mcp-orchestration-example.ts](./examples/mcp-orchestration-example.ts)** - Examples

## 🔗 Quick Links

```bash
# Build
cd core/deus && pnpm build

# Test
node -r esbuild-register examples/mcp-orchestration-example.ts

# Clean sessions
rm -rf .deus/sessions/*
rm -rf ~/.deus/sessions/*
```

## 💡 Tips

1. **Always build first**: `cd core/deus && pnpm build`
2. **Use session IDs**: Don't rely on "latest" - use specific IDs
3. **Filter MCPs**: Only include MCPs you need for better performance
4. **Use --strict-mcp-config**: Prevents config conflicts
5. **Clean up regularly**: Run `cleanupOldSessions(7)` periodically

## ✅ Checklist

Before using the system:

- [ ] Built deus MCP server (`cd core/deus && pnpm build`)
- [ ] Have `.mcp.json` in repo root
- [ ] `deus-session` MCP configured in `.mcp.json`
- [ ] Understand session lifecycle
- [ ] Know how to debug sessions

Ready to orchestrate! 🎭
