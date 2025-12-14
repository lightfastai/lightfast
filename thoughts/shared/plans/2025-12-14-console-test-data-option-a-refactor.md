# Console Test Data JSON Refactor - Option A Implementation Plan

## Overview

Refactor `@repo/console-test-data` to:
1. Add `with-env` script pointing to `apps/console/.vercel/.env.development.local`
2. Replace TypeScript scenarios with JSON dataset files
3. Delete event builders and TypeScript scenario files (no backward compatibility)

## Current State Analysis

### Existing Architecture
```
packages/console-test-data/
├── src/
│   ├── events/              # DELETE: Event builders (no longer needed)
│   │   ├── github.ts
│   │   ├── vercel.ts
│   │   └── index.ts
│   ├── scenarios/           # DELETE: TypeScript scenarios
│   │   ├── security.ts
│   │   ├── performance.ts
│   │   └── index.ts
│   ├── trigger/             # KEEP
│   ├── verifier/            # KEEP
│   ├── cli/                 # MODIFY
│   └── index.ts
└── package.json
```

### Key Discoveries
| File | Line | Description |
|------|------|-------------|
| `packages/console-test-data/package.json` | 16 | `inject` script has no env loading |
| `packages/console-test-data/src/trigger/trigger.ts` | 8 | Imports Inngest from `@api/console/inngest` |
| `db/console/package.json` | 27-33 | Pattern for cross-package env loading |
| `packages/console-types/src/neural/source-event.ts` | 7-37 | SourceEvent interface definition |

## Desired End State

```
packages/console-test-data/
├── datasets/                      # NEW: JSON dataset files
│   ├── security.json
│   ├── performance.json
│   └── schema.json
├── src/
│   ├── loader/                    # NEW: JSON loading
│   │   └── index.ts
│   ├── trigger/                   # UNCHANGED
│   ├── verifier/                  # UNCHANGED
│   ├── cli/
│   │   ├── inject.ts              # MODIFIED
│   │   └── verify.ts
│   └── index.ts
└── package.json                   # MODIFIED: Add with-env, dotenv-cli
```

### Verification
- `pnpm --filter @repo/console-test-data inject -- -w <id> -o <org> -i <index>` works without pre-loading env
- JSON datasets are the only way to define scenarios
- `balanced` and `stress` modes combine/multiply JSON dataset events

## What We're NOT Doing

- **NOT keeping TypeScript scenarios** - Full migration to JSON only
- **NOT keeping event builders** - Events defined directly in JSON
- **NOT maintaining backward compatibility** - Clean break
- **NOT moving CLI to apps/console** - Option A keeps everything in package

## Implementation Approach

Complete replacement: delete TypeScript scenarios/events, add JSON datasets and loader.

---

## Phase 1: Add Environment Loading

### Overview
Add `with-env` script and `dotenv-cli` dependency.

### Changes Required

#### 1. Update package.json
**File**: `packages/console-test-data/package.json`

```json
{
  "name": "@repo/console-test-data",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/index.ts",
    "./trigger": "./src/trigger/index.ts",
    "./verifier": "./src/verifier/index.ts",
    "./loader": "./src/loader/index.ts"
  },
  "scripts": {
    "typecheck": "tsc --noEmit",
    "lint": "eslint src/",
    "with-env": "dotenv -e ../../apps/console/.vercel/.env.development.local --",
    "inject": "pnpm with-env tsx src/cli/inject.ts",
    "verify": "pnpm with-env tsx src/cli/verify.ts"
  },
  "dependencies": {
    "@api/console": "workspace:*",
    "@db/console": "workspace:*",
    "@repo/console-pinecone": "workspace:*",
    "@repo/console-types": "workspace:*",
    "@repo/console-validation": "workspace:*",
    "drizzle-orm": "catalog:"
  },
  "devDependencies": {
    "@repo/eslint-config": "workspace:*",
    "@repo/typescript-config": "workspace:*",
    "dotenv-cli": "^8.0.0",
    "eslint": "catalog:",
    "tsx": "^4.19.2",
    "typescript": "catalog:"
  }
}
```

### Success Criteria

#### Automated Verification:
- [x] `pnpm install` completes successfully
- [x] `pnpm --filter @repo/console-test-data inject -- --help` shows help

#### Manual Verification:
- [ ] Env variables load correctly (check with `pnpm with-env env | grep INNGEST`)

**Implementation Note**: Pause here for confirmation before proceeding.

---

## Phase 2: Create JSON Datasets and Schema

### Overview
Create datasets directory with JSON schema and converted scenario files.

### Changes Required

#### 1. Create directory
```bash
mkdir -p packages/console-test-data/datasets
```

#### 2. Create JSON Schema
**File**: `packages/console-test-data/datasets/schema.json`

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "https://lightfast.ai/schemas/test-dataset.json",
  "title": "Test Dataset",
  "type": "object",
  "required": ["name", "events"],
  "properties": {
    "name": {
      "type": "string"
    },
    "description": {
      "type": "string"
    },
    "events": {
      "type": "array",
      "items": { "$ref": "#/definitions/SourceEvent" },
      "minItems": 1
    }
  },
  "definitions": {
    "SourceEvent": {
      "type": "object",
      "required": ["source", "sourceType", "sourceId", "title", "body", "occurredAt", "references", "metadata"],
      "properties": {
        "source": { "type": "string", "enum": ["github", "vercel", "linear"] },
        "sourceType": { "type": "string" },
        "sourceId": { "type": "string" },
        "title": { "type": "string", "maxLength": 120 },
        "body": { "type": "string" },
        "actor": { "$ref": "#/definitions/SourceActor" },
        "occurredAt": { "type": "string" },
        "references": { "type": "array", "items": { "$ref": "#/definitions/SourceReference" } },
        "metadata": { "type": "object", "required": ["testData"] }
      }
    },
    "SourceActor": {
      "type": "object",
      "required": ["id", "name"],
      "properties": {
        "id": { "type": "string" },
        "name": { "type": "string" },
        "email": { "type": "string" },
        "avatarUrl": { "type": "string" }
      }
    },
    "SourceReference": {
      "type": "object",
      "required": ["type", "id"],
      "properties": {
        "type": { "type": "string", "enum": ["commit", "branch", "pr", "issue", "deployment", "project", "cycle", "assignee", "reviewer", "team", "label"] },
        "id": { "type": "string" },
        "url": { "type": "string" },
        "label": { "type": "string" }
      }
    }
  }
}
```

#### 3. Create security.json
**File**: `packages/console-test-data/datasets/security.json`

```json
{
  "$schema": "./schema.json",
  "name": "security",
  "description": "Security-focused events for testing significance scoring and entity extraction",
  "events": [
    {
      "source": "github",
      "sourceType": "pull-request.merged",
      "sourceId": "pr:test/repo#101:merged",
      "title": "[PR Merged] feat(auth): Implement OAuth2 PKCE flow for secure authentication",
      "body": "feat(auth): Implement OAuth2 PKCE flow for secure authentication\n## Summary\nImplements PKCE (Proof Key for Code Exchange) extension to OAuth2 flow.\nThis prevents authorization code interception attacks.\n\n## Changes\n- Added PKCE challenge generation in `src/lib/auth/pkce.ts`\n- Updated OAuth callback to verify code_verifier\n- Added @security-team as reviewer for audit\n\n## Security Impact\n- Mitigates CVE-2019-XXXX class vulnerabilities\n- Required for mobile clients per IETF RFC 7636\n\nFixes #45",
      "actor": { "id": "github:alice", "name": "alice" },
      "occurredAt": "-2d",
      "references": [
        { "type": "pr", "id": "#101", "url": "https://github.com/test/repo/pull/101" },
        { "type": "branch", "id": "feature-branch", "url": "https://github.com/test/repo/tree/feature-branch" },
        { "type": "commit", "id": "abc123def456", "url": "https://github.com/test/repo/commit/abc123def456" },
        { "type": "issue", "id": "#45", "label": "fixes" },
        { "type": "label", "id": "security" },
        { "type": "label", "id": "auth" },
        { "type": "reviewer", "id": "security-team", "url": "https://github.com/security-team" }
      ],
      "metadata": {
        "testData": true,
        "repoFullName": "test/repo",
        "repoId": 123456,
        "prNumber": 101,
        "action": "merged",
        "merged": true,
        "additions": 50,
        "deletions": 20,
        "headRef": "feature-branch",
        "baseRef": "main",
        "headSha": "abc123def456"
      }
    },
    {
      "source": "github",
      "sourceType": "issue.opened",
      "sourceId": "issue:test/repo#102:opened",
      "title": "[Issue Opened] Critical: API keys exposed in client bundle",
      "body": "Critical: API keys exposed in client bundle\n## Problem\nFound API_KEY and JWT_SECRET exposed in the production bundle.\n\n## Steps to Reproduce\n1. Open browser DevTools\n2. Search for \"API_KEY\" in Sources\n\n## Impact\nAttackers could impersonate the server or forge JWTs.\n\n## Suggested Fix\nMove secrets to server-side environment variables.\nReference: src/config/keys.ts:15",
      "actor": { "id": "github:bob", "name": "bob" },
      "occurredAt": "-1d",
      "references": [
        { "type": "issue", "id": "#102", "url": "https://github.com/test/repo/issues/102" },
        { "type": "label", "id": "security" },
        { "type": "label", "id": "critical" },
        { "type": "label", "id": "bug" }
      ],
      "metadata": {
        "testData": true,
        "repoFullName": "test/repo",
        "repoId": 123456,
        "issueNumber": 102,
        "action": "opened"
      }
    },
    {
      "source": "github",
      "sourceType": "push",
      "sourceId": "push:test/repo:def789abc012",
      "title": "[Push] fix(security): Rotate compromised credentials",
      "body": "fix(security): Rotate compromised credentials\n\n- Regenerated DATABASE_URL with new password\n- Updated Redis connection string\n- Invalidated all existing JWT tokens\n\nBREAKING: All users will need to re-authenticate",
      "actor": { "id": "github:charlie", "name": "charlie" },
      "occurredAt": "-0d",
      "references": [
        { "type": "commit", "id": "def789abc012", "url": "https://github.com/test/repo/commit/def789abc012" },
        { "type": "branch", "id": "main", "url": "https://github.com/test/repo/tree/main" }
      ],
      "metadata": {
        "testData": true,
        "repoFullName": "test/repo",
        "repoId": 123456,
        "branch": "main",
        "afterSha": "def789abc012",
        "fileCount": 3
      }
    }
  ]
}
```

#### 4. Create performance.json
**File**: `packages/console-test-data/datasets/performance.json`

```json
{
  "$schema": "./schema.json",
  "name": "performance",
  "description": "Performance-focused events for testing optimization-related content",
  "events": [
    {
      "source": "github",
      "sourceType": "pull-request.merged",
      "sourceId": "pr:test/repo#201:merged",
      "title": "[PR Merged] perf: Implement Redis caching for API responses",
      "body": "perf: Implement Redis caching for API responses\n## Summary\nAdded Redis caching layer to reduce database load.\n\n## Changes\n- New cache module at `src/lib/cache.ts`\n- Configured CACHE_TTL via environment variable\n- Added cache invalidation on writes\n\n## Performance Impact\n- GET /api/dashboard: 450ms → 45ms (90% reduction)\n- Database queries reduced by 75%\n\nTested with @david-perf",
      "actor": { "id": "github:david", "name": "david" },
      "occurredAt": "-3d",
      "references": [
        { "type": "pr", "id": "#201", "url": "https://github.com/test/repo/pull/201" },
        { "type": "branch", "id": "feature-branch", "url": "https://github.com/test/repo/tree/feature-branch" },
        { "type": "commit", "id": "perf123hash", "url": "https://github.com/test/repo/commit/perf123hash" },
        { "type": "label", "id": "performance" },
        { "type": "label", "id": "enhancement" }
      ],
      "metadata": {
        "testData": true,
        "repoFullName": "test/repo",
        "repoId": 234567,
        "prNumber": 201,
        "action": "merged",
        "merged": true,
        "additions": 50,
        "deletions": 20,
        "headRef": "feature-branch",
        "baseRef": "main",
        "headSha": "perf123hash"
      }
    },
    {
      "source": "github",
      "sourceType": "issue.opened",
      "sourceId": "issue:test/repo#202:opened",
      "title": "[Issue Opened] Dashboard loading time exceeds 5s on production",
      "body": "Dashboard loading time exceeds 5s on production\n## Problem\nThe GET /api/dashboard endpoint is taking >5 seconds on production.\n\n## Investigation\n- N+1 query detected in user list\n- No database indexes on frequently queried columns\n\n## Environment\n- Production cluster with 1000+ concurrent users\n- Redis not currently deployed",
      "actor": { "id": "github:eve", "name": "eve" },
      "occurredAt": "-5d",
      "references": [
        { "type": "issue", "id": "#202", "url": "https://github.com/test/repo/issues/202" },
        { "type": "label", "id": "performance" },
        { "type": "label", "id": "bug" }
      ],
      "metadata": {
        "testData": true,
        "repoFullName": "test/repo",
        "repoId": 234567,
        "issueNumber": 202,
        "action": "opened"
      }
    },
    {
      "source": "vercel",
      "sourceType": "deployment.succeeded",
      "sourceId": "deploy:lightfast-app:dpl_abc123",
      "title": "Deployed lightfast-app to production",
      "body": "Deployment succeeded for lightfast-app\n\nCommit: perf: enable edge runtime for API routes\nBranch: main\nEnvironment: production",
      "actor": { "id": "vercel:frank", "name": "frank" },
      "occurredAt": "-1d",
      "references": [
        { "type": "deployment", "id": "dpl_abc123", "url": "https://vercel.com/lightfast/lightfast-app/dpl_abc123" },
        { "type": "branch", "id": "main" }
      ],
      "metadata": {
        "testData": true,
        "projectId": "prj_lightfast123",
        "projectName": "lightfast-app",
        "deploymentId": "dpl_abc123",
        "target": "production",
        "deploymentUrl": "https://lightfast-app.vercel.app"
      }
    }
  ]
}
```

### Success Criteria

#### Automated Verification:
- [x] `cat datasets/security.json | jq .` validates
- [x] `cat datasets/performance.json | jq .` validates

---

## Phase 3: Create Loader Module

### Overview
Create loader module that reads JSON datasets and resolves relative timestamps.

### Changes Required

#### 1. Create loader directory and module
**File**: `packages/console-test-data/src/loader/index.ts`

```typescript
/**
 * JSON Dataset Loader
 *
 * Loads JSON datasets, resolves relative timestamps, generates unique sourceIds.
 */

import { readFileSync, existsSync, readdirSync } from "node:fs";
import { resolve, join } from "node:path";
import type { SourceEvent } from "@repo/console-types";

export interface Dataset {
  name: string;
  description?: string;
  events: SourceEvent[];
}

interface RawDataset {
  name: string;
  description?: string;
  events: RawSourceEvent[];
}

interface RawSourceEvent extends Omit<SourceEvent, "occurredAt"> {
  occurredAt: string;
}

/**
 * Resolve relative timestamp expressions to ISO strings
 * Supports: "-2d" (2 days ago), "-1w" (1 week ago), "-3h" (3 hours ago)
 */
const resolveTimestamp = (value: string): string => {
  if (value.match(/^\d{4}-\d{2}-\d{2}/)) {
    return value;
  }

  const match = value.match(/^-(\d+)([dhwm])$/);
  if (!match) {
    throw new Error(`Invalid timestamp: ${value}. Use ISO or relative like "-2d"`);
  }

  const [, amount, unit] = match;
  const now = new Date();

  switch (unit) {
    case "h":
      now.setHours(now.getHours() - parseInt(amount!, 10));
      break;
    case "d":
      now.setDate(now.getDate() - parseInt(amount!, 10));
      break;
    case "w":
      now.setDate(now.getDate() - parseInt(amount!, 10) * 7);
      break;
    case "m":
      now.setMonth(now.getMonth() - parseInt(amount!, 10));
      break;
  }

  return now.toISOString();
};

const generateSuffix = (): string => Math.random().toString(36).substring(2, 8);

const processEvents = (events: RawSourceEvent[]): SourceEvent[] => {
  const suffix = generateSuffix();
  return events.map((event, index) => ({
    ...event,
    sourceId: `${event.sourceId}:${suffix}:${index}`,
    occurredAt: resolveTimestamp(event.occurredAt),
  }));
};

const getDatasetsDir = (): string => {
  return resolve(import.meta.dirname, "..", "..", "datasets");
};

/**
 * Load a dataset by name or file path
 */
export const loadDataset = (nameOrPath: string): Dataset => {
  const datasetsDir = getDatasetsDir();

  const filePath = nameOrPath.endsWith(".json")
    ? resolve(nameOrPath)
    : join(datasetsDir, `${nameOrPath}.json`);

  if (!existsSync(filePath)) {
    throw new Error(`Dataset not found: ${filePath}`);
  }

  const raw: RawDataset = JSON.parse(readFileSync(filePath, "utf-8"));

  if (!raw.name) throw new Error(`Dataset missing: name`);
  if (!Array.isArray(raw.events) || raw.events.length === 0) {
    throw new Error(`Dataset must have at least one event`);
  }

  return {
    name: raw.name,
    description: raw.description,
    events: processEvents(raw.events),
  };
};

/**
 * List available dataset names
 */
export const listDatasets = (): string[] => {
  const datasetsDir = getDatasetsDir();
  if (!existsSync(datasetsDir)) return [];

  return readdirSync(datasetsDir)
    .filter((f) => f.endsWith(".json") && f !== "schema.json")
    .map((f) => f.replace(".json", ""));
};

/**
 * Load all datasets and return combined events
 */
export const loadAllDatasets = (): SourceEvent[] => {
  const names = listDatasets();
  const events: SourceEvent[] = [];
  for (const name of names) {
    events.push(...loadDataset(name).events);
  }
  return events;
};

/**
 * Generate balanced scenario: shuffle all events, slice to count
 */
export const balancedScenario = (count: number): SourceEvent[] => {
  const all = loadAllDatasets();
  const shuffled = all.sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(count, shuffled.length));
};

/**
 * Generate stress scenario: repeat events to reach count
 */
export const stressScenario = (count: number): SourceEvent[] => {
  const base = loadAllDatasets();
  const events: SourceEvent[] = [];

  while (events.length < count) {
    for (const event of base) {
      if (events.length >= count) break;
      events.push({
        ...event,
        sourceId: `${event.sourceId}:stress:${events.length}`,
        occurredAt: new Date(Date.now() - Math.random() * 90 * 24 * 60 * 60 * 1000).toISOString(),
      });
    }
  }

  return events;
};
```

### Success Criteria

#### Automated Verification:
- [x] `pnpm --filter @repo/console-test-data typecheck` passes
- [x] `pnpm --filter @repo/console-test-data lint` passes

---

## Phase 4: Update CLI and Delete Old Files

### Overview
Update CLI to use loader, delete TypeScript scenarios and event builders.

### Changes Required

#### 1. Update inject.ts
**File**: `packages/console-test-data/src/cli/inject.ts`

Replace entire file:

```typescript
#!/usr/bin/env npx tsx
/**
 * Test Data Injection CLI
 *
 * Injects JSON dataset events via Inngest workflow.
 *
 * Usage:
 *   pnpm inject -- --workspace <id> --org <clerkOrgId> --index <name> [options]
 */

import { loadDataset, listDatasets, balancedScenario, stressScenario } from "../loader";
import { triggerObservationCapture } from "../trigger/trigger";
import { waitForCapture } from "../trigger/wait";
import { verify, printReport } from "../verifier/verifier";

function parseArgs() {
  const args = process.argv.slice(2);
  const parsed: Record<string, string | boolean> = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (!arg) continue;
    if (arg === "--help" || arg === "-h") {
      parsed.help = true;
    } else if (arg === "--skip-wait") {
      parsed.skipWait = true;
    } else if (arg === "--skip-verify") {
      parsed.skipVerify = true;
    } else if (arg.startsWith("--") || arg.startsWith("-")) {
      const key = arg.replace(/^-+/, "");
      const value = args[i + 1];
      if (value && !value.startsWith("-")) {
        parsed[key] = value;
        i++;
      } else {
        parsed[key] = true;
      }
    }
  }

  return parsed;
}

function showHelp() {
  const datasets = listDatasets();
  console.log(`
Test Data Injection CLI

Usage:
  pnpm inject -- [options]

Required:
  --workspace, -w   Workspace ID
  --org, -o         Clerk Org ID
  --index, -i       Pinecone index name

Options:
  --scenario, -s    Dataset name or path (default: security)
                    Available: ${datasets.join(", ")}, balanced, stress
  --count, -c       Event count for balanced/stress (default: 6)
  --skip-wait       Don't wait for workflow completion
  --skip-verify     Don't run verification
  --help, -h        Show this help

Examples:
  pnpm inject -- -w <id> -o <orgId> -i <index>
  pnpm inject -- -w <id> -o <orgId> -i <index> -s performance
  pnpm inject -- -w <id> -o <orgId> -i <index> -s balanced -c 10
  pnpm inject -- -w <id> -o <orgId> -i <index> -s /path/to/custom.json
`);
}

async function main() {
  const args = parseArgs();

  if (args.help) {
    showHelp();
    process.exit(0);
  }

  const workspaceId = (args.workspace ?? args.w) as string;
  const clerkOrgId = (args.org ?? args.o) as string;
  const indexName = (args.index ?? args.i) as string;
  const scenarioName = (args.scenario ?? args.s ?? "security") as string;
  const count = parseInt((args.count ?? args.c ?? "6") as string, 10);
  const skipWait = !!args.skipWait;
  const skipVerify = !!args.skipVerify;

  if (!workspaceId || !clerkOrgId || !indexName) {
    console.error("Error: --workspace, --org, and --index are required");
    showHelp();
    process.exit(1);
  }

  // Load events based on scenario
  const events =
    scenarioName === "stress"
      ? stressScenario(count)
      : scenarioName === "balanced"
        ? balancedScenario(count)
        : loadDataset(scenarioName).events;

  console.log("=".repeat(60));
  console.log("Test Data Injection");
  console.log("=".repeat(60));
  console.log(`  Workspace: ${workspaceId}`);
  console.log(`  Org: ${clerkOrgId}`);
  console.log(`  Index: ${indexName}`);
  console.log(`  Scenario: ${scenarioName}`);
  console.log(`  Events: ${events.length}`);
  console.log();

  console.log(`Triggering ${events.length} events via Inngest workflow...\n`);

  const triggerResult = await triggerObservationCapture(events, {
    workspaceId,
    onProgress: (current, total) => {
      process.stdout.write(`\rTriggered: ${current}/${total}`);
    },
  });

  console.log(`\n\nTriggered ${triggerResult.triggered} events in ${triggerResult.duration}ms`);

  if (!skipWait) {
    console.log("\nWaiting for workflow completion...");
    const waitResult = await waitForCapture({
      workspaceId,
      sourceIds: triggerResult.sourceIds,
      timeoutMs: 120000,
    });

    console.log(`Completed: ${waitResult.completed}/${triggerResult.triggered}`);
    if (waitResult.pending > 0) {
      console.log(`Pending/Filtered: ${waitResult.pending}`);
    }
    if (waitResult.timedOut) {
      console.log("Warning: Wait timed out");
    }
  }

  if (!skipVerify) {
    console.log("\nVerifying results...");
    const verifyResult = await verify({ workspaceId, clerkOrgId, indexName });
    printReport(verifyResult);

    const allHealthy =
      verifyResult.health.multiViewComplete &&
      verifyResult.health.entitiesExtracted &&
      verifyResult.health.clustersAssigned;

    if (!allHealthy) {
      console.log("Warning: Some health checks failed");
    }
  }

  console.log("\nDone!");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
```

#### 2. Update index.ts
**File**: `packages/console-test-data/src/index.ts`

```typescript
// Core exports
export * from "./loader";
export * from "./trigger";
export * from "./verifier";
```

#### 3. Delete old files
```bash
rm -rf packages/console-test-data/src/events
rm -rf packages/console-test-data/src/scenarios
rm -f packages/console-test-data/src/types.ts
```

### Success Criteria

#### Automated Verification:
- [x] `pnpm --filter @repo/console-test-data typecheck` passes
- [x] `pnpm --filter @repo/console-test-data lint` passes
- [x] `pnpm --filter @repo/console-test-data inject -- --help` works

#### Manual Verification:
- [ ] `pnpm --filter @repo/console-test-data inject -- -w <id> -o <org> -i <index>` triggers events
- [ ] Events flow through Inngest workflow
- [ ] Verification report shows correct counts

---

## Testing Strategy

### Manual Testing Steps
1. Run: `pnpm --filter @repo/console-test-data inject -- -w <id> -o <org> -i <index> -s security`
2. Run: `pnpm --filter @repo/console-test-data inject -- -w <id> -o <org> -i <index> -s performance`
3. Run: `pnpm --filter @repo/console-test-data inject -- -w <id> -o <org> -i <index> -s balanced -c 5`
4. Verify events appear in console UI
5. Check verification report

## Migration Notes

- **Breaking change**: TypeScript scenarios and event builders deleted
- **New datasets**: Add new scenarios by creating JSON files in `datasets/`
- **Custom datasets**: Use `-s /path/to/file.json` for custom scenarios

## References

- Research: `thoughts/shared/research/2025-12-14-console-test-data-json-refactor.md`
- SourceEvent type: `packages/console-types/src/neural/source-event.ts:7-37`
- DB console env pattern: `db/console/package.json:27-33`
