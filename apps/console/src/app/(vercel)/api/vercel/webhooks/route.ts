import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { db } from "@db/console";
import {
  workspaceStores,
  workspaceIntegrations,
  userSources,
} from "@db/console/schema";
// TODO: Uncomment when Phase 02 (Observation Pipeline) is implemented
// import { inngest } from "@api/console/inngest";
import type {
  VercelWebhookPayload,
  VercelDeploymentEvent,
} from "@repo/console-webhooks";
import { verifyVercelWebhook } from "@repo/console-webhooks";
import { env } from "~/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Handle Vercel deployment events
 */
async function handleDeploymentEvent(
  payload: VercelWebhookPayload,
  eventType: VercelDeploymentEvent,
) {
  const deployment = payload.payload.deployment;
  const project = payload.payload.project;
  const team = payload.payload.team;

  if (!deployment || !project) {
    console.error("[Vercel Webhook] Missing deployment or project data");
    return;
  }

  // Resolve workspace from project ID via workspaceIntegrations
  const workspace = await findWorkspaceForVercelProject(project.id, team?.id);

  if (!workspace) {
    console.log(
      `[Vercel Webhook] No workspace found for team ${team?.id}, project ${project.name}`,
    );
    return;
  }

  const { workspaceId } = workspace;

  // Get default store
  const store = await db.query.workspaceStores.findFirst({
    where: and(
      eq(workspaceStores.workspaceId, workspaceId),
      eq(workspaceStores.slug, "default"),
    ),
  });

  if (!store) {
    console.error(
      `[Vercel Webhook] No default store for workspace: ${workspaceId}`,
    );
    return;
  }

  // Generate event title
  const eventTitle = getDeploymentEventTitle(
    eventType,
    deployment.name,
    deployment.meta,
  );

  // Extract git metadata
  const gitMeta = deployment.meta;
  const references: { type: string; id: string; url?: string }[] = [];

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

  // TODO: Emit observation capture event (requires Phase 02: Observation Pipeline)
  // This will be implemented when the neural memory infrastructure is in place
  console.log(
    `[Vercel Webhook] Would emit observation for deployment ${deployment.id}`,
    {
      workspaceId,
      storeId: store.id,
      eventType,
      title: eventTitle,
      actor,
      metadata: {
        webhookId: payload.id,
        deploymentId: deployment.id,
        deploymentUrl: deployment.url,
        projectId: project.id,
        projectName: project.name,
        teamId: team?.id,
      },
    },
  );

  /*
  // Uncomment when Phase 02 (Observation Pipeline) is implemented
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
  */

  console.log(
    `[Vercel Webhook] ${eventType} event sent for deployment ${deployment.id}`,
  );
}

/**
 * Find workspace associated with Vercel project
 * Resolves workspace via workspaceIntegrations table using projectId
 */
async function findWorkspaceForVercelProject(
  projectId: string,
  _teamId: string | undefined,
): Promise<{ workspaceId: string; storeSlug: string } | null> {
  // Look up workspace integration by Vercel project ID with join to verify provider
  const results = await db
    .select({
      workspaceId: workspaceIntegrations.workspaceId,
      provider: userSources.provider,
    })
    .from(workspaceIntegrations)
    .innerJoin(
      userSources,
      eq(workspaceIntegrations.userSourceId, userSources.id),
    )
    .where(
      and(
        eq(workspaceIntegrations.providerResourceId, projectId),
        eq(workspaceIntegrations.isActive, true),
        eq(userSources.provider, "vercel"),
      ),
    )
    .limit(1);

  const integration = results[0];
  if (!integration) {
    return null;
  }

  return {
    workspaceId: integration.workspaceId,
    storeSlug: "default",
  };
}

/**
 * Generate deployment event title
 */
function getDeploymentEventTitle(
  eventType: VercelDeploymentEvent,
  deploymentName: string,
  gitMeta?: NonNullable<VercelWebhookPayload["payload"]["deployment"]>["meta"],
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
 * TODO: Used when Phase 02 (Observation Pipeline) is implemented
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function buildDeploymentBody(
  eventType: VercelDeploymentEvent,
  deployment: NonNullable<VercelWebhookPayload["payload"]["deployment"]>,
  gitMeta?: NonNullable<VercelWebhookPayload["payload"]["deployment"]>["meta"],
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

  const statusEmoji: Record<string, string> = {
    "deployment.created": "🚀",
    "deployment.succeeded": "✅",
    "deployment.ready": "✅",
    "deployment.error": "❌",
    "deployment.canceled": "⏹",
  };

  lines.unshift(
    `${statusEmoji[eventType] ?? "📦"} ${eventType.replace("deployment.", "").toUpperCase()}`,
  );

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
      console.error(
        "[Vercel Webhook] Missing VERCEL_CLIENT_INTEGRATION_SECRET",
      );
      return NextResponse.json(
        { error: "Integration secret not configured" },
        { status: 500 },
      );
    }

    const result = await verifyVercelWebhook(rawBody, signature, clientSecret);

    if (!result.verified) {
      console.error(`[Vercel Webhook] Verification failed: ${result.error}`);
      return NextResponse.json({ error: result.error }, { status: 401 });
    }

    const payload = result.event;
    if (!payload) {
      console.error("[Vercel Webhook] Missing event payload");
      return NextResponse.json(
        { error: "Missing event payload" },
        { status: 500 },
      );
    }

    const eventType = payload.type as VercelDeploymentEvent;

    console.log(`[Vercel Webhook] Received ${eventType} event`);

    // Only process deployment events
    if (eventType.startsWith("deployment.")) {
      await handleDeploymentEvent(payload, eventType);
    } else {
      console.log(
        `[Vercel Webhook] Ignoring non-deployment event: ${eventType}`,
      );
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("[Vercel Webhook] Error processing webhook:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

// Health check endpoint
export function GET() {
  return NextResponse.json({
    status: "ok",
    service: "vercel-webhooks",
  });
}
