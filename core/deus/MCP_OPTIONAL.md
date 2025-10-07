# MCP Configuration is Optional

## Overview

Deus v2.0 gracefully handles missing `.mcp.json` files. The system will work perfectly fine without MCP configuration - agents will simply start without MCP servers.

## How it Works

### Without .mcp.json

```bash
# No .mcp.json in repo
cd /path/to/project
deus

# Deus starts normally
🎭 Deus: Welcome! Tell me what you need help with.

# User: "review the code"
🎭 Deus: I'll start Claude Code to review the code.
[Starting Claude Code...]

# Claude Code starts with basic command
# Command: claude
🤖 Claude Code: [ready to help]
```

### With .mcp.json

```bash
# .mcp.json exists with deus-session
cd /path/to/project
deus

# Same flow, but with MCP injection
🎭 Deus: I'll start Claude Code to review the code.
[Creating MCP session...]
[Starting Claude Code...]

# Claude Code starts with MCP config
# Command: claude --session-id abc123 --mcp-config .deus/sessions/abc123/claude.json
🤖 Claude Code: [ready with MCP tools]
```

## Implementation Details

### Graceful Fallbacks

**1. `readMCPConfig()` - Returns empty config**
```typescript
// If .mcp.json not found
return { mcpServers: {} };  // Empty, not null
```

**2. `generateClaudeMCPConfig()` - Skips missing servers**
```typescript
for (const serverName of mcpServers) {
  const serverConfig = mcpConfig.mcpServers[serverName];

  if (!serverConfig) {
    console.log('Skipping missing MCP server:', serverName);
    continue; // Gracefully skip
  }

  // Add server...
}
```

**3. `SimpleOrchestrator` - Starts agents without MCPs**
```typescript
// Only create MCP session if MCPs are requested
if (action.config.mcpServers.length > 0) {
  // Create MCP orchestrator...
} else {
  // Start agent directly without MCP config
  command = 'claude';  // Basic command, no --mcp-config
}
```

### Routing Patterns Without MCPs

Updated routing patterns don't require MCPs by default:

```typescript
const ROUTING_PATTERNS = [
  {
    keywords: ['review', 'code review'],
    agent: 'claude-code',
    mcpServers: [], // No MCPs needed!
  },
  {
    keywords: ['test', 'testing'],
    agent: 'codex',
    mcpServers: [], // No MCPs needed!
  },
  // ... more patterns
];
```

## Scenarios

### Scenario 1: Fresh Project (No .mcp.json)

```bash
# User starts Deus in a new project
deus

# ✅ Works perfectly
# - No errors
# - Agents start normally
# - Full functionality without MCPs
```

### Scenario 2: Partial .mcp.json

```json
// Only has playwright, missing deus-session
{
  "mcpServers": {
    "playwright": {
      "command": "npx",
      "args": ["@playwright/mcp@latest"]
    }
  }
}
```

```bash
# User: "review code"
# Deus requests: ['deus-session']
# ✅ Gracefully skips deus-session (not found)
# ✅ Starts Claude Code without it
```

### Scenario 3: Complete .mcp.json

```json
{
  "mcpServers": {
    "deus-session": {
      "command": "node",
      "args": ["./core/deus/dist/mcp-server/index.js"]
    },
    "playwright": {
      "command": "npx",
      "args": ["@playwright/mcp@latest"]
    }
  }
}
```

```bash
# User: "review code"
# ✅ Creates MCP session
# ✅ Injects deus-session with session ID
# ✅ Starts Claude Code with full MCP support
```

## Benefits

1. **No Setup Required** - Works out of the box
2. **Progressive Enhancement** - Add MCPs when needed
3. **No Error Messages** - Graceful degradation
4. **Flexible** - Use MCPs in some projects, not others

## When to Use .mcp.json

**.mcp.json is useful when you want:**

- **Shared Context** - `deus-session` MCP for agent communication
- **Browser Automation** - `playwright` or `browserbase` MCPs
- **Tool Integration** - Any other MCP servers

**.mcp.json is NOT required for:**

- Basic code review
- General conversations
- Testing without browser automation
- Documentation tasks

## Example Configurations

### Minimal (No MCPs)

```bash
# No .mcp.json file needed!
deus
```

### Basic (Deus Session Only)

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

### Full (All Tools)

```json
{
  "mcpServers": {
    "deus-session": {
      "command": "node",
      "args": ["./core/deus/dist/mcp-server/index.js"]
    },
    "playwright": {
      "command": "npx",
      "args": ["@playwright/mcp@latest", "--headless"]
    },
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/path/to/allowed"]
    }
  }
}
```

## Debug Mode

To see what's happening with MCP config:

```bash
DEBUG=1 deus

# Output:
# [deus-config] No .mcp.json found, using empty MCP config
# [SimpleOrchestrator] Starting agent without MCP configuration
# [Claude Code PTY] Starting with command: claude
```

## Summary

✅ **No .mcp.json?** No problem!
✅ **Missing MCP servers?** Gracefully skipped!
✅ **Want MCP features?** Add .mcp.json when ready!

Deus v2.0 works great with or without MCP configuration.
