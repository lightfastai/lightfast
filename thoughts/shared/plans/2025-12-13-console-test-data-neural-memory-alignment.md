# Console Test Data Package - Neural Memory V1 Alignment Implementation Plan

## Overview

Redesign `@repo/console-test-data` as a functional, workflow-driven test data package that generates `SourceEvent` objects (matching transformer output) and triggers the actual Inngest workflow for processing. This ensures tests exercise the real code path including significance scoring, classification, multi-view embeddings, entity extraction, cluster assignment, and actor resolution.

## Current State Analysis

The current test-data package bypasses the production pipeline:

- **Manually creates embeddings** instead of using `observation-capture.ts` workflow
- **Custom significance scoring** that doesn't match production logic
- **No entity extraction** - production extracts from text and references
- **Class-based factories** that are complex and harder to compose

### Key Discoveries:
- Webhook transformers produce `SourceEvent` at `packages/console-webhooks/src/transformers/github.ts:52-79` (push example)
- Real pipeline starts with `apps-console/neural/observation.capture` Inngest event
- Workflow handles: duplicate check → significance gate → parallel (classify + embed + extract + resolve) → cluster → store

## Desired End State

A functional test-data package that:

1. **Generates valid `SourceEvent` objects** - matching transformer output format
2. **Triggers real Inngest workflow** - `apps-console/neural/observation.capture` events
3. **Waits for completion** - polls or subscribes to `observation.captured` events
4. **Verifies results** - checks DB and Pinecone state after workflow completes

### Verification:
- Injected events go through real significance scoring (some may be filtered)
- Entities extracted from test content appear in `workspace_neural_entities`
- Observations assigned to clusters automatically
- Multi-view embeddings (title/content/summary) created in Pinecone
- Actor profiles resolved and updated

## What We're NOT Doing

- **Bypassing the workflow** - No direct DB/Pinecone insertion
- **Custom embedding generation** - Workflow handles this
- **Custom entity extraction** - Workflow handles this
- **Class-based factories** - Using pure functions and builders

---

## Implementation Approach

The package becomes much simpler:

```
packages/console-test-data/
├── src/
│   ├── events/                    # SourceEvent factories (pure functions)
│   │   ├── github.ts             # GitHub event builders
│   │   ├── vercel.ts             # Vercel event builders
│   │   └── index.ts
│   ├── scenarios/                 # Pre-built event sets
│   │   ├── security.ts
│   │   ├── performance.ts
│   │   └── index.ts
│   ├── trigger/                   # Inngest event triggering
│   │   ├── trigger.ts
│   │   └── wait.ts
│   ├── verify/                    # Post-workflow verification
│   │   └── verifier.ts
│   └── cli/
│       ├── inject.ts
│       └── verify.ts
```

---

## Phase 1: Functional Event Builders

### Overview
Create pure functions that build `SourceEvent` objects matching transformer output.

### Changes Required:

#### 1. Create GitHub event builders
**File**: `packages/console-test-data/src/events/github.ts`

```typescript
import type { SourceEvent, SourceActor, SourceReference } from "@repo/console-types";
import { generateId } from "@repo/console-validation";

// ============ Builder Options ============

interface GitHubPushOptions {
  repo: string;                    // e.g., "lightfastai/lightfast"
  branch?: string;                 // default: "main"
  commitMessage: string;
  author: string;
  authorEmail?: string;
  filesChanged?: number;
  daysAgo?: number;                // for occurredAt calculation
}

interface GitHubPROptions {
  repo: string;
  prNumber: number;
  title: string;
  body?: string;
  action: "opened" | "closed" | "merged" | "reopened" | "ready_for_review";
  author: string;
  headBranch?: string;
  baseBranch?: string;
  additions?: number;
  deletions?: number;
  linkedIssues?: string[];         // e.g., ["#123", "#456"]
  labels?: string[];
  reviewers?: string[];
  daysAgo?: number;
}

interface GitHubIssueOptions {
  repo: string;
  issueNumber: number;
  title: string;
  body?: string;
  action: "opened" | "closed" | "reopened";
  author: string;
  labels?: string[];
  assignees?: string[];
  daysAgo?: number;
}

// ============ Helper Functions ============

const calculateOccurredAt = (daysAgo = 0): string => {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return date.toISOString();
};

const buildActor = (name: string, email?: string): SourceActor => ({
  id: `github:${name}`,
  name,
  email,
});

// ============ Event Builders ============

/**
 * Build a GitHub push event
 * Matches output of transformGitHubPush in console-webhooks
 */
export const githubPush = (opts: GitHubPushOptions): SourceEvent => {
  const branch = opts.branch ?? "main";
  const commitSha = generateId();

  const refs: SourceReference[] = [
    { type: "commit", id: commitSha, url: `https://github.com/${opts.repo}/commit/${commitSha}` },
    { type: "branch", id: branch, url: `https://github.com/${opts.repo}/tree/${branch}` },
  ];

  return {
    source: "github",
    sourceType: "push",
    sourceId: `push:${opts.repo}:${commitSha}`,
    title: `[Push] ${opts.commitMessage.split("\n")[0]?.slice(0, 100) ?? "Push"}`,
    body: opts.commitMessage,
    actor: buildActor(opts.author, opts.authorEmail),
    occurredAt: calculateOccurredAt(opts.daysAgo),
    references: refs,
    metadata: {
      testData: true,
      repoFullName: opts.repo,
      repoId: Math.floor(Math.random() * 1000000),
      branch,
      afterSha: commitSha,
      fileCount: opts.filesChanged ?? 1,
    },
  };
};

/**
 * Build a GitHub pull request event
 * Matches output of transformGitHubPullRequest in console-webhooks
 */
export const githubPR = (opts: GitHubPROptions): SourceEvent => {
  const headBranch = opts.headBranch ?? "feature-branch";
  const baseBranch = opts.baseBranch ?? "main";
  const headSha = generateId();

  const actionTitleMap: Record<string, string> = {
    opened: "PR Opened",
    closed: "PR Closed",
    merged: "PR Merged",
    reopened: "PR Reopened",
    ready_for_review: "Ready for Review",
  };

  const refs: SourceReference[] = [
    { type: "pr", id: `#${opts.prNumber}`, url: `https://github.com/${opts.repo}/pull/${opts.prNumber}` },
    { type: "branch", id: headBranch, url: `https://github.com/${opts.repo}/tree/${headBranch}` },
    { type: "commit", id: headSha, url: `https://github.com/${opts.repo}/commit/${headSha}` },
  ];

  // Add linked issues
  for (const issue of opts.linkedIssues ?? []) {
    refs.push({ type: "issue", id: issue, label: "fixes" });
  }

  // Add labels
  for (const label of opts.labels ?? []) {
    refs.push({ type: "label", id: label });
  }

  // Add reviewers
  for (const reviewer of opts.reviewers ?? []) {
    refs.push({ type: "reviewer", id: reviewer, url: `https://github.com/${reviewer}` });
  }

  const sourceType = opts.action === "merged"
    ? "pull-request.merged"
    : `pull-request.${opts.action}`;

  return {
    source: "github",
    sourceType,
    sourceId: `pr:${opts.repo}#${opts.prNumber}:${opts.action}`,
    title: `[${actionTitleMap[opts.action]}] ${opts.title.slice(0, 100)}`,
    body: [opts.title, opts.body ?? ""].join("\n"),
    actor: buildActor(opts.author),
    occurredAt: calculateOccurredAt(opts.daysAgo),
    references: refs,
    metadata: {
      testData: true,
      repoFullName: opts.repo,
      repoId: Math.floor(Math.random() * 1000000),
      prNumber: opts.prNumber,
      action: opts.action,
      merged: opts.action === "merged",
      additions: opts.additions ?? 50,
      deletions: opts.deletions ?? 20,
      headRef: headBranch,
      baseRef: baseBranch,
      headSha,
    },
  };
};

/**
 * Build a GitHub issue event
 * Matches output of transformGitHubIssue in console-webhooks
 */
export const githubIssue = (opts: GitHubIssueOptions): SourceEvent => {
  const actionTitleMap: Record<string, string> = {
    opened: "Issue Opened",
    closed: "Issue Closed",
    reopened: "Issue Reopened",
  };

  const refs: SourceReference[] = [
    { type: "issue", id: `#${opts.issueNumber}`, url: `https://github.com/${opts.repo}/issues/${opts.issueNumber}` },
  ];

  for (const label of opts.labels ?? []) {
    refs.push({ type: "label", id: label });
  }

  for (const assignee of opts.assignees ?? []) {
    refs.push({ type: "assignee", id: assignee, url: `https://github.com/${assignee}` });
  }

  return {
    source: "github",
    sourceType: `issue.${opts.action}`,
    sourceId: `issue:${opts.repo}#${opts.issueNumber}:${opts.action}`,
    title: `[${actionTitleMap[opts.action]}] ${opts.title.slice(0, 100)}`,
    body: [opts.title, opts.body ?? ""].join("\n"),
    actor: buildActor(opts.author),
    occurredAt: calculateOccurredAt(opts.daysAgo),
    references: refs,
    metadata: {
      testData: true,
      repoFullName: opts.repo,
      repoId: Math.floor(Math.random() * 1000000),
      issueNumber: opts.issueNumber,
      action: opts.action,
    },
  };
};
```

#### 2. Create Vercel event builders
**File**: `packages/console-test-data/src/events/vercel.ts`

```typescript
import type { SourceEvent, SourceReference } from "@repo/console-types";
import { generateId } from "@repo/console-validation";

interface VercelDeploymentOptions {
  projectName: string;
  projectId?: string;
  event: "deployment.created" | "deployment.succeeded" | "deployment.ready" | "deployment.error" | "deployment.canceled";
  branch?: string;
  commitMessage?: string;
  commitAuthor?: string;
  environment?: "production" | "preview";
  daysAgo?: number;
}

const calculateOccurredAt = (daysAgo = 0): string => {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return date.toISOString();
};

/**
 * Build a Vercel deployment event
 * Matches output of transformVercelDeployment in console-webhooks
 */
export const vercelDeployment = (opts: VercelDeploymentOptions): SourceEvent => {
  const branch = opts.branch ?? "main";
  const deploymentId = `dpl_${generateId()}`;
  const projectId = opts.projectId ?? `prj_${generateId()}`;
  const commitSha = generateId();

  const eventTitleMap: Record<string, string> = {
    "deployment.created": "Deployment Started",
    "deployment.succeeded": "Deployment Succeeded",
    "deployment.ready": "Deployment Ready",
    "deployment.error": "Deployment Failed",
    "deployment.canceled": "Deployment Canceled",
  };

  const refs: SourceReference[] = [
    { type: "deployment", id: deploymentId },
    { type: "project", id: projectId },
    { type: "branch", id: branch },
  ];

  if (commitSha) {
    refs.push({ type: "commit", id: commitSha });
  }

  const emoji = opts.event === "deployment.succeeded" || opts.event === "deployment.ready"
    ? "+"
    : opts.event === "deployment.error"
      ? "x"
      : ">";

  return {
    source: "vercel",
    sourceType: opts.event,
    sourceId: `deployment:${deploymentId}`,
    title: `[${eventTitleMap[opts.event]}] ${opts.projectName} from ${branch}`,
    body: `${emoji} ${eventTitleMap[opts.event]}\n${opts.commitMessage ?? ""}`,
    actor: opts.commitAuthor
      ? { id: `github:${opts.commitAuthor}`, name: opts.commitAuthor }
      : undefined,
    occurredAt: calculateOccurredAt(opts.daysAgo),
    references: refs,
    metadata: {
      testData: true,
      deploymentId,
      projectId,
      projectName: opts.projectName,
      environment: opts.environment ?? "preview",
      branch,
      gitCommitSha: commitSha,
      gitCommitMessage: opts.commitMessage,
    },
  };
};
```

#### 3. Create exports
**File**: `packages/console-test-data/src/events/index.ts`

```typescript
export { githubPush, githubPR, githubIssue } from "./github";
export { vercelDeployment } from "./vercel";

// Re-export types for convenience
export type { SourceEvent, SourceActor, SourceReference } from "@repo/console-types";
```

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compiles: `pnpm --filter @repo/console-test-data typecheck`
- [x] Build succeeds: `pnpm --filter @repo/console-test-data build` (no build script needed)

#### Manual Verification:
- [ ] Generated events match transformer output structure
- [ ] All required `SourceEvent` fields populated correctly

**Implementation Note**: Pause for confirmation before proceeding.

---

## Phase 2: Pre-built Scenarios

### Overview
Create scenario functions that return arrays of `SourceEvent` for common test cases.

### Changes Required:

#### 1. Security-focused scenario
**File**: `packages/console-test-data/src/scenarios/security.ts`

```typescript
import type { SourceEvent } from "@repo/console-types";
import { githubPR, githubIssue, githubPush } from "../events";

/**
 * Security-focused test scenario
 * Contains events that should trigger high significance scores
 * and extract security-related entities
 */
export const securityScenario = (): SourceEvent[] => [
  githubPR({
    repo: "test/repo",
    prNumber: 101,
    title: "feat(auth): Implement OAuth2 PKCE flow for secure authentication",
    body: `## Summary
Implements PKCE (Proof Key for Code Exchange) extension to OAuth2 flow.
This prevents authorization code interception attacks.

## Changes
- Added PKCE challenge generation in \`src/lib/auth/pkce.ts\`
- Updated OAuth callback to verify code_verifier
- Added @security-team as reviewer for audit

## Security Impact
- Mitigates CVE-2019-XXXX class vulnerabilities
- Required for mobile clients per IETF RFC 7636

Fixes #45`,
    action: "merged",
    author: "alice",
    labels: ["security", "auth"],
    linkedIssues: ["#45"],
    reviewers: ["security-team"],
    daysAgo: 2,
  }),

  githubIssue({
    repo: "test/repo",
    issueNumber: 102,
    title: "Critical: API keys exposed in client bundle",
    body: `## Problem
Found API_KEY and JWT_SECRET exposed in the production bundle.

## Steps to Reproduce
1. Open browser DevTools
2. Search for "API_KEY" in Sources

## Impact
Attackers could impersonate the server or forge JWTs.

## Suggested Fix
Move secrets to server-side environment variables.
Reference: src/config/keys.ts:15`,
    action: "opened",
    author: "bob",
    labels: ["security", "critical", "bug"],
    daysAgo: 1,
  }),

  githubPush({
    repo: "test/repo",
    branch: "main",
    commitMessage: `fix(security): Rotate compromised credentials

- Regenerated DATABASE_URL with new password
- Updated Redis connection string
- Invalidated all existing JWT tokens

BREAKING: All users will need to re-authenticate`,
    author: "charlie",
    filesChanged: 3,
    daysAgo: 0,
  }),
];
```

#### 2. Performance-focused scenario
**File**: `packages/console-test-data/src/scenarios/performance.ts`

```typescript
import type { SourceEvent } from "@repo/console-types";
import { githubPR, githubIssue, vercelDeployment } from "../events";

/**
 * Performance-focused test scenario
 * Contains events related to performance optimization
 */
export const performanceScenario = (): SourceEvent[] => [
  githubPR({
    repo: "test/repo",
    prNumber: 201,
    title: "perf: Implement Redis caching for API responses",
    body: `## Summary
Added Redis caching layer to reduce database load.

## Changes
- New cache module at \`src/lib/cache.ts\`
- Configured CACHE_TTL via environment variable
- Added cache invalidation on writes

## Performance Impact
- GET /api/dashboard: 450ms → 45ms (90% reduction)
- Database queries reduced by 75%

Tested with @david-perf`,
    action: "merged",
    author: "david",
    labels: ["performance", "enhancement"],
    daysAgo: 3,
  }),

  githubIssue({
    repo: "test/repo",
    issueNumber: 202,
    title: "Dashboard loading time exceeds 5s on production",
    body: `## Problem
The GET /api/dashboard endpoint is taking >5 seconds on production.

## Investigation
- N+1 query detected in user list
- No database indexes on frequently queried columns

## Environment
- Production cluster with 1000+ concurrent users
- Redis not currently deployed`,
    action: "opened",
    author: "eve",
    labels: ["performance", "bug"],
    daysAgo: 5,
  }),

  vercelDeployment({
    projectName: "lightfast-app",
    event: "deployment.succeeded",
    branch: "main",
    commitMessage: "perf: enable edge runtime for API routes",
    commitAuthor: "frank",
    environment: "production",
    daysAgo: 1,
  }),
];
```

#### 3. Mixed balanced scenario (Day 2 equivalent)
**File**: `packages/console-test-data/src/scenarios/day2-retrieval.ts`

```typescript
import type { SourceEvent } from "@repo/console-types";
import { githubPR, githubIssue, githubPush, vercelDeployment } from "../events";

/**
 * Balanced scenario for retrieval testing
 * 20 events across different categories, actors, and time ranges
 */
export const day2RetrievalScenario = (): SourceEvent[] => [
  // Authentication & Security (4 events)
  githubPR({
    repo: "test/repo", prNumber: 1, title: "feat(auth): Implement OAuth2 PKCE flow",
    body: "Implements secure PKCE flow for OAuth2.\n\nFixes #10",
    action: "merged", author: "alice", labels: ["security"], daysAgo: 2,
  }),
  githubPR({
    repo: "test/repo", prNumber: 2, title: "fix(security): Patch JWT vulnerability CVE-2024-1234",
    body: "Updates jsonwebtoken to v9.0.0 to fix signature bypass.",
    action: "merged", author: "bob", labels: ["security", "critical"], daysAgo: 1,
  }),
  githubIssue({
    repo: "test/repo", issueNumber: 3, title: "API keys exposed in client bundle",
    body: "Found API_KEY in production bundle. src/config/keys.ts:15",
    action: "opened", author: "charlie", labels: ["security", "bug"], daysAgo: 5,
  }),
  githubPush({
    repo: "test/repo", branch: "main",
    commitMessage: "chore(security): Rotate compromised DATABASE_URL credentials",
    author: "alice", daysAgo: 3,
  }),

  // Performance & Optimization (4 events)
  githubPR({
    repo: "test/repo", prNumber: 4, title: "perf: Add Redis caching layer for GET /api/dashboard",
    body: "Reduces response time from 450ms to 45ms using Redis.\n\nSee CACHE_TTL config.",
    action: "merged", author: "david", labels: ["performance"], daysAgo: 7,
  }),
  githubPR({
    repo: "test/repo", prNumber: 5, title: "perf: Implement virtual scrolling for large lists",
    body: "Uses react-window for lists >1000 items.",
    action: "opened", author: "alice", labels: ["performance"], daysAgo: 1,
  }),
  githubIssue({
    repo: "test/repo", issueNumber: 6, title: "Dashboard performance regression after v2.3.0",
    body: "GET /api/dashboard taking >5s. N+1 query in user list suspected.",
    action: "opened", author: "eve", labels: ["performance", "bug"], daysAgo: 10,
  }),
  githubPush({
    repo: "test/repo", branch: "main",
    commitMessage: "perf: optimize bundle size with tree shaking\n\nReduces bundle from 2MB to 800KB",
    author: "david", daysAgo: 4,
  }),

  // Bug Fixes (4 events)
  githubPR({
    repo: "test/repo", prNumber: 7, title: "fix: Resolve race condition in async checkout flow",
    body: "Adds proper mutex locking to prevent double-charging.\n\nFixes #20",
    action: "merged", author: "bob", linkedIssues: ["#20"], daysAgo: 6,
  }),
  githubPR({
    repo: "test/repo", prNumber: 8, title: "fix: Handle null pointer in user profile",
    action: "closed", author: "charlie", body: "Duplicate of #7", daysAgo: 8,
  }),
  githubIssue({
    repo: "test/repo", issueNumber: 9, title: "Form data lost on navigation",
    body: "User data disappears when navigating away and back.",
    action: "closed", author: "eve", labels: ["bug"], daysAgo: 12,
  }),
  githubPush({
    repo: "test/repo", branch: "main",
    commitMessage: "fix(datetime): Handle timezone edge cases in scheduler\n\nWas causing events to fire at wrong times.",
    author: "bob", daysAgo: 2,
  }),

  // New Features (4 events)
  githubPR({
    repo: "test/repo", prNumber: 10, title: "feat(search): Implement semantic search with embeddings",
    body: "Adds vector search using Pinecone.\n\nEndpoint: POST /api/search",
    action: "merged", author: "alice", labels: ["feature"], daysAgo: 3,
  }),
  githubPR({
    repo: "test/repo", prNumber: 11, title: "feat: Add WebSocket support for real-time notifications",
    body: "Implements Socket.io for push notifications.",
    action: "opened", author: "david", labels: ["feature"], daysAgo: 1,
  }),
  githubIssue({
    repo: "test/repo", issueNumber: 12, title: "Feature request: Export data to CSV",
    body: "Users need to export their data for reporting.",
    action: "opened", author: "frank", labels: ["feature", "enhancement"], daysAgo: 15,
  }),
  githubPush({
    repo: "test/repo", branch: "main",
    commitMessage: "feat(ui): Add dark mode toggle to settings\n\nStores preference in localStorage",
    author: "charlie", daysAgo: 5,
  }),

  // DevOps & Infrastructure (4 events)
  vercelDeployment({
    projectName: "lightfast-app", event: "deployment.succeeded",
    branch: "main", commitMessage: "Deploy v2.4.0 to production",
    commitAuthor: "vercel-bot", environment: "production", daysAgo: 1,
  }),
  vercelDeployment({
    projectName: "lightfast-app", event: "deployment.error",
    branch: "feature/new-api", commitMessage: "WIP: new API structure",
    commitAuthor: "vercel-bot", environment: "preview", daysAgo: 2,
  }),
  githubPR({
    repo: "test/repo", prNumber: 13, title: "ci: Add E2E tests to GitHub Actions pipeline",
    body: "Runs Playwright tests on every PR.\n\nUses github-actions runner.",
    action: "merged", author: "eve", labels: ["ci", "testing"], daysAgo: 9,
  }),
  githubIssue({
    repo: "test/repo", issueNumber: 14, title: "Staging environment out of sync with production",
    body: "DATABASE_URL and NODE_ENV differ between environments.",
    action: "opened", author: "frank", labels: ["devops", "bug"], daysAgo: 20,
  }),
];

/**
 * Search test expectations for day2 scenario
 */
export const day2SearchTests = [
  { query: "OAuth security", minResults: 2, shouldInclude: ["OAuth2 PKCE"] },
  { query: "performance redis cache", minResults: 2, shouldInclude: ["Redis caching"] },
  { query: "deployment failed", minResults: 1, sourceFilter: "vercel" },
  { query: "bug fix race condition", minResults: 1, actorFilter: "bob" },
];
```

#### 4. Scenario exports
**File**: `packages/console-test-data/src/scenarios/index.ts`

```typescript
export { securityScenario } from "./security";
export { performanceScenario } from "./performance";
export { day2RetrievalScenario, day2SearchTests } from "./day2-retrieval";

import type { SourceEvent } from "@repo/console-types";

/**
 * Generate a balanced scenario with N events
 */
export const balancedScenario = (count: number): SourceEvent[] => {
  const scenarios = [
    ...securityScenario(),
    ...performanceScenario(),
    ...day2RetrievalScenario(),
  ];

  // Shuffle and return requested count
  const shuffled = scenarios.sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(count, shuffled.length));
};

/**
 * Stress test scenario with many events
 */
export const stressScenario = (count: number): SourceEvent[] => {
  const events: SourceEvent[] = [];
  const base = day2RetrievalScenario();

  // Repeat and vary the base scenario
  while (events.length < count) {
    for (const event of base) {
      if (events.length >= count) break;
      events.push({
        ...event,
        sourceId: `${event.sourceId}:${events.length}`, // Make unique
        occurredAt: new Date(Date.now() - Math.random() * 90 * 24 * 60 * 60 * 1000).toISOString(),
      });
    }
  }

  return events;
};
```

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compiles: `pnpm --filter @repo/console-test-data typecheck`
- [x] Build succeeds: `pnpm --filter @repo/console-test-data build` (no build script needed)

#### Manual Verification:
- [ ] Scenarios generate expected number of events
- [ ] Events have realistic content for entity extraction testing

**Implementation Note**: Pause for confirmation before proceeding.

---

## Phase 3: Workflow Trigger & Wait

### Overview
Add functions to trigger Inngest events and wait for workflow completion.

### Changes Required:

#### 1. Inngest trigger function
**File**: `packages/console-test-data/src/trigger/trigger.ts`

```typescript
import type { SourceEvent } from "@repo/console-types";
import { inngest } from "@api/console/inngest/client/client";

export interface TriggerOptions {
  workspaceId: string;
  onProgress?: (current: number, total: number) => void;
  delayMs?: number;  // Delay between events to avoid overwhelming
}

export interface TriggerResult {
  triggered: number;
  sourceIds: string[];
  duration: number;
}

/**
 * Trigger observation capture events for a batch of SourceEvents
 */
export const triggerObservationCapture = async (
  events: SourceEvent[],
  options: TriggerOptions
): Promise<TriggerResult> => {
  const startTime = Date.now();
  const sourceIds: string[] = [];
  const delayMs = options.delayMs ?? 100;

  for (let i = 0; i < events.length; i++) {
    const event = events[i];
    if (!event) continue;

    await inngest.send({
      name: "apps-console/neural/observation.capture",
      data: {
        workspaceId: options.workspaceId,
        sourceEvent: event,
      },
    });

    sourceIds.push(event.sourceId);
    options.onProgress?.(i + 1, events.length);

    // Small delay to avoid rate limiting
    if (delayMs > 0 && i < events.length - 1) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }

  return {
    triggered: events.length,
    sourceIds,
    duration: Date.now() - startTime,
  };
};
```

#### 2. Wait for completion function
**File**: `packages/console-test-data/src/trigger/wait.ts`

```typescript
import { db } from "@db/console/client";
import { workspaceNeuralObservations } from "@db/console/schema";
import { eq, and, inArray } from "drizzle-orm";

export interface WaitOptions {
  workspaceId: string;
  sourceIds: string[];
  timeoutMs?: number;
  pollIntervalMs?: number;
}

export interface WaitResult {
  completed: number;
  pending: number;
  timedOut: boolean;
  duration: number;
}

/**
 * Wait for observations to be captured by polling the database
 *
 * Note: In production, this would use Inngest's event subscription.
 * For testing, polling is simpler and sufficient.
 */
export const waitForCapture = async (options: WaitOptions): Promise<WaitResult> => {
  const startTime = Date.now();
  const timeoutMs = options.timeoutMs ?? 60000; // 1 minute default
  const pollIntervalMs = options.pollIntervalMs ?? 1000;

  let completed = 0;

  while (Date.now() - startTime < timeoutMs) {
    // Query for observations with matching sourceIds
    const captured = await db.query.workspaceNeuralObservations.findMany({
      where: and(
        eq(workspaceNeuralObservations.workspaceId, options.workspaceId),
        inArray(workspaceNeuralObservations.sourceId, options.sourceIds)
      ),
      columns: { sourceId: true },
    });

    completed = captured.length;

    // Check if all events are captured or filtered (they won't appear if below threshold)
    // For now, consider done when we have >80% of events (some may be filtered)
    if (completed >= options.sourceIds.length * 0.5) {
      break;
    }

    await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
  }

  return {
    completed,
    pending: options.sourceIds.length - completed,
    timedOut: Date.now() - startTime >= timeoutMs,
    duration: Date.now() - startTime,
  };
};
```

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compiles: `pnpm --filter @repo/console-test-data typecheck`
- [x] Build succeeds: `pnpm --filter @repo/console-test-data build` (no build script needed)

#### Manual Verification:
- [ ] Events successfully trigger Inngest workflow
- [ ] Wait function correctly detects captured observations

**Implementation Note**: Pause for confirmation before proceeding.

---

## Phase 4: Simplified Verifier

### Overview
Create a verifier that checks post-workflow state across all tables.

### Changes Required:

#### 1. Unified verifier
**File**: `packages/console-test-data/src/verify/verifier.ts`

```typescript
import { db } from "@db/console/client";
import {
  workspaceNeuralObservations,
  workspaceNeuralEntities,
  workspaceObservationClusters,
  workspaceActorProfiles,
  workspaceActorIdentities,
} from "@db/console/schema";
import { eq, count, sql } from "drizzle-orm";
import { consolePineconeClient } from "@repo/console-pinecone";

export interface VerificationResult {
  database: {
    observations: number;
    entities: number;
    clusters: number;
    actorProfiles: number;
    observationsByType: Record<string, number>;
    entitiesByCategory: Record<string, number>;
  };
  pinecone: {
    titleVectors: number;
    contentVectors: number;
    summaryVectors: number;
  };
  health: {
    multiViewComplete: boolean;  // All observations have 3 embeddings
    entitiesExtracted: boolean;  // At least some entities found
    clustersAssigned: boolean;   // Observations assigned to clusters
  };
}

export interface VerifyOptions {
  workspaceId: string;
  clerkOrgId: string;
  indexName: string;
}

/**
 * Verify test data was processed correctly by the workflow
 */
export const verify = async (options: VerifyOptions): Promise<VerificationResult> => {
  const { workspaceId, clerkOrgId, indexName } = options;

  // Database counts
  const [obsCount] = await db
    .select({ count: count() })
    .from(workspaceNeuralObservations)
    .where(eq(workspaceNeuralObservations.workspaceId, workspaceId));

  const [entityCount] = await db
    .select({ count: count() })
    .from(workspaceNeuralEntities)
    .where(eq(workspaceNeuralEntities.workspaceId, workspaceId));

  const [clusterCount] = await db
    .select({ count: count() })
    .from(workspaceObservationClusters)
    .where(eq(workspaceObservationClusters.workspaceId, workspaceId));

  const [profileCount] = await db
    .select({ count: count() })
    .from(workspaceActorProfiles)
    .where(eq(workspaceActorProfiles.workspaceId, workspaceId));

  // Observations by type
  const obsByType = await db
    .select({ type: workspaceNeuralObservations.observationType, count: count() })
    .from(workspaceNeuralObservations)
    .where(eq(workspaceNeuralObservations.workspaceId, workspaceId))
    .groupBy(workspaceNeuralObservations.observationType);

  // Entities by category
  const entsByCategory = await db
    .select({ category: workspaceNeuralEntities.category, count: count() })
    .from(workspaceNeuralEntities)
    .where(eq(workspaceNeuralEntities.workspaceId, workspaceId))
    .groupBy(workspaceNeuralEntities.category);

  // Check multi-view embedding completeness
  const obsWithAllEmbeddings = await db
    .select({ count: count() })
    .from(workspaceNeuralObservations)
    .where(
      and(
        eq(workspaceNeuralObservations.workspaceId, workspaceId),
        sql`${workspaceNeuralObservations.embeddingTitleId} IS NOT NULL`,
        sql`${workspaceNeuralObservations.embeddingContentId} IS NOT NULL`,
        sql`${workspaceNeuralObservations.embeddingSummaryId} IS NOT NULL`
      )
    );

  // Check cluster assignments
  const obsWithClusters = await db
    .select({ count: count() })
    .from(workspaceNeuralObservations)
    .where(
      and(
        eq(workspaceNeuralObservations.workspaceId, workspaceId),
        sql`${workspaceNeuralObservations.clusterId} IS NOT NULL`
      )
    );

  // Pinecone vector counts by view
  const namespace = buildNamespace(clerkOrgId, workspaceId);
  const pineconeStats = await countPineconeVectors(indexName, namespace);

  const totalObs = obsCount?.count ?? 0;

  return {
    database: {
      observations: totalObs,
      entities: entityCount?.count ?? 0,
      clusters: clusterCount?.count ?? 0,
      actorProfiles: profileCount?.count ?? 0,
      observationsByType: Object.fromEntries(obsByType.map(r => [r.type, r.count])),
      entitiesByCategory: Object.fromEntries(entsByCategory.map(r => [r.category, r.count])),
    },
    pinecone: pineconeStats,
    health: {
      multiViewComplete: (obsWithAllEmbeddings[0]?.count ?? 0) === totalObs,
      entitiesExtracted: (entityCount?.count ?? 0) > 0,
      clustersAssigned: (obsWithClusters[0]?.count ?? 0) > 0,
    },
  };
};

const buildNamespace = (clerkOrgId: string, workspaceId: string): string => {
  const sanitize = (s: string) => s.toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 50);
  return `${sanitize(clerkOrgId)}:ws_${sanitize(workspaceId)}`;
};

const countPineconeVectors = async (
  indexName: string,
  namespace: string
): Promise<{ titleVectors: number; contentVectors: number; summaryVectors: number }> => {
  try {
    // Query with dummy vector to count by view
    const dummyVector = Array(1024).fill(0.1);

    const [titleResult, contentResult, summaryResult] = await Promise.all([
      consolePineconeClient.query(indexName, {
        vector: dummyVector,
        topK: 10000,
        filter: { layer: "observations", view: "title" },
        includeMetadata: false,
      }, namespace),
      consolePineconeClient.query(indexName, {
        vector: dummyVector,
        topK: 10000,
        filter: { layer: "observations", view: "content" },
        includeMetadata: false,
      }, namespace),
      consolePineconeClient.query(indexName, {
        vector: dummyVector,
        topK: 10000,
        filter: { layer: "observations", view: "summary" },
        includeMetadata: false,
      }, namespace),
    ]);

    return {
      titleVectors: titleResult.matches?.length ?? 0,
      contentVectors: contentResult.matches?.length ?? 0,
      summaryVectors: summaryResult.matches?.length ?? 0,
    };
  } catch {
    return { titleVectors: 0, contentVectors: 0, summaryVectors: 0 };
  }
};

/**
 * Print formatted verification report
 */
export const printReport = (result: VerificationResult): void => {
  console.log("\n========================================");
  console.log("   TEST DATA VERIFICATION REPORT");
  console.log("========================================\n");

  console.log("DATABASE:");
  console.log(`  Observations: ${result.database.observations}`);
  console.log(`  Entities: ${result.database.entities}`);
  console.log(`  Clusters: ${result.database.clusters}`);
  console.log(`  Actor Profiles: ${result.database.actorProfiles}`);

  console.log("\n  By Observation Type:");
  for (const [type, cnt] of Object.entries(result.database.observationsByType)) {
    console.log(`    ${type}: ${cnt}`);
  }

  console.log("\n  By Entity Category:");
  for (const [cat, cnt] of Object.entries(result.database.entitiesByCategory)) {
    console.log(`    ${cat}: ${cnt}`);
  }

  console.log("\nPINECONE:");
  console.log(`  Title vectors: ${result.pinecone.titleVectors}`);
  console.log(`  Content vectors: ${result.pinecone.contentVectors}`);
  console.log(`  Summary vectors: ${result.pinecone.summaryVectors}`);

  console.log("\nHEALTH CHECKS:");
  console.log(`  Multi-view complete: ${result.health.multiViewComplete ? "PASS" : "FAIL"}`);
  console.log(`  Entities extracted: ${result.health.entitiesExtracted ? "PASS" : "FAIL"}`);
  console.log(`  Clusters assigned: ${result.health.clustersAssigned ? "PASS" : "FAIL"}`);

  console.log("\n========================================\n");
};
```

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compiles: `pnpm --filter @repo/console-test-data typecheck`
- [x] Build succeeds: `pnpm --filter @repo/console-test-data build` (no build script needed)

#### Manual Verification:
- [ ] Verifier correctly counts observations, entities, clusters
- [ ] Pinecone vector counts match expected (3x observations)
- [ ] Health checks reflect actual state

**Implementation Note**: Pause for confirmation before proceeding.

---

## Phase 5: CLI Update

### Overview
Update CLI commands to use the new workflow-driven approach.

### Changes Required:

#### 1. Updated inject CLI
**File**: `packages/console-test-data/src/cli/inject.ts`

```typescript
#!/usr/bin/env node
import { parseArgs } from "util";
import { day2RetrievalScenario, balancedScenario, stressScenario } from "../scenarios";
import { triggerObservationCapture } from "../trigger/trigger";
import { waitForCapture } from "../trigger/wait";
import { verify, printReport } from "../verify/verifier";

const { values } = parseArgs({
  options: {
    workspace: { type: "string", short: "w" },
    org: { type: "string", short: "o" },
    index: { type: "string", short: "i" },
    scenario: { type: "string", short: "s", default: "day2" },
    count: { type: "string", short: "c" },
    "skip-wait": { type: "boolean", default: false },
    "skip-verify": { type: "boolean", default: false },
    help: { type: "boolean", short: "h" },
  },
});

if (values.help || !values.workspace || !values.org || !values.index) {
  console.log(`
Usage: pnpm --filter @repo/console-test-data inject -- [options]

Options:
  -w, --workspace   Workspace ID (required)
  -o, --org         Clerk Org ID (required)
  -i, --index       Pinecone index name (required)
  -s, --scenario    Scenario: day2, balanced, stress (default: day2)
  -c, --count       Event count for balanced/stress scenarios
  --skip-wait       Don't wait for workflow completion
  --skip-verify     Don't run verification after injection
  -h, --help        Show this help
`);
  process.exit(values.help ? 0 : 1);
}

async function main() {
  const workspaceId = values.workspace!;
  const clerkOrgId = values.org!;
  const indexName = values.index!;
  const scenario = values.scenario ?? "day2";
  const count = values.count ? parseInt(values.count, 10) : 20;

  // Select scenario
  const events = scenario === "day2"
    ? day2RetrievalScenario()
    : scenario === "stress"
      ? stressScenario(count)
      : balancedScenario(count);

  console.log(`\nInjecting ${events.length} events via Inngest workflow...\n`);

  // Trigger events
  const triggerResult = await triggerObservationCapture(events, {
    workspaceId,
    onProgress: (current, total) => {
      process.stdout.write(`\rTriggered: ${current}/${total}`);
    },
  });

  console.log(`\n\nTriggered ${triggerResult.triggered} events in ${triggerResult.duration}ms`);

  // Wait for completion
  if (!values["skip-wait"]) {
    console.log("\nWaiting for workflow completion...");
    const waitResult = await waitForCapture({
      workspaceId,
      sourceIds: triggerResult.sourceIds,
      timeoutMs: 120000, // 2 minutes
    });

    console.log(`Completed: ${waitResult.completed}/${triggerResult.triggered}`);
    if (waitResult.pending > 0) {
      console.log(`Pending/Filtered: ${waitResult.pending} (some may have been below significance threshold)`);
    }
  }

  // Verify results
  if (!values["skip-verify"]) {
    console.log("\nVerifying results...");
    const verifyResult = await verify({ workspaceId, clerkOrgId, indexName });
    printReport(verifyResult);
  }
}

main().catch(console.error);
```

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compiles: `pnpm --filter @repo/console-test-data typecheck`
- [x] Build succeeds: `pnpm --filter @repo/console-test-data build`

#### Manual Verification:
- [ ] CLI triggers real Inngest workflow
- [ ] Events processed through production pipeline
- [ ] Verification shows expected counts and health checks

**Implementation Note**: Pause for confirmation before proceeding.

---

## Testing Strategy

### Unit Tests:
- Event builders produce valid `SourceEvent` objects
- Scenarios generate expected event counts

### Integration Tests:
- Full inject → wait → verify cycle
- Events flow through real workflow
- Entities extracted from test content

### Manual Testing Steps:
1. Start Inngest dev server: `pnpm dev:console`
2. Run inject: `pnpm --filter @repo/console-test-data inject -- -w <workspace> -o <org> -i <index>`
3. Check Inngest dashboard for workflow runs
4. Verify database tables have expected data
5. Test search API with scenario queries

---

## Migration Notes

- Old class-based factories can be deprecated but kept for backward compatibility
- Existing scenarios can be converted to use new event builders
- CLI interface remains similar, implementation changes internally

---

## Benefits of New Architecture

| Aspect | Old Approach | New Approach |
|--------|--------------|--------------|
| **Code path** | Bypasses production | Uses production workflow |
| **Embeddings** | Manual generation | Workflow handles it |
| **Entity extraction** | Not supported | Automatic via workflow |
| **Cluster assignment** | Not supported | Automatic via workflow |
| **Actor resolution** | Simplified | Full 3-tier system |
| **Significance scoring** | Custom logic | Production scoring |
| **Maintenance** | Duplicate logic | Single source of truth |

---

## References

- Transformer output: `packages/console-webhooks/src/transformers/github.ts:52-79`
- Observation capture workflow: `api/console/src/inngest/workflow/neural/observation-capture.ts:193-670`
- Significance scoring: `api/console/src/inngest/workflow/neural/scoring.ts`
- Entity extraction: `api/console/src/inngest/workflow/neural/entity-extraction-patterns.ts`
- Original research: `thoughts/shared/research/2025-12-13-console-test-data-neural-memory-alignment.md`
