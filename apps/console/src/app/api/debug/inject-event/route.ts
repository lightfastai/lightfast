import { gateway } from "@ai-sdk/gateway";
import { auth } from "@clerk/nextjs/server";
import { db } from "@db/console/client";
import { gwInstallations, workspaceIntegrations } from "@db/console/schema";
import type { EventKey } from "@repo/console-providers";
import { EVENT_REGISTRY } from "@repo/console-providers";
import { createRelayClient } from "@repo/gateway-service-clients";
import { generateObject } from "ai";
import { eq } from "drizzle-orm";
import { buildContext } from "./_lib/context";
import { getSchemaForEvent } from "./_lib/schemas";

export const runtime = "nodejs";

const MODEL_ID = "anthropic/claude-haiku-4-5-20251001";

export async function POST(request: Request) {
  // Dev-only guard
  const isDev =
    !process.env.VERCEL_ENV || process.env.VERCEL_ENV === "development";
  console.debug("[inject-event] Dev guard check", {
    VERCEL_ENV: process.env.VERCEL_ENV,
    isDev,
  });
  if (!isDev) {
    return Response.json({ error: "not_found" }, { status: 404 });
  }

  // Auth — verify the user is logged in
  const { userId } = await auth();
  if (!userId) {
    console.debug("[inject-event] Unauthorized — no userId");
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: { integrationId?: unknown; eventKey?: unknown; context?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }

  const { integrationId, eventKey, context } = body;
  console.debug("[inject-event] Request body", {
    integrationId,
    eventKey,
    context,
  });

  if (typeof integrationId !== "string" || !integrationId) {
    return Response.json({ error: "integrationId required" }, { status: 400 });
  }
  if (typeof eventKey !== "string" || !eventKey) {
    return Response.json({ error: "eventKey required" }, { status: 400 });
  }

  // 1. Look up workspace integration
  const integration = await db.query.workspaceIntegrations.findFirst({
    where: eq(workspaceIntegrations.id, integrationId),
  });
  if (!integration?.installationId) {
    console.debug("[inject-event] Integration not found", { integrationId });
    return Response.json({ error: "integration_not_found" }, { status: 404 });
  }
  console.debug("[inject-event] Found integration", {
    provider: integration.provider,
    installationId: integration.installationId,
  });

  // 2. Look up gw installation for orgId
  const installation = await db.query.gwInstallations.findFirst({
    where: eq(gwInstallations.id, integration.installationId),
  });
  if (!installation) {
    console.debug("[inject-event] Installation not found", {
      installationId: integration.installationId,
    });
    return Response.json({ error: "installation_not_found" }, { status: 404 });
  }
  console.debug("[inject-event] Found installation", {
    orgId: installation.orgId,
  });

  // 3. Resolve event type metadata
  if (!(eventKey in EVENT_REGISTRY)) {
    console.debug("[inject-event] Unknown event type", { eventKey });
    return Response.json({ error: "unknown_event_type" }, { status: 400 });
  }
  const validKey = eventKey as EventKey;
  const eventDef = EVENT_REGISTRY[validKey];
  // externalKeys always has at least one entry per registry definition
  const wireEventType = eventDef.externalKeys[0] as string;
  console.debug("[inject-event] Resolved event", {
    eventKey: validKey,
    wireEventType,
  });

  // 4. Build schema + context for AI generation
  const schema = getSchemaForEvent(validKey);
  const prompt = buildContext(
    integration,
    installation,
    validKey,
    typeof context === "string" ? context : undefined
  );

  // 5. Generate payload with Claude Haiku
  let payload: unknown;
  try {
    console.debug("[inject-event] Generating payload with AI...");
    const result = await generateObject({
      model: gateway(MODEL_ID),
      schema,
      system:
        "You are a webhook payload generator. Generate realistic, complete webhook payloads for testing purposes. All URL fields must be fully-qualified with the https:// protocol (e.g., https://github.com/acme/repo).",
      prompt,
      temperature: 0.7,
    });
    payload = result.object as unknown;
    console.debug("[inject-event] Payload generated", {
      payloadKeys: Object.keys(payload as Record<string, unknown>),
    });
  } catch (err) {
    console.debug("[inject-event] Generation failed", { error: String(err) });
    return Response.json(
      { error: "generation_failed", detail: String(err) },
      { status: 500 }
    );
  }

  // 6. Inject into relay via internal service auth
  const deliveryId = `debug-${crypto.randomUUID()}`;
  const apiKey = process.env.GATEWAY_API_KEY;
  if (!apiKey) {
    console.debug("[inject-event] GATEWAY_API_KEY not configured");
    return Response.json(
      { error: "GATEWAY_API_KEY not configured" },
      { status: 500 }
    );
  }

  const relay = createRelayClient({ apiKey, requestSource: "debug-panel" });
  try {
    console.debug("[inject-event] Dispatching to relay", {
      deliveryId,
      provider: integration.provider,
    });
    await relay.dispatchWebhook(integration.provider, {
      connectionId: integration.installationId,
      orgId: installation.orgId,
      deliveryId,
      eventType: wireEventType,
      payload,
      receivedAt: Date.now(),
    });
  } catch (err) {
    console.debug("[inject-event] Relay dispatch failed", {
      error: String(err),
    });
    return Response.json(
      { error: "relay_failed", detail: String(err) },
      { status: 502 }
    );
  }

  console.debug("[inject-event] Injection complete", { deliveryId });
  return Response.json({ status: "injected", deliveryId });
}
