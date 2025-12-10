---
title: "Phase 4: Vercel Ingestion"
description: Deployment webhook route and event handlers, Vercel to observation transformers
status: not_started
phase: 4
parent: "./README.md"
depends_on: ["./phase-02-observation-pipeline.md"]
blocks: ["./phase-06-embedding-storage.md"]
---

# Phase 4: Vercel Ingestion

**Status**: Not Started
**Parent Plan**: [Implementation Plan](./README.md)

## Overview

Create Vercel webhook infrastructure from scratch. This includes the API route for receiving webhooks, signature verification, and transformation of deployment events into observations.

**Important**: Vercel webhooks require Pro or Enterprise plan.

## Prerequisites

- [ ] Phase 2 completed and verified
- [ ] Observation capture workflow functioning
- [ ] Vercel Pro/Enterprise plan active
- [ ] `VERCEL_CLIENT_INTEGRATION_SECRET` configured in environment (used for webhook verification)

## Changes Required

### 1. Create Vercel Webhook Route

**File**: `apps/console/src/app/(vercel)/api/vercel/webhooks/route.ts`
**Action**: Create (including directory structure)

```typescript
import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { db } from "@db/console";
import { workspaceStores, orgWorkspaces } from "@db/console/schema";
import { inngest } from "@api/console/inngest";
import {
  verifyVercelWebhook,
  type VercelWebhookPayload,
  type VercelDeploymentEvent,
} from "@repo/console-webhooks";
import { env } from "@/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Handle Vercel deployment events
 */
async function handleDeploymentEvent(
  payload: VercelWebhookPayload,
  eventType: VercelDeploymentEvent
) {
  const deployment = payload.payload.deployment;
  const project = payload.payload.project;
  const team = payload.payload.team;

  if (!deployment || !project) {
    console.error("[Vercel Webhook] Missing deployment or project data");
    return;
  }

  // Resolve workspace from team ID or project name
  // For now, we'll use a simple approach: match by team ID in workspace metadata
  // This will need to be enhanced with proper Vercel integration linking
  const workspace = await findWorkspaceForVercelTeam(team?.id, project.name);

  if (!workspace) {
    console.log(
      `[Vercel Webhook] No workspace found for team ${team?.id}, project ${project.name}`
    );
    return;
  }

  const { workspaceId } = workspace;

  // Get default store
  const store = await db.query.workspaceStores.findFirst({
    where: and(
      eq(workspaceStores.workspaceId, workspaceId),
      eq(workspaceStores.slug, "default")
    ),
  });

  if (!store) {
    console.error(`[Vercel Webhook] No default store for workspace: ${workspaceId}`);
    return;
  }

  // Determine event significance and title
  const isSuccess = eventType === "deployment.succeeded" || eventType === "deployment.ready";
  const isError = eventType === "deployment.error";
  const eventTitle = getDeploymentEventTitle(eventType, deployment.name, deployment.meta);

  // Extract git metadata
  const gitMeta = deployment.meta;
  const references: Array<{ type: string; id: string; url?: string }> = [];

  // Add commit reference
  if (gitMeta?.githubCommitSha) {
    references.push({
      type: "commit",
      id: gitMeta.githubCommitSha,
      url: `https://github.com/${gitMeta.githubOrg}/${gitMeta.githubRepo}/commit/${gitMeta.githubCommitSha}`,
    });
  }

  // Add branch reference
  if (gitMeta?.githubCommitRef) {
    references.push({
      type: "branch",
      id: gitMeta.githubCommitRef,
    });
  }

  // Build actor from git metadata
  const actor = gitMeta?.githubCommitAuthorName
    ? {
        id: `github:${gitMeta.githubCommitAuthorName}`,
        name: gitMeta.githubCommitAuthorName,
      }
    : undefined;

  // Emit observation capture event
  await inngest.send({
    name: "apps-console/neural/observation.capture",
    data: {
      workspaceId,
      storeId: store.id,
      sourceEvent: {
        source: "vercel",
        sourceType: eventType,
        sourceId: `deployment:${deployment.id}`,
        title: eventTitle,
        body: buildDeploymentBody(eventType, deployment, gitMeta),
        actor,
        occurredAt: new Date(payload.createdAt).toISOString(),
        references,
        metadata: {
          webhookId: payload.id,
          deploymentId: deployment.id,
          deploymentUrl: deployment.url,
          projectId: project.id,
          projectName: project.name,
          teamId: team?.id,
          region: payload.region,
          gitCommitSha: gitMeta?.githubCommitSha,
          gitCommitRef: gitMeta?.githubCommitRef,
          gitCommitMessage: gitMeta?.githubCommitMessage,
          gitRepo: gitMeta?.githubRepo,
          gitOrg: gitMeta?.githubOrg,
          isProduction: deployment.url?.includes(project.name) && !deployment.url?.includes("-"),
        },
      },
    },
  });

  console.log(
    `[Vercel Webhook] ${eventType} event sent for deployment ${deployment.id}`
  );
}

/**
 * Find workspace associated with Vercel team
 * TODO: Enhance with proper Vercel integration linking in future phase
 */
async function findWorkspaceForVercelTeam(
  teamId: string | undefined,
  projectName: string
): Promise<{ workspaceId: string } | null> {
  // For now, search workspaces by name match
  // This is a simplified approach - in production, we'd have a proper
  // vercel integration table linking team IDs to workspaces

  if (!teamId) {
    return null;
  }

  // Try to find workspace with matching Vercel team metadata
  // This requires workspaces to have Vercel integration configured
  const workspaces = await db
    .select({ id: orgWorkspaces.id })
    .from(orgWorkspaces)
    .limit(1);

  // TODO: Add proper workspace-vercel linking
  // For MVP, return first workspace if exists (single-tenant assumption)
  if (workspaces.length > 0) {
    return { workspaceId: workspaces[0]!.id };
  }

  return null;
}

/**
 * Generate deployment event title
 */
function getDeploymentEventTitle(
  eventType: VercelDeploymentEvent,
  deploymentName: string,
  gitMeta?: VercelWebhookPayload["payload"]["deployment"]["meta"]
): string {
  const branch = gitMeta?.githubCommitRef ?? "unknown";

  switch (eventType) {
    case "deployment.created":
      return `[Deployment Started] ${deploymentName} from ${branch}`;
    case "deployment.succeeded":
    case "deployment.ready":
      return `[Deployment Succeeded] ${deploymentName} from ${branch}`;
    case "deployment.error":
      return `[Deployment Failed] ${deploymentName} from ${branch}`;
    case "deployment.canceled":
      return `[Deployment Canceled] ${deploymentName} from ${branch}`;
    default:
      return `[Deployment] ${deploymentName}`;
  }
}

/**
 * Build deployment body text
 */
function buildDeploymentBody(
  eventType: VercelDeploymentEvent,
  deployment: NonNullable<VercelWebhookPayload["payload"]["deployment"]>,
  gitMeta?: VercelWebhookPayload["payload"]["deployment"]["meta"]
): string {
  const lines: string[] = [];

  if (gitMeta?.githubCommitMessage) {
    lines.push(`Commit: ${gitMeta.githubCommitMessage}`);
  }

  if (gitMeta?.githubCommitSha) {
    lines.push(`SHA: ${gitMeta.githubCommitSha.slice(0, 7)}`);
  }

  if (gitMeta?.githubCommitRef) {
    lines.push(`Branch: ${gitMeta.githubCommitRef}`);
  }

  if (deployment.url) {
    lines.push(`URL: https://${deployment.url}`);
  }

  const statusEmoji = {
    "deployment.created": "🚀",
    "deployment.succeeded": "✅",
    "deployment.ready": "✅",
    "deployment.error": "❌",
    "deployment.canceled": "⏹️",
  };

  lines.unshift(`${statusEmoji[eventType] ?? "📦"} ${eventType.replace("deployment.", "").toUpperCase()}`);

  return lines.join("\n");
}

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    const signature = request.headers.get("x-vercel-signature");

    // Verify webhook signature using client integration secret
    // NOTE: Vercel integration webhooks use CLIENT_INTEGRATION_SECRET (per Vercel docs)
    const clientSecret = env.VERCEL_CLIENT_INTEGRATION_SECRET;
    if (!clientSecret) {
      console.error("[Vercel Webhook] Missing VERCEL_CLIENT_INTEGRATION_SECRET");
      return NextResponse.json(
        { error: "Integration secret not configured" },
        { status: 500 }
      );
    }

    const result = await verifyVercelWebhook(rawBody, signature, clientSecret);

    if (!result.verified) {
      console.error(`[Vercel Webhook] Verification failed: ${result.error}`);
      return NextResponse.json(
        { error: result.error },
        { status: 401 }
      );
    }

    const payload = result.payload!;
    const eventType = payload.type as VercelDeploymentEvent;

    console.log(`[Vercel Webhook] Received ${eventType} event`);

    // Only process deployment events
    if (eventType.startsWith("deployment.")) {
      await handleDeploymentEvent(payload, eventType);
    } else {
      console.log(`[Vercel Webhook] Ignoring non-deployment event: ${eventType}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("[Vercel Webhook] Error processing webhook:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// Health check endpoint
export async function GET() {
  return NextResponse.json({
    status: "ok",
    service: "vercel-webhooks",
  });
}
```

**Why**: New webhook endpoint for Vercel deployment events.

### 2. Create Route Directory Structure

**Action**: Create directories

```bash
mkdir -p apps/console/src/app/\(vercel\)/api/vercel/webhooks
```

**Why**: Next.js App Router route structure.

### 3. Update Console App Environment

**File**: `apps/console/src/env.ts`
**Action**: Verify (should be done in Phase 1)

Ensure VERCEL_CLIENT_INTEGRATION_SECRET exists from Phase 01 (used for webhook verification).

**Note**: Vercel integration webhooks use the client integration secret, not a separate webhook secret (per Vercel documentation).

## Vercel Dashboard Configuration

After deploying the webhook endpoint:

1. Go to Vercel Dashboard → Team Settings → Webhooks
2. Click "Add Webhook"
3. Enter URL: `https://your-domain.com/api/vercel/webhooks`
4. Select events:
   - `deployment.created`
   - `deployment.succeeded`
   - `deployment.error`
   - `deployment.canceled`
5. Note: For Vercel Integration webhooks, signature verification uses the `VERCEL_CLIENT_INTEGRATION_SECRET` from your integration settings (no separate webhook secret needed)

## Database Changes

No new migrations - uses tables created in Phase 1.

## Success Criteria

### Automated Verification:
- [ ] Type checking passes: `pnpm typecheck`
- [ ] Linting passes: `pnpm lint`
- [ ] Build succeeds: `pnpm build:console`
- [ ] GET `/api/vercel/webhooks` returns `{ status: "ok" }`

### Manual Verification:
- [ ] Configure webhook in Vercel dashboard
- [ ] Trigger a deployment (push to connected repo)
- [ ] Verify `deployment.created` event received (check console logs)
- [ ] Verify `deployment.succeeded` or `deployment.error` event received
- [ ] Verify observation appears in database via Drizzle Studio
- [ ] Verify git metadata (commit SHA, branch, message) captured correctly

## Rollback Plan

1. Delete webhook configuration in Vercel dashboard
2. Remove `apps/console/src/app/(vercel)/` directory
3. Remove middleware entry for `/api/vercel/webhooks` from public routes

---

**CHECKPOINT**: After completing this phase, Vercel deployment events will flow through the neural memory pipeline.

---

**Previous Phase**: [Phase 2: Observation Pipeline](./phase-02-observation-pipeline.md)
**Parallel Phases**:
- [Phase 3: GitHub Ingestion](./phase-03-github-ingestion.md)
- [Phase 5: Sentry Ingestion](./phase-05-sentry-ingestion.md)
**Next Phase**: [Phase 6: Embedding & Storage](./phase-06-embedding-storage.md)
