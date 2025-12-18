import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { db } from "@db/console";
import {
  workspaceIntegrations,
  userSources,
  orgWorkspaces,
} from "@db/console/schema";
import { inngest } from "@api/console/inngest";
import type {
  VercelWebhookPayload,
  VercelDeploymentEvent,
} from "@repo/console-webhooks";
import {
  verifyVercelWebhook,
  transformVercelDeployment,
  validateWebhookTimestamp,
} from "@repo/console-webhooks";
import {
  storeWebhookPayload,
  extractWebhookHeaders,
} from "@repo/console-webhooks/storage";
import { log } from "@vendor/observability/log";
import { env } from "~/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Handle Vercel deployment events
 */
async function handleDeploymentEvent(
  payload: VercelWebhookPayload,
  eventType: VercelDeploymentEvent,
  rawPayload: string,
  headers: Record<string, string>,
) {
  const receivedAt = new Date();
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

  // Store raw webhook payload for permanent retention
  await storeWebhookPayload({
    workspaceId,
    deliveryId: payload.id,
    source: "vercel",
    eventType,
    payload: rawPayload,
    headers,
    receivedAt,
  });

  // Emit observation capture event (transformer handles all field mapping)
  await inngest.send({
    name: "apps-console/neural/observation.capture",
    data: {
      workspaceId,
      clerkOrgId: workspace.clerkOrgId,
      sourceEvent: transformVercelDeployment(payload, eventType, {
        deliveryId: payload.id,
        receivedAt,
      }),
    },
  });

  log.info("[Vercel Webhook] Observation capture triggered", {
    workspaceId,
    eventType,
    deploymentId: deployment.id,
  });
}

/**
 * Find workspace associated with Vercel project
 * Resolves workspace via workspaceIntegrations table using projectId
 * Returns workspaceId and clerkOrgId for metrics tracking
 */
async function findWorkspaceForVercelProject(
  projectId: string,
  _teamId: string | undefined,
): Promise<{ workspaceId: string; clerkOrgId: string } | null> {
  // Look up workspace integration by Vercel project ID with join to verify source type
  // Also join orgWorkspaces to get clerkOrgId
  const results = await db
    .select({
      workspaceId: workspaceIntegrations.workspaceId,
      sourceType: userSources.sourceType,
      clerkOrgId: orgWorkspaces.clerkOrgId,
    })
    .from(workspaceIntegrations)
    .innerJoin(
      userSources,
      eq(workspaceIntegrations.userSourceId, userSources.id),
    )
    .innerJoin(
      orgWorkspaces,
      eq(workspaceIntegrations.workspaceId, orgWorkspaces.id),
    )
    .where(
      and(
        eq(workspaceIntegrations.providerResourceId, projectId),
        eq(workspaceIntegrations.isActive, true),
        eq(userSources.sourceType, "vercel"),
      ),
    )
    .limit(1);

  const integration = results[0];
  if (!integration) {
    return null;
  }

  // Return workspaceId and clerkOrgId for metrics tracking
  return {
    workspaceId: integration.workspaceId,
    clerkOrgId: integration.clerkOrgId,
  };
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

    // Timestamp validation (replay attack prevention)
    // Vercel webhooks include createdAt in milliseconds
    if (payload.createdAt) {
      const timestampMs = payload.createdAt;
      const timestampSeconds = Math.floor(timestampMs / 1000);
      const isTimestampValid = validateWebhookTimestamp(timestampSeconds, 300);

      if (!isTimestampValid) {
        log.warn("[Vercel Webhook] Rejected stale webhook", {
          webhookId: payload.id,
          timestamp: new Date(timestampMs).toISOString(),
        });
        return NextResponse.json(
          { error: "Webhook timestamp too old (possible replay attack)" },
          { status: 401 }
        );
      }
    }

    const eventType = payload.type as VercelDeploymentEvent;
    const webhookHeaders = extractWebhookHeaders(request.headers);

    console.log(`[Vercel Webhook] Received ${eventType} event`);

    // Only process deployment events
    if (eventType.startsWith("deployment.")) {
      await handleDeploymentEvent(payload, eventType, rawBody, webhookHeaders);
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
