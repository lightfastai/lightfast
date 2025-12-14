---
date: 2025-12-14T14:30:00+08:00
researcher: Claude
git_commit: 26dd8a3a65bcee86d1aba1c5df8f81d9a5a56307
branch: feat/memory-layer-foundation
repository: lightfast
topic: "Console Test Data Architecture - JSON Dataset Refactoring"
tags: [research, codebase, console-test-data, inngest, architecture]
status: complete
last_updated: 2025-12-14
last_updated_by: Claude
---

# Research: Console Test Data Architecture - JSON Dataset Refactoring

**Date**: 2025-12-14T14:30:00+08:00
**Researcher**: Claude
**Git Commit**: 26dd8a3a65bcee86d1aba1c5df8f81d9a5a56307
**Branch**: feat/memory-layer-foundation
**Repository**: lightfast

## Research Question

Research the current architecture of `@packages/console-test-data/` to understand:
1. How to refactor from TypeScript scenario files (`src/scenarios/*.ts`) to JSON data files that get injected
2. How to run the inject functionality from `apps/console` where Inngest environment variables are defined

## Summary

The current `@repo/console-test-data` package uses TypeScript-based event builders and scenarios that directly import the Inngest client from `@api/console/inngest`. The package triggers the production `observation.capture` workflow to inject test data. Moving to JSON datasets would decouple data from code, but running from `apps/console` makes sense since that's where the Inngest environment is configured via `dual run` or `dotenv-cli`.

## Detailed Findings

### Current Package Architecture

```
packages/console-test-data/
├── src/
│   ├── events/              # Pure function event builders
│   │   ├── github.ts        # githubPush, githubPR, githubIssue
│   │   ├── vercel.ts        # vercelDeployment
│   │   └── index.ts
│   ├── scenarios/           # Pre-built SourceEvent[] arrays
│   │   ├── security.ts      # securityScenario() - 3 events
│   │   ├── performance.ts   # performanceScenario() - 3 events
│   │   └── index.ts         # balancedScenario(), stressScenario()
│   ├── trigger/             # Inngest event triggering
│   │   ├── trigger.ts       # triggerObservationCapture()
│   │   └── wait.ts          # waitForCapture()
│   ├── verifier/            # Post-workflow verification
│   │   └── verifier.ts      # verify(), printReport()
│   ├── cli/
│   │   ├── inject.ts        # CLI entry point
│   │   └── verify.ts
│   ├── types.ts
│   └── index.ts
├── package.json
└── tsconfig.json
```

### How Scenarios Currently Work

**Event Builders** (`src/events/github.ts:80-107`):
- Pure functions that create `SourceEvent` objects
- Accept options like `repo`, `title`, `body`, `author`, `daysAgo`
- Generate random IDs for commits/deployments
- Calculate `occurredAt` based on `daysAgo`
- Add `metadata.testData: true` flag

**Scenarios** (`src/scenarios/security.ts:16-80`):
- Functions that return `SourceEvent[]` arrays
- Compose event builders with hardcoded content
- Content is embedded directly in TypeScript code

**Trigger Flow** (`src/trigger/trigger.ts:38-82`):
1. Receives array of `SourceEvent` objects
2. Batches events (default: 10 per batch)
3. Sends `inngest.send({ name: "apps-console/neural/observation.capture", data: {...} })`
4. Returns triggered count and sourceIds

### Inngest Client Import Chain

```
packages/console-test-data/src/trigger/trigger.ts:8
  └── imports { inngest } from "@api/console/inngest"
        └── api/console/src/inngest/index.ts:4
              └── exports { inngest } from "./client/client"
                    └── api/console/src/inngest/client/client.ts:716
                          └── new Inngest({ id: env.INNGEST_APP_NAME, ... })
```

The Inngest client at `api/console/src/inngest/client/client.ts:716` uses:
- `INNGEST_APP_NAME` from `@vendor/inngest/env` (required)
- `INNGEST_EVENT_KEY` (optional in dev)
- `INNGEST_SIGNING_KEY` (optional in dev)

### Environment Variable Resolution

**From `apps/console/` (current approach if moved there)**:
```bash
# Development - uses dual CLI for worktree-aware env loading
pnpm with-env:dev <command>  # = "dual run --"

# Production - uses dotenv-cli
pnpm with-env:prod <command>  # = "dotenv -e ./.vercel/.env.development.local --"
```

**From `packages/console-test-data/` (current approach)**:
```bash
pnpm inject  # = "tsx src/cli/inject.ts"
```

The current approach works because:
1. TypeScript imports resolve `@api/console/inngest` at runtime
2. The Inngest client reads env vars when instantiated
3. If env vars are present in process.env, the client initializes correctly

### Why Running from apps/console Makes Sense

| Aspect | packages/console-test-data | apps/console |
|--------|---------------------------|--------------|
| **Env setup** | Must inherit or configure | Native `with-env:dev` scripts |
| **Inngest access** | Imports from @api/console | Direct access to @api/console |
| **Dev workflow** | Separate terminal/context | Same context as dev server |
| **Dependencies** | Must add @api/console, @db/console | Already has all deps |

**Environment file location**: `/Users/jeevanpillay/Code/@lightfastai/lightfast/apps/console/.vercel/.env.development.local`

Contains all required variables:
- `INNGEST_APP_NAME=lightfast-console` (line 23)
- Clerk M2M tokens for Inngest (lines 6-10)
- Database connection (lines 13-15)
- Pinecone API key (line 27)

### Data Flow: Current TypeScript Scenarios

```
1. CLI invokes inject.ts with --scenario flag
2. Scenario function called (e.g., securityScenario())
3. Event builders called with hardcoded options
4. SourceEvent[] returned
5. triggerObservationCapture() sends to Inngest
6. Inngest workflow processes events
7. waitForCapture() polls database
8. verify() checks final state
```

### Data Flow: Proposed JSON Datasets

```
1. CLI reads JSON file from path or scenario name
2. JSON parsed into SourceEvent[] (no transformation needed)
3. triggerObservationCapture() sends to Inngest (unchanged)
4. Inngest workflow processes events (unchanged)
5. waitForCapture() polls database (unchanged)
6. verify() checks final state (unchanged)
```

### JSON Dataset Schema

The `SourceEvent` type is defined at `packages/console-types/src/source-event.ts`. A JSON dataset would be:

```json
{
  "name": "security-scenario",
  "description": "Security-focused events for testing significance scoring and entity extraction",
  "events": [
    {
      "source": "github",
      "sourceType": "pull-request.merged",
      "sourceId": "pr:test/repo#101:merged",
      "title": "[PR Merged] feat(auth): Implement OAuth2 PKCE flow",
      "body": "...",
      "actor": { "id": "github:alice", "name": "alice" },
      "occurredAt": "2025-12-12T10:00:00.000Z",
      "references": [...],
      "metadata": { "testData": true, ... }
    }
  ]
}
```

### Implementation Location Options

**Option A: Keep in packages/console-test-data, add `with-env` wrapper**

```json
// packages/console-test-data/package.json
{
  "scripts": {
    "with-env": "dotenv -e ../../apps/console/.vercel/.env.development.local --",
    "inject": "pnpm with-env tsx src/cli/inject.ts"
  }
}
```

**Option B: Move CLI to apps/console**

```json
// apps/console/package.json
{
  "scripts": {
    "test-data:inject": "pnpm with-env:dev tsx src/scripts/test-data/inject.ts",
    "test-data:verify": "pnpm with-env:dev tsx src/scripts/test-data/verify.ts"
  }
}
```

File structure:
```
apps/console/
├── src/
│   └── scripts/
│       └── test-data/
│           ├── inject.ts      # CLI entry point
│           ├── verify.ts      # Verification CLI
│           └── datasets/      # JSON dataset files
│               ├── security.json
│               ├── performance.json
│               └── stress.json
```

**Option C: Hybrid - JSON datasets in package, CLI in apps/console**

```
packages/console-test-data/
├── datasets/                  # JSON files (no code execution)
│   ├── security.json
│   ├── performance.json
│   └── custom/
└── src/
    ├── loader.ts             # JSON loading/validation
    ├── trigger/              # Unchanged
    └── verifier/             # Unchanged

apps/console/
├── src/
│   └── scripts/
│       └── test-data.ts      # CLI that imports from @repo/console-test-data
```

## Code References

| File | Line | Description |
|------|------|-------------|
| `packages/console-test-data/package.json` | 16 | `inject` script definition |
| `packages/console-test-data/src/cli/inject.ts` | 1-193 | CLI entry point |
| `packages/console-test-data/src/trigger/trigger.ts` | 8 | Inngest client import |
| `packages/console-test-data/src/trigger/trigger.ts` | 56-64 | Event sending via `inngest.send()` |
| `packages/console-test-data/src/scenarios/security.ts` | 16-80 | Example scenario function |
| `packages/console-test-data/src/events/github.ts` | 80-107 | Event builder example |
| `api/console/src/inngest/client/client.ts` | 716 | Inngest client instantiation |
| `api/console/src/inngest/client/client.ts` | 588 | `observation.capture` event schema |
| `apps/console/package.json` | 18-19 | `with-env:dev` and `with-env:prod` scripts |
| `apps/console/.vercel/.env.development.local` | 23 | `INNGEST_APP_NAME` variable |

## Architecture Documentation

### Current Dependencies (packages/console-test-data/package.json)

```json
{
  "dependencies": {
    "@api/console": "workspace:*",      // Inngest client access
    "@db/console": "workspace:*",       // Database queries (verifier, wait)
    "@repo/console-pinecone": "workspace:*",  // Pinecone queries (verifier)
    "@repo/console-types": "workspace:*",     // SourceEvent type
    "@repo/console-validation": "workspace:*", // Validation utils
    "drizzle-orm": "catalog:"           // Query builder
  }
}
```

### Inngest Event Flow

```
┌─────────────────────────────────────────────────────────────────┐
│ packages/console-test-data                                       │
│   ├─ CLI parses args, selects scenario                          │
│   ├─ Scenario returns SourceEvent[]                             │
│   └─ triggerObservationCapture() sends events                   │
└────────────────────────┬────────────────────────────────────────┘
                         │ inngest.send()
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│ Inngest (Cloud or Dev Server)                                   │
│   └─ Queues "apps-console/neural/observation.capture" events    │
└────────────────────────┬────────────────────────────────────────┘
                         │ HTTP POST /api/inngest
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│ apps/console/src/app/(inngest)/api/inngest/route.ts             │
│   └─ createInngestRouteContext() handles request                │
└────────────────────────┬────────────────────────────────────────┘
                         │ Dispatches to workflow
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│ api/console/src/inngest/workflow/neural/observation-capture.ts  │
│   ├─ Duplicate check                                            │
│   ├─ Significance scoring                                       │
│   ├─ Classification + Embedding + Entity extraction (parallel)  │
│   ├─ Cluster assignment                                         │
│   └─ Database + Pinecone storage                                │
└─────────────────────────────────────────────────────────────────┘
```

## Historical Context (from thoughts/)

| Document | Key Insight |
|----------|-------------|
| `thoughts/shared/plans/2025-12-13-console-test-data-neural-memory-alignment.md` | Full implementation plan for workflow-driven architecture |
| `thoughts/shared/research/2025-12-13-console-test-data-neural-memory-alignment.md` | Research backing the refactoring to functional event builders |
| `thoughts/shared/research/2025-12-12-neural-memory-test-data-plan.md` | Original test data strategy |

The package was recently refactored (commit 26dd8a3a) to use:
- Pure function event builders instead of class factories
- Real Inngest workflow instead of direct DB insertion
- Workflow-driven verification instead of manual assertions

## Related Research

- `thoughts/shared/research/2025-12-13-console-test-data-neural-memory-alignment.md`
- `thoughts/shared/plans/2025-12-13-console-test-data-neural-memory-alignment.md`

## Open Questions

1. **JSON schema validation**: Should datasets be validated against a JSON schema before injection?
2. **Dynamic field generation**: How to handle `occurredAt`, `sourceId` generation (relative dates, unique IDs)?
3. **Dataset versioning**: Should datasets be versioned or regenerated each time?
4. **CLI location**: Option A (add with-env to package) vs Option B (move to apps/console) vs Option C (hybrid)?
