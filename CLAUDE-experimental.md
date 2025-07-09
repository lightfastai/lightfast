# Claude Development Guidelines

## Project Conventions

### Import Rules

**NO INDEX.TS FILES**: This project does not use index.ts files. Always use direct imports to specific files.

#### ❌ Wrong
```typescript
import { bugReporterNetwork } from '@/lib/agent-kit/networks';
import type { BugReport } from '@/lib/agent-kit/types';
```

#### ✅ Correct
```typescript
import { bugReporterNetwork } from '@/lib/agent-kit/networks/bug-reporter-network';
import type { BugReport } from '@/lib/agent-kit/types/types';
```

### Folder Structure

```
lib/agent-kit/
├── agents/                    # Individual agents
│   ├── bug-analysis-agent.ts
│   ├── code-fix-agent.ts
│   └── security-analysis-agent.ts
├── networks/                  # Agent networks
│   └── bug-reporter-network.ts
├── types/                     # Type definitions
│   └── types.ts
└── tools/                     # Reusable tools (future)
```

### Import Examples

```typescript
// Agents
import { bugAnalysisAgent } from '@/lib/agent-kit/agents/bug-analysis-agent';
import { securityAnalysisAgent } from '@/lib/agent-kit/agents/security-analysis-agent';
import { codeFixAgent } from '@/lib/agent-kit/agents/code-fix-agent';

// Networks
import { bugReporterNetwork } from '@/lib/agent-kit/networks/bug-reporter-network';

// Types
import type { BugReport, BugReporterNetworkState } from '@/lib/agent-kit/types/types';
```

## Development Practices

1. **Direct Imports Only**: Never create or use index.ts files. Always import directly from the source file.

2. **Type Safety**: Use TypeScript types extensively. Import types separately with `import type`.

3. **File Organization**: Keep related functionality in the same directory, but always use explicit file imports.

4. **AgentKit Structure**: 
   - Agents go in `/agents/` directory
   - Networks go in `/networks/` directory
   - Types go in `/types/` directory
   - Tools go in `/tools/` directory

5. **Naming Conventions**:
   - Agents: `{name}-agent.ts` (e.g., `bug-analysis-agent.ts`)
   - Networks: `{name}-network.ts` (e.g., `bug-reporter-network.ts`)
   - Use kebab-case for file names
   - Use camelCase for exports

## Commands to Run

When making changes:
1. `npm run typecheck` - Ensure no TypeScript errors
2. `npm run lint` - Check code style (Biome will auto-format on save)
3. `npm run dev` - Test in development

Note: The project uses Biome for linting and formatting. Files may be automatically formatted on save.

## Important Notes

- This project uses Inngest for orchestration
- AgentKit is used for multi-agent AI systems
- SSE (Server-Sent Events) for real-time updates
- Vercel Sandbox for secure code execution

## Architecture Overview

### General-Purpose Task Execution System

The project includes a universal task execution system that can handle any computational task by:

1. **Task Analysis** - Analyzes the task to understand requirements
2. **Environment Setup** - Configures dependencies and environment
3. **Script Generation** - Creates executable scripts based on the analysis
4. **Secure Execution** - Runs scripts in Vercel Sandbox with proper isolation

#### Key Components:

- **Task Network** (`/lib/agent-kit/networks/task-network.ts`) - Orchestrates the multi-agent workflow
- **Agents**:
  - Task Analyzer Agent - Understands and plans tasks
  - Environment Setup Agent - Configures execution environment
  - Script Generator Agent - Creates executable scripts
  - Execution Agent - Runs scripts in Vercel Sandbox
- **Sandbox Executor** (`/lib/sandbox/sandbox-executor.ts`) - Interfaces with Vercel Sandbox API

#### Vercel Sandbox Notes:

- Base system: Amazon Linux 2023 with Node.js 22 and Python 3.13
- Working directory: `/vercel/sandbox`
- User: `vercel-sandbox` with sudo access
- Package managers: npm, pnpm, pip, uv
- Additional packages can be installed via `dnf`