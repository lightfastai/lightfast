---
title: "Phase 5: Sentry Ingestion"
description: Issue webhook route and event handlers, Sentry to observation transformers with release linking
status: not_started
phase: 5
parent: "./README.md"
depends_on: ["./phase-02-observation-pipeline.md"]
blocks: ["./phase-06-embedding-storage.md"]
---

# Phase 5: Sentry Ingestion

**Status**: Not Started
**Parent Plan**: [Implementation Plan](./README.md)

## Overview

Create Sentry webhook infrastructure from scratch. This includes the API route for receiving webhooks, signature verification, and transformation of issue events into observations. Key feature: linking Sentry issues to deployments via release version.

## Prerequisites

- [ ] Phase 2 completed and verified
- [ ] Observation capture workflow functioning
- [ ] Sentry Internal Integration created
- [ ] `SENTRY_CLIENT_SECRET` configured in environment

## Changes Required

### 1. Create Sentry Webhook Route

**File**: `apps/console/src/app/(sentry)/api/sentry/webhooks/route.ts`
**Action**: Create (including directory structure)

```typescript
import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { db } from "@db/console";
import { workspaceStores, orgWorkspaces } from "@db/console/schema";
import { inngest } from "@api/console/inngest";
import {
  verifySentryWebhook,
  type SentryWebhookPayload,
  type SentryIssueEvent,
} from "@repo/console-webhooks";
import { env } from "@/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Handle Sentry issue events
 */
async function handleIssueEvent(
  payload: SentryWebhookPayload,
  eventType: SentryIssueEvent
) {
  const issue = payload.data.issue;
  const event = payload.data.event;

  if (!issue) {
    console.error("[Sentry Webhook] Missing issue data");
    return;
  }

  // Resolve workspace from Sentry project
  const workspace = await findWorkspaceForSentryProject(
    issue.project.slug,
    issue.project.id
  );

  if (!workspace) {
    console.log(
      `[Sentry Webhook] No workspace found for Sentry project ${issue.project.slug}`
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
    console.error(`[Sentry Webhook] No default store for workspace: ${workspaceId}`);
    return;
  }

  // Build event title and body
  const eventTitle = getIssueEventTitle(eventType, issue);
  const eventBody = buildIssueBody(issue, event);

  // Extract references
  const references: Array<{ type: string; id: string; url?: string }> = [];

  // Add release reference (links to deployment)
  if (event?.release?.version) {
    references.push({
      type: "release",
      id: event.release.version,
    });
  }

  // Add assignee reference
  if (issue.assignedTo) {
    references.push({
      type: "assignee",
      id: issue.assignedTo.id,
    });
  }

  // Add Sentry issue link
  references.push({
    type: "sentry_issue",
    id: issue.shortId,
    url: issue.permalink,
  });

  // Build actor from assignee or event user
  let actor: { id: string; name: string; email?: string } | undefined;

  if (payload.action === "assigned" && issue.assignedTo) {
    actor = {
      id: `sentry:${issue.assignedTo.id}`,
      name: issue.assignedTo.name,
      email: issue.assignedTo.email,
    };
  } else if (event?.user) {
    actor = {
      id: `user:${event.user.id ?? event.user.email ?? "unknown"}`,
      name: event.user.username ?? event.user.email ?? "Unknown User",
      email: event.user.email ?? undefined,
    };
  }

  // Emit observation capture event
  await inngest.send({
    name: "apps-console/neural/observation.capture",
    data: {
      workspaceId,
      storeId: store.id,
      sourceEvent: {
        source: "sentry",
        sourceType: `issue.${payload.action}`,
        sourceId: `issue:${issue.id}`,
        title: eventTitle,
        body: eventBody,
        actor,
        occurredAt: issue.lastSeen,
        references,
        metadata: {
          issueId: issue.id,
          shortId: issue.shortId,
          permalink: issue.permalink,
          projectSlug: issue.project.slug,
          projectId: issue.project.id,
          platform: issue.platform,
          level: issue.level,
          status: issue.status,
          eventCount: parseInt(issue.count, 10),
          userCount: parseInt(issue.userCount, 10),
          firstSeen: issue.firstSeen,
          lastSeen: issue.lastSeen,
          release: event?.release?.version ?? null,
          environment: event?.environment ?? null,
          errorType: issue.metadata?.type ?? null,
          errorValue: issue.metadata?.value ?? null,
          culprit: issue.culprit,
          hasStackTrace: !!event?.exception?.values?.some((v) => v.stacktrace),
        },
      },
    },
  });

  console.log(
    `[Sentry Webhook] ${eventType} event sent for issue ${issue.shortId}`
  );
}

/**
 * Find workspace associated with Sentry project
 * TODO: Enhance with proper Sentry integration linking in future phase
 */
async function findWorkspaceForSentryProject(
  projectSlug: string,
  projectId: string
): Promise<{ workspaceId: string } | null> {
  // For now, search workspaces by name match or existing Sentry integration
  // This is a simplified approach - in production, we'd have a proper
  // sentry integration table linking project IDs to workspaces

  // Try to find workspace with matching name (common pattern)
  const workspaces = await db
    .select({ id: orgWorkspaces.id, name: orgWorkspaces.name })
    .from(orgWorkspaces)
    .limit(10);

  // Check for name match (case insensitive)
  const matchingWorkspace = workspaces.find(
    (ws) => ws.name.toLowerCase().includes(projectSlug.toLowerCase())
  );

  if (matchingWorkspace) {
    return { workspaceId: matchingWorkspace.id };
  }

  // TODO: Add proper workspace-sentry linking
  // For MVP, return first workspace if exists (single-tenant assumption)
  if (workspaces.length > 0) {
    return { workspaceId: workspaces[0]!.id };
  }

  return null;
}

/**
 * Generate issue event title
 */
function getIssueEventTitle(
  eventType: SentryIssueEvent,
  issue: NonNullable<SentryWebhookPayload["data"]["issue"]>
): string {
  const levelEmoji: Record<string, string> = {
    fatal: "💀",
    error: "🔴",
    warning: "🟡",
    info: "🔵",
  };

  const emoji = levelEmoji[issue.level] ?? "⚠️";

  switch (eventType) {
    case "issue.created":
      return `${emoji} [New Issue] ${issue.title}`;
    case "issue.resolved":
      return `✅ [Resolved] ${issue.title}`;
    case "issue.assigned":
      return `👤 [Assigned] ${issue.title}`;
    case "issue.ignored":
      return `🔇 [Ignored] ${issue.title}`;
    case "issue.unresolved":
      return `🔄 [Reopened] ${issue.title}`;
    default:
      return `${emoji} ${issue.title}`;
  }
}

/**
 * Build issue body text with error details
 */
function buildIssueBody(
  issue: NonNullable<SentryWebhookPayload["data"]["issue"]>,
  event?: SentryWebhookPayload["data"]["event"]
): string {
  const lines: string[] = [];

  // Error type and message
  if (issue.metadata?.type) {
    lines.push(`**${issue.metadata.type}**: ${issue.metadata.value ?? issue.title}`);
  } else {
    lines.push(`**Error**: ${issue.title}`);
  }

  // Location (culprit)
  if (issue.culprit) {
    lines.push(`\n**Location**: \`${issue.culprit}\``);
  }

  // Stats
  lines.push(`\n**Occurrences**: ${issue.count} events affecting ${issue.userCount} users`);

  // Timeline
  lines.push(`**First seen**: ${issue.firstSeen}`);
  lines.push(`**Last seen**: ${issue.lastSeen}`);

  // Release info (deployment link)
  if (event?.release?.version) {
    lines.push(`\n**Release**: ${event.release.version}`);
  }

  // Environment
  if (event?.environment) {
    lines.push(`**Environment**: ${event.environment}`);
  }

  // Stack trace summary (if available)
  const stacktrace = event?.exception?.values?.[0]?.stacktrace;
  if (stacktrace?.frames && stacktrace.frames.length > 0) {
    lines.push(`\n**Stack Trace** (top frames):`);

    // Get top 3 in-app frames
    const inAppFrames = stacktrace.frames
      .filter((f) => f.inApp)
      .slice(-3)
      .reverse();

    for (const frame of inAppFrames) {
      const loc = `${frame.filename}:${frame.lineno}`;
      lines.push(`- \`${frame.function ?? "(anonymous)"}\` at \`${loc}\``);
    }
  }

  // Platform
  lines.push(`\n**Platform**: ${issue.platform}`);

  return lines.join("\n");
}

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    const signature = request.headers.get("sentry-hook-signature");

    // Verify webhook signature
    const secret = env.SENTRY_CLIENT_SECRET;
    if (!secret) {
      console.error("[Sentry Webhook] Missing SENTRY_CLIENT_SECRET");
      return NextResponse.json(
        { error: "Webhook secret not configured" },
        { status: 500 }
      );
    }

    const result = await verifySentryWebhook(rawBody, signature, secret);

    if (!result.verified) {
      console.error(`[Sentry Webhook] Verification failed: ${result.error}`);
      return NextResponse.json(
        { error: result.error },
        { status: 401 }
      );
    }

    const payload = result.payload!;
    const action = payload.action;

    console.log(`[Sentry Webhook] Received issue.${action} event`);

    // Map action to event type
    const eventType = `issue.${action}` as SentryIssueEvent;

    // Only process significant issue events
    const significantActions = ["created", "resolved", "assigned"];
    if (significantActions.includes(action)) {
      await handleIssueEvent(payload, eventType);
    } else {
      console.log(`[Sentry Webhook] Ignoring action: ${action}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("[Sentry Webhook] Error processing webhook:", error);
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
    service: "sentry-webhooks",
  });
}
```

**Why**: New webhook endpoint for Sentry issue events with release/deployment linking.

### 2. Create Route Directory Structure

**Action**: Create directories

```bash
mkdir -p apps/console/src/app/\(sentry\)/api/sentry/webhooks
```

**Why**: Next.js App Router route structure.

### 3. Update Console App Environment

**File**: `apps/console/src/env.ts`
**Action**: Verify (should be done in Phase 1)

Ensure this exists:
```typescript
SENTRY_CLIENT_SECRET: z.string().optional(),
```

**Why**: Environment variable for webhook verification.

## Sentry Integration Configuration

After deploying the webhook endpoint:

1. Go to Sentry → Settings → Integrations → Internal Integrations
2. Create a new Internal Integration
3. Configure:
   - **Name**: "Lightfast Neural Memory"
   - **Webhook URL**: `https://your-domain.com/api/sentry/webhooks`
   - **Permissions**: Read access to Issues, Events
   - **Webhooks**:
     - Issue Created
     - Issue Resolved
     - Issue Assigned
4. Copy the **Client Secret** to `SENTRY_CLIENT_SECRET` environment variable
5. Install the integration on your organization

### Linking Sentry to Deployments

For Sentry issues to be linked to deployments:

1. Configure Sentry Releases in your CI/CD:
```bash
# In your deployment script
sentry-cli releases new $VERSION
sentry-cli releases set-commits $VERSION --auto
sentry-cli releases finalize $VERSION
sentry-cli releases deploys $VERSION new -e production
```

2. Set the `SENTRY_RELEASE` environment variable in your app:
```typescript
// sentry.client.config.ts
Sentry.init({
  release: process.env.VERCEL_GIT_COMMIT_SHA, // or your version
});
```

When errors occur, Sentry will include the release version in webhook payloads, which we capture in `metadata.release` and `references` for linking to Vercel deployment observations.

## Database Changes

No new migrations - uses tables created in Phase 1.

## Success Criteria

### Automated Verification:
- [ ] Type checking passes: `pnpm typecheck`
- [ ] Linting passes: `pnpm lint`
- [ ] Build succeeds: `pnpm build:console`
- [ ] GET `/api/sentry/webhooks` returns `{ status: "ok" }`

### Manual Verification:
- [ ] Configure Internal Integration in Sentry
- [ ] Trigger an error in a connected app (e.g., `throw new Error("Test error")`)
- [ ] Verify `issue.created` webhook received (check console logs)
- [ ] Verify observation appears in database via Drizzle Studio
- [ ] Verify error details captured (type, message, stack trace)
- [ ] Verify release version captured (if configured)
- [ ] Resolve the issue in Sentry, verify `issue.resolved` observation created

## Rollback Plan

1. Delete Internal Integration in Sentry
2. Remove `apps/console/src/app/(sentry)/` directory
3. Remove `SENTRY_CLIENT_SECRET` from environment variables

---

**CHECKPOINT**: After completing this phase, Sentry issue events will flow through the neural memory pipeline with deployment linking.

---

**Previous Phase**: [Phase 2: Observation Pipeline](./phase-02-observation-pipeline.md)
**Parallel Phases**:
- [Phase 3: GitHub Ingestion](./phase-03-github-ingestion.md)
- [Phase 4: Vercel Ingestion](./phase-04-vercel-ingestion.md)
**Next Phase**: [Phase 6: Embedding & Storage](./phase-06-embedding-storage.md)
