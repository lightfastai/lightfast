---
date: 2026-03-10T00:00:00+00:00
researcher: claude
git_commit: 47a707d313782c61992f4abf34806be58cc3ff56
branch: feat/backfill-depth-entitytypes-run-tracking
repository: lightfast
topic: "Gateway/Backfill Schema Scatter Audit — Pre-v3 Quality Control"
tags: [research, codebase, console-providers, console-validation, console-backfill, gateway, relay, backfill]
status: complete
last_updated: 2026-03-10
---

# Research: Gateway/Backfill Schema Scatter Audit

**Date**: 2026-03-10
**Git Commit**: 47a707d313782c61992f4abf34806be58cc3ff56
**Branch**: feat/backfill-depth-entitytypes-run-tracking

## Research Question

Before implementing Backfill Provider Unification v3, audit where gateway/relay/backfill schemas currently live, identify all code smells (schemas in wrong packages, scattered imports, dead types), and map the full consolidation into `@repo/console-providers` — including deleting `console-validation/src/schemas/gateway.ts`.

## Summary

The backfill/gateway/relay schema surface is currently split across two packages (`console-validation` and `console-providers`) and one standalone package (`console-backfill`). The relay app is already clean. The gateway app has two imports from `console-validation` that belong in `console-providers`. All of `console-validation/src/schemas/gateway.ts` is gateway-specific and should be dissolved into `console-providers`. The dependency graph has no circular risk — `@db/console` already imports from `@repo/console-providers`.

## Dependency Graph (Runtime)

```
@repo/console-providers          ← leaf: no internal workspace deps
         ↑
@repo/console-validation         ← imports from console-providers (sourceTypeSchema)
         ↑
@db/console                      ← imports from BOTH packages
         ↑
apps/* / api/console             ← import from all three

@repo/console-backfill           ← separate leaf, imports only from console-providers
```

`@db/console` already imports `ProviderAccountInfo` and `SourceType` from `@repo/console-providers` in `gw-installations.ts`. **No circular risk** from moving any gateway schema to `console-providers`.

## The Code Smell: `console-validation/src/schemas/gateway.ts`

This file contains 10 schemas/constants that are **100% gateway/backfill specific** — none of them belong in a generic validation package. They should live in `@repo/console-providers`.

### Current file: `packages/console-validation/src/schemas/gateway.ts`

| Symbol | Type | Current consumers |
|---|---|---|
| `installationStatusSchema` / `InstallationStatus` | Zod enum | Not directly imported elsewhere (export only) |
| `resourceStatusSchema` / `ResourceStatus` | Zod enum | Not directly imported elsewhere |
| `deliveryStatusSchema` / `DeliveryStatus` | Zod enum | Not directly imported elsewhere |
| `backfillDepthSchema` | Zod union (7\|30\|90) | `apps/backfill/src/inngest/client.ts` |
| `gwInstallationBackfillConfigSchema` / `GwInstallationBackfillConfig` | Zod object | `api/console/src/router/org/connections.ts`, `db/console/src/schema/tables/gw-installations.ts` |
| `BACKFILL_DEPTH_OPTIONS` | const array | `apps/console/src/app/.../source-settings-form.tsx` |
| `backfillTerminalStatusSchema` / `BACKFILL_TERMINAL_STATUSES` | Zod enum + options | `apps/gateway/src/routes/connections.ts` |
| `backfillTriggerPayload` / `BackfillTriggerPayload` | Zod object | `apps/backfill/src/routes/trigger.ts`, `apps/backfill/src/inngest/client.ts`, `api/console/src/router/org/workspace.ts`, `packages/gateway-service-clients/src/backfill.ts` |
| `backfillEstimatePayload` / `BackfillEstimatePayload` | Zod object | `apps/backfill/src/routes/estimate.ts`, `packages/gateway-service-clients/src/backfill.ts` |
| `backfillRunRecord` / `BackfillRunRecord` | Zod object | `apps/gateway/src/routes/connections.ts`, `packages/gateway-service-clients/src/gateway.ts` |

### Proposed home in `console-providers`: `packages/console-providers/src/gateway.ts`

This file already exists and already contains the relay/gateway wire schemas:
- `serviceAuthWebhookBodySchema` / `ServiceAuthWebhookBody`
- `webhookReceiptPayloadSchema` / `WebhookReceiptPayload`
- `webhookEnvelopeSchema` / `WebhookEnvelope`
- `gatewayConnectionSchema` / `GatewayConnection`
- `gatewayTokenResultSchema` / `GatewayTokenResult`

All 10 symbols from `console-validation/schemas/gateway.ts` should be **appended to this file**.

## Consumer Import Changes Required

After moving all symbols to `@repo/console-providers`:

| File | Old import | New import | Symbols |
|---|---|---|---|
| `apps/gateway/src/routes/connections.ts:11-13` | `@repo/console-validation` | `@repo/console-providers` | `BACKFILL_TERMINAL_STATUSES`, `backfillRunRecord` |
| `apps/backfill/src/inngest/client.ts:1-4` | `@repo/console-validation` | `@repo/console-providers` | `backfillDepthSchema`, `backfillTriggerPayload` |
| `apps/backfill/src/routes/trigger.ts:2` | `@repo/console-validation` | `@repo/console-providers` | `backfillTriggerPayload` |
| `apps/backfill/src/routes/estimate.ts:4` | `@repo/console-validation` | `@repo/console-providers` | `backfillEstimatePayload` |
| `packages/gateway-service-clients/src/gateway.ts` | `@repo/console-validation` | `@repo/console-providers` | `BackfillRunRecord` |
| `packages/gateway-service-clients/src/backfill.ts` | `@repo/console-validation` | `@repo/console-providers` | `BackfillEstimatePayload`, `BackfillTriggerPayload` |
| `api/console/src/router/org/connections.ts` | `@repo/console-validation` | `@repo/console-providers` | `gwInstallationBackfillConfigSchema` |
| `api/console/src/router/org/workspace.ts` | `@repo/console-validation` | `@repo/console-providers` | `BackfillTriggerPayload` |
| `db/console/src/schema/tables/gw-installations.ts:2-5` | `@repo/console-validation` | `@repo/console-providers` | `GwInstallationBackfillConfig` |
| `apps/console/src/app/.../source-settings-form.tsx` | `@repo/console-validation` | `@repo/console-providers` | `BACKFILL_DEPTH_OPTIONS` |

**Note**: `db/console` already imports from `@repo/console-providers` (line 1: `ProviderAccountInfo`, `SourceType`), so this is a same-line addition.

## What's Already Clean

### Relay (`apps/relay`)

**Zero imports from `@repo/console-validation` or `@repo/console-backfill`.** Relay only uses `@repo/console-providers`:
- `serviceAuthWebhookBodySchema` — validates backfill → relay body
- `WebhookReceiptPayload`, `WebhookEnvelope` — workflow and ingress payload types
- `getProvider`, `ProviderName`, `SourceType` — provider resolution
- `timingSafeStringEqual` — API key comparison

Relay is the reference implementation of how the other apps should look.

### `console-providers/src/gateway.ts`

Already holds the core cross-service wire schemas. The relay app imports these directly. This file needs to **absorb** the symbols from `console-validation/schemas/gateway.ts`.

## `@repo/console-backfill` — The Full Delete Target

The package has a single runtime dependency: `@repo/console-providers`. It will be fully dissolved by v3 Phase 6.

### What it currently contains (all to be replaced):

| File | Content | v3 destination |
|---|---|---|
| `src/types.ts` | `BackfillConnector<TCursor>`, `BackfillPage<TCursor>`, `BackfillConfig` | Replaced by `BackfillEntityHandler`, `BackfillContext` in `console-providers/src/define.ts` |
| `src/registry.ts` | `Map<SourceType, BackfillConnector>` imperative registry | Replaced by `ProviderDefinition.backfill.entityTypes` in each provider's `index.ts` |
| `src/connectors/github.ts` | `GitHubBackfillConnector` class with `fetchPage()` doing HTTP | Logic split into `github/api.ts` (HTTP params) and `github/backfill.ts` (`buildRequest`/`processResponse`) |
| `src/connectors/vercel.ts` | `VercelBackfillConnector` class | Same split for Vercel |
| `src/adapters/github.ts` | `adaptGitHubPR/Issue/ReleaseForTransformer`, `parseGitHubRateLimit` | Move to `github/backfill.ts` and `github/api.ts` |
| `src/adapters/vercel.ts` | `adaptVercelDeploymentForTransformer`, `parseVercelRateLimit` | Move to `vercel/backfill.ts` and `vercel/api.ts` |

**Key behavioral difference**: Current connectors do the HTTP fetch inside `fetchPage()`. v3 separates this into `buildRequest()` (pure params) + `processResponse()` (pure data processing), with the HTTP call handled by the gateway proxy.

**`parseGitHubRateLimit` signature change**: Currently accepts `Record<string, string>` (converted via `Object.fromEntries`). v3 changes to `Headers` (native) for case-insensitive `.get()`. Both the github and vercel adapters currently diverge here — vercel already uses `Headers`, github converts to a plain object first.

### Tests moving from `console-backfill` to `console-providers`:

| Old location | New location |
|---|---|
| `console-backfill/src/adapters/github.test.ts` | `console-providers/src/providers/github/backfill.test.ts` |
| `console-backfill/src/adapters/vercel.test.ts` | `console-providers/src/providers/vercel/backfill.test.ts` |
| `console-backfill/src/adapters/round-trip.test.ts` | `console-providers/src/providers/github/backfill-round-trip.test.ts` |

## `@repo/backfill` App — Current Code Smells

### Token fetching outside step boundary (`entity-worker.ts:62`)

```typescript
// Line 62 — outside any step.run(), re-executes on every Inngest replay
const { accessToken: initialToken } = await gw.getToken(installationId);
```

This is intentional (comment at line 60 documents it) — keeping tokens out of memoized state. In v3 this entire pattern is eliminated: gateway proxy handles auth, entity worker never sees tokens.

### `BackfillConfig.accessToken` — sensitive field in plain object

`BackfillConfig` (in `console-backfill/src/types.ts:24-42`) carries `accessToken: string` marked `@internal SENSITIVE`. In v3 the `BackfillContext` type has no `accessToken` field at all — gateway proxy handles auth injection.

### 401 retry inside step boundary (`entity-worker.ts:118-148`)

The entity worker currently catches 401 responses inside `step.run()`, fetches a fresh token from gateway, and retries `connector.fetchPage()` — all within the same memoized step. In v3 the gateway proxy handles 401 retry internally, and this logic is deleted.

### `getConnector()` registry pattern

```typescript
// entity-worker.ts:65-72
const connector = getConnector(provider as Parameters<typeof getConnector>[0]);
if (!connector) throw new NonRetriableError(...);
```

The cast `as Parameters<typeof getConnector>[0]` exists because the `provider` string from Inngest event data is not type-constrained. In v3 this becomes `getProvider(provider)` from `@repo/console-providers` — the same call already used by gateway and relay.

## `@repo/gateway-service-clients` — Current Mixed Imports

The package correctly uses `@repo/console-providers` for `GatewayConnection` and `GatewayTokenResult`. But it imports `BackfillRunRecord`, `BackfillEstimatePayload`, `BackfillTriggerPayload` from `@repo/console-validation`. All three move to `console-providers/src/gateway.ts`.

Additionally, `upsertBackfillRun` (line 64) uses `Record<string, unknown>` instead of `BackfillRunRecord` as the parameter type. After the move this should use the Zod-inferred type directly.

## What Stays in `console-validation`

After removing `src/schemas/gateway.ts`:
- All `src/forms/` — UI-only form schemas (workspace, team, auth, early-access)
- All `src/primitives/` — composable leaf schemas (IDs, names, slugs)
- All `src/constants/` — embedding defaults, naming constraints
- All `src/utils/` — slug generation helpers
- `src/schemas/activities.ts`, `classification.ts`, `entities.ts`, `job.ts`, `metrics.ts`, `neural.ts`, `org-api-key.ts`, `organization.ts`, `source-metadata.ts`, `sources.ts`, `store.ts`, `workflow-io.ts`, `workspace.ts`, `workspace-settings.ts` — console-layer business schemas
- All `src/schemas/api/` — v1 public API and internal API shapes

**Also staying**: `src/schemas/workflow-io.ts` contains a `backfillOrchestratorInputSchema` that IS backfill-specific but is consumed by `api/console` Inngest workflows. This is a borderline case — it documents the Inngest workflow input shape and is currently only used in console-level job tracking. Leave it in `console-validation` for now (it does not belong to the gateway/relay/backfill runtime path).

## Integration Tests

`packages/integration-tests/src/backfill-connections-api.integration.test.ts` mocks `@repo/console-backfill` as a devDependency only — the real connector code never runs in tests. After v3, this mock changes to mock `@repo/console-providers/getProvider`.

## Consolidation Checklist (Pre-v3)

- [x] Append all 10 symbols from `console-validation/schemas/gateway.ts` to `console-providers/src/gateway.ts`
- [x] Export all new symbols from `console-providers/src/index.ts`
- [x] Update `apps/gateway/src/routes/connections.ts` import (2 symbols)
- [x] Update `apps/backfill/src/inngest/client.ts` import (2 symbols)
- [x] Update `apps/backfill/src/routes/trigger.ts` import (1 symbol)
- [x] Update `apps/backfill/src/routes/estimate.ts` import (1 symbol)
- [x] Update `packages/gateway-service-clients/src/gateway.ts` import (1 symbol)
- [x] Update `packages/gateway-service-clients/src/backfill.ts` import (2 symbols)
- [x] Update `api/console/src/router/org/connections.ts` import (1 symbol)
- [x] Update `api/console/src/router/org/workspace.ts` import (1 symbol)
- [x] Update `db/console/src/schema/tables/gw-installations.ts` import (1 symbol)
- [x] Update `apps/console/src/app/.../source-settings-form.tsx` import (1 symbol)
- [x] Delete `console-validation/src/schemas/gateway.ts`
- [x] Remove the `gateway` export from `console-validation/src/schemas/index.ts`
- [x] Remove the gateway symbols from `console-validation/src/index.ts` barrel
- [x] Run `pnpm typecheck` across all packages

**Then proceed with v3 Phase 1** (add `ApiEndpoint`, `ProviderApi`, `BackfillDef` etc. to `console-providers/src/define.ts`).

## Code References

- `packages/console-validation/src/schemas/gateway.ts:1-103` — full file to delete
- `packages/console-providers/src/gateway.ts` — target for absorption
- `packages/console-providers/src/index.ts` — barrel to update
- `apps/gateway/src/routes/connections.ts:11-13` — two gateway-specific imports
- `apps/backfill/src/workflows/entity-worker.ts:59-62` — token outside step boundary
- `apps/backfill/src/workflows/entity-worker.ts:118-148` — 401 retry to delete in v3
- `packages/console-backfill/src/types.ts:24-42` — `BackfillConfig` with `accessToken`
- `packages/console-backfill/src/adapters/github.ts:81-113` — `parseGitHubRateLimit` accepts `Record<string, string>` (will become `Headers`)
- `packages/console-backfill/src/adapters/vercel.ts:89-109` — `parseVercelRateLimit` accepts `Headers` (already correct signature)
- `db/console/src/schema/tables/gw-installations.ts:1-5` — already imports from `console-providers`, safe to add `GwInstallationBackfillConfig`

## Related Research

- `thoughts/shared/plans/2026-03-10-backfill-provider-unification-v3.md` — the full v3 implementation plan this audit supports
- `thoughts/shared/research/2026-03-10-backfill-architecture-provider-unification.md` — earlier architecture research
- `thoughts/shared/research/2026-03-10-zod-migration-inventory.md` — broader Zod schema inventory
