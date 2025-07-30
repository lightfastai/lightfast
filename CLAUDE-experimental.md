# Development Guidelines

## Monorepo Structure
- **apps/www** - Next.js application
- **packages/ai** - AI agents, tools, and workflows (@lightfast/ai)
- **packages/types** - Shared TypeScript types (@lightfast/types)
- **packages/evals** - Evaluation framework with Braintrust (@lightfast/evals)

## Core Rules
- **NO index.ts files** - Always use direct imports
- **NO factory functions** - Use `new ClassName()` directly, avoid `createClassName()` patterns
- **Use pnpm** - Not npm or yarn
- **Run tests** - `pnpm typecheck` and `pnpm lint` before commits
- **Biome auto-formats** - Code is formatted on save
- **NEVER create .md files** - Unless explicitly requested by user
- **NEVER use "any" type** - Always investigate node_modules for correct types
- **Super strict TypeScript** - Full type safety, no shortcuts
- **Always use shadcn/ui components** - Import from @/components/ui/*
- **Use workspace packages** - Import as @lightfast/ai, @lightfast/types, @lightfast/evals
- **NEVER use process.env directly** - Always import and use `env` from the appropriate env.ts file
- **Adding new env vars** - When adding new environment variables:
  1. Check the relevant env.ts file (apps/www/env.ts or packages/ai/src/core/v2/env.ts)
  2. Add the variable to the schema with proper zod validation
  3. Add it to runtimeEnv mapping
  4. Ask the user to add the actual key to their .env file

## Commands

### Monorepo Commands (from root)
```bash
pnpm dev          # Run all dev servers (Turborepo)
pnpm build:packages # Build all packages
pnpm build:www    # Build only web app
pnpm typecheck    # TypeScript check all packages
pnpm lint         # Run Biome linter on all packages
pnpm dev:www      # Run only web app dev server
```

### Web App Commands (from apps/www)
```bash
pnpm dev          # Start Next.js dev server
pnpm build        # Build Next.js for production
pnpm start        # Start Next.js production server
pnpm typecheck    # TypeScript check
pnpm lint         # Run Biome linter

# Install new shadcn/ui components (from apps/www)
pnpm dlx shadcn@latest add <component-name>
# Example: pnpm dlx shadcn@latest add button
# Example: pnpm dlx shadcn@latest add dialog
# Available components: https://ui.shadcn.com/docs/components

# Development Server Management
# IMPORTANT: Always use port 3000. Kill other processes if needed.

# Kill any process using port 3000
pkill -f "next dev"

# Run Next.js dev server in background (from monorepo root)
cd .. && pnpm dev:www > /tmp/nextjs-dev.log 2>&1 &

# Check Next.js dev server logs
cat /tmp/nextjs-dev.log

# Kill background Next.js server
pkill -f "next dev"


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

### Important: Environment Variable Usage
- **NEVER use `process.env.VARIABLE_NAME`** directly in code
- Always import the typed `env` object from the appropriate env.ts file:
  - For web app code: `import { env } from "@/env"`
  - For AI package v2: `import { env } from "@lightfast/ai/v2/env"`
- This provides type safety, validation, and runtime checks
- The env.ts files use @t3-oss/env-nextjs for validation

### Adding New Environment Variables
When you need a new environment variable:
1. Locate the appropriate env.ts file
2. Add the variable to the `server` or `client` schema with zod validation
3. Add the corresponding mapping in `runtimeEnv` (server) or `experimental__runtimeEnv` (client)
4. Inform the user they need to add the key to their .env file

Example:
```typescript
// In env.ts
server: {
  MY_NEW_API_KEY: z.string().min(1).describe("API key for new service"),
},
runtimeEnv: {
  MY_NEW_API_KEY: process.env.MY_NEW_API_KEY,
}
```

## Documentation
- **Next.js Best Practices**: @docs/nextjs.md
- **Container-Use**: @docs/container-use.md (for isolated development)
- **Authentication Testing**: @docs/auth-login-process.md (test credentials for Playwright)
- **Braintrust Evaluations**: @docs/braintrust/ (evaluation framework docs)

## Quick References
- Model: `anthropic/claude-4-sonnet` via Vercel AI Gateway
- Next.js dev server: http://localhost:3000
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

## Task Execution
- **Evaluate parallelism first** - Can subtasks run independently?
- **Use Task tool for parallel work** - Multiple agents concurrently when possible
- **Examples**: File searches, data fetching, independent validations

## Testing Checklist
- [ ] Run `pnpm typecheck`
- [ ] Run `pnpm lint`
- [ ] Verify no console errors

IMPORTANT: When using container-use, always inform user how to view work:
- `container-use log <env_id>`
- `container-use checkout <env_id>`