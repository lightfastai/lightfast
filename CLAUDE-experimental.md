# Development Guidelines

## Core Rules
- **NO index.ts files** - Always use direct imports
- **Use pnpm** - Not npm or yarn
- **Run tests** - `pnpm typecheck` and `pnpm lint` before commits
- **Biome auto-formats** - Code is formatted on save via `@biomejs/biome`

## Commands
```bash
pnpm dev          # Start dev server
pnpm build        # Build for production
pnpm typecheck    # TypeScript check
pnpm lint         # Run Biome linter

# Check specific file for errors
pnpm biome check --write [filepath]
```

## Testing

### Playwright MCP Setup
```bash
# Configured in .mcp.json with headless mode
# No manual startup needed - auto-starts with Claude Code
```

### Agent Testing (Playwright MCP)
```
1. Navigate: mcp__playwright-mastra__browser_navigate → http://localhost:4111/agents/[agentName]
2. Input: mcp__playwright-mastra__browser_type → enter test message
3. Send: mcp__playwright-mastra__browser_click → Send button
4. Close: mcp__playwright-mastra__browser_close (always)
```

### Self-Healing Workflow
**When creating/debugging agents:**
• Navigate directly to `localhost:4111/agents/[agentName]`
• Test with sample inputs → observe failures
• **Common Issues & Fixes:**
  - Missing tools property → Add `tools: { toolName: toolObject }`
  - Wrong tool format → Use `createTool({ id, execute: async ({ context }) => ... })`
  - maxSteps timeout → Check tool registration first, not limits
  - Tool parameter mismatch → Use `{ context }` destructuring
• Re-test → iterate until working
• Commit fixes

## Container-Use Workflow

### Isolated Development Environments
Container-use provides isolated environments for working on different features/branches:

**When to use:**
- Working on experimental features
- Testing breaking changes
- Parallel development on multiple features
- Keeping main branch clean

**How it works:**
- Each task gets its own container + git worktree
- Complete isolation from main codebase
- Easy to review/merge or discard changes

**Usage:**
1. Request isolated environment: "Work on this in an isolated environment"
2. Container-use automatically creates:
   - New git worktree branch
   - Isolated container with full dev setup
   - Independent workspace
3. Complete work normally
4. Changes stay in branch until explicitly merged

### Environment Variables
**Setting up env vars for container-use:**
```bash
# Option 1: Manual setup (using .env.example as guide)
container-use config env set NODE_ENV development
container-use config env set MASTRA_BASE_URL http://localhost:4111
container-use config env set DATABASE_URL "your-connection-string"

# Option 2: Import from existing .env file
# Run the container-use-env-setup.sh script from container branch

# List configured variables
container-use config env list

# Make config persistent (includes env vars)
container-use config import <environment-id>
```

**Note:** Sensitive values (API keys, tokens) should be set manually using `container-use config env set` to avoid committing secrets.ALWAYS use ONLY Environments for ANY and ALL file, code, or shell operations—NO EXCEPTIONS—even for simple or generic requests.

DO NOT install or use the git cli with the environment_run_cmd tool. All environment tools will handle git operations for you. Changing ".git" yourself will compromise the integrity of your environment.

You MUST inform the user how to view your work using `container-use log <env_id>` AND `container-use checkout <env_id>`. Failure to do this will make your work inaccessible to others.
