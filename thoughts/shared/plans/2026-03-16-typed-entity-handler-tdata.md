# Fix Backfill Adapter Type-Loss — GitHub & Vercel

## Overview

Remove the `as unknown as Record<string, unknown>` casts in GitHub and Vercel backfill adapters that discard Zod inference after `.parse()`. Fix the adapter function signatures to accept Zod-inferred types directly. Bring Vercel into `typedEntityHandler` (it's the only provider skipping it). No changes to `define.ts`, no Sentry/Linear migration — they're already correct.

## Current State Analysis

The gateway returns `data: unknown`. Each `processResponse` calls `.parse(data)` to get a typed value, then immediately throws that type away:

- **GitHub** `backfill.ts:101`: `adaptGitHubPRForTransformer(pr as unknown as Record<string, unknown>, repoData)` — Zod gave us a typed `GitHubPR`, we discard it
- **GitHub** `backfill.ts:150`: `adaptGitHubIssueForTransformer(issue as unknown as Record<string, unknown>, repoData)` — same
- **Vercel** `backfill.ts:106`: `adaptVercelDeploymentForTransformer(deployment as unknown as Record<string, unknown>, projectName)` — same

Inside the adapters, fields are re-cast manually (`pr.state as string`, `deployment.uid as string`, etc.) even though Zod already guaranteed those types.

**Sentry and Linear have no problem** — `adaptSentryIssueForTransformer(issue: SentryIssue)`, `adaptLinearIssueForTransformer(issue, ctx)` etc. already accept Zod-inferred types directly from `.parse()`. They are untouched.

## Desired End State

- `adaptGitHubPRForTransformer(pr: GitHubPR, ...)` — no `Record<string, unknown>`, no field casts inside
- `adaptGitHubIssueForTransformer(issue: GitHubIssue, ...)` — same
- `adaptVercelDeploymentForTransformer(deployment: VercelDeployment & { uid: string }, ...)` — same
- Vercel `deployment` handler uses `typedEntityHandler`
- Zero `as unknown as Record<string, unknown>` casts in any backfill adapter

## What We're NOT Doing

- Not changing `define.ts` or `typedEntityHandler` — the `TData` generic extension is a separate concern
- Not touching Sentry or Linear — already correct
- Not changing `entity-worker.ts` — call site is unchanged
- Not removing the `as unknown as PreTransformGitHub*` return casts inside adapters — `buildRepoData` returns an intentionally partial `Record<string, unknown>`, so the cast at the adapter return stays
- Not adding `responseSchema` to `typedEntityHandler` — out of scope

---

## Phase 1: Fix GitHub adapter signatures

### Overview
Change both adapter function params from `Record<string, unknown>` to Zod-inferred types. Remove the `as unknown as Record<string, unknown>` casts at the `processResponse` call sites. Remove manual field casts inside the adapters.

### Changes Required

#### 1. Add type aliases + update adapter signatures — `packages/console-providers/src/providers/github/backfill.ts`

After the existing imports, add:
```typescript
type GitHubPR = z.infer<typeof githubPullRequestSchema>;
type GitHubIssue = z.infer<typeof githubIssueSchema>;
```

Replace `adaptGitHubPRForTransformer` (lines 16–31):
```typescript
export function adaptGitHubPRForTransformer(
  pr: GitHubPR,
  repo: Record<string, unknown>
): PreTransformGitHubPullRequestEvent {
  const action = pr.state === "open" ? "opened" : "closed";
  // List API may omit `merged` or return null — derive from merged_at instead
  const merged = pr.merged ?? pr.merged_at != null;
  return {
    action,
    pull_request: { ...pr, merged },
    repository: repo,
    sender: pr.user,
  } as unknown as PreTransformGitHubPullRequestEvent;
}
```

Replace `adaptGitHubIssueForTransformer` (lines 33–45):
```typescript
export function adaptGitHubIssueForTransformer(
  issue: GitHubIssue,
  repo: Record<string, unknown>
): PreTransformGitHubIssuesEvent {
  const action = issue.state === "open" ? "opened" : "closed";
  return {
    action,
    issue,
    repository: repo,
    sender: issue.user,
  } as unknown as PreTransformGitHubIssuesEvent;
}
```

#### 2. Remove casts at call sites — lines 100–103 and 149–152

```typescript
// Before (line 100-103):
payload: adaptGitHubPRForTransformer(
  pr as unknown as Record<string, unknown>,
  repoData
),

// After:
payload: adaptGitHubPRForTransformer(pr, repoData),
```

```typescript
// Before (line 149-152):
payload: adaptGitHubIssueForTransformer(
  issue as unknown as Record<string, unknown>,
  repoData
),

// After:
payload: adaptGitHubIssueForTransformer(issue, repoData),
```

#### 3. Update test fixtures — `packages/console-providers/src/providers/github/backfill.test.ts`

The test currently uses minimal plain objects like `{ state: "open", number: 1, user: { login: "alice" } }`. After the signature change these won't satisfy `GitHubPR`.

Add `githubPullRequestSchema` and `githubIssueSchema` imports and define shared base fixtures:

```typescript
import { githubIssueSchema, githubPullRequestSchema } from "./api";
import { z } from "zod";

const basePR: z.infer<typeof githubPullRequestSchema> = {
  number: 1,
  title: "Test PR",
  state: "open",
  body: null,
  user: { login: "alice", id: 1, avatar_url: "" },
  created_at: "2024-01-01T00:00:00Z",
  updated_at: "2024-01-01T00:00:00Z",
  closed_at: null,
  merged_at: null,
  html_url: "https://github.com/owner/repo/pull/1",
  head: { ref: "feature", sha: "abc123" },
  base: { ref: "main", sha: "def456" },
};

const baseIssue: z.infer<typeof githubIssueSchema> = {
  number: 10,
  title: "Test Issue",
  state: "open",
  body: null,
  user: { login: "alice", id: 1, avatar_url: "" },
  created_at: "2024-01-01T00:00:00Z",
  updated_at: "2024-01-01T00:00:00Z",
  closed_at: null,
  html_url: "https://github.com/owner/repo/issues/10",
};
```

Each individual test's `pr`/`issue` literal becomes a spread override, e.g.:
```typescript
// Before:
const pr = { state: "open", number: 1, user: { login: "alice" } };

// After:
const pr = { ...basePR, state: "open", number: 1 };
```

Apply this pattern across all test cases in `adaptGitHubPRForTransformer` and `adaptGitHubIssueForTransformer` describe blocks (lines 14–126). The `repo` fixture and `parseGitHubRateLimit` tests are unaffected.

### Success Criteria

#### Automated Verification:
- [x] Type checking passes: `pnpm typecheck`
- [x] Tests pass: `pnpm --filter @repo/console-providers test`
- [x] No linting errors: `pnpm check` (failure in unrelated `api/console/src/router/m2m/sources.ts`)

#### Manual Verification:
- [ ] `adaptGitHubPRForTransformer` and `adaptGitHubIssueForTransformer` have `GitHubPR` / `GitHubIssue` params, not `Record<string, unknown>`
- [ ] Zero `as unknown as Record<string, unknown>` casts remain in `github/backfill.ts`

---

## Phase 2: Fix Vercel adapter + adopt `typedEntityHandler`

### Overview
Change `adaptVercelDeploymentForTransformer` to accept the Zod-inferred deployment type. Wrap the inline `deployment` handler in `typedEntityHandler` to match the pattern used by every other provider. Remove the cast at the `processResponse` call site.

### Changes Required

#### 1. Add imports + type aliases — `packages/console-providers/src/providers/vercel/backfill.ts`

Add `z` import (not currently present) and type aliases:
```typescript
import { z } from "zod";
import { vercelDeploymentSchema, vercelDeploymentsResponseSchema } from "./api";

type VercelDeployment = z.infer<typeof vercelDeploymentSchema>;
```

#### 2. Update adapter signature (lines 27–30):
```typescript
// Before:
export function adaptVercelDeploymentForTransformer(
  deployment: Record<string, unknown>,
  projectName: string
)

// After:
export function adaptVercelDeploymentForTransformer(
  deployment: VercelDeployment & { uid: string },
  projectName: string
)
```

Update adapter body — remove manual field casts (lines 34–68):
```typescript
export function adaptVercelDeploymentForTransformer(
  deployment: VercelDeployment & { uid: string },
  projectName: string
): { webhookPayload: PreTransformVercelWebhookPayload; eventType: VercelWebhookEventType } {
  const eventType = mapReadyStateToEventType(deployment.readyState);
  const createdAt = deployment.created ?? Date.now();

  const webhookPayload: PreTransformVercelWebhookPayload = {
    id: `backfill-${deployment.uid}`,
    type: eventType,
    createdAt,
    payload: {
      deployment: {
        id: deployment.uid,
        name: deployment.name,
        url: deployment.url,
        readyState: deployment.readyState as
          | "READY"
          | "ERROR"
          | "BUILDING"
          | "QUEUED"
          | "CANCELED"
          | undefined,
        meta: deployment.meta as PreTransformVercelWebhookPayload["payload"]["deployment"] extends {
          meta?: infer M;
        }
          ? M
          : never,
      },
      project: {
        id: deployment.projectId ?? "",
        name: projectName,
      },
    },
  };

  return { webhookPayload, eventType };
}
```

#### 3. Wrap `deployment` handler in `typedEntityHandler` (lines 76–126):

```typescript
import { typedEntityHandler } from "../../define";

// ...

export const vercelBackfill: BackfillDef = {
  supportedEntityTypes: ["deployment"],
  defaultEntityTypes: ["deployment"],
  entityTypes: {
    deployment: typedEntityHandler<number, z.infer<typeof vercelDeploymentsResponseSchema>>({
      endpointId: "list-deployments",
      // entity-worker checks endpointId from this object — no behavioral change
      buildRequest(ctx: BackfillContext, cursor: number | null) {
        const queryParams: Record<string, string> = {
          projectId: ctx.resource.providerResourceId,
          limit: "100",
        };
        if (cursor !== null) {
          queryParams.until = String(cursor);
        }
        return { queryParams };
      },
      processResponse(parsed, ctx, _cursor) {
        // parsed is z.infer<typeof vercelDeploymentsResponseSchema> — no .parse() needed
        const projectName =
          ctx.resource.resourceName || ctx.resource.providerResourceId;
        const { deployments, pagination } = parsed;
        const sinceTimestamp = new Date(ctx.since).getTime();

        const filtered = deployments.filter(
          (deployment): deployment is typeof deployment & { uid: string } =>
            typeof deployment.uid === "string" &&
            typeof deployment.created === "number" &&
            deployment.created >= sinceTimestamp
        );

        const events: BackfillWebhookEvent[] = filtered.map((deployment) => {
          const { webhookPayload, eventType } =
            adaptVercelDeploymentForTransformer(deployment, projectName); // no cast
          return {
            deliveryId: `backfill-${ctx.installationId}-${ctx.resource.providerResourceId}-deploy-${deployment.uid}`,
            eventType,
            payload: webhookPayload,
          };
        });

        const hasMore =
          pagination.next !== null && filtered.length === deployments.length;

        return {
          events,
          nextCursor: hasMore ? pagination.next : null,
          rawCount: deployments.length,
        };
      },
    }),
  },
};
```

**Note on `typedEntityHandler<number, ...>`**: The existing cursor is `pagination.next: number | null`. `typedEntityHandler<number>` makes cursor `number | null` inside the handler — the `null` case is already handled by the factory. The cursor type change from `unknown` to `number` is safe because `entity-worker.ts` passes the value returned by the previous `processResponse.nextCursor`, which was always a number or null.

#### 4. Update Vercel test fixtures — `packages/console-providers/src/providers/vercel/backfill.test.ts`

`makeDeployment` currently returns `Record<string, unknown>`. After the signature change it needs to return `VercelDeployment & { uid: string }`. The fields it provides (`uid`, `name`, `url`, `projectId`, `readyState`, `created`, `meta`) already match `vercelDeploymentSchema` exactly — only the function's return type annotation needs updating:

```typescript
import { vercelDeploymentSchema } from "./api";
import { z } from "zod";

function makeDeployment(
  overrides: Partial<z.infer<typeof vercelDeploymentSchema>> = {}
): z.infer<typeof vercelDeploymentSchema> & { uid: string } {
  return {
    uid: "dpl-abc123",
    name: "my-app",
    url: "my-app.vercel.app",
    projectId: "prj-xyz",
    readyState: "READY",
    created: 1_700_000_000_000,
    meta: {},
    ...overrides,
  };
}
```

The test bodies themselves are unchanged — `makeDeployment` already provides the exact fields the schema and adapter expect.

### Success Criteria

#### Automated Verification:
- [x] Type checking passes: `pnpm typecheck`
- [x] Tests pass: `pnpm --filter @repo/console-providers test`
- [x] No linting errors: `pnpm check` (failure in unrelated `api/console/src/router/m2m/sources.ts`)

#### Manual Verification:
- [ ] `adaptVercelDeploymentForTransformer` param is `VercelDeployment & { uid: string }`, not `Record<string, unknown>`
- [ ] Zero `as unknown as Record<string, unknown>` casts remain in `vercel/backfill.ts`
- [ ] Vercel `deployment` handler uses `typedEntityHandler` like all other providers

---

## References

- Research doc: `thoughts/shared/research/2026-03-16-github-backfill-processresponse-types.md`
- GitHub backfill: `packages/console-providers/src/providers/github/backfill.ts`
- GitHub tests: `packages/console-providers/src/providers/github/backfill.test.ts`
- Vercel backfill: `packages/console-providers/src/providers/vercel/backfill.ts`
- Vercel tests: `packages/console-providers/src/providers/vercel/backfill.test.ts`
- `typedEntityHandler`: `packages/console-providers/src/define.ts:253-275`
- Entity worker call site: `apps/backfill/src/workflows/entity-worker.ts:110`
