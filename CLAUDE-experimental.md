# Development Guidelines

## Core Rules
- **NO index.ts files** - Always use direct imports
- **Use pnpm** - Not npm or yarn
- **Run tests** - `pnpm typecheck` and `pnpm lint` before commits
- **Biome auto-formats** - Code is formatted on save

## Commands
```bash
pnpm dev          # Start Next.js dev server
pnpm build        # Build Next.js for production
pnpm start        # Start Next.js production server
pnpm typecheck    # TypeScript check
pnpm lint         # Run Biome linter

# Run Next.js dev server in background
pnpm dev > /tmp/nextjs-dev.log 2>&1 &

# Check Next.js dev server logs
cat /tmp/nextjs-dev.log

# Kill background Next.js server
pkill -f "next dev"

# Mastra-specific commands
pnpm dev:mastra   # Start Mastra dev server
pnpm build:mastra # Build Mastra

# Check specific file for errors
pnpm biome check --write [filepath]
```

## Environment Variables
```bash
OPENROUTER_API_KEY=your-key-here
```
See `.env.example` for all required variables.

## Documentation
- **Next.js Best Practices**: @docs/nextjs.md
- **Agent Testing**: @docs/agent-testing.md
- **Memory System**: @docs/memory-system.md
- **Container-Use**: @docs/container-use.md (for isolated development)

## Quick References
- Model: `anthropic/claude-4-sonnet-20250514` via OpenRouter
- Next.js dev server: http://localhost:3000
- Mastra dev server: http://localhost:4111

## Testing Checklist
- [ ] Run `pnpm typecheck`
- [ ] Run `pnpm lint`
- [ ] Verify no console errors

IMPORTANT: When using container-use, always inform user how to view work:
- `container-use log <env_id>`
- `container-use checkout <env_id>`