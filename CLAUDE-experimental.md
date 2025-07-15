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