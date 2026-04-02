/**
 * POST /api/ingest/:provider
 *
 * Webhook ingestion endpoint for external provider webhooks.
 * Validates HMAC signatures and dispatches to the Inngest pipeline.
 *
 * NOT tRPC — external providers send raw HTTP with HMAC signatures.
 */

import { inngest } from "@api/platform/inngest/client";
import { getProviderConfigs } from "@api/platform/lib/provider-configs";
import { db } from "@db/app/client";
import { gatewayWebhookDeliveries } from "@db/app/schema";
import type { WebhookDef } from "@repo/app-providers";
import {
  deriveVerifySignature,
  getProvider,
  hasInboundWebhooks,
  isWebhookProvider,
} from "@repo/app-providers";
import { log } from "@vendor/observability/log/next";
import type { NextRequest } from "next/server";

export const runtime = "nodejs";

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Resolve WebhookDef from any provider kind that supports inbound webhooks.
 */
function getWebhookDef(
  providerDef: NonNullable<ReturnType<typeof getProvider>>
): WebhookDef<unknown> | null {
  if (isWebhookProvider(providerDef)) {
    return providerDef.webhook as WebhookDef<unknown>;
  }
  if (providerDef.kind === "managed") {
    return providerDef.inbound.webhook as WebhookDef<unknown>;
  }
  if (
    providerDef.kind === "api" &&
    "inbound" in providerDef &&
    providerDef.inbound
  ) {
    return providerDef.inbound.webhook as WebhookDef<unknown>;
  }
  return null;
}

// ── Route Handler ────────────────────────────────────────────────────────────

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  const { provider: providerSlug } = await params;
  const receivedAt = Date.now();

  // Step 1: Provider guard
  const providerDef = getProvider(providerSlug);
  if (!providerDef) {
    return Response.json(
      { error: "unknown_provider", provider: providerSlug },
      { status: 404 }
    );
  }

  if (!hasInboundWebhooks(providerDef)) {
    return Response.json(
      { error: "not_webhook_provider", provider: providerSlug },
      { status: 400 }
    );
  }

  return handleStandardWebhook(req, providerSlug, providerDef, receivedAt);
}

// ── Standard Webhook Path ────────────────────────────────────────────────────

async function handleStandardWebhook(
  req: NextRequest,
  providerSlug: string,
  providerDef: NonNullable<ReturnType<typeof getProvider>>,
  receivedAt: number
): Promise<Response> {
  const webhookDef = getWebhookDef(providerDef);
  if (!webhookDef) {
    return Response.json(
      { error: "no_webhook_def", provider: providerSlug },
      { status: 400 }
    );
  }

  // Step 4: Webhook header guard
  const headersObj: Record<string, string | undefined> = {};
  for (const key of Object.keys(
    (webhookDef.headersSchema as { shape: Record<string, unknown> }).shape
  )) {
    headersObj[key] = req.headers.get(key) ?? undefined;
  }
  const headersParsed = webhookDef.headersSchema.safeParse(headersObj);
  if (!headersParsed.success) {
    return Response.json(
      { error: "missing_headers", issues: headersParsed.error.issues },
      { status: 400 }
    );
  }

  // Step 5: Raw body capture (MUST be req.text() — HMAC needs raw bytes)
  const rawBody = await req.text();

  // Step 6: Signature verification
  const configs = getProviderConfigs();
  const providerConfig = configs[providerSlug];
  if (!providerConfig) {
    log.error("[ingest] provider config not found", {
      provider: providerSlug,
    });
    return Response.json(
      { error: "provider_not_configured", provider: providerSlug },
      { status: 500 }
    );
  }

  const secret = (webhookDef.extractSecret as (config: unknown) => string)(
    providerConfig
  );
  const verify =
    webhookDef.verifySignature ??
    deriveVerifySignature(webhookDef.signatureScheme);
  const isValid = await verify(rawBody, req.headers, secret);
  if (!isValid) {
    log.warn("[ingest] signature verification failed", {
      provider: providerSlug,
    });
    return Response.json({ error: "signature_invalid" }, { status: 401 });
  }

  // Step 7: Payload parse + metadata extraction
  let jsonPayload: unknown;
  try {
    jsonPayload = JSON.parse(rawBody);
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }

  let parsedPayload: unknown;
  try {
    parsedPayload = webhookDef.parsePayload(jsonPayload);
  } catch (parseError) {
    log.warn("[ingest] payload schema validation failed", {
      provider: providerSlug,
      error:
        parseError instanceof Error ? parseError.message : String(parseError),
    });
    return Response.json(
      { error: "payload_validation_failed", provider: providerSlug },
      { status: 400 }
    );
  }
  const deliveryId = webhookDef.extractDeliveryId(req.headers, parsedPayload);
  const eventType = webhookDef.extractEventType(req.headers, parsedPayload);
  const resourceId = webhookDef.extractResourceId(parsedPayload);

  // Persist to DB
  await db
    .insert(gatewayWebhookDeliveries)
    .values({
      provider: providerSlug,
      deliveryId,
      eventType,
      installationId: null,
      status: "received",
      payload: JSON.stringify(parsedPayload),
      receivedAt: new Date(receivedAt).toISOString(),
    })
    .onConflictDoNothing();

  // Dispatch Inngest event
  await inngest.send({
    id: `wh-${providerSlug}-${deliveryId}`,
    name: "memory/webhook.received",
    data: {
      provider: providerSlug,
      deliveryId,
      eventType,
      resourceId,
      payload: parsedPayload,
      receivedAt,
    },
  });

  log.info("[ingest] webhook received", {
    provider: providerSlug,
    deliveryId,
    eventType,
    resourceId,
  });

  return Response.json({ status: "accepted", deliveryId });
}
