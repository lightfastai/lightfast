---
title: "Phase 3: GitHub Ingestion"
description: PR and Issue webhook handlers, GitHub event to observation transformers
status: not_started
phase: 3
parent: "./README.md"
depends_on: ["./phase-02-observation-pipeline.md"]
blocks: ["./phase-06-embedding-storage.md"]
---

# Phase 3: GitHub Ingestion

**Status**: Not Started
**Parent Plan**: [Implementation Plan](./README.md)

## Overview

Add GitHub PR and Issue event handlers to the existing webhook route. Transform GitHub events into the source-agnostic format expected by the observation capture pipeline.

## Prerequisites

- [ ] Phase 2 completed and verified
- [ ] Observation capture workflow functioning
- [ ] GitHub App already configured (existing infrastructure)

## Changes Required

### 1. Add PR Event Handler

**File**: `apps/console/src/app/(github)/api/github/webhooks/route.ts`
**Action**: Modify

Add after existing `handlePushEvent` function (~line 145):

```typescript
/**
 * Handle GitHub Pull Request events
 * Events: opened, closed, merged, review_requested, review_submitted
 */
async function handlePullRequestEvent(
  payload: PullRequestEvent,
  deliveryId: string
) {
  const action = payload.action;

  // Only capture significant PR events
  const significantActions = [
    "opened",
    "closed",
    "merged",
    "review_requested",
    "review_submitted",
  ];

  if (!significantActions.includes(action)) {
    console.log(`[Webhook] Ignoring PR action: ${action}`);
    return;
  }

  // Resolve workspace
  const ownerLogin = payload.repository.full_name.split("/")[0]?.toLowerCase();
  if (!ownerLogin) {
    console.error(`[Webhook] Missing owner login in ${payload.repository.full_name}`);
    return;
  }

  const workspacesService = new WorkspacesService();
  const workspace = await workspacesService.resolveFromGithubOrgSlug(ownerLogin);

  if (!workspace) {
    console.error(`[Webhook] No workspace found for GitHub org: ${ownerLogin}`);
    return;
  }

  const { workspaceId, workspaceKey } = workspace;

  // Resolve source and store
  const sourcesService = new SourcesService();
  const sourceId = await sourcesService.getSourceIdByGithubRepoId(
    workspaceId,
    payload.repository.id.toString()
  );

  if (!sourceId) {
    console.error(
      `[Webhook] No workspace source found for repo ${payload.repository.full_name}`
    );
    return;
  }

  // Get default store
  const store = await db.query.workspaceStores.findFirst({
    where: and(
      eq(workspaceStores.workspaceId, workspaceId),
      eq(workspaceStores.slug, "default")
    ),
  });

  if (!store) {
    console.error(`[Webhook] No default store for workspace: ${workspaceId}`);
    return;
  }

  // Build PR event data
  const pr = payload.pull_request;
  const isMerged = action === "closed" && pr.merged;
  const eventType = isMerged ? "pull_request_merged" : `pull_request_${action}`;

  // Extract references (linked issues, reviewers)
  const references: Array<{ type: string; id: string; url?: string }> = [];

  // Add linked issues from PR body
  const issueMatches = pr.body?.match(/#(\d+)/g) || [];
  for (const match of issueMatches) {
    const issueNum = match.replace("#", "");
    references.push({
      type: "issue",
      id: `${payload.repository.full_name}#${issueNum}`,
      url: `https://github.com/${payload.repository.full_name}/issues/${issueNum}`,
    });
  }

  // Add reviewers if present
  if (payload.requested_reviewer) {
    references.push({
      type: "reviewer",
      id: payload.requested_reviewer.login,
      url: `https://github.com/${payload.requested_reviewer.login}`,
    });
  }

  // Emit observation capture event
  await inngest.send({
    name: "apps-console/neural/observation.capture",
    data: {
      workspaceId,
      storeId: store.id,
      sourceEvent: {
        source: "github",
        sourceType: eventType,
        sourceId: `pr:${payload.repository.full_name}#${pr.number}`,
        title: `[PR ${isMerged ? "Merged" : action.charAt(0).toUpperCase() + action.slice(1)}] ${pr.title}`,
        body: pr.body ?? undefined,
        actor: pr.user
          ? {
              id: pr.user.id.toString(),
              name: pr.user.login,
              email: pr.user.email ?? undefined,
              avatarUrl: pr.user.avatar_url,
            }
          : undefined,
        occurredAt: pr.updated_at,
        references,
        metadata: {
          deliveryId,
          prNumber: pr.number,
          prUrl: pr.html_url,
          repoFullName: payload.repository.full_name,
          baseBranch: pr.base.ref,
          headBranch: pr.head.ref,
          commits: pr.commits,
          additions: pr.additions,
          deletions: pr.deletions,
          changedFiles: pr.changed_files,
          merged: isMerged,
          mergedBy: isMerged ? pr.merged_by?.login : undefined,
        },
      },
    },
  });

  console.log(
    `[Webhook] PR ${eventType} event sent for ${payload.repository.full_name}#${pr.number}`
  );
}
```

**Why**: Transform GitHub PR events into observations for engineering memory.

### 2. Add Issue Event Handler

**File**: `apps/console/src/app/(github)/api/github/webhooks/route.ts`
**Action**: Modify (add after handlePullRequestEvent)

```typescript
/**
 * Handle GitHub Issues events
 * Events: opened, closed, reopened, assigned, labeled
 */
async function handleIssuesEvent(
  payload: IssuesEvent,
  deliveryId: string
) {
  const action = payload.action;

  // Only capture significant issue events
  const significantActions = ["opened", "closed", "reopened", "assigned"];

  if (!significantActions.includes(action)) {
    console.log(`[Webhook] Ignoring issue action: ${action}`);
    return;
  }

  // Resolve workspace
  const ownerLogin = payload.repository.full_name.split("/")[0]?.toLowerCase();
  if (!ownerLogin) {
    console.error(`[Webhook] Missing owner login in ${payload.repository.full_name}`);
    return;
  }

  const workspacesService = new WorkspacesService();
  const workspace = await workspacesService.resolveFromGithubOrgSlug(ownerLogin);

  if (!workspace) {
    console.error(`[Webhook] No workspace found for GitHub org: ${ownerLogin}`);
    return;
  }

  const { workspaceId } = workspace;

  // Resolve source and store
  const sourcesService = new SourcesService();
  const sourceId = await sourcesService.getSourceIdByGithubRepoId(
    workspaceId,
    payload.repository.id.toString()
  );

  if (!sourceId) {
    console.error(
      `[Webhook] No workspace source found for repo ${payload.repository.full_name}`
    );
    return;
  }

  // Get default store
  const store = await db.query.workspaceStores.findFirst({
    where: and(
      eq(workspaceStores.workspaceId, workspaceId),
      eq(workspaceStores.slug, "default")
    ),
  });

  if (!store) {
    console.error(`[Webhook] No default store for workspace: ${workspaceId}`);
    return;
  }

  const issue = payload.issue;

  // Extract references (linked PRs, mentions)
  const references: Array<{ type: string; id: string; url?: string }> = [];

  // Add linked PRs from issue body
  const prMatches = issue.body?.match(/(?:closes|fixes|resolves)\s+#(\d+)/gi) || [];
  for (const match of prMatches) {
    const prNum = match.match(/#(\d+)/)?.[1];
    if (prNum) {
      references.push({
        type: "pull_request",
        id: `${payload.repository.full_name}#${prNum}`,
        url: `https://github.com/${payload.repository.full_name}/pull/${prNum}`,
      });
    }
  }

  // Add assignee if present
  if (payload.assignee) {
    references.push({
      type: "assignee",
      id: payload.assignee.login,
      url: `https://github.com/${payload.assignee.login}`,
    });
  }

  // Emit observation capture event
  await inngest.send({
    name: "apps-console/neural/observation.capture",
    data: {
      workspaceId,
      storeId: store.id,
      sourceEvent: {
        source: "github",
        sourceType: `issues_${action}`,
        sourceId: `issue:${payload.repository.full_name}#${issue.number}`,
        title: `[Issue ${action.charAt(0).toUpperCase() + action.slice(1)}] ${issue.title}`,
        body: issue.body ?? undefined,
        actor: issue.user
          ? {
              id: issue.user.id.toString(),
              name: issue.user.login,
              email: issue.user.email ?? undefined,
              avatarUrl: issue.user.avatar_url,
            }
          : undefined,
        occurredAt: issue.updated_at,
        references,
        metadata: {
          deliveryId,
          issueNumber: issue.number,
          issueUrl: issue.html_url,
          repoFullName: payload.repository.full_name,
          state: issue.state,
          labels: issue.labels?.map((l) => l.name) ?? [],
          assignees: issue.assignees?.map((a) => a.login) ?? [],
          comments: issue.comments,
        },
      },
    },
  });

  console.log(
    `[Webhook] Issue ${action} event sent for ${payload.repository.full_name}#${issue.number}`
  );
}
```

**Why**: Transform GitHub Issue events into observations.

### 3. Update Webhook Router

**File**: `apps/console/src/app/(github)/api/github/webhooks/route.ts`
**Action**: Modify

Find the switch statement in the POST handler and add cases:

```typescript
switch (event) {
  case "push":
    await handlePushEvent(body as PushEvent, deliveryId);
    break;

  // Add these new cases:
  case "pull_request":
    await handlePullRequestEvent(body as PullRequestEvent, deliveryId);
    break;

  case "issues":
    await handleIssuesEvent(body as IssuesEvent, deliveryId);
    break;

  // Existing cases...
}
```

**Why**: Route new event types to appropriate handlers.

### 4. Add Type Imports

**File**: `apps/console/src/app/(github)/api/github/webhooks/route.ts`
**Action**: Modify (add imports)

```typescript
import type {
  InstallationRepositoriesEvent,
  InstallationEvent,
  RepositoryEvent,
  PushEvent,
  PullRequestEvent,  // Add
  IssuesEvent,       // Add
} from "@octokit/webhooks-types";
```

**Why**: Type safety for webhook payloads.

### 5. Add Required Imports

**File**: `apps/console/src/app/(github)/api/github/webhooks/route.ts`
**Action**: Modify (ensure these imports exist)

```typescript
import { db } from "@db/console";
import { workspaceStores } from "@db/console/schema";
import { and, eq } from "drizzle-orm";
import { inngest } from "@api/console/inngest";
```

**Why**: Database and Inngest access for the new handlers.

## Database Changes

No new migrations - uses tables created in Phase 1.

## Success Criteria

### Automated Verification:
- [ ] Type checking passes: `pnpm typecheck`
- [ ] Linting passes: `pnpm lint`
- [ ] Build succeeds: `pnpm build:console`

### Manual Verification:
- [ ] Open a PR in a connected GitHub repo
- [ ] Verify `neural/observation.capture` event appears in Inngest dashboard
- [ ] Verify observation stored in database with correct fields
- [ ] Merge the PR, verify merged event captured
- [ ] Open an issue, verify issue observation captured
- [ ] Close the issue, verify closed event captured
- [ ] Check actor identity created/matched correctly

## Rollback Plan

1. Remove `handlePullRequestEvent` and `handleIssuesEvent` functions
2. Remove case statements from switch
3. Remove type imports
4. GitHub webhooks continue to work for push events only

---

**CHECKPOINT**: After completing this phase, GitHub PR and Issue events will flow through the neural memory pipeline.

---

**Previous Phase**: [Phase 2: Observation Pipeline](./phase-02-observation-pipeline.md)
**Next Phase**: [Phase 4: Vercel Ingestion](./phase-04-vercel-ingestion.md) (can be done in parallel)
