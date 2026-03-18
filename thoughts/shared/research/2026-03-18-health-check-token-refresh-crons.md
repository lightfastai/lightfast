# Health Check Cron & Token Refresh Cron — Implementation Research

Date: 2026-03-18

## Summary

This document records what the codebase currently provides that is relevant to
implementing a health-check cron and a token-refresh cron as Inngest functions
in the existing 4-service architecture (console, gateway, relay, backfill).

---

## 1. Does backfill have direct DB access?

**No.** `apps/backfill/src/env.ts` declares no `DATABASE_URL` variable. The
full server-side env for backfill is:

```
GATEWAY_API_KEY   (required)
SENTRY_DSN        (optional)
INNGEST_APP_NAME  (required, must start with "lightfast-")
INNGEST_EVENT_KEY (optional)
INNGEST_SIGNING_KEY (optional, must start with "signkey-")
```

There is no `dbEnv` in backfill's `createEnv` extends array. The backfill
service communicates with the database only indirectly — through the gateway
service via `GATEWAY_API_KEY`-authenticated HTTP calls using
`createGatewayClient` from `@repo/gateway-service-clients`.

The gateway service (`apps/gateway/src/env.ts`) does extend `dbEnv`, owns
`DATABASE_URL`, and has the `ENCRYPTION_KEY`. It is the sole service with direct
DB + token-vault access.

---

## 2. Where can the Inngest cron functions live?

**Option A — backfill's existing Inngest app**

- The backfill service already has a fully wired Inngest setup:
  - Client: `apps/backfill/src/inngest/client.ts` — `new Inngest({ id: env.INNGEST_APP_NAME, ... })`
  - Serving: `apps/backfill/src/routes/inngest.ts` — `serve({ client: inngest, functions: [...] })` via `@vendor/inngest/hono`
  - Registration pattern: functions are imported and passed directly into the `functions` array in the serve call
- Adding new Inngest functions here requires only: (1) creating the function file, (2) importing it in `apps/backfill/src/routes/inngest.ts`, (3) appending to the `functions` array

Because backfill has no DB access, any cron that needs to enumerate or mutate
installations must go through gateway HTTP calls. The gateway client already
supports `getConnection(installationId)` and `getToken(installationId)` but
**there is no `listInstallations` method** on `createGatewayClient`
(`packages/gateway-service-clients/src/gateway.ts`). The client exposes:
`getConnection`, `getToken`, `getBackfillRuns`, `upsertBackfillRun`,
`executeApi`, `getApiEndpoints`, `registerResource`, `getAuthorizeUrl`.

**Option B — console's Inngest app (api/console)**

- `api/console/src/inngest/index.ts` uses `serve` from `inngest/next` (Next.js adapter).
- `createInngestRouteContext()` registers: `recordActivity`, `eventStore`,
  `entityGraph`, `entityEmbed`, `notificationDispatch`
- `api/console/src/env.ts` does NOT have `DATABASE_URL` directly — it extends
  `clerkEnvBase`, `sentryEnv`, `githubEnv`, `consoleM2MEnv`, `vercelEnv`. It
  has `GATEWAY_API_KEY` and `ENCRYPTION_KEY` but no DB env preset.
- Same constraint as backfill: no direct DB access from console API layer.

**Option C — a new dedicated Inngest function registered in the gateway**

The gateway has no Inngest setup at all (no `inngest` dependency in its env, no
serve route). It does have full DB + token-vault access. Adding Inngest to the
gateway would require adding `INNGEST_APP_NAME`, `INNGEST_EVENT_KEY`,
`INNGEST_SIGNING_KEY` to `apps/gateway/src/env.ts` and wiring a new `/inngest`
route.

---

## 3. Inngest cron trigger syntax

There are no existing `{ cron: "..." }` usages in the codebase — all current
functions are event-triggered. The pattern for a cron-triggered Inngest function
is:

```ts
export const myFunction = inngest.createFunction(
  { id: "some-function-id", name: "Human Name" },
  { cron: "*/5 * * * *" },  // <-- trigger is a cron spec instead of { event: "..." }
  async ({ step }) => { ... }
);
```

The `backfillOrchestrator` (`apps/backfill/src/workflows/backfill-orchestrator.ts:12-33`)
shows the full config pattern for non-cron functions:
- `id` — stable identifier string
- `name` — human label
- `retries` — integer (3 used here)
- `concurrency` — array of `{ limit, key? }` objects
- `cancelOn` — array of `{ event, match }` objects
- `timeouts` — `{ start, finish }` duration strings
- Second argument is `{ event: "..." }` for event-driven; for cron it is `{ cron: "..." }`

---

## 4. Token refresh: what backfill can and cannot do

The token refresh logic lives entirely inside the gateway:

- `apps/gateway/src/routes/connections.ts:557-613` — `getActiveTokenForInstallation`:
  reads `gatewayTokens` table, checks expiry, decrypts `refreshToken` using
  `getEncryptionKey()` (which requires `ENCRYPTION_KEY`), calls
  `auth.refreshToken(config, decryptedRefresh)`, then calls
  `updateTokenRecord(...)` to persist the new encrypted token.
- `apps/gateway/src/routes/connections.ts:619-672` — `forceRefreshToken`:
  similar but skips expiry check; used by the 401-retry path in proxy/execute.
- `apps/gateway/src/lib/token-store.ts` — `writeTokenRecord` and
  `updateTokenRecord` — encrypt tokens with `ENCRYPTION_KEY` and write to
  `gatewayTokens` table.

**Backfill cannot do token refresh directly.** It lacks both `DATABASE_URL` and
`ENCRYPTION_KEY`.

However, backfill can trigger token refresh indirectly by calling
`gw.getToken(installationId)` — the gateway's `GET /connections/:id/token`
endpoint (`apps/gateway/src/routes/connections.ts:681-738`) already performs
on-demand refresh when the stored token is expired, as a side effect of
returning the active token.

So the pattern for a token-refresh cron running in backfill would be:
1. Obtain a list of active installation IDs (needs a new gateway endpoint — see below)
2. Call `gw.getToken(installationId)` for each — this triggers refresh if needed inside the gateway

---

## 5. Gateway list-installations endpoint: does it exist?

**No.** There is no `GET /connections` (list all) endpoint in
`apps/gateway/src/routes/connections.ts`. All gateway connection routes require
an `:id` or `:provider` path parameter. The gateway client
`packages/gateway-service-clients/src/gateway.ts` likewise has no
`listInstallations` method.

To enumerate installations for a health-check or token-refresh cron, a new
endpoint would need to be added to the gateway (e.g.
`GET /connections?status=active&provider=...`) and a corresponding client method
added to `createGatewayClient`.

Alternatively, if the cron lives in a service that has DB access (i.e., the
gateway itself), it can query `gatewayInstallations` directly with Drizzle.

---

## 6. Health check: HealthCheckDef in the provider architecture

The provider shape type (`packages/console-providers/src/provider/shape.ts:54-55`)
defines an optional `healthCheck` field on `BaseProviderFields`:

```ts
/** Optional connection health probe — enables 401-poll cron for revocation detection */
readonly healthCheck?: HealthCheckDef<TConfig>;
```

The `HealthCheckDef` interface (`packages/console-providers/src/provider/api.ts:20-26`):

```ts
export interface HealthCheckDef<TConfig> {
  readonly check: (
    config: TConfig,
    externalId: string,
    accessToken: string | null
  ) => Promise<ConnectionStatus>;
}
```

`ConnectionStatus` is `"healthy" | "revoked" | "suspended"` (Zod enum at line
5-9 of the same file).

The comment on `HealthCheckDef` states:
> "Providers without a meaningful liveness endpoint (e.g., Apollo API keys that
> don't expire) omit this field — the polling cron skips them."

This means the health-check cron is designed to:
1. Iterate active installations
2. For each, check if `providerDef.healthCheck` exists (skip if absent)
3. Call `providerDef.healthCheck.check(config, installation.externalId, accessToken)`
4. Update installation status in DB when result is `"revoked"` or `"suspended"`

This probe logic requires the provider config (requires `PROVIDER_ENVS`),
decrypted access token (requires `ENCRYPTION_KEY` and DB), and ability to write
installation status back (requires DB). All three are present only in the
gateway.

---

## 7. Gateway: does it have an Inngest setup?

**No.** `apps/gateway/src/env.ts` has no Inngest env vars. The gateway file list
shows no inngest client, no inngest serve route, no workflow files that use
Inngest. The gateway uses Upstash Workflow (QStash) for its single async
operation: connection teardown (`apps/gateway/src/workflows/connection-teardown.ts`),
triggered via `workflowClient.trigger(...)`.

---

## 8. vercel.json cron config: does it exist?

**No.** Both `apps/backfill/vercel.json` and `apps/gateway/vercel.json` contain
only build/install/ignore commands — no `"crons"` key:

```json
// apps/backfill/vercel.json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "buildCommand": "pnpm turbo run build --filter=@lightfast/backfill...",
  "installCommand": "pnpm install",
  "ignoreCommand": "npx turbo-ignore"
}
```

Neither service has any Vercel Cron Jobs configured.

---

## 9. gatewayInstallations schema — shape for health-check query

From `db/console/src/schema/tables/gateway-installations.ts`:

Table: `lightfast_gateway_installations`

Relevant columns for a health-check or token-refresh cron:
- `id` varchar(191) — the installation ID used by all gateway client calls
- `provider` varchar(50) — `SourceType` — needed to look up `providerDef` and `providerConfigs`
- `externalId` varchar(191) — passed to `healthCheck.check()` and `auth.getActiveToken()`
- `status` varchar(50) — `"active" | "pending" | "error" | "revoked"` — filter to `"active"` only
- `orgId` varchar(191)

Indexes available:
- `gateway_inst_org_id_idx` on `orgId`
- `gateway_inst_org_provider_idx` on `(orgId, provider)`
- `gateway_inst_provider_external_idx` (unique) on `(provider, externalId)`

A query for all active installations suitable for a cron would be:
```ts
db.select({ id, provider, externalId, orgId })
  .from(gatewayInstallations)
  .where(eq(gatewayInstallations.status, "active"))
```

There is no index on `status` alone — a full table scan over active rows.

---

## 10. Concurrency and config patterns from backfillOrchestrator

From `apps/backfill/src/workflows/backfill-orchestrator.ts:12-33`:

```ts
inngest.createFunction(
  {
    id: "apps-backfill/run.orchestrator",
    name: "Backfill Orchestrator",
    retries: 3,
    concurrency: [
      { limit: 1, key: "event.data.installationId" },
      { limit: 10 },
    ],
    cancelOn: [{ event: "apps-backfill/run.cancelled", match: "data.installationId" }],
    timeouts: { start: "2m", finish: "8h" },
  },
  { event: "apps-backfill/run.requested" },
  async ({ event, step }) => { ... }
)
```

For a cron function the second argument changes to `{ cron: "..." }` and
`cancelOn` would not typically apply. `concurrency` with a global `limit: 1` is
the standard pattern for ensuring a cron does not overlap itself.

---

## Key Conclusions

| Question | Answer |
|---|---|
| Does backfill have `DATABASE_URL`? | No — only `GATEWAY_API_KEY` |
| Can health-check cron live in backfill? | Only if a new `listInstallations` gateway endpoint is added AND the health probe is moved/proxied through the gateway; the actual `healthCheck.check()` call requires provider config + decrypted token which only the gateway has |
| Can token-refresh cron live in backfill? | Partially — backfill can call `gw.getToken(installationId)` which triggers gateway-side refresh, but needs a new `listInstallations` gateway endpoint to know which IDs to iterate |
| Is there a `listInstallations` gateway client method? | No — must be added |
| What is the Inngest cron trigger syntax? | `{ cron: "*/5 * * * *" }` as second arg to `createFunction` |
| Does gateway have Inngest? | No — it uses Upstash Workflow only |
| Do vercel.json files have cron config? | No |
| Where does `getActiveTokenForInstallation` live? | `apps/gateway/src/routes/connections.ts:557` — gateway-internal, not callable externally |
| Which service is the natural home for these crons? | The gateway, because it owns DB + encryption + provider configs + token vault; but it would require adding Inngest |

The lowest-friction path for the token-refresh cron (no new service, no gateway
Inngest) is: add a `GET /connections?status=active` endpoint to the gateway,
add `listInstallations(status?)` to `createGatewayClient`, then implement the
cron in the existing backfill Inngest app — it pages through IDs and calls
`gw.getToken(id)` per installation (gateway does the actual decrypt + refresh
work). Health check is more complex because `healthCheck.check()` itself
requires the decrypted token and provider config — this logic must either live
inside the gateway or be proxied through a new gateway endpoint.
