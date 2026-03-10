---
date: 2026-03-10T00:00:00+00:00
researcher: claude
git_commit: 9de5c112bbfd921858ca4e940dbbe3798de6455b
branch: feat/backfill-depth-entitytypes-run-tracking
repository: lightfast
topic: "Correlation between TransformContext and gateway schemas: shared variable propagation"
tags: [research, codebase, console-providers, gateway, relay, backfill, transform, webhook]
status: complete
last_updated: 2026-03-10
---

# Research: TransformContext ↔ Gateway Schema Correlation

**Date**: 2026-03-10
**Git Commit**: `9de5c112bbfd921858ca4e940dbbe3798de6455b`
**Branch**: `feat/backfill-depth-entitytypes-run-tracking`

## Research Question

Is there any correlation between `packages/console-providers/src/types.ts` and
`packages/console-providers/src/gateway.ts` around `TransformContext`? How do the
shared variables (`deliveryId`, `eventType`, `receivedAt`) propagate throughout the
whole application?

---

## Summary

`TransformContext` is a 3-field structural **subset** of every gateway wire-format
schema. The fields `deliveryId`, `eventType`, and `receivedAt` appear in 16 distinct
locations spanning the relay → console ingress → provider transformer pipeline.

The one divergence between the two files is **type of `receivedAt`**: all gateway
schemas use `z.number()` (epoch milliseconds); `TransformContext` alone uses `z.date()`
(a JS `Date` object). This conversion happens at a single boundary point in the console
ingress transform helper. Despite being present in `TransformContext`, `receivedAt` is
**never read** by any provider transformer function.

---

## Detailed Findings

### 1. Canonical Definitions

#### `TransformContext` — `packages/console-providers/src/types.ts:3-9`

```ts
export const transformContextSchema = z.object({
  deliveryId: z.string(),
  eventType: z.string(),
  receivedAt: z.date(),        // JS Date — the one outlier
});
export type TransformContext = z.infer<typeof transformContextSchema>;
```

#### Gateway schemas — `packages/console-providers/src/gateway.ts`

| Schema | Line | `receivedAt` type | Extra fields |
|---|---|---|---|
| `serviceAuthWebhookBodySchema` | 15–26 | `z.number().finite()` | `connectionId`, `orgId`, `resourceId?`, `payload` |
| `webhookReceiptPayloadSchema` | 32–42 | `z.number()` | `provider`, `resourceId`, `payload`, `correlationId?` |
| `webhookEnvelopeSchema` | 48–66 | `z.number()` | `connectionId`, `orgId`, `provider`, `payload`, `correlationId?` |

All three gateway schemas are a superset of `TransformContext`'s three fields, with
`receivedAt` typed as `number` rather than `Date`.

---

### 2. The `deliveryId` / `eventType` / `receivedAt` Triad — All 16 Locations

| Location | `receivedAt` type | Notes |
|---|---|---|
| `packages/console-providers/src/types.ts:3` | `z.date()` | **TransformContext** — only `Date` usage |
| `packages/console-providers/src/gateway.ts:22` | `z.number().finite()` | `serviceAuthWebhookBodySchema` |
| `packages/console-providers/src/gateway.ts:38` | `z.number()` | `webhookReceiptPayloadSchema` |
| `packages/console-providers/src/gateway.ts:62` | `z.number()` | `webhookEnvelopeSchema` |
| `packages/gateway-service-clients/src/relay.ts:5` | `number` | `DispatchPayload` interface — relay client |
| `core/cli/src/commands/listen.ts:19` | `number` | `CatchUpEvent` interface — CLI listen command |
| `apps/relay/src/middleware/webhook.ts:25` | absent | `WebhookVariables` — `receivedAt` not a Hono ctx var |
| `apps/relay/src/routes/webhooks.ts:148` | `number` | `WebhookReceiptPayload` assembly (`Date.now()`) |
| `apps/relay/src/routes/workflows.ts:189` | `number` | `WebhookEnvelope` assembly in publish-to-console step |
| `apps/relay/src/lib/replay.ts:63` | `number` | `WebhookReceiptPayload` re-assembly (`new Date(delivery.receivedAt).getTime()`) |
| `apps/backfill/src/workflows/entity-worker.ts:176` | `number` | `DispatchPayload` assembly (`Date.now()`) |
| `apps/console/src/app/api/debug/inject-event/route.ts:148` | `number` | Debug dispatch assembly (`Date.now()`) |
| `apps/console/src/app/api/gateway/ingress/_lib/transform.ts:19` | **`Date`** | **The conversion boundary**: `new Date(envelope.receivedAt)` |
| `packages/console-backfill/src/adapters/round-trip.test.ts:33` | `Date` | Test fixture construction |
| `db/console/src/schema/tables/gw-webhook-deliveries.ts:30` | PG timestamp string | DB column: `timestamp with timezone, mode: "string"` |
| `db/console/src/schema/tables/workspace-events.ts:XX` | PG timestamp string | DB column: `timestamp with timezone, mode: "string"` |

---

### 3. The Single Conversion Boundary

`apps/console/src/app/api/gateway/ingress/_lib/transform.ts:18-24`

```ts
return transformWebhookPayload(
  envelope.provider,
  envelope.eventType,
  envelope.payload,
  {
    deliveryId: envelope.deliveryId,
    receivedAt: new Date(envelope.receivedAt),  // number → Date
    eventType: envelope.eventType,
  }
);
```

This is the only place in production code where `envelope.receivedAt` (a `number` from
`webhookEnvelopeSchema`) is converted to a `Date` to satisfy `TransformContext`'s
`z.date()` field. No other path exists.

---

### 4. `TransformContext` Import Graph

`transformContextSchema` is defined in `types.ts`, re-exported from `index.ts:268`,
and **never called with `.parse()` or `.safeParse()`** anywhere. `TransformContext`
objects are always constructed as plain object literals. The schema value is exported
but serves only as documentation of the shape.

**Import sites for the `TransformContext` type:**

| File | Line | Role |
|---|---|---|
| `packages/console-providers/src/define.ts` | 8 | Function signature type constraint |
| `packages/console-providers/src/dispatch.ts` | 5 | Entry-point parameter type |
| `packages/console-providers/src/providers/github/transformers.ts` | 6 | Individual transformer parameter |
| `packages/console-providers/src/providers/linear/transformers.ts` | 6 | Individual transformer parameter |
| `packages/console-providers/src/providers/sentry/transformers.ts` | 6 | Individual transformer parameter |
| `packages/console-providers/src/providers/vercel/transformers.ts` | 6 | Individual transformer parameter |

---

### 5. Function Signatures That Accept `TransformContext`

**Entry point** — `packages/console-providers/src/dispatch.ts:15-20`:
```ts
function transformWebhookPayload(
  provider: SourceType,
  eventType: string,
  payload: unknown,
  context: TransformContext
): PostTransformEvent | null
```

**Interface declarations** — `packages/console-providers/src/define.ts:29,45`:
```ts
readonly transform: (payload: z.infer<S>, ctx: TransformContext) => PostTransformEvent;
```

**Per-provider transformers** (all follow the same signature):

| Provider | Functions accepting `ctx: TransformContext` |
|---|---|
| GitHub | `transformGitHubPush`, `transformGitHubPullRequest`, `transformGitHubIssue`, `transformGitHubRelease`, `transformGitHubDiscussion` |
| Linear | `transformLinearIssue`, `transformLinearComment`, `transformLinearProject`, `transformLinearCycle`, `transformLinearProjectUpdate` |
| Sentry | `transformSentryIssue`, `transformSentryError`, `transformSentryEventAlert`, `transformSentryMetricAlert` |
| Vercel | `transformVercelDeployment` |

---

### 6. What Each Field Is Actually Used For in Transformers

| Field | Used by | How |
|---|---|---|
| `deliveryId` | All transformers | Written into `PostTransformEvent.metadata.deliveryId` |
| `eventType` | Vercel only (`transformers.ts:20`) | Cast as `VercelWebhookEventType` to drive event-type branching |
| `receivedAt` | **No transformer** | Carried in `TransformContext` but never accessed by any transformer body |

The dispatch layer (`dispatch.ts:31`) also overrides `eventType` before passing context
to the event-level transformer:
```ts
eventDef.transform(parsed, { ...context, eventType });
```
This replaces the raw provider event type with the normalized internal event type string.

---

### 7. `resourceId` — The Companion Field

`resourceId` appears alongside `deliveryId` through the relay layer but is absent from
both `WebhookEnvelope` and `TransformContext`.

| Schema / Type | Has `resourceId`? |
|---|---|
| `serviceAuthWebhookBodySchema` | ✓ (`nullable().optional()`) |
| `webhookReceiptPayloadSchema` | ✓ (`nullable()`) |
| `WebhookVariables` (Hono context) | ✓ (`string \| null`) |
| `WebhookEnvelope` | ✗ — dropped after connection resolution |
| `TransformContext` | ✗ |
| `DispatchPayload` | ✗ |

`resourceId` is used in `workflows.ts` to look up which installation a webhook belongs
to (resource-scoped connection resolution). Once the `connectionId` and `orgId` are
resolved, `resourceId` is no longer needed and is not forwarded.

---

### 8. Full Pipeline Flow

```
External webhook POST /webhooks/:provider
    │
    ├─ [relay middleware] signatureVerify, payloadParseAndExtract
    │     Sets Hono ctx: deliveryId, eventType, resourceId, parsedPayload
    │
    └─ [relay/routes/webhooks.ts:148] Assemble WebhookReceiptPayload
          { provider, deliveryId, eventType, resourceId, payload, receivedAt: Date.now() }
          → Upstash Workflow trigger
          │
          └─ [relay/routes/workflows.ts] webhookDeliveryWorkflow
                Steps: dedup → persist-delivery → resolve-connection → publish-to-console
                [publish step] Assemble WebhookEnvelope
                { deliveryId, connectionId, orgId, provider, eventType, payload, receivedAt }
                → QStash → POST /api/gateway/ingress (console)
                │
                └─ [console/src/app/api/gateway/ingress/route.ts:28]
                      serve<WebhookEnvelope> → envelope = context.requestPayload
                      → transformEnvelope(envelope)
                      │
                      └─ [_lib/transform.ts:18] Assemble TransformContext
                              { deliveryId, eventType, receivedAt: new Date(envelope.receivedAt) }
                              → transformWebhookPayload(provider, eventType, payload, context)
                              │
                              └─ [dispatch.ts] Per-provider transformer
                                    context.deliveryId → PostTransformEvent.metadata
                                    context.eventType (Vercel only) → event-type branching
                                    context.receivedAt → never read

Backfill path:
  backfill/entity-worker.ts → relay.dispatchWebhook(provider, DispatchPayload)
      → POST /webhooks/:provider [X-API-Key] → serviceAuthBodyValidator
      → [relay/routes/webhooks.ts:64] serviceAuthBody path
            → QStash → /api/gateway/ingress (same console ingress path)
```

---

## Code References

- `packages/console-providers/src/types.ts:3-9` — `TransformContext` / `transformContextSchema`
- `packages/console-providers/src/gateway.ts:15-26` — `serviceAuthWebhookBodySchema`
- `packages/console-providers/src/gateway.ts:32-42` — `webhookReceiptPayloadSchema`
- `packages/console-providers/src/gateway.ts:48-66` — `webhookEnvelopeSchema`
- `packages/console-providers/src/dispatch.ts:15-31` — `transformWebhookPayload` entry point
- `packages/console-providers/src/define.ts:29,45` — `EventDef.transform` signature
- `packages/gateway-service-clients/src/relay.ts:5-12` — `DispatchPayload` interface
- `packages/console-backfill/src/types.ts:4-11` — `BackfillWebhookEvent` (no `receivedAt`)
- `apps/relay/src/middleware/webhook.ts:25-57` — `WebhookVariables` + context setters
- `apps/relay/src/routes/webhooks.ts:103,148` — Envelope + receipt assembly
- `apps/relay/src/routes/workflows.ts:39,189` — Workflow ingestion + publish step
- `apps/relay/src/lib/replay.ts:63-73` — Replay `WebhookReceiptPayload` construction
- `apps/backfill/src/workflows/entity-worker.ts:176-184` — Backfill dispatch call
- `apps/console/src/app/api/gateway/ingress/route.ts:28-82` — Console ingress workflow
- `apps/console/src/app/api/gateway/ingress/_lib/transform.ts:13-24` — `TransformContext` construction + `number → Date` boundary
- `apps/console/src/app/api/debug/inject-event/route.ts:148-155` — Debug dispatch
- `core/cli/src/commands/listen.ts:19-26` — `CatchUpEvent` — `receivedAt: number` in CLI
- `db/console/src/schema/tables/gw-webhook-deliveries.ts:30` — DB `received_at` column
- `db/console/src/schema/tables/workspace-events.ts` — DB `received_at` column

## Architecture Documentation

### Type Narrowing: `number → Date`

The `receivedAt` type boundary is enforced structurally, not via Zod validation. The
gateway wire format uses epoch milliseconds (`number`) for serialization efficiency.
`TransformContext` uses `z.date()` as a convenience for the transform layer. The
single conversion (`new Date(...)`) in `transform.ts:21` is the only crossing point.

### `transformContextSchema` as Documentation

The schema value is exported from the package but never used for runtime validation. It
exists as a type-level contract. The `TransformContext` type (inferred from it) is the
runtime constraint enforced by TypeScript's structural typing at the call sites.

### `eventType` Duplication Pattern

`eventType` is passed both as a top-level argument to `transformWebhookPayload` and as
a field inside `TransformContext`. The dispatch layer uses the top-level argument for
event routing; it then overrides `context.eventType` with the normalized internal type
before forwarding to the per-event transformer. The top-level arg and `context.eventType`
start identical and diverge only at dispatch time.

## Open Questions

- Why does `TransformContext` use `z.date()` when `receivedAt` is never read by any
  transformer? Is the type chosen for forward-looking correctness, or is it a remnant of
  an earlier design where transformers did use it?
- `transformContextSchema` is never `.parse()`d — is this intentional (pure type alias
  pattern), or was runtime validation intended but never wired up?
- Should `resourceId` ever be accessible to transformers? Currently it is resolved and
  discarded before `TransformContext` is constructed.
