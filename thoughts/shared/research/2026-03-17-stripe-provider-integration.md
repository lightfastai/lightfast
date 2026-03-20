---
date: 2026-03-17T00:00:00+11:00
researcher: claude
git_commit: 2cebd819fc9ca00e174fbdca08c116c8bbe46c35
branch: main
repository: lightfast
topic: "Stripe Connect integration into @repo/app-providers"
tags: [research, codebase, console-providers, stripe, providers, oauth, webhooks, backfill, payments]
status: complete
last_updated: 2026-03-17
---

# Research: Stripe Connect Integration into `@repo/app-providers`

**Date**: 2026-03-17
**Git Commit**: `2cebd819fc9ca00e174fbdca08c116c8bbe46c35`
**Branch**: `main`

## Research Question

What does it take to add Stripe (via Stripe Connect OAuth) as a new provider in `packages/console-providers/`, observing `payment_intent.*` and `charge.*` events, with webhook endpoints as the resource concept?

---

## Summary

The provider framework is well-suited for Stripe Connect OAuth. Adding Stripe requires **6 new files** plus **6 existing files** touched across the monorepo. Stripe's webhook signature scheme is the only structural difference from existing providers — the relay's `verifySignature` interface already accommodates it.

There is **one critical design decision** requiring attention before implementation: the resource model. The user selected "webhook endpoints" as the resource concept, but Stripe webhook payloads do not contain the webhook endpoint ID. This creates a mismatch with the relay's `extractResourceId → gatewayResources` connection resolution. Two architecturally sound alternatives exist, documented below.

---

## Detailed Findings

### 1. Provider Framework Fit

The `ProviderDefinition` interface at [`packages/console-providers/src/define.ts:346`](https://github.com/lightfastai/lightfast/blob/2cebd819fc9ca00e174fbdca08c116c8bbe46c35/packages/console-providers/src/define.ts#L346) requires:

| Field | Stripe Implementation |
|---|---|
| `envSchema` | `STRIPE_CLIENT_ID`, `STRIPE_CLIENT_SECRET` |
| `createConfig(env, runtime)` | Standard: read env vars, return null if absent |
| `configSchema` | `z.object({ clientId, clientSecret })` |
| `accountInfoSchema` | `stripeAccountInfoSchema` (discriminated on `sourceType: "stripe"`) |
| `providerConfigSchema` | `z.object({ provider: "stripe", type: "account", sync })` |
| `categories` | `payment_intent`, `charge` |
| `events` | `actionEvent` for each — see §5 |
| `webhook` | `WebhookDef` — see §3 |
| `oauth` | `OAuthDef` — see §2 |
| `api` | Stripe REST at `https://api.stripe.com` |
| `backfill` | `typedEntityHandler<string>` — see §4 |
| `resourcePicker` | see §6 critical decision |
| `optional?: true` | yes — Stripe env vars absent → null config → provider disabled |

---

### 2. Stripe Connect OAuth Flow

Stripe Connect uses standard OAuth 2.0 Authorization Code flow. It maps directly to `OAuthDef<TConfig>`:

**`buildAuthUrl(config, state)`**
`https://connect.stripe.com/oauth/authorize?response_type=code&client_id={clientId}&scope=read_write&state={state}&redirect_uri={callbackBaseUrl}/gateway/stripe/callback`

**`exchangeCode(config, code, redirectUri)`**
POST to `https://connect.stripe.com/oauth/token` with `grant_type=authorization_code`, `code`, `client_secret`. Response contains `access_token` (the connected account's secret key) and `stripe_user_id` (`acct_xxx`). This becomes `externalId` in the gateway installation record.

**`processCallback(config, query)`**
Reads `query.code`, calls `exchangeCode`, fetches account display info via `GET /v1/accounts/{stripe_user_id}`. Returns `CallbackResult` with `status: "connected"`, `externalId: stripe_user_id`, `tokens.accessToken: access_token`.

**`getActiveToken(_config, _externalId, storedAccessToken)`**
Returns `storedAccessToken` directly. Set `usesStoredToken: true`.

**`revokeToken(config, accessToken)`**
POST to `https://connect.stripe.com/oauth/deauthorize` with `client_id`, `stripe_user_id`. Called during gateway teardown Step 2 ([`apps/gateway/src/workflows/connection-teardown.ts:62`](https://github.com/lightfastai/lightfast/blob/2cebd819fc9ca00e174fbdca08c116c8bbe46c35/apps/gateway/src/workflows/connection-teardown.ts#L62)).

**`refreshToken`**
Stripe Connect access tokens do not expire and cannot be refreshed. Return a stub that throws — the gateway only calls this when `tokenRow.expiresAt` is in the past, which won't happen since `exchangeCode` returns no `expiresIn`.

The gateway's OAuth callback at [`apps/gateway/src/routes/connections.ts:260`](https://github.com/lightfastai/lightfast/blob/2cebd819fc9ca00e174fbdca08c116c8bbe46c35/apps/gateway/src/routes/connections.ts#L260) passes all query params to `processCallback` as `Record<string, string>` — no changes to the route itself.

---

### 3. Webhook Signature — The Only Structural Difference

Stripe uses a **timestamp-prefixed HMAC** scheme, not a simple body HMAC. The `Stripe-Signature` header has format: `t=<epoch_seconds>,v1=<hex_digest>`. The signed payload is `${t}.${rawBody}` (literal dot concatenation), signed with HMAC-SHA256 using the webhook signing secret.

The `WebhookDef` interface at [`packages/console-providers/src/define.ts:79`](https://github.com/lightfastai/lightfast/blob/2cebd819fc9ca00e174fbdca08c116c8bbe46c35/packages/console-providers/src/define.ts#L79) fully accommodates this — `verifySignature` receives `rawBody`, `headers`, and `secret`, which is enough to reconstruct the signed payload. The existing `computeHmac` utility at [`packages/console-providers/src/crypto.ts:14`](https://github.com/lightfastai/lightfast/blob/2cebd819fc9ca00e174fbdca08c116c8bbe46c35/packages/console-providers/src/crypto.ts#L14) can be called with `${t}.${rawBody}` as the message.

Tolerance window: Stripe recommends rejecting webhooks where `|Date.now()/1000 - t| > 300` (5 minutes) to prevent replay attacks. The signed payload includes `t` so a replayed signature with a different `t` would be invalid — the timestamp tolerance is an additional defense.

```
// Stripe verifySignature sketch
verifySignature: (rawBody, headers, secret) => {
  const sig = headers.get("stripe-signature");
  if (!sig) return false;
  const parts = Object.fromEntries(sig.split(",").map(p => p.split("=")));
  const t = parts["t"];
  const v1 = parts["v1"];
  if (!t || !v1) return false;
  // Optional: timestamp tolerance check
  const expected = computeHmac(`${t}.${rawBody}`, secret, "SHA-256");
  return timingSafeEqual(v1, expected);
}
```

**`headersSchema`** (used by `webhookHeaderGuard` for early rejection before body read):
```ts
headersSchema: z.object({
  "stripe-signature": z.string(),
})
```

**`extractDeliveryId`**: reads `payload.id` — Stripe event IDs (`evt_xxx`) are globally unique per event.

**`extractEventType`**: reads `payload.type` — e.g., `payment_intent.succeeded`, `charge.refunded`.

**Relay env var addition**: `apps/relay/src/middleware/webhook.ts:64-78` contains the `webhookSecretEnvKey` map. This map **must** be updated to add `stripe: "STRIPE_WEBHOOK_SECRET"`. The relay's `env.ts` must also declare the corresponding env var.

---

### 4. Critical Design Decision: `extractResourceId` and the Resource Model

#### The Tension

The relay's Step 2 workflow ([`apps/relay/src/routes/workflows.ts:60`](https://github.com/lightfastai/lightfast/blob/2cebd819fc9ca00e174fbdca08c116c8bbe46c35/apps/relay/src/routes/workflows.ts#L60)) resolves a connection by querying `gatewayResources` where `providerResourceId = extractResourceId(payload)`. This is how the relay maps a webhook to the right workspace.

The user selected "webhook endpoints" (`we_xxx`) as the resource concept. The problem: **Stripe webhook payloads do not contain the webhook endpoint ID**. The payload contains `payload.id` (the event), `payload.account` (the connected Stripe account, for Connect webhooks), and `payload.data.object.*` (the payment object). There is no `we_xxx` field.

If `extractResourceId` returns a webhook endpoint ID that was stored as `providerResourceId`, the relay Step 2 query will return no rows → webhook routes to DLQ.

#### Two Architecturally Sound Options

**Option A — Stripe Account as Resource (`acct_xxx`)**

Map each Stripe Connect account to a resource. `providerResourceId = acct_xxx` = `payload.account`.

- `extractResourceId(payload)` → `(payload as { account?: string }).account ?? null`
- `installationMode: "single"` — one Stripe account per installation; no resource picker dropdown needed
- `listResources` → calls `GET /v1/accounts/{externalId}` and returns the single account as a `NormalizedResource` with `id = acct_xxx`, `name = display_name or email`
- `linkName` not needed — `name` is sufficient as the resource display label
- Relay routing works: `payload.account = "acct_xxx"` matches `gatewayResources.providerResourceId = "acct_xxx"`

This is the simpler model and the one that fits Stripe Connect's data model. Each installation = one connected Stripe account = one resource.

**Option B — Webhook Endpoints as Resources, custom routing**

If multiple webhook endpoints per account must be supported (e.g., test vs. production endpoints):

- Stripe sends webhook endpoint events to a single URL, not per-endpoint URLs. The Lightfast relay endpoint would receive *all* events from *all* registered endpoints for a connected account.
- `extractResourceId` would need to return the `acct_xxx` (to resolve the installation) while the webhook endpoint selection acts as a *filter* inside the transformer or ingress layer, not a routing key.
- `providerResourceId = we_xxx` stored in `workspaceIntegrations`, but routing still happens via `acct_xxx` stored in a *separate* `gatewayResources` row.

This requires a custom routing layer and is significantly more complex. The existing relay pipeline does not support this pattern.

**Recommendation for the research document**: Option A (Stripe account as resource, `installationMode: "single"`) maps cleanly to the existing pipeline. Option B requires architectural changes to the relay.

---

### 5. Events: `payment_intent` and `charge`

Both fit the `actionEvent` pattern (events with sub-actions). Stripe event types follow `{object}.{action}` which maps directly to the provider framework's `{eventKey}.{action}` structure.

**`payment_intent` event** (category key: `payment_intent`):
```ts
payment_intent: actionEvent({
  label: "Payment Intents",
  weight: 55,
  schema: preTransformStripePaymentIntentSchema,
  transform: transformStripePaymentIntent,
  actions: {
    created:                 { label: "Payment Intent Created",  weight: 30 },
    succeeded:               { label: "Payment Succeeded",       weight: 70 },
    payment_failed:          { label: "Payment Failed",          weight: 65 },
    canceled:                { label: "Payment Intent Canceled", weight: 40 },
    requires_action:         { label: "Requires Action (3DS)",   weight: 50 },
    amount_capturable_updated: { label: "Capture Amount Updated", weight: 25 },
  },
})
```

**`charge` event** (category key: `charge`):
```ts
charge: actionEvent({
  label: "Charges",
  weight: 45,
  schema: preTransformStripeChargeSchema,
  transform: transformStripeCharge,
  actions: {
    succeeded: { label: "Charge Succeeded",  weight: 60 },
    failed:    { label: "Charge Failed",     weight: 65 },
    refunded:  { label: "Charge Refunded",   weight: 50 },
    disputed:  { label: "Charge Disputed",   weight: 55 },
  },
})
```

**`resolveCategory`**: Stripe event types are `{category}.{action}` — split on `.` and return the first segment:
```ts
resolveCategory: (eventType) => eventType.split(".")[0],
```

**`getBaseEventType`**: same logic (1:1 with category):
```ts
getBaseEventType: (sourceType) => sourceType.split(".")[0],
```

---

### 6. Pre-Transform Schemas and Transformer Mapping

Stripe webhook payloads have a consistent envelope:
```json
{
  "id": "evt_xxx",
  "type": "payment_intent.succeeded",
  "account": "acct_xxx",
  "data": { "object": { /* the Stripe object */ } },
  "created": 1234567890
}
```

**Pre-transform schema pattern**: Following the Sentry standalone pattern (not the Linear base-extend pattern):
```ts
export const preTransformStripePaymentIntentSchema = z.object({
  id: z.string(),          // evt_xxx
  type: z.string(),        // payment_intent.*
  account: z.string().optional(),
  created: z.number(),     // Unix epoch seconds
  data: z.object({
    object: z.object({
      id: z.string(),      // pi_xxx
      amount: z.number(),
      currency: z.string(),
      status: z.string(),
      customer: z.string().nullable().optional(),
      description: z.string().nullable().optional(),
      receipt_url: z.string().nullable().optional(),
      metadata: z.record(z.string()).optional(),
    }),
  }),
});
```

**`PostTransformEvent` field mapping for `payment_intent`**:

| PostTransformEvent field | Stripe source |
|---|---|
| `deliveryId` | `context.deliveryId` (the `evt_xxx` set by `extractDeliveryId`) |
| `sourceId` | `stripe:payment_intent:{pi_xxx}:payment_intent.{action}` |
| `provider` | `"stripe"` |
| `eventType` | `"payment_intent.{action}"` (e.g., `payment_intent.succeeded`) |
| `occurredAt` | `new Date(payload.created * 1000).toISOString()` |
| `entity.provider` | `"stripe"` |
| `entity.entityType` | `"payment_intent"` |
| `entity.entityId` | `payload.data.object.id` (`pi_xxx`) |
| `entity.title` | `payload.data.object.description ?? payload.data.object.id` |
| `entity.url` | `payload.data.object.receipt_url ?? null` |
| `entity.state` | `payload.data.object.status` |
| `relations` | `[]` (can add customer relation if `customer` is present) |
| `title` | `[Payment {ActionLabel}] {amount_formatted} {currency.toUpperCase()}: {description}` |
| `body` | `bodyParts` array: amount, status, customer ID, metadata entries |
| `attributes` | flat: `paymentIntentId`, `amount`, `currency`, `status`, `customerId`, `description`, `receiptUrl`, metadata keys |

`occurredAt` follows the same Unix-epoch-to-ISO pattern used in `sentry/transformers.ts:132-135`.

---

### 7. Backfill: `starting_after` Cursor

Stripe list endpoints use cursor-based pagination: `starting_after={last_id}`, page size via `limit` (max 100). The response shape:
```json
{ "object": "list", "data": [...], "has_more": true, "url": "..." }
```

This maps directly to `typedEntityHandler<string>` — the same structure used by Linear's GraphQL cursor, but simpler. The Vercel backfill ([`packages/console-providers/src/providers/vercel/backfill.ts:74`](https://github.com/lightfastai/lightfast/blob/2cebd819fc9ca00e174fbdca08c116c8bbe46c35/packages/console-providers/src/providers/vercel/backfill.ts#L74)) is the closest structural analog.

```ts
payment_intent: typedEntityHandler<string>({
  endpointId: "list-payment-intents",
  buildRequest(ctx, cursor) {
    return {
      queryParams: {
        limit: "100",
        created: { gte: Math.floor(new Date(ctx.since).getTime() / 1000).toString() },
        ...(cursor ? { starting_after: cursor } : {}),
      },
    };
  },
  processResponse(data, ctx, cursor) {
    const list = data as { data: Array<{ id: string; ... }>; has_more: boolean };
    const events: BackfillWebhookEvent[] = list.data.map((pi) => ({
      deliveryId: `backfill-${ctx.installationId}-${ctx.resource.providerResourceId}-payment_intent-${pi.id}`,
      eventType: `payment_intent.${pi.status === "succeeded" ? "succeeded" : "created"}`,
      payload: { /* synthetic webhook envelope */ },
    }));
    return {
      events,
      nextCursor: list.has_more ? (list.data.at(-1)?.id ?? null) : null,
      rawCount: list.data.length,
    };
  },
})
```

Stripe's `created[gte]` filter maps to `ctx.since` — convert the ISO timestamp to Unix epoch seconds.

**Rate limiting**: Stripe's rate limit headers are `Stripe-Livemode-Ratelimit-Remaining` and `Stripe-Livemode-Ratelimit-Limit` (or Testmode variants). The provider's `api.parseRateLimit(headers)` must read these.

---

### 8. API Endpoint Catalog

```ts
export const stripeApi: ProviderApi = {
  baseUrl: "https://api.stripe.com",
  buildAuthHeader: (token) => `Bearer ${token}`,
  defaultHeaders: { "Stripe-Version": "2024-06-20" },
  endpoints: {
    "get-account": {
      method: "GET",
      path: "/v1/accounts/{account_id}",
      description: "Fetch a connected account",
      responseSchema: z.object({ id: z.string(), ... }).passthrough(),
    },
    "list-payment-intents": {
      method: "GET",
      path: "/v1/payment_intents",
      description: "List payment intents",
      responseSchema: z.object({ data: z.array(z.unknown()), has_more: z.boolean() }).passthrough(),
    },
    "list-charges": {
      method: "GET",
      path: "/v1/charges",
      description: "List charges",
      responseSchema: z.object({ data: z.array(z.unknown()), has_more: z.boolean() }).passthrough(),
    },
  },
  parseRateLimit: (headers) => {
    const remaining = headers.get("stripe-livemode-ratelimit-remaining")
      ?? headers.get("stripe-testmode-ratelimit-remaining");
    const limit = headers.get("stripe-livemode-ratelimit-limit")
      ?? headers.get("stripe-testmode-ratelimit-limit");
    if (!remaining || !limit) return null;
    return {
      remaining: Number(remaining),
      limit: Number(limit),
      resetAt: new Date(Date.now() + 1000), // Stripe resets per-second, no reset header
    };
  },
};
```

---

### 9. Display Entry

[`packages/console-providers/src/display.ts:18`](https://github.com/lightfastai/lightfast/blob/2cebd819fc9ca00e174fbdca08c116c8bbe46c35/packages/console-providers/src/display.ts#L18):

```ts
stripe: {
  name: "stripe",
  displayName: "Stripe",
  description: "Connect your Stripe account",
  comingSoon: true, // remove when live
  icon: {
    viewBox: "0 0 24 24",
    d: "M13.976 9.15c-2.172-.806-3.356-1.426-3.356-2.409 0-.831.683-1.305 1.901-1.305 2.227 0 4.515.858 6.09 1.631l.89-5.494C18.252.975 15.697 0 12.165 0 9.667 0 7.589.654 6.104 1.872 4.56 3.147 3.757 4.992 3.757 7.218c0 4.039 2.467 5.76 6.476 7.219 2.585.92 3.445 1.574 3.445 2.583 0 .98-.84 1.545-2.354 1.545-1.875 0-4.965-.921-6.99-2.109l-.9 5.555C5.175 22.99 8.385 24 11.714 24c2.641 0 4.843-.624 6.328-1.813 1.664-1.305 2.525-3.236 2.525-5.732 0-4.128-2.524-5.851-6.591-7.305z",
  },
},
```

---

### 10. Complete Touch Points

#### New Files (6)

```
packages/console-providers/src/providers/stripe/
├── auth.ts          StripeConfig, StripeAccountInfo, StripeOAuthRaw, StripeProviderConfig schemas
├── api.ts           stripeApi: ProviderApi
├── schemas.ts       preTransformStripePaymentIntentSchema, preTransformStripeChargeSchema
├── transformers.ts  transformStripePaymentIntent, transformStripeCharge
├── backfill.ts      stripeBackfill: BackfillDef (payment_intent + charge entity handlers)
└── index.ts         defineProvider() call exporting `stripe`
```

#### Existing Files to Update (6)

| File | Change |
|---|---|
| [`packages/console-providers/src/registry.ts:20-36`](https://github.com/lightfastai/lightfast/blob/2cebd819fc9ca00e174fbdca08c116c8bbe46c35/packages/console-providers/src/registry.ts#L20) | Add `stripe: StripeConfig` to `ProviderConfigMap`; add `stripe` to `PROVIDERS` |
| [`packages/console-providers/src/registry.ts:132-138`](https://github.com/lightfastai/lightfast/blob/2cebd819fc9ca00e174fbdca08c116c8bbe46c35/packages/console-providers/src/registry.ts#L132) | Add `PROVIDERS.stripe.accountInfoSchema` to `providerAccountInfoSchema` discriminated union |
| [`packages/console-providers/src/registry.ts:144-150`](https://github.com/lightfastai/lightfast/blob/2cebd819fc9ca00e174fbdca08c116c8bbe46c35/packages/console-providers/src/registry.ts#L144) | Add `PROVIDERS.stripe.providerConfigSchema` to `providerConfigSchema` discriminated union |
| [`packages/console-providers/src/display.ts:18`](https://github.com/lightfastai/lightfast/blob/2cebd819fc9ca00e174fbdca08c116c8bbe46c35/packages/console-providers/src/display.ts#L18) | Add `stripe` entry to `PROVIDER_DISPLAY` |
| `apps/relay/src/middleware/webhook.ts:64-78` | Add `stripe: "STRIPE_WEBHOOK_SECRET"` to `webhookSecretEnvKey` map |
| `apps/relay/src/env.ts` | Add `STRIPE_WEBHOOK_SECRET: z.string().min(1).optional()` env var |

`apps/gateway/src/env.ts` does **not** need manual changes — `PROVIDER_ENVS()` at [`apps/gateway/src/env.ts:26`](https://github.com/lightfastai/lightfast/blob/2cebd819fc9ca00e174fbdca08c116c8bbe46c35/apps/gateway/src/env.ts#L26) automatically includes all provider env presets from the registry.

---

## Code References

- [`packages/console-providers/src/define.ts:346`](https://github.com/lightfastai/lightfast/blob/2cebd819fc9ca00e174fbdca08c116c8bbe46c35/packages/console-providers/src/define.ts#L346) — `ProviderDefinition` interface
- [`packages/console-providers/src/define.ts:79`](https://github.com/lightfastai/lightfast/blob/2cebd819fc9ca00e174fbdca08c116c8bbe46c35/packages/console-providers/src/define.ts#L79) — `WebhookDef` interface
- [`packages/console-providers/src/define.ts:99`](https://github.com/lightfastai/lightfast/blob/2cebd819fc9ca00e174fbdca08c116c8bbe46c35/packages/console-providers/src/define.ts#L99) — `OAuthDef` interface
- [`packages/console-providers/src/define.ts:218`](https://github.com/lightfastai/lightfast/blob/2cebd819fc9ca00e174fbdca08c116c8bbe46c35/packages/console-providers/src/define.ts#L218) — `BackfillEntityHandler` interface
- [`packages/console-providers/src/crypto.ts:14`](https://github.com/lightfastai/lightfast/blob/2cebd819fc9ca00e174fbdca08c116c8bbe46c35/packages/console-providers/src/crypto.ts#L14) — `computeHmac` (reusable for Stripe timestamp+HMAC)
- [`packages/console-providers/src/registry.ts:20`](https://github.com/lightfastai/lightfast/blob/2cebd819fc9ca00e174fbdca08c116c8bbe46c35/packages/console-providers/src/registry.ts#L20) — `ProviderConfigMap`, `PROVIDERS` — two additions needed
- [`packages/console-providers/src/registry.ts:132`](https://github.com/lightfastai/lightfast/blob/2cebd819fc9ca00e174fbdca08c116c8bbe46c35/packages/console-providers/src/registry.ts#L132) — discriminated union tuples — two additions needed
- [`packages/console-providers/src/display.ts:18`](https://github.com/lightfastai/lightfast/blob/2cebd819fc9ca00e174fbdca08c116c8bbe46c35/packages/console-providers/src/display.ts#L18) — `PROVIDER_DISPLAY` — one addition
- [`packages/console-providers/src/post-transform-event.ts`](https://github.com/lightfastai/lightfast/blob/2cebd819fc9ca00e174fbdca08c116c8bbe46c35/packages/console-providers/src/post-transform-event.ts) — canonical `PostTransformEvent` schema
- [`apps/relay/src/middleware/webhook.ts`](https://github.com/lightfastai/lightfast/blob/2cebd819fc9ca00e174fbdca08c116c8bbe46c35/apps/relay/src/middleware/webhook.ts) — `webhookSecretEnvKey` map + seven-middleware chain
- [`apps/relay/src/routes/workflows.ts:60`](https://github.com/lightfastai/lightfast/blob/2cebd819fc9ca00e174fbdca08c116c8bbe46c35/apps/relay/src/routes/workflows.ts#L60) — `resolve-connection` step (where `extractResourceId` is consumed)
- [`apps/gateway/src/routes/connections.ts:260`](https://github.com/lightfastai/lightfast/blob/2cebd819fc9ca00e174fbdca08c116c8bbe46c35/apps/gateway/src/routes/connections.ts#L260) — `processCallback` call site
- [`apps/gateway/src/workflows/connection-teardown.ts:62`](https://github.com/lightfastai/lightfast/blob/2cebd819fc9ca00e174fbdca08c116c8bbe46c35/apps/gateway/src/workflows/connection-teardown.ts#L62) — `revokeToken` call site
- [`apps/gateway/src/routes/connections.ts:763`](https://github.com/lightfastai/lightfast/blob/2cebd819fc9ca00e174fbdca08c116c8bbe46c35/apps/gateway/src/routes/connections.ts#L763) — proxy execute (used by backfill + resource picker)
- [`apps/backfill/src/workflows/entity-worker.ts:96`](https://github.com/lightfastai/lightfast/blob/2cebd819fc9ca00e174fbdca08c116c8bbe46c35/apps/backfill/src/workflows/entity-worker.ts#L96) — pagination loop
- [`packages/console-providers/src/providers/sentry/index.ts`](https://github.com/lightfastai/lightfast/blob/2cebd819fc9ca00e174fbdca08c116c8bbe46c35/packages/console-providers/src/providers/sentry/index.ts) — reference implementation (closest to Stripe's `single` + `simple-OAuth` structure)
- [`packages/console-providers/src/providers/vercel/backfill.ts:74`](https://github.com/lightfastai/lightfast/blob/2cebd819fc9ca00e174fbdca08c116c8bbe46c35/packages/console-providers/src/providers/vercel/backfill.ts#L74) — closest cursor-pagination analog to Stripe's `starting_after`

---

## Architecture Documentation

### Current Patterns Stripe Must Follow

1. **`sourceId` convention**: `{provider}:{entityType}:{entityId}:{eventType}` — e.g., `stripe:payment_intent:pi_xxx:payment_intent.succeeded`
2. **`occurredAt`**: Stripe sends `created` as Unix epoch seconds — multiply by 1000: `new Date(payload.created * 1000).toISOString()`
3. **`body` assembly**: `bodyParts` string array, filter falsy, join `"\n"`, then `sanitizeBody()` (max 10,000 chars via `sanitize.ts`)
4. **`title` format**: `[{ActionLabel}] {amount_formatted}: {description}`, then `sanitizeTitle()` (max 200 chars)
5. **`entity.url`**: always explicitly set — `receipt_url` or `null`; never `undefined`
6. **`entity.state`**: Stripe payment status (e.g., `"succeeded"`, `"requires_payment_method"`) — maps cleanly
7. **Validation**: call `validatePostTransformEvent(event)` at end of every transformer — non-blocking, observability only

### Connection Topology for Stripe Connect

```
One Stripe Connect OAuth → one gatewayInstallations row (externalId = acct_xxx)
                         → one gatewayResources row (providerResourceId = acct_xxx) [Option A]
                         → one workspaceIntegrations row per workspace that links it

Inbound webhook:
POST /api/webhooks/stripe
  → extractResourceId(payload) → payload.account = "acct_xxx"
  → relay Step 2: gatewayResources WHERE providerResourceId = "acct_xxx" → connectionId
  → relay Step 4: publish WebhookEnvelope to Console ingress
```

### QStash Deduplication

The relay's `deduplicationId` format is `${provider}_${deliveryId}` (see `workflows.ts:180`, note `_` separator — QStash rejects `:`). For Stripe: `stripe_evt_xxx`. Since `evt_xxx` is globally unique, this prevents duplicate delivery if the relay retries Step 4.

---

## Historical Context (from thoughts/)

- `thoughts/shared/plans/2026-03-17-relay-drop-redis-cache.md` — plan in progress to drop Redis-based deduplication in the relay in favor of QStash native dedup. The relay agent confirmed Redis deduplication is already gone; dedup now happens via QStash `deduplicationId`. Stripe integration should use QStash dedup only, no Redis needed.
- `thoughts/shared/research/2026-03-17-hubspot-provider-integration.md` — prior research on HubSpot as a provider. HubSpot also uses standard OAuth 2.0 — the Stripe Connect flow is nearly identical in structure.

---

## Related Research

- `thoughts/shared/research/2026-03-17-hubspot-provider-integration.md` — HubSpot provider: closest structural analog (standard OAuth, same framework touch points)
- `thoughts/shared/research/2026-03-17-relay-upstash-to-inngest-migration.md` — relay migration context (may affect backfill dispatch path)

---

## Open Questions

1. ~~**Resource model decision**~~ — **Resolved**: Use Option A. `providerResourceId = acct_xxx`, `installationMode: "single"`, `extractResourceId` returns `payload.account`. No relay changes needed.

2. **Stripe API version pinning**: The `Stripe-Version` header in `defaultHeaders` should pin to a specific API version. The version affects which fields are present in webhook payloads — confirm the version before writing the pre-transform schemas.

3. **Livemode vs testmode**: Stripe sends separate webhooks for live and test events. The signing secret is different for each. A single installation will likely be either live or test — how to handle this at the account level vs. per-endpoint?

4. **Connect vs standard account**: If Lightfast users are connecting their own Stripe account (not via a platform), there is no `payload.account` field in webhooks. This affects `extractResourceId`. Clarify whether the target is Stripe Connect (account field present) or direct account integration (no account field).

5. **Dispute webhook events**: `charge.dispute.created/closed/funds_withdrawn` — whether to add a `dispute` category in a future iteration.
