# AgentKit Architecture

This directory contains all AgentKit-related components organized by their purpose.

## Directory Structure

```
lib/agent-kit/
├── agents/          # Individual agents with specific capabilities
├── networks/        # Networks that coordinate multiple agents
├── types/          # TypeScript type definitions
├── tools/          # Reusable tools for agents (future)
└── index.ts        # Main export file
```

## Components

### Agents (`/agents`)
Individual agents that handle specific tasks:
- **bug-analysis-agent.ts**: Analyzes bug reports to identify root causes
- **security-analysis-agent.ts**: Performs security scans and vulnerability analysis
- **code-fix-agent.ts**: Generates code fixes and patches

### Networks (`/networks`)
Networks coordinate multiple agents to solve complex problems:
- **bug-reporter-network.ts**: Orchestrates bug analysis, security checks, and fix generation

### Types (`/types`)
Shared TypeScript interfaces and types:
- Bug report structures
- Agent state interfaces
- Network state definitions

## Usage

Import from the main index:
```typescript
import { 
  bugReporterNetwork,
  bugAnalysisAgent,
  BugReport,
  BugReporterNetworkState 
} from '@/lib/agent-kit';
```

Or import from specific modules:
```typescript
import { bugAnalysisAgent } from '@/lib/agent-kit/agents';
import { bugReporterNetwork } from '@/lib/agent-kit/networks';
import type { BugReport } from '@/lib/agent-kit/types';
```

## Adding New Components

### Creating a New Agent
1. Create a new file in `/agents` directory
2. Use `createAgent<StateType>()` from `@inngest/agent-kit`
3. Define the agent's system prompt and tools
4. Export from `/agents/index.ts`

### Creating a New Network
1. Create a new file in `/networks` directory
2. Use `createNetwork<StateType>()` from `@inngest/agent-kit`
3. Define routing logic between agents
4. Export from `/networks/index.ts`

### Adding New Types
1. Add types to `/types/types.ts`
2. Types are automatically exported via `/types/index.ts`