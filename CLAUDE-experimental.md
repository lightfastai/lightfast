# Development Guidelines

## Monorepo Structure
- **apps/web** - Next.js application
- **packages/ai** - AI agents, tools, and workflows (@lightfast/ai)
- **packages/types** - Shared TypeScript types (@lightfast/types)
- **packages/evals** - Evaluation framework with Braintrust (@lightfast/evals)

## Core Rules
- **NO index.ts files** - Always use direct imports
- **Use pnpm** - Not npm or yarn
- **Run tests** - `pnpm typecheck` and `pnpm lint` before commits
- **Biome auto-formats** - Code is formatted on save
- **NEVER create .md files** - Unless explicitly requested by user
- **NEVER use "any" type** - Always investigate node_modules for correct types
- **Super strict TypeScript** - Full type safety, no shortcuts
- **Always use shadcn/ui components** - Import from @/components/ui/*
- **Use workspace packages** - Import as @lightfast/ai, @lightfast/types, @lightfast/evals

## Commands

### Monorepo Commands (from root)
```bash
pnpm dev          # Run all dev servers (Turborepo)
pnpm build        # Build all packages
pnpm typecheck    # TypeScript check all packages
pnpm lint         # Run Biome linter on all packages
pnpm dev:web      # Run only web app dev server
pnpm build:web    # Build only web app
```

### Web App Commands (from apps/web)
```bash
pnpm dev          # Start Next.js dev server
pnpm build        # Build Next.js for production
pnpm start        # Start Next.js production server
pnpm typecheck    # TypeScript check
pnpm lint         # Run Biome linter

# Install new shadcn/ui components (from apps/web)
pnpm dlx shadcn@latest add <component-name>
# Example: pnpm dlx shadcn@latest add button
# Example: pnpm dlx shadcn@latest add dialog
# Available components: https://ui.shadcn.com/docs/components

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

### Evaluation Commands (from packages/evals)
```bash
pnpm eval:a011         # Run a011 agent evaluation
pnpm eval:a011:dev     # Run in dev mode with Braintrust UI
pnpm eval:a011:baseline # Set current run as baseline
pnpm eval:experiments  # CLI for experiment management
pnpm eval:list         # List recent experiments
pnpm eval:baseline     # Show current baseline
```

## Environment Variables
See `.env.example` for all required variables.

## Documentation
- **Next.js Best Practices**: @docs/nextjs.md
- **Agent Testing**: @docs/agent-testing.md
- **Memory System**: @docs/memory-system.md
- **Container-Use**: @docs/container-use.md (for isolated development)
- **Authentication Testing**: @docs/auth-login-process.md (test credentials for Playwright)
- **Braintrust Evaluations**: @docs/braintrust/ (evaluation framework docs)

## Quick References
- Model: `anthropic/claude-4-sonnet` via Vercel AI Gateway
- Next.js dev server: http://localhost:3000
- Mastra dev server: http://localhost:4111
- Workspace packages:
  - `@lightfast/ai` - AI agents and tools
  - `@lightfast/types` - Shared TypeScript types
  - `@lightfast/evals` - Evaluation framework

## Repository Analysis
Use `/tmp/repo/...` for quickly cloning and analyzing repositories:
```bash
# Clone a repository for analysis
git clone https://github.com/user/repo.git /tmp/repo/repo-name

# Analyze repository structure
find /tmp/repo/repo-name -type f -name "*.ts" | head -20
```

## Testing Checklist
- [ ] Run `pnpm typecheck`
- [ ] Run `pnpm lint`
- [ ] Verify no console errors

IMPORTANT: When using container-use, always inform user how to view work:
- `container-use log <env_id>`
- `container-use checkout <env_id>`