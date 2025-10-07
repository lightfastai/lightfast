# Deus MCP Orchestration Integration Guide

## Overview

This guide explains how to integrate the new MCP orchestration system with the existing Deus TUI orchestrator.

## Current Architecture

### Before (Existing TUI Orchestrator)

```
src/lib/orchestrator.ts (TUI Orchestrator)
├── Manages PTY spawning for agents
├── Coordinates message passing
├── Tracks agent state in-memory
└── Uses session-manager for persistence

Problem:
- Depends on user's .mcp.json and ~/.codex/config.toml
- Cannot dynamically inject MCPs per job
- No way to control which MCPs are available per session
```

### After (With MCP Orchestration)

```
Two Orchestrators Working Together:

1. MCPOrchestrator (New)
   ├── Creates .deus/ folder structure
   ├── Generates session-specific MCP configs
   ├── Manages session lifecycle
   └── Launches agents with correct configs

2. TUI Orchestrator (Existing)
   ├── Manages PTY spawning
   ├── Coordinates messages
   ├── Provides TUI interface
   └── Uses MCPOrchestrator's session ID
```

## Integration Strategy

### Option 1: Enhanced TUI Orchestrator (Recommended)

Update the existing TUI orchestrator to use MCPOrchestrator internally:

```typescript
// src/lib/orchestrator.ts

import { MCPOrchestrator } from './mcp-orchestrator.js';

export class Orchestrator {
  private state: OrchestrationState;
  private spawners: Map<AgentType, ClaudePtySpawner | CodexPtySpawner | null>;
  private listeners: Set<(state: OrchestrationState) => void>;
  private sessionManager: SessionManager | null;

  // NEW: Add MCP orchestrator
  private mcpOrchestrator: MCPOrchestrator | null = null;

  constructor(sessionManager?: SessionManager, options?: {
    jobType?: string;
    mcpServers?: string[];
  }) {
    this.state = { /* ... */ };
    this.sessionManager = sessionManager;

    // Initialize MCP orchestrator if options provided
    if (options?.mcpServers) {
      this.initializeMCPOrchestration(options);
    }
  }

  private async initializeMCPOrchestration(options: {
    jobType?: string;
    mcpServers?: string[];
  }) {
    this.mcpOrchestrator = new MCPOrchestrator({
      jobType: options.jobType,
      mcpServers: options.mcpServers,
      repoRoot: process.cwd(),
    });

    await this.mcpOrchestrator.initialize();

    console.log('[Orchestrator] MCP orchestration enabled');
    console.log(`[Orchestrator] Session ID: ${this.mcpOrchestrator.getManifest()?.sessionId}`);
  }

  // Update startAgent to use MCP configs
  async startAgent(agentType: AgentType) {
    // If MCP orchestrator is available, get the session ID
    const sessionId = this.mcpOrchestrator?.getManifest()?.sessionId;

    if (sessionId) {
      console.log(`[Orchestrator] Using MCP session: ${sessionId}`);
    }

    // Rest of existing code...
    // PTY spawning remains the same
  }

  // Add helper to get MCP commands
  getMCPCommands(): {
    claudeCode?: string;
    codex?: string;
  } {
    if (!this.mcpOrchestrator) {
      return {};
    }

    return {
      claudeCode: this.mcpOrchestrator.getClaudeCodeCommand(),
      codex: await this.mcpOrchestrator.getCodexCommand(),
    };
  }
}
```

### Option 2: Separate Launch (For Manual Control)

Keep orchestrators separate and use MCPOrchestrator before TUI:

```typescript
// bin/deus.ts (CLI entry point)

import { MCPOrchestrator } from './src/lib/mcp-orchestrator.js';
import { Orchestrator } from './src/lib/orchestrator.js';
import { SessionManager } from './src/lib/session-manager.js';

async function main() {
  // 1. Create MCP orchestration session
  const mcpOrch = new MCPOrchestrator({
    jobType: 'development',
    mcpServers: ['deus-session', 'playwright'],
  });

  await mcpOrch.initialize();
  mcpOrch.printSessionInfo();

  // 2. Create session manager with same session ID
  const sessionManager = new SessionManager(mcpOrch.getManifest()?.sessionId);
  await sessionManager.initialize();

  // 3. Start TUI orchestrator
  const tuiOrch = new Orchestrator(sessionManager);

  // 4. Launch agents (TUI handles PTY, MCP configs are in place)
  await tuiOrch.startAgent('claude-code');
  await tuiOrch.startAgent('codex');

  // 5. Start TUI...
}
```

## Key Changes Needed

### 1. Update `.mcp.json` Location Awareness

The system needs to know where `.mcp.json` is:

```typescript
// Current: Always reads from ~/.mcp.json or project root
// Needed: Read from repo root, respect .deus/ configs

import { readMCPConfig } from './lib/deus-config.js';

// This already handles repo root correctly
const mcpConfig = await readMCPConfig(process.cwd());
```

### 2. Update Agent Launch Commands

**Current (TUI Orchestrator):**
```typescript
const spawner = new ClaudePtySpawner({
  command: 'claude', // No session or MCP config
});
```

**New (With MCP Orchestration):**
```typescript
const sessionId = this.mcpOrchestrator?.getManifest()?.sessionId;
const sessionDir = getSessionDir(sessionId);

const spawner = new ClaudePtySpawner({
  command: `claude --session-id ${sessionId} --mcp-config ${sessionDir}/claude.json --strict-mcp-config`,
});
```

### 3. Environment Variables

Set environment variables for both agents:

```typescript
const env = {
  ...process.env,
  DEUS_SESSION_ID: sessionId,
  DEUS_JOB_TYPE: jobType,
};
```

### 4. Session Lifecycle Coordination

```typescript
class Orchestrator {
  async cleanup() {
    // Stop PTY spawners
    for (const [agentType] of this.spawners) {
      await this.stopAgent(agentType);
    }

    // Complete MCP session
    if (this.mcpOrchestrator) {
      await this.mcpOrchestrator.completeSession();
    }
  }
}
```

## Usage Examples

### Example 1: TUI with MCP Orchestration

```typescript
import { Orchestrator } from './lib/orchestrator.js';
import { SessionManager } from './lib/session-manager.js';

// Create orchestrator with MCP config
const sessionManager = new SessionManager();
await sessionManager.initialize();

const orchestrator = new Orchestrator(sessionManager, {
  jobType: 'code-review',
  mcpServers: ['deus-session', 'playwright'],
});

// Start TUI (agents will use generated MCP configs)
startTUI(orchestrator);
```

### Example 2: Manual MCP Setup + TUI

```typescript
import { createMCPOrchestrator } from './lib/mcp-orchestrator.js';
import { Orchestrator } from './lib/orchestrator.js';

// 1. Setup MCP session first
const mcpOrch = await createMCPOrchestrator({
  mcpServers: ['deus-session'],
});

console.log('Setup complete. Starting TUI...');

// 2. Create TUI orchestrator (can read from .deus/ configs)
const sessionManager = new SessionManager(mcpOrch.getManifest()?.sessionId);
await sessionManager.initialize();

const tuiOrch = new Orchestrator(sessionManager);

// 3. Start TUI
startTUI(tuiOrch);
```

## Migration Path

### Phase 1: Optional MCP Orchestration
- Add MCPOrchestrator as optional dependency
- TUI works with or without it
- Users can manually set up .deus/ or use existing configs

### Phase 2: Default Integration
- TUI automatically creates .deus/ structure
- Default to using deus-session MCP
- User can override with CLI flags

### Phase 3: Full Integration
- All sessions managed through .deus/
- Job templates for common workflows
- Automatic MCP filtering based on job type

## CLI Integration

Add CLI commands to manage MCP sessions:

```bash
# Create new MCP session
deus mcp init --job-type code-review --mcps deus-session,playwright

# List sessions
deus mcp list

# Show session info
deus mcp info <session-id>

# Clean up old sessions
deus mcp cleanup --days 7

# Start TUI with specific session
deus start --session <session-id>
```

## Testing

### Unit Tests

```typescript
import { MCPOrchestrator } from './lib/mcp-orchestrator.js';

describe('MCPOrchestrator', () => {
  it('should create session with correct MCPs', async () => {
    const orch = await createMCPOrchestrator({
      mcpServers: ['deus-session'],
    });

    const manifest = orch.getManifest();
    expect(manifest?.mcpServers).toEqual(['deus-session']);
  });

  it('should inject session ID in deus-session MCP', async () => {
    // Test config generation...
  });
});
```

### Integration Tests

```typescript
describe('TUI + MCP Integration', () => {
  it('should start agents with MCP configs', async () => {
    const sessionManager = new SessionManager();
    await sessionManager.initialize();

    const orchestrator = new Orchestrator(sessionManager, {
      mcpServers: ['deus-session'],
    });

    // Verify configs exist
    const sessionId = orchestrator.getDeusSessionId();
    const configPath = `.deus/sessions/${sessionId}/claude.json`;
    expect(fs.existsSync(configPath)).toBe(true);
  });
});
```

## Rollout Plan

1. **Week 1**: Implement MCPOrchestrator (✅ Complete)
2. **Week 2**: Add integration to TUI Orchestrator
3. **Week 3**: Add CLI commands
4. **Week 4**: Testing and documentation
5. **Week 5**: Release and gather feedback

## Known Issues & Solutions

### Issue 1: Session ID Conflicts

**Problem**: TUI creates session ID, MCP Orchestrator creates another

**Solution**: MCP Orchestrator creates session first, TUI uses same ID

### Issue 2: Config File Locations

**Problem**: Users have existing .mcp.json that conflicts

**Solution**: Use `--strict-mcp-config` to override

### Issue 3: Cleanup Timing

**Problem**: When to clean up .deus/ sessions?

**Solution**:
- Automatic cleanup on completion
- Manual cleanup command
- 7-day retention by default

## Next Steps

1. ✅ Implement core MCP orchestration (Complete)
2. Update TUI orchestrator to use MCPOrchestrator
3. Add CLI commands for session management
4. Write integration tests
5. Update documentation
6. Create migration guide for existing users

## Questions?

See:
- [MCP Orchestration README](./README_MCP_ORCHESTRATION.md)
- [Example Usage](./examples/mcp-orchestration-example.ts)
- [Session Manager](./src/lib/session-manager.ts)
