# Deus v2.0 - Quick Start Guide

## What is Deus v2.0?

Deus v2.0 is a smart AI orchestrator that routes your development tasks to the right AI agent:

- **Deus** (🎭) - The router that decides which agent to use
- **Claude Code** (🤖) - For code review, debugging, refactoring
- **Codex** (⚡) - For testing, web automation, browser tasks

**Key Difference from v1.0**: You don't manually start agents. **Deus decides for you.**

## Installation & Setup

### 1. Build Deus

```bash
cd core/deus
pnpm install
pnpm build
```

### 2. Ensure Prerequisites

Make sure you have:
- `.mcp.json` in repo root with `deus-session` MCP configured
- `claude` CLI installed and authenticated
- `codex` CLI installed and authenticated (optional)

### 3. Verify .mcp.json

```bash
cat .mcp.json
```

Should include:
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

## Usage

### Start Deus

```bash
cd core/deus
node dist/index-simple.js
```

You'll see:
```
╔══════════════════════════════════════╗
║         Welcome to Deus v2.0         ║
║      AI Orchestrator & Router        ║
╚══════════════════════════════════════╝

I'm Deus - I route your tasks to the right agent.

Tell me what you need help with:
• "Review the authentication code"
• "Help me write tests for the API"
• "start code-review"

Type 'help' for more info.
```

## Example Workflows

### Workflow 1: Code Review

```
🎭 > Review the authentication code in src/auth/

🎭 Deus: I'll start Claude Code to review the code.
[Creating MCP session...]
[Starting Claude Code...]

🤖 Claude Code: I'll review the authentication code...
[Claude Code reviews the code...]

🤖 > back

🎭 Deus: ✓ Task completed. What's next?
```

### Workflow 2: Testing

```
🎭 > Write tests for the API endpoints

🎭 Deus: I'll start Codex to help with testing.
[Creating MCP session...]
[Starting Codex...]

⚡ Codex: I'll help write tests for the API...
[Codex generates tests...]

⚡ > back

🎭 Deus: ✓ Task completed. What's next?
```

### Workflow 3: Multiple Tasks

```
🎭 > start code-review

🎭 Deus: Starting Claude Code for code-review...

🤖 > Review src/auth/login.ts

🤖 Claude Code: [reviews code...]

🤖 > back

🎭 Deus: ✓ Task completed. What's next?

🎭 > Now write tests for what we just reviewed

🎭 Deus: I'll start Codex to help with testing.

⚡ > Generate unit tests for src/auth/login.ts

⚡ Codex: [generates tests...]

⚡ > back

🎭 Deus: ✓ All tasks completed!
```

## Commands

### In Deus Chat

| Command | Description |
|---------|-------------|
| `start code-review` | Explicitly start code review job |
| `start testing` | Explicitly start testing job |
| `help` | Show available commands |
| `status` | Show current status |
| Natural language | "Review the code", "Write tests", etc. |

### In Agent Chat (Claude Code or Codex)

| Command | Description |
|---------|-------------|
| `back` | Return to Deus |
| `Ctrl+B` | Same as "back" |
| `Ctrl+C` | Exit Deus completely |
| Any message | Sent to active agent |

## Routing Patterns

Deus automatically detects your intent and starts the right agent:

| Keywords | Agent | Job Type | MCPs |
|----------|-------|----------|------|
| "review", "check code" | Claude Code | code-review | deus-session, filesystem |
| "test", "testing" | Codex | testing | deus-session, playwright |
| "debug", "fix bug" | Claude Code | debugging | deus-session, filesystem |
| "refactor" | Claude Code | refactoring | deus-session, filesystem |
| "web", "browser" | Codex | web-automation | deus-session, browserbase |
| "document", "docs" | Claude Code | documentation | deus-session, filesystem |

## UI Layout

```
┌─────────────────────────────────────────┐
│ 🎭 Deus                                 │ ← Active agent indicator
│ Session: abc123...                      │ ← Session ID
└─────────────────────────────────────────┘

🎭 Deus: Welcome message                   ← System messages

→ You: Your message                        ← User messages

🎭 Deus: Response                          ← Agent responses

┌─────────────────────────────────────────┐
│ 🎭 Message Deus...                      │ ← Input box
└─────────────────────────────────────────┘

Ctrl+B: Back to Deus • Ctrl+C: Exit       ← Footer with shortcuts
```

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+B` | Return to Deus (from agent) |
| `Ctrl+C` | Exit Deus |
| Type `back` | Return to Deus (alternative) |

## File Structure

After running Deus, you'll see:

```
.deus/
├── sessions/
│   └── <session-id>/
│       ├── manifest.json      # Session metadata
│       ├── claude.json        # Generated Claude Code config
│       └── codex-flags.txt    # Generated Codex flags

~/.deus/
└── sessions/
    └── <session-id>.jsonl     # Session event log
```

## Troubleshooting

### "MCP server not found"

```bash
# Verify .mcp.json exists
cat .mcp.json

# Rebuild Deus
cd core/deus && pnpm build
```

### "claude: command not found"

```bash
# Install Claude Code
npm install -g @anthropic/claude-code

# Or check installation
which claude
```

### "Session creation failed"

```bash
# Check .deus directory
ls -la .deus/

# Clean and retry
rm -rf .deus/
```

### Agent not starting

```bash
# Enable debug mode
DEBUG=1 node dist/index-simple.js
```

## Advanced Usage

### Custom Job Types

```
🎭 > start my-custom-job

🎭 Deus: Starting Claude Code for my-custom-job...
```

Deus will default to Claude Code with basic MCPs.

### Check Session Info

```
🎭 > status

🎭 Deus: === Deus Status ===

Conversation turns: 5
Active: Deus (Router)

Ready to route tasks!
```

### Get Help

```
🎭 > help

🎭 Deus: === Deus Orchestrator ===

TASKS:
• Code review → Starts Claude Code
• Testing → Starts Codex with Playwright
• Debugging → Starts Claude Code
...
```

## What's Next?

After getting comfortable with Deus v2.0:

1. **Customize Routing**: Edit `src/lib/deus-agent.ts` to add your own patterns
2. **Add LLM Routing**: Replace mocked routing with actual LLM calls
3. **Create Job Templates**: Define reusable MCP configurations
4. **Add More MCPs**: Extend `.mcp.json` with additional tools

## Architecture Overview

```
You
 ↓
Deus (Router) ← Decides which agent to use
 ↓
MCP Orchestrator ← Creates session, generates configs
 ↓
Claude Code OR Codex ← Spawned with correct MCPs
 ↓
MCP Server (deus-session) ← Shared context
```

## Comparison: v1.0 vs v2.0

| Feature | v1.0 (Parallel) | v2.0 (Simple) |
|---------|-----------------|---------------|
| **Starting agents** | Manual (user starts both) | Automatic (Deus decides) |
| **Active agents** | Both running | One at a time |
| **UI** | Split screen | Single view |
| **Switching** | Manual tab switch | Automatic |
| **Routing** | User decides | Deus decides |
| **Cognitive load** | High | Low |

## Next Steps

1. **Try it**: `node dist/index-simple.js`
2. **Chat with Deus**: Tell it what you need
3. **Work with agents**: Deus will start the right one
4. **Return to Deus**: Type "back" when done
5. **Repeat**: Let Deus route your next task

## Documentation

- **[SIMPLE_MODE.md](./SIMPLE_MODE.md)** - Complete architecture guide
- **[README_MCP_ORCHESTRATION.md](./README_MCP_ORCHESTRATION.md)** - MCP system details
- **[INTEGRATION_GUIDE.md](./INTEGRATION_GUIDE.md)** - Integration with existing code

## Summary

Deus v2.0 Simple Mode:
- ✅ Deus decides which agent to use
- ✅ Only one agent active at a time
- ✅ Automatic view switching
- ✅ Simple handoff with "back"
- ✅ Clean, focused UX

**Try it now:**
```bash
cd core/deus
node dist/index-simple.js
```

🎭 Welcome to the future of AI orchestration!
