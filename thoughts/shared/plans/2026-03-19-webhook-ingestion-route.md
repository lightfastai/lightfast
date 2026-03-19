---
title: "Webhook Ingestion Route Implementation"
status: draft
priority: P0
estimated_effort: medium
---

# Webhook Ingestion Route Implementation

## Objective

Replace the 501 stub at `apps/memory/src/app/api/ingest/[provider]/route.ts` with a fully functional webhook ingestion endpoint that ports the relay service's 7-step middleware chain into a single Next.js POST route handler.

This is the critical entry point for all external provider webhooks (GitHub, Linear, Sentry, Vercel) and internal service-auth backfill deliveries. Without it, no events flow into the memory service's neural pipeline.

## Success Criteria

1. External webhooks from all providers (GitHub, Linear, Sentry, Vercel) are received, verified (HMAC/Ed25519), and persisted to `gatewayWebhookDeliveries`
2. `memory/webhook.received` Inngest event is dispatched for each verified delivery
3. Service-auth path (backfill) works with `X-API-Key` header and pre-resolved connectionId/orgId
4. `X-Backfill-Hold: true` causes DB insertion WITHOUT Inngest event dispatch (held for replay)
5. Duplicate deliveries are silently ignored via `onConflictDoNothing()` on `(provider, deliveryId)` unique index
6. All error modes return appropriate HTTP status codes with structured JSON

## Dependencies

### Packages & Import Paths

| Symbol | Import Path |
|--------|------------|
| `getProvider` | `@repo/console-providers` |
| `isWebhookProvider`, `hasInboundWebhooks` | `@repo/console-providers` |
| `deriveVerifySignature` | `@repo/console-providers` |
| `timingSafeStringEqual` | `@repo/console-providers` |
| `serviceAuthWebhookBodySchema` | `@repo/console-providers` (re-exported from `contracts/wire.ts`) |
| `providerSlugSchema` | `@repo/console-providers` |
| `db` | `@db/console/client` |
| `gatewayWebhookDeliveries` | `@db/console/schema` |
| `inngest` | `../../../inngest/client` (relative — `api/memory/src/inngest/client.ts`) |
| `getProviderConfigs` | `../../../lib/provider-configs` (relative — `api/memory/src/lib/provider-configs.ts`) |
| `env` | `../../../env` (relative — `apps/memory/src/env.ts`) |
| `log` | `@vendor/observability/log/next` |

### Key Provider Type Relationships

- `WebhookProvider.webhook` — has `WebhookDef<TConfig>` with `extractSecret`, `extractDeliveryId`, `extractEventType`, `extractResourceId`, `parsePayload`, `headersSchema`, `signatureScheme`
- `ManagedProvider.inbound.webhook` — same `WebhookDef<TConfig>` shape
- `ApiProvider.inbound?.webhook` — same shape, but optional (only providers with manual webhook setup)
- `hasInboundWebhooks(providerDef)` — type guard that returns true for all three cases above

## Implementation Steps

### Step 1: Import Setup

```typescript
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
import { env } from "../../../../env";
import { inngest } from "../../../../inngest/client";
import { getProviderConfigs } from "../../../../lib/provider-configs";

export const runtime = "nodejs";
```

Note: The relative import paths above are from `apps/memory/src/app/api/ingest/[provider]/route.ts`. The `api/memory/src/` barrel is at `../../../../`. Verify exact depth during implementation — the route file lives at 4 levels below `src/`:
- `src/app/api/ingest/[provider]/route.ts` → `../../../../env` reaches `src/env.ts`
- `../../../../inngest/client` reaches `src/inngest/client.ts`
- `../../../../lib/provider-configs` reaches `src/lib/provider-configs.ts`

### Step 2: Helper — Resolve WebhookDef from ProviderDefinition

Different provider kinds store the `WebhookDef` in different locations:

```typescript
function getWebhookDef(
  providerDef: ReturnType<typeof getProvider> & {}
): WebhookDef<unknown> | null {
  if (isWebhookProvider(providerDef)) {
    return providerDef.webhook as WebhookDef<unknown>;
  }
  // ManagedProvider: providerDef.inbound.webhook
  if (providerDef.kind === "managed") {
    return providerDef.inbound.webhook as WebhookDef<unknown>;
  }
  // ApiProvider with optional inbound webhooks
  if (providerDef.kind === "api" && "inbound" in providerDef && providerDef.inbound) {
    return providerDef.inbound.webhook as WebhookDef<unknown>;
  }
  return null;
}
```

### Step 3: Helper — Normalize `receivedAt` Timestamp

The relay used this pattern to handle Unix seconds vs milliseconds:

```typescript
function normalizeReceivedAt(ts: number): number {
  // If < 1e12, treat as Unix seconds and convert to milliseconds
  return ts < 1e12 ? ts * 1000 : ts;
}
```

### Step 4: POST Handler — Full Flow

The handler has two paths: **service auth** (internal backfill) and **standard** (external webhooks).

```typescript
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  const { provider: providerSlug } = await params;
  const receivedAt = Date.now();

  // ──────────────────────────────────────────────
  // Step 1: Provider guard
  // ──────────────────────────────────────────────
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

  // ──────────────────────────────────────────────
  // Step 2: Service auth detection
  // ──────────────────────────────────────────────
  const apiKey = req.headers.get("x-api-key");
  const isServiceAuth =
    apiKey != null &&
    env.MEMORY_API_KEY != null &&
    timingSafeStringEqual(apiKey, env.MEMORY_API_KEY);

  if (apiKey != null && !isServiceAuth) {
    // API key was provided but didn't match — reject
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  // ──────────────────────────────────────────────
  // SERVICE AUTH PATH (backfill / internal)
  // ──────────────────────────────────────────────
  if (isServiceAuth) {
    return handleServiceAuth(req, providerSlug, receivedAt);
  }

  // ──────────────────────────────────────────────
  // STANDARD PATH (external webhooks)
  // ──────────────────────────────────────────────
  return handleStandardWebhook(req, providerSlug, providerDef, receivedAt);
}
```

### Step 5: Service Auth Handler

```typescript
async function handleServiceAuth(
  req: NextRequest,
  providerSlug: string,
  receivedAt: number
): Promise<Response> {
  // Step 3: Validate service auth body
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

  // Step 4: Persist to gatewayWebhookDeliveries
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

  // Step 5: Dispatch Inngest event (unless held for replay)
  if (!holdForReplay) {
    await inngest.send({
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
```

### Step 6: Standard Webhook Handler

```typescript
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

  // Step 4: Webhook header guard — validate required headers
  const headersObj: Record<string, string | undefined> = {};
  for (const key of Object.keys(webhookDef.headersSchema.shape)) {
    headersObj[key] = req.headers.get(key) ?? undefined;
  }
  const headersParsed = webhookDef.headersSchema.safeParse(headersObj);
  if (!headersParsed.success) {
    return Response.json(
      { error: "missing_headers", issues: headersParsed.error.issues },
      { status: 400 }
    );
  }

  // Step 5: Raw body capture (MUST be req.text(), NOT req.json() — HMAC needs raw bytes)
  const rawBody = await req.text();

  // Step 6: HMAC / Ed25519 signature verification
  const configs = getProviderConfigs();
  const providerConfig = configs[providerSlug];
  if (!providerConfig) {
    log.error("[ingest] provider config not found", { provider: providerSlug });
    return Response.json(
      { error: "provider_not_configured", provider: providerSlug },
      { status: 500 }
    );
  }

  const secret = webhookDef.extractSecret(providerConfig);
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

  const parsedPayload = webhookDef.parsePayload(jsonPayload);
  const deliveryId = webhookDef.extractDeliveryId(req.headers, parsedPayload);
  const eventType = webhookDef.extractEventType(req.headers, parsedPayload);
  const resourceId = webhookDef.extractResourceId(parsedPayload);

  // Persist to gatewayWebhookDeliveries
  await db
    .insert(gatewayWebhookDeliveries)
    .values({
      provider: providerSlug,
      deliveryId,
      eventType,
      installationId: null, // resolved later by ingest-delivery
      status: "received",
      payload: JSON.stringify(parsedPayload),
      receivedAt: new Date(receivedAt).toISOString(),
    })
    .onConflictDoNothing();

  // Dispatch Inngest event
  await inngest.send({
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
```

## Event Schema

### `memory/webhook.received` — Inngest Event Data

Source: `packages/inngest/src/schemas/memory.ts` lines 49-64.

```typescript
// Standard webhook (external):
{
  provider: string;         // e.g. "github"
  deliveryId: string;       // e.g. "a1b2c3d4" (from provider headers)
  eventType: string;        // e.g. "pull_request" (from provider headers/payload)
  resourceId: string | null; // e.g. "123456789" (repo ID, extracted from payload)
  payload: unknown;         // parsed webhook payload
  receivedAt: number;       // Unix milliseconds
  // serviceAuth: omitted
  // preResolved: omitted
  // correlationId: omitted
}

// Service auth (backfill):
{
  provider: string;
  deliveryId: string;
  eventType: string;
  resourceId: string | null;
  payload: unknown;
  receivedAt: number;       // Unix milliseconds (normalized from body)
  serviceAuth: true;
  preResolved: {
    connectionId: string;   // gatewayInstallations.id
    orgId: string;          // Clerk org ID
  };
  // correlationId: omitted
}
```

The downstream `ingestDelivery` function (at `api/memory/src/inngest/functions/ingest-delivery.ts`) reads:
- `data.preResolved` — if present, skips connection resolution (Step 1)
- `data.resourceId` — used for DB JOIN to resolve connection when `preResolved` is absent
- `data.provider`, `data.deliveryId`, `data.eventType`, `data.payload`, `data.receivedAt` — passed to `transformEnvelope()`

## Error Handling

| Failure Mode | HTTP Status | Response Shape | Notes |
|---|---|---|---|
| Unknown provider slug | 404 | `{ error: "unknown_provider", provider }` | `getProvider()` returns undefined |
| Provider doesn't receive webhooks | 400 | `{ error: "not_webhook_provider", provider }` | `hasInboundWebhooks()` false (e.g. Apollo API-only) |
| Invalid API key | 401 | `{ error: "unauthorized" }` | `X-API-Key` present but doesn't match `MEMORY_API_KEY` |
| Invalid service-auth body | 400 | `{ error: "invalid_body", issues }` | `serviceAuthWebhookBodySchema` validation failed |
| Missing required headers | 400 | `{ error: "missing_headers", issues }` | `headersSchema` validation failed |
| Provider config not available | 500 | `{ error: "provider_not_configured", provider }` | Optional provider env vars absent |
| Signature verification failed | 401 | `{ error: "signature_invalid" }` | HMAC/Ed25519 mismatch |
| Invalid JSON body | 400 | `{ error: "invalid_json" }` | `JSON.parse` or `req.json()` failed |
| `parsePayload` throws (Zod) | Let it propagate → 500 | Next.js default error | Indicates provider schema bug — should be rare |
| DB insert fails | Let it propagate → 500 | Next.js default error | PlanetScale connectivity issue — retryable |
| Inngest send fails | Let it propagate → 500 | Next.js default error | Delivery stays `received`, recovered by cron |

### Resilience Notes

- **DB insert uses `.onConflictDoNothing()`**: duplicate deliveries (same `provider + deliveryId`) are silently accepted. Returns 200 with `{ status: "accepted" }` even on conflict — the Inngest event may fire twice but `ingest-delivery` is idempotent.
- **Delivery recovery cron**: If the route crashes after DB insert but before Inngest send, the delivery stays in `status: "received"`. The `delivery-recovery` cron (every 5 minutes) sweeps these and re-sends the Inngest event.
- **Hold semantics**: `X-Backfill-Hold: true` writes with `status: "held"` (not `"received"`), which the delivery-recovery cron ignores. The backfill orchestrator's `replay-held-webhooks` step later sweeps `status = "held"` records.

## Verification

### Manual Testing

1. **GitHub webhook**: Use `ngrok` (auto-started by `pnpm dev:app`) to receive a real GitHub webhook, or use GitHub's webhook redeliver UI.
2. **cURL service auth**:
   ```bash
   curl -X POST http://localhost:4112/api/ingest/github \
     -H "Content-Type: application/json" \
     -H "X-API-Key: $MEMORY_API_KEY" \
     -d '{
       "connectionId": "test-conn-id",
       "orgId": "test-org-id",
       "deliveryId": "test-del-001",
       "eventType": "pull_request",
       "resourceId": null,
       "payload": {"action": "opened"},
       "receivedAt": 1710849600000
     }'
   ```
3. **cURL hold for replay**:
   ```bash
   curl -X POST http://localhost:4112/api/ingest/github \
     -H "Content-Type: application/json" \
     -H "X-API-Key: $MEMORY_API_KEY" \
     -H "X-Backfill-Hold: true" \
     -d '{
       "connectionId": "test-conn-id",
       "orgId": "test-org-id",
       "deliveryId": "test-del-002",
       "eventType": "issues",
       "resourceId": null,
       "payload": {"action": "created"},
       "receivedAt": 1710849600000
     }'
   ```

### Automated Verification

1. Check DB after each test: `pnpm db:studio` → `lightfast_gateway_webhook_deliveries` table
2. Check Inngest dashboard (http://localhost:8288) for `memory/webhook.received` events
3. Verify no event appears for held deliveries
4. Test signature failure: send a request without proper HMAC headers → expect 401
5. Test unknown provider: `POST /api/ingest/unknown` → expect 404
6. Test duplicate: send the same deliveryId twice → both return 200, only one DB row

### Build Verification

```bash
pnpm build:memory
pnpm typecheck
```

## Notes

- **`extractSecret(config)` requires the provider-specific TConfig**: the `getProviderConfigs()` helper returns `Record<string, unknown>`, which is the runtime config built from env vars. It is passed directly to `extractSecret()` — the function uses `as` internally per the provider definition (e.g. `(config) => config.webhookSecret`). The unknown type is safe because each provider's `createConfig()` builds the correct shape.
- **`verifySignature` override**: Some providers may define `webhookDef.verifySignature` directly instead of using `signatureScheme`. The standard path checks for this: `webhookDef.verifySignature ?? deriveVerifySignature(webhookDef.signatureScheme)`.
- **No `correlationId` in the standard path**: External webhooks don't carry correlation IDs. Only backfill service-auth deliveries could include them, but the current `serviceAuthWebhookBodySchema` doesn't include `correlationId`, so it is omitted from the Inngest event. If needed later, extend the schema.
- **`receivedAt` normalization**: Only applied to the service-auth path where `receivedAt` comes from the request body (backfill might send Unix seconds). The standard path uses `Date.now()` directly (already milliseconds).
