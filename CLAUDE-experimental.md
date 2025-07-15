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

## Import Convention
```typescript
// ❌ Wrong
import { bugAnalysisAgent } from '@/lib/agent-kit/agents';

// ✅ Correct
import { bugAnalysisAgent } from '@/lib/agent-kit/agents/bug-analysis-agent';
```

## Architecture

### General Task Executor
Multi-agent system that analyzes, plans, and executes any computational task:
1. Task Analyzer → Environment Setup → Script Generator → Execution Agent
2. Runs in Vercel Sandbox (Node.js 22, `/vercel/sandbox`)

### Tech Stack
- Next.js 15 + TypeScript
- Mastra (AI agents & workflows)
- AgentKit (AI agents)
- Vercel Sandbox (execution)
- SSE (real-time updates)