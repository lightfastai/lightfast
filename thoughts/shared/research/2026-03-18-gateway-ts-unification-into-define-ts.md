---
date: 2026-03-18T00:00:00+11:00
researcher: claude
git_commit: dc3ec591e028b8e5d7c542ddfef56441d6deaf1a
branch: refactor/define-ts-provider-redesign
repository: lightfast
topic: "gateway.ts → define.ts unification: schema mapping, phase placement, and accretive split strategy"
tags: [research, codebase, console-providers, gateway, define, provider-architecture]
status: complete
last_updated: 2026-03-18
---

# Research: gateway.ts → define.ts Unification

**Date**: 2026-03-18
**Git Commit**: `dc3ec591e028b8e5d7c542ddfef56441d6deaf1a`
**Branch**: `refactor/define-ts-provider-redesign`

## Research Question

Investigate the complete simplification and unification of `packages/console-providers/src/gateway.ts` into `packages/console-providers/src/define.ts`. Map every schema from `gateway.ts` onto `define.ts`. Find the most accretive, innovative approach. Determine which phase of the provider architecture redesign this belongs in.

## Summary

`gateway.ts` (222 lines) mixes 4 distinct conceptual groups that have completely different consumers. The key insight: `define.ts` already imports `ProxyExecuteResponse` from `gateway.ts` (line 4) — the cross-file import is the type system signalling that proxy types belong in `define.ts`. Similarly, `backfillDepthSchema` is a primitive of `BackfillDef` which already lives in `define.ts`.

The selected approach is **Phase 6 enhanced**: `define.ts` absorbs proxy types + backfill depth, `wire.ts` gets the relay pipeline, `backfill-contracts.ts` gets orchestration, and `gateway.ts` shrinks to ~50 lines of pure gateway API response shapes.

**Phase placement**: Phase 6 (next unimplemented phase — Phases 1–4 complete, Phase 5 absorbed into Phase 4).

---

## Detailed Findings

### Current State: `define.ts` Already Contains Half the Backfill Hierarchy

`define.ts` already owns the **execution-level** backfill types:

| Type | Location |
|------|----------|
| `backfillWebhookEventSchema` + `BackfillWebhookEvent` | `define.ts:343-352` |
| `backfillContextSchema` + `BackfillContext` | `define.ts:354-366` |
| `BackfillEntityHandler` interface | `define.ts:409-435` |
| `typedEntityHandler<TCursor>` factory | `define.ts:444-466` |
| `BackfillDef` interface | `define.ts:469-473` |

`gateway.ts` owns the **orchestration-level** backfill types (`backfillDepthSchema`, `backfillTriggerPayload`, run records, etc.) — but `backfillDepthSchema` is a primitive of `BackfillDef` and belongs beside it.

### The Smoking Gun: Cross-File Import

```typescript
// define.ts:4
import type { ProxyExecuteResponse } from "./gateway";
```

`ProxyExecuteResponse` is the return type of `ResourcePickerExecuteApiFn` (`define.ts:479-484`):

```typescript
export type ResourcePickerExecuteApiFn = (request: {
  endpointId: string;
  pathParams?: Record<string, string>;
  queryParams?: Record<string, string>;
  body?: unknown;
}) => Promise<ProxyExecuteResponse>;  // ← imported from gateway.ts
```

`ResourcePickerExecuteApiFn` is the callback signature for every provider's `resourcePicker.listResources()` and `resourcePicker.enrichInstallation()`. The proxy types are a **provider capability definition concern** — they define how providers call the gateway proxy to fetch resource data. Moving them to `define.ts` eliminates this cross-file dependency entirely.

---

### The 4 Conceptual Groups in `gateway.ts`

#### Group 1: Webhook Pipeline Wire Types (relay-only consumers)

| Export | Consumer | Role |
|--------|----------|------|
| `serviceAuthWebhookBodySchema` / `ServiceAuthWebhookBody` | `relay/src/middleware/webhook.ts` | Internal service-auth fast-path body validation + Hono context type |
| `webhookReceiptPayloadSchema` / `WebhookReceiptPayload` | `relay/src/routes/webhooks.ts`, `workflows.ts`, `replay.ts`, `workflows.test.ts` | Relay→Upstash Workflow durable delivery contract |
| `webhookEnvelopeSchema` / `WebhookEnvelope` | `relay/src/routes/webhooks.ts` | Relay→Console QStash envelope on service-auth fast path |

**Destination**: `wire.ts` (new file). All three types are relay-internal — the relay both produces and consumes them. No other service needs them.

#### Group 2: Proxy Types (define.ts + gateway-service-clients)

| Export | Consumer | Role |
|--------|----------|------|
| `proxyExecuteRequestSchema` / `ProxyExecuteRequest` | `gateway-service-clients/src/gateway.ts` | Body type for `POST /connections/:id/proxy/execute` |
| `proxyExecuteResponseSchema` / `ProxyExecuteResponse` | `gateway-service-clients/src/gateway.ts` + **`define.ts:4`** | Response type for proxy execute; return type of `ResourcePickerExecuteApiFn` |

**Destination**: `define.ts`. The cross-file import at `define.ts:4` is the deciding signal. `ProxyExecuteRequest` is its natural pair.

#### Group 3: Gateway API Response Shapes (gateway-service-clients only)

| Export | Consumer | Role |
|--------|----------|------|
| `gatewayConnectionSchema` / `GatewayConnection` | `gateway-service-clients/src/gateway.ts` | Validates `GET /connections/:id` response |
| `gatewayTokenResultSchema` / `GatewayTokenResult` | `gateway-service-clients/src/gateway.ts` | Validates `GET /connections/:id/token` response |
| `proxyEndpointsResponseSchema` / `ProxyEndpointsResponse` | `gateway-service-clients/src/gateway.ts` | Validates `GET /connections/:id/proxy/endpoints` response |

**Destination**: Stays in `gateway.ts` (trimmed). These are purely gateway HTTP response contracts — not provider definitions. ~50 lines remain.

#### Group 4: Backfill Orchestration (cross-service)

| Export | Consumer | Role |
|--------|----------|------|
| `backfillDepthSchema` / `BACKFILL_DEPTH_OPTIONS` | `apps/backfill/src/inngest/client.ts` (depth enum in Inngest event schema) | Constrains depth to `1 | 7 | 30 | 90` |
| `gwInstallationBackfillConfigSchema` / `GwInstallationBackfillConfig` | `api/console/src/router/org/connections.ts` | Input validation for `updateBackfillConfig` tRPC mutation |
| `backfillTerminalStatusSchema` / `BACKFILL_TERMINAL_STATUSES` | `apps/gateway/src/routes/connections.ts` | Gate for setting `completedAt` on backfill run upsert |
| `backfillTriggerPayload` / `BackfillTriggerPayload` | `apps/backfill/src/routes/trigger.ts`, `inngest/client.ts`, `api/console/src/router/org/workspace.ts`, `gateway-service-clients` | Console→Relay→Backfill trigger contract |
| `backfillEstimatePayload` / `BackfillEstimatePayload` | `apps/backfill/src/routes/estimate.ts`, `gateway-service-clients` | Estimate probe contract |
| `backfillRunRecord` / `BackfillRunRecord` | `apps/gateway/src/routes/connections.ts`, `gateway-service-clients` | Entity Worker→Gateway run upsert body |
| `backfillRunReadRecord` / `BackfillRunReadRecord` | `gateway-service-clients` | Gateway→Entity Worker run read response |

**Destination split**:
- `backfillDepthSchema` + `BACKFILL_DEPTH_OPTIONS` → **`define.ts`** (primitive of `BackfillDef`, conceptually belongs beside it)
- Everything else → `backfill-contracts.ts` (new file)

**Reasoning for `backfillDepthSchema` in `define.ts`**: `BackfillDef.defaultEntityTypes` and `BackfillDef.supportedEntityTypes` are already in `define.ts`. Depth is the third axis of a backfill capability — how many days back. The `BACKFILL_DEPTH_OPTIONS` constant is a UI primitive for depth selectors, making it purely display-layer, but it derives from the depth schema, and both are simple enough to live beside `BackfillDef`.

---

### Consumer Map Summary

| File | gateway.ts exports consumed |
|------|-----------------------------|
| `apps/relay/src/middleware/webhook.ts` | `serviceAuthWebhookBodySchema`, `ServiceAuthWebhookBody` |
| `apps/relay/src/routes/webhooks.ts` | `WebhookReceiptPayload`, `WebhookEnvelope` |
| `apps/relay/src/routes/workflows.ts` | `WebhookReceiptPayload` |
| `apps/relay/src/lib/replay.ts` | `WebhookReceiptPayload` |
| `apps/relay/src/routes/workflows.test.ts` | `WebhookReceiptPayload` |
| `apps/relay/src/routes/relay-post-teardown.test.ts` | `WebhookReceiptPayload` |
| `apps/backfill/src/routes/trigger.ts` | `backfillTriggerPayload` |
| `apps/backfill/src/routes/estimate.ts` | `backfillEstimatePayload` |
| `apps/backfill/src/inngest/client.ts` | `backfillDepthSchema`, `backfillTriggerPayload` |
| `apps/gateway/src/routes/connections.ts` | `BACKFILL_TERMINAL_STATUSES`, `backfillRunRecord` |
| `api/console/src/router/org/connections.ts` | `gwInstallationBackfillConfigSchema` |
| `api/console/src/router/org/workspace.ts` | `BackfillTriggerPayload` |
| `packages/gateway-service-clients/src/gateway.ts` | `gatewayConnectionSchema`, `GatewayConnection`, `gatewayTokenResultSchema`, `GatewayTokenResult`, `proxyExecuteResponseSchema`, `ProxyExecuteResponse`, `proxyEndpointsResponseSchema`, `ProxyEndpointsResponse` |
| `packages/gateway-service-clients/src/backfill.ts` | `BackfillTriggerPayload`, `BackfillEstimatePayload`, `BackfillRunRecord`, `backfillRunReadRecord`, `BackfillRunReadRecord` |
| `packages/console-providers/src/define.ts` | `ProxyExecuteResponse` (import type) |

---

### `sourceTypeSchema` Dependency in `gateway.ts`

`gateway.ts` imports `sourceTypeSchema` from `registry.ts` (line 9) and uses it in 3 schemas:

```typescript
import { sourceTypeSchema } from "./registry";

// webhookReceiptPayloadSchema:33
provider: sourceTypeSchema,

// webhookEnvelopeSchema:56
provider: sourceTypeSchema,

// backfillTriggerPayload:144
provider: sourceTypeSchema,
```

When schemas move to `wire.ts` and `backfill-contracts.ts`, these files will need the same `import { sourceTypeSchema } from "./registry"`. No circular dependency issue — registry imports from display, not from wire/backfill-contracts.

---

## Code References

- `packages/console-providers/src/gateway.ts:1-222` — full current file
- `packages/console-providers/src/define.ts:4` — smoking gun: `import type { ProxyExecuteResponse } from "./gateway"`
- `packages/console-providers/src/define.ts:343-366` — existing `BackfillWebhookEvent` + `BackfillContext`
- `packages/console-providers/src/define.ts:469-473` — existing `BackfillDef`
- `packages/console-providers/src/define.ts:479-484` — `ResourcePickerExecuteApiFn` using `ProxyExecuteResponse`
- `packages/console-providers/src/index.ts:204-238` — all gateway.ts re-exports from the barrel
- `packages/gateway-service-clients/src/gateway.ts` — exclusive consumer of Group 3 (gateway API responses)
- `apps/relay/src/middleware/webhook.ts` — exclusive consumer of `ServiceAuthWebhookBody`
- `apps/relay/src/routes/webhooks.ts` + `workflows.ts` — exclusive consumers of `WebhookReceiptPayload`

---

## Architecture: The Enhanced Phase 6 Split

### After Phase 6 (enhanced)

```
define.ts
  ├── ... existing provider definition types ...
  ├── proxyExecuteRequestSchema + ProxyExecuteRequest    ← moved from gateway.ts
  ├── proxyExecuteResponseSchema + ProxyExecuteResponse  ← moved from gateway.ts
  ├── backfillDepthSchema + BACKFILL_DEPTH_OPTIONS       ← moved from gateway.ts
  ├── BackfillWebhookEvent (already here)
  ├── BackfillContext (already here)
  ├── BackfillEntityHandler (already here)
  ├── typedEntityHandler (already here)
  └── BackfillDef (already here)

wire.ts (NEW — relay ↔ console pipeline)
  ├── serviceAuthWebhookBodySchema + ServiceAuthWebhookBody
  ├── webhookReceiptPayloadSchema + WebhookReceiptPayload
  └── webhookEnvelopeSchema + WebhookEnvelope

backfill-contracts.ts (NEW — console ↔ backfill orchestration)
  ├── gwInstallationBackfillConfigSchema + GwInstallationBackfillConfig
  ├── backfillRunStatusSchema (internal)
  ├── backfillTerminalStatusSchema + BACKFILL_TERMINAL_STATUSES
  ├── backfillTriggerPayload + BackfillTriggerPayload
  ├── backfillEstimatePayload + BackfillEstimatePayload
  ├── backfillRunRecord + BackfillRunRecord
  └── backfillRunReadRecord + BackfillRunReadRecord

gateway.ts (TRIMMED — ~50 lines, gateway API response shapes only)
  ├── gatewayConnectionSchema + GatewayConnection
  ├── gatewayTokenResultSchema + GatewayTokenResult
  └── proxyEndpointsResponseSchema + ProxyEndpointsResponse
```

### index.ts barrel changes

Add two new re-export blocks for `wire.ts` and `backfill-contracts.ts`. Update `define.ts` re-export block to include the absorbed proxy + depth schemas. Zero breaking changes for external consumers — the barrel is the public API.

### Consumer import updates

When the schemas move, these files need updated imports:

| File | Before | After |
|------|--------|-------|
| `define.ts` | `import type { ProxyExecuteResponse } from "./gateway"` | removed (now defined here) |
| `apps/relay/src/middleware/webhook.ts` | `from "@repo/console-providers"` | stays — barrel re-exports |
| `apps/relay/src/routes/webhooks.ts` | `from "@repo/console-providers"` | stays — barrel re-exports |
| `apps/backfill/src/inngest/client.ts` | `from "@repo/console-providers"` | stays — barrel re-exports |
| `apps/gateway/src/routes/connections.ts` | `from "@repo/console-providers"` | stays — barrel re-exports |
| Internal provider files using `backfillDepthSchema` | N/A | import directly from `../../define` |

All external consumers import via `@repo/console-providers` barrel — zero import path changes required for apps.

---

## Phase Placement

**Phase 6** is the correct home. Phases 1–4 are complete (confirmed by git log: latest commit is `refactor(providers): Phase 4 — Zod-first registry unification`). Phase 5 was absorbed into Phase 4. Phase 6 is the next unimplemented phase.

The enhanced Phase 6 replaces the original plan's "trim gateway.ts" with a stronger version that also absorbs proxy and depth types into `define.ts`. The result:
- `gateway.ts`: 222 lines → ~50 lines
- `define.ts`: gains 6 exports (proxies + depth) — natural home already established
- 2 new focused files: `wire.ts` + `backfill-contracts.ts`
- Zero breaking changes (barrel absorbs all new re-exports)

---

## Historical Context (from thoughts/)

`thoughts/shared/plans/2026-03-18-provider-architecture-redesign.md` — Phase 6 (lines 1235–1298) proposes the 3-file split but does NOT include the define.ts absorption. This research extends Phase 6 with the additional move of proxy types and backfill depth into `define.ts`, motivated by the existing import at `define.ts:4`.

`thoughts/shared/research/2026-03-18-provider-architecture-synthesis.md` — Change 6 (lines 658–688) describes the same split. Notes: "wire.ts — relay ↔ console pipeline" + "gateway.ts — gateway API + proxy (trimmed)" + "backfill-contracts.ts — console ↔ backfill service." The synthesis does NOT propose moving proxy types to `define.ts`.

## Open Questions

1. Should `BACKFILL_DEPTH_OPTIONS` move with `backfillDepthSchema` to `define.ts` (it's a UI constant), or stay separate?
2. Should `backfillRunStatusSchema` (internal, not exported) live in `backfill-contracts.ts` or inline in `gateway.ts` where it's consumed?
3. After trimming, does `gateway.ts` warrant a rename (e.g., `gateway-responses.ts`) to better reflect its reduced scope?
