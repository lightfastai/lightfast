/**
 * POST /api/ingest/:provider
 *
 * Webhook ingestion endpoint. Replaces relay's 7-step middleware chain.
 * Two paths: service auth (internal backfill) and standard (external webhooks).
 *
 * NOT tRPC — external providers send raw HTTP with HMAC signatures.
 */
import { db } from "@db/console/client";
import { gatewayWebhookDeliveries } from "@db/console/schema";
import {
  deriveVerifySignature,
  getProvider,
  hasInboundWebhooks,
  isWebhookProvider,
  serviceAuthWebhookBodySchema,
  timingSafeStringEqual,
} from "@repo/console-providers";
import type { WebhookDef } from "@repo/console-providers";
import { log } from "@vendor/observability/log/next";
import type { NextRequest } from "next/server";
import { inngest } from "@api/memory/inngest/client";
import { getProviderConfigs } from "@api/memory/lib/provider-configs";
import { env } from "~/env";

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

/**
 * Normalize receivedAt: if < 1e12 treat as Unix seconds → convert to ms.
 */
function normalizeReceivedAt(ts: number): number {
  return ts < 1e12 ? ts * 1000 : ts;
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

  // Step 2: Service auth detection
  const apiKey = req.headers.get("x-api-key");
  const isServiceAuth =
    apiKey != null &&
    env.MEMORY_API_KEY != null &&
    timingSafeStringEqual(apiKey, env.MEMORY_API_KEY);

  if (apiKey != null && !isServiceAuth) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  if (isServiceAuth) {
    return handleServiceAuth(req, providerSlug);
  }

  return handleStandardWebhook(req, providerSlug, providerDef, receivedAt);
}

// ── Service Auth Path ────────────────────────────────────────────────────────

async function handleServiceAuth(
  req: NextRequest,
  providerSlug: string
): Promise<Response> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = serviceAuthWebhookBodySchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "invalid_body", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  const {
    connectionId,
    orgId,
    deliveryId,
    eventType,
    resourceId,
    payload,
    receivedAt: bodyReceivedAt,
  } = parsed.data;

  const normalizedReceivedAt = normalizeReceivedAt(bodyReceivedAt);
  const holdForReplay = req.headers.get("x-backfill-hold") === "true";

  // Persist to DB
  await db
    .insert(gatewayWebhookDeliveries)
    .values({
      provider: providerSlug,
      deliveryId,
      eventType,
      installationId: connectionId,
      status: holdForReplay ? "held" : "received",
      payload: JSON.stringify(payload),
      receivedAt: new Date(normalizedReceivedAt).toISOString(),
    })
    .onConflictDoNothing();

  // Dispatch Inngest event (unless held for replay)
  if (!holdForReplay) {
    await inngest.send({
      id: `wh-${providerSlug}-${deliveryId}`,
      name: "memory/webhook.received",
      data: {
        provider: providerSlug,
        deliveryId,
        eventType,
        resourceId: resourceId ?? null,
        payload,
        receivedAt: normalizedReceivedAt,
        serviceAuth: true,
        preResolved: { connectionId, orgId },
      },
    });
  }

  log.info("[ingest] service-auth delivery", {
    provider: providerSlug,
    deliveryId,
    eventType,
    holdForReplay,
    connectionId,
  });

  return Response.json({
    status: holdForReplay ? "held" : "accepted",
    deliveryId,
  });
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
      error: parseError instanceof Error ? parseError.message : String(parseError),
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
