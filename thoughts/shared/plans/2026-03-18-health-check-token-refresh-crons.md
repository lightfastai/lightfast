---
date: 2026-03-18
topic: "gateway: add Inngest cron functions for health-check and token-refresh"
tags: [plan, gateway, inngest, cron, health-check, token-refresh]
status: draft
depends-on:
  - thoughts/shared/research/2026-03-18-phase0-db-schema-migration.md
  - thoughts/shared/research/2026-03-18-repo-inngest-shared-package.md
  - thoughts/shared/plans/2026-03-18-platform-architecture-redesign.md
---

# Health Check + Token Refresh Crons — Implementation Plan

## Overview

Add two Inngest cron functions — `healthCheck` and `tokenRefresh` — to the gateway
service. Both live in the gateway because it is the only service with direct DB
access (`DATABASE_URL`), the token vault (`ENCRYPTION_KEY`), and provider configs
(`PROVIDER_ENVS`). The health-check cron is the **primary lifecycle trigger** in
the redesigned platform architecture: it probes each active installation every 5
minutes and fires `platform/connection.lifecycle` on auth failure, replacing all
webhook-based lifecycle classification.

This plan covers:

1. Adding Inngest to the gateway service (env vars, client, serve route)
2. A new `GET /connections?status=active` gateway endpoint + `listInstallations`
   client method (needed by the token-refresh cron; health-check uses DB directly)
3. The `healthCheck` cron Inngest function
4. The `tokenRefresh` cron Inngest function
5. Tests for both functions

---

## Current State Analysis

### What exists

| Concern | Current state |
|---------|--------------|
| Inngest in gateway | **None.** Gateway has no Inngest env vars, no client, no serve route. |
| Durable execution in gateway | Upstash Workflow (`vendor/upstash-workflow`) — used for `connectionTeardown` only. |
| Health check plumbing | `HealthCheckDef.check(config, externalId, accessToken)` is declared in `packages/console-providers/src/provider/api.ts`. Not yet called anywhere. |
| Token refresh logic | `getActiveTokenForInstallation()` and `forceRefreshToken()` exist in `apps/gateway/src/routes/connections.ts` (lines 557–672). Both are private helpers — not exported, not accessible from outside the route module. |
| listInstallations | **Does not exist.** `createGatewayClient` in `packages/gateway-service-clients/src/gateway.ts` has no `listInstallations` method. No `GET /connections` (list all) route exists. |
| DB columns for health | **Do not exist yet.** `healthStatus`, `lastHealthCheckAt`, `healthCheckFailures`, `configStatus` are planned columns (Phase 0 DB migration). This plan assumes Phase 0 has landed. |
| `gatewayLifecycleLog` table | **Does not exist yet.** Also part of Phase 0. This plan assumes it has landed. |
| `@repo/inngest` shared package | **Does not exist yet.** Planned in `research/2026-03-18-repo-inngest-shared-package.md`. Until it ships, the gateway creates its own Inngest client scoped to the platform event namespace. |

### Key files

| File | Role |
|------|------|
| `apps/gateway/src/env.ts` | Env validation — needs Inngest vars added |
| `apps/gateway/src/app.ts` | Hono app — needs `/inngest` route wired |
| `apps/gateway/src/routes/connections.ts` | Houses `getActiveTokenForInstallation` (to be extracted) |
| `apps/gateway/src/lib/token-store.ts` | `writeTokenRecord` / `updateTokenRecord` |
| `apps/gateway/src/lib/encryption.ts` | `getEncryptionKey()` |
| `apps/gateway/package.json` | No `@vendor/inngest` dep yet |
| `vendor/inngest/src/hono.ts` | Re-exports `serve` from `inngest/hono` |
| `vendor/inngest/env.ts` | `inngestEnv` preset for `createEnv` |
| `packages/gateway-service-clients/src/gateway.ts` | `createGatewayClient` — needs `listInstallations` |
| `packages/console-providers/src/provider/api.ts` | `HealthCheckDef`, `ConnectionStatus` |
| `db/console/src/schema/tables/gateway-installations.ts` | Schema — Phase 0 adds health columns |

---

## Desired End State

After this plan is complete:

- `apps/gateway` has Inngest wired: env, client, serve route at `GET|POST|PUT /inngest`.
- `healthCheck` cron runs every 5 minutes:
  - Queries all `status='active'` installations.
  - For each installation whose provider has `healthCheck` defined, calls
    `provider.healthCheck.check(config, externalId, accessToken)`.
  - On `"healthy"`: updates `healthStatus='healthy'`, resets `healthCheckFailures=0`,
    sets `lastHealthCheckAt=now`.
  - On `"revoked"` or `"suspended"`: fires `platform/connection.lifecycle` event
    (`reason: 'health_check_revoked'`, `triggeredBy: 'health_check'`), writes
    lifecycle log row.
  - On transient error (provider API threw / returned 5xx): increments
    `healthCheckFailures`, sets `healthStatus='degraded'` at ≥3 failures, fires
    lifecycle at ≥6 consecutive failures (`reason: 'health_check_unreachable'`).
  - Providers without `healthCheck` are skipped silently.
- `tokenRefresh` cron runs every 5 minutes:
  - Queries installations with expiring OAuth tokens (token row
    `expiresAt < now + 10min`, `refreshToken IS NOT NULL`, `installation.status='active'`).
  - For each, calls `getActiveTokenForInstallation` (which auto-refreshes on expiry)
    and writes the updated token back via `updateTokenRecord`.
  - Skips non-OAuth providers (no `refreshToken` in `gatewayTokens`).
- `GET /connections?status=active` endpoint exists on the gateway (internal,
  `X-API-Key` auth), returning `[{ id, provider, externalId, orgId }]`.
- `createGatewayClient` has a `listInstallations(status?)` method.
- Tests exist for both cron functions: mock provider API, verify DB mutations,
  verify lifecycle event emission.

### Verification

```bash
# Type checking
pnpm typecheck --filter @lightfast/gateway

# Unit tests
pnpm test --filter @lightfast/gateway

# Inngest serve route responds
curl -s http://localhost:4110/inngest | jq .

# listInstallations endpoint
curl -s -H "X-API-Key: $GATEWAY_API_KEY" \
  "http://localhost:4110/services/gateway/connections?status=active" | jq .
```

---

## What We Are NOT Doing

- **Not moving health-check to backfill.** Backfill has no `ENCRYPTION_KEY` or
  `DATABASE_URL`. The actual `healthCheck.check()` call requires the decrypted
  token, which only the gateway can produce.
- **Not implementing `connectionLifecycle` Inngest function here.** That is the
  gate-first teardown function from the platform architecture redesign. This plan
  only fires the event that triggers it.
- **Not implementing config drift detection.** That is a follow-on — referenced in
  the architecture plan but out of scope for cron bootstrap.
- **Not dropping Upstash Workflow.** The `connectionTeardown` workflow stays as-is
  until the `connectionLifecycle` Inngest function replaces it.
- **Not wiring `@repo/inngest` shared package.** That package does not yet exist.
  The gateway gets its own scoped Inngest client. When `@repo/inngest` ships, the
  client is replaced with `import { inngest } from "@repo/inngest"`.
- **Not adding Vercel Cron Jobs.** Inngest crons are self-contained — no
  `vercel.json` `"crons"` key needed.
- **Not implementing the `connectionRestore` function** (health check returning
  `"healthy"` for a suspended installation). This is a future extension.

---

## Implementation Approach

The gateway is the natural and only viable home for both crons because it owns the
DB, the encryption key, and the provider configs. Adding Inngest follows the exact
same pattern already established in `apps/backfill`:

1. Extend `env.ts` with `inngestEnv` preset.
2. Create `src/inngest/client.ts` with a typed `Inngest` instance.
3. Create `src/routes/inngest.ts` with `serve({ client, functions })`.
4. Mount the route in `app.ts`.
5. Add functions in `src/functions/`.

The health-check cron queries the DB directly (no HTTP hop needed — it's inside
the gateway). The token-refresh cron also queries the DB directly and reuses the
existing private helpers (extracted into a shared lib module).

---

## Phase 0: Prerequisite Check

This plan **requires** Phase 0 DB migration to have landed:

- `gatewayInstallations` has columns: `healthStatus`, `lastHealthCheckAt`,
  `healthCheckFailures`, `configStatus`.
- `gatewayLifecycleLog` table exists.
- `gatewayInstallations.status` accepts values: `active | pending | error | revoked | suspended | disconnected`.

Do not start Phase 1 until `pnpm db:generate && pnpm db:migrate` has been run
with the Phase 0 schema changes in place.

---

## Phase 1: Wire Inngest Into the Gateway

### Overview

Add `@vendor/inngest` as a dependency, extend env validation with Inngest vars,
create the Inngest client, wire the serve route.

### 1.1 — Add `@vendor/inngest` dependency

**File**: `apps/gateway/package.json`

Add to `dependencies`:

```json
"@vendor/inngest": "workspace:*"
```

### 1.2 — Extend env validation

**File**: `apps/gateway/src/env.ts`

Import and extend with `inngestEnv` from `@vendor/inngest/env`:

```ts
import { inngestEnv } from "@vendor/inngest/env";

export const env = createEnv({
  // ...existing...
  extends: [
    vercel(),
    betterstackEdgeEnv,
    upstashEnv,
    qstashEnv,
    dbEnv,
    inngestEnv,          // ← add
    ...PROVIDER_ENVS(),
  ],
  // runtimeEnv: inngestEnv handles its own runtimeEnv via @t3-oss/env-core preset
  // ...
});
```

The `inngestEnv` preset (at `vendor/inngest/env.ts`) already declares:
- `INNGEST_APP_NAME` — required, must start with `"lightfast-"`
- `INNGEST_EVENT_KEY` — optional
- `INNGEST_SIGNING_KEY` — optional, must start with `"signkey-"`

### 1.3 — Create the Inngest client

**New file**: `apps/gateway/src/inngest/client.ts`

```ts
import { EventSchemas, Inngest } from "@vendor/inngest";
import { z } from "zod";
import { env } from "../env.js";

/**
 * Platform-scoped Inngest event schemas.
 *
 * NOTE: When @repo/inngest ships (shared event bus), replace this client
 * with `import { inngest } from "@repo/inngest"` and remove this file.
 */
const platformEvents = {
  "platform/connection.lifecycle": z.object({
    /** Why the lifecycle was triggered */
    reason: z.enum([
      "health_check_revoked",
      "health_check_unreachable",
      "user_disconnect",
    ]),
    installationId: z.string(),
    orgId: z.string(),
    provider: z.string(),
    triggeredBy: z.enum(["health_check", "user", "system"]),
    correlationId: z.string().optional(),
  }),
};

export const inngest = new Inngest({
  id: env.INNGEST_APP_NAME,
  eventKey: env.INNGEST_EVENT_KEY,
  signingKey: env.INNGEST_SIGNING_KEY,
  schemas: new EventSchemas().fromZod(platformEvents),
});
```

### 1.4 — Create the Inngest serve route

**New file**: `apps/gateway/src/routes/inngest.ts`

```ts
import { serve } from "@vendor/inngest/hono";
import { Hono } from "hono";
import { inngest } from "../inngest/client.js";
import { healthCheck } from "../functions/health-check.js";
import { tokenRefresh } from "../functions/token-refresh.js";

const inngestRoute = new Hono();

inngestRoute.on(
  ["GET", "POST", "PUT"],
  "/",
  serve({
    client: inngest,
    functions: [healthCheck, tokenRefresh],
  })
);

export { inngestRoute };
```

### 1.5 — Mount the route in app.ts

**File**: `apps/gateway/src/app.ts`

```ts
import { inngestRoute } from "./routes/inngest.js";

// Add after existing routes:
app.route("/inngest", inngestRoute);
```

### 1.6 — Add env vars to `.vercel/.env.development.local`

```
INNGEST_APP_NAME=lightfast-gateway
INNGEST_EVENT_KEY=<from Inngest dashboard>
INNGEST_SIGNING_KEY=<from Inngest dashboard>
```

### Success Criteria

#### Automated Verification
- [ ] `pnpm typecheck --filter @lightfast/gateway` passes
- [ ] `curl http://localhost:4110/inngest` returns an Inngest introspection response
  (not a 404 or 500)

#### Manual Verification
- [ ] Gateway starts without env validation errors
- [ ] Inngest dashboard shows the `lightfast-gateway` app registered

---

## Phase 2: Extract Token Refresh Helper

### Overview

`getActiveTokenForInstallation` is a private async function in
`apps/gateway/src/routes/connections.ts`. The `tokenRefresh` cron needs it.
Extract it to a shared lib module so both the route and the cron can import it
without circular dependencies.

### 2.1 — Create `src/lib/token-helpers.ts`

**New file**: `apps/gateway/src/lib/token-helpers.ts`

Move the body of `getActiveTokenForInstallation` and `forceRefreshToken` from
`connections.ts` into this file. The signature is unchanged:

```ts
import { db } from "@db/app/client";
import { gatewayTokens } from "@db/app/schema";
import type { ProviderDefinition } from "@repo/app-providers";
import { decrypt } from "@repo/lib";
import { eq } from "@vendor/db";
import { getEncryptionKey } from "./encryption.js";
import { updateTokenRecord } from "./token-store.js";

export async function getActiveTokenForInstallation(
  installation: { id: string; externalId: string; provider: string },
  config: unknown,
  providerDef: ProviderDefinition
): Promise<{ token: string; expiresAt: string | null }> {
  // ... exact body from connections.ts:557-613 ...
}

export async function forceRefreshToken(
  installation: { id: string; externalId: string; provider: string },
  config: unknown,
  providerDef: ProviderDefinition
): Promise<string | null> {
  // ... exact body from connections.ts:619-672 ...
}
```

### 2.2 — Update connections.ts to import from lib

**File**: `apps/gateway/src/routes/connections.ts`

Remove the function bodies and add:

```ts
import {
  getActiveTokenForInstallation,
  forceRefreshToken,
} from "../lib/token-helpers.js";
```

### Success Criteria

#### Automated Verification
- [ ] `pnpm typecheck --filter @lightfast/gateway` passes
- [ ] `pnpm test --filter @lightfast/gateway` passes (existing tests unchanged)

---

## Phase 3: Health Check Cron Function

### Overview

Implement the `healthCheck` Inngest function. It runs every 5 minutes, queries all
active installations, probes each provider's health endpoint, and fires lifecycle
events on auth failure.

### 3.1 — Create `src/functions/health-check.ts`

**New file**: `apps/gateway/src/functions/health-check.ts`

```ts
import { db } from "@db/app/client";
import {
  gatewayInstallations,
  gatewayLifecycleLog,
} from "@db/app/schema";
import type { RuntimeConfig, SourceType } from "@repo/app-providers";
import { getProvider, PROVIDERS } from "@repo/app-providers";
import { nanoid } from "@repo/lib";
import { eq, and, lt, sql } from "@vendor/db";
import { log } from "@vendor/observability/log/edge";
import { env } from "../env.js";
import { gatewayBaseUrl } from "../lib/urls.js";
import { getActiveTokenForInstallation } from "../lib/token-helpers.js";
import { inngest } from "../inngest/client.js";

const runtime: RuntimeConfig = { callbackBaseUrl: gatewayBaseUrl };

const FAILURE_THRESHOLD_DEGRADED = 3;   // mark healthStatus='degraded'
const FAILURE_THRESHOLD_LIFECYCLE = 6;  // fire lifecycle event (~30 min)

export const healthCheck = inngest.createFunction(
  {
    id: "apps-gateway/health.check",
    name: "Health Check (5m cron)",
    retries: 1,
    /**
     * Global concurrency: 1 — prevents overlapping cron runs.
     * If the previous run is still executing when the next cron fires,
     * Inngest queues the new run; it does not drop it.
     */
    concurrency: [{ limit: 1 }],
  },
  { cron: "*/5 * * * *" },
  async ({ step }) => {
    // ── Step 1: Fetch all active installations ──────────────────────────────
    const installations = await step.run(
      "list-active-installations",
      async () => {
        return db
          .select({
            id: gatewayInstallations.id,
            provider: gatewayInstallations.provider,
            externalId: gatewayInstallations.externalId,
            orgId: gatewayInstallations.orgId,
            healthCheckFailures: gatewayInstallations.healthCheckFailures,
          })
          .from(gatewayInstallations)
          .where(eq(gatewayInstallations.status, "active"));
      }
    );

    log.info("[health-check] probing installations", {
      count: installations.length,
    });

    // ── Step 2: Probe each installation ──────────────────────────────────────
    // Fan-out via step.run per installation. Inngest will execute these
    // in-process sequentially (no parallelism within a single function run),
    // but each step is independently durable/retryable.
    for (const installation of installations) {
      const providerName = installation.provider as SourceType;
      const providerDef = getProvider(providerName);

      // Skip providers without a health check definition
      if (!providerDef.healthCheck) {
        continue;
      }

      await step.run(
        `probe-${installation.id}`,
        async () => {
          const config = PROVIDERS[providerName]?.createConfig(
            env as unknown as Record<string, string>,
            runtime
          );

          if (!config) {
            log.warn("[health-check] provider not configured — skipping", {
              provider: providerName,
              installationId: installation.id,
            });
            return;
          }

          // Get the decrypted access token (handles on-demand refresh)
          let accessToken: string | null = null;
          try {
            const tokenResult = await getActiveTokenForInstallation(
              installation,
              config,
              providerDef as Parameters<typeof getActiveTokenForInstallation>[2]
            );
            accessToken = tokenResult.token;
          } catch {
            // If we can't get the token, we can't probe — treat as transient
            await recordTransientFailure(installation);
            return;
          }

          // Call provider health probe
          let status: Awaited<
            ReturnType<NonNullable<typeof providerDef.healthCheck>["check"]>
          >;
          try {
            status = await providerDef.healthCheck.check(
              config as never,
              installation.externalId,
              accessToken
            );
          } catch {
            // Network error / timeout — treat as transient failure
            await recordTransientFailure(installation);
            return;
          }

          if (status === "healthy") {
            await db
              .update(gatewayInstallations)
              .set({
                healthStatus: "healthy",
                healthCheckFailures: 0,
                lastHealthCheckAt: new Date().toISOString(),
              })
              .where(eq(gatewayInstallations.id, installation.id));

            log.info("[health-check] healthy", {
              installationId: installation.id,
              provider: providerName,
            });
            return;
          }

          // revoked | suspended → fire lifecycle event immediately
          log.warn("[health-check] auth failure — firing lifecycle", {
            installationId: installation.id,
            provider: providerName,
            status,
          });

          // Write lifecycle log row
          await db.insert(gatewayLifecycleLog).values({
            id: nanoid(),
            installationId: installation.id,
            provider: providerName,
            reason: "health_check_revoked",
            previousStatus: "active",
            newStatus: "revoked",
            triggeredBy: "health_check",
            metadata: { connectionStatus: status },
          });

          // Fire connectionLifecycle event
          await inngest.send({
            name: "platform/connection.lifecycle",
            data: {
              reason: "health_check_revoked",
              installationId: installation.id,
              orgId: installation.orgId,
              provider: providerName,
              triggeredBy: "health_check",
            },
          });
        }
      );
    }

    return { probed: installations.length };
  }
);

// ── Private helpers ─────────────────────────────────────────────────────────

async function recordTransientFailure(installation: {
  id: string;
  provider: string;
  orgId: string;
  healthCheckFailures: number;
}): Promise<void> {
  const newFailureCount = installation.healthCheckFailures + 1;
  const healthStatus =
    newFailureCount >= FAILURE_THRESHOLD_DEGRADED ? "degraded" : "unknown";

  await db
    .update(gatewayInstallations)
    .set({
      healthCheckFailures: sql`${gatewayInstallations.healthCheckFailures} + 1`,
      healthStatus,
      lastHealthCheckAt: new Date().toISOString(),
    })
    .where(eq(gatewayInstallations.id, installation.id));

  log.warn("[health-check] transient failure recorded", {
    installationId: installation.id,
    provider: installation.provider,
    newFailureCount,
    healthStatus,
  });

  // After FAILURE_THRESHOLD_LIFECYCLE consecutive failures (~30min), fire lifecycle
  if (newFailureCount >= FAILURE_THRESHOLD_LIFECYCLE) {
    await db.insert(gatewayLifecycleLog).values({
      id: nanoid(),
      installationId: installation.id,
      provider: installation.provider,
      reason: "health_check_unreachable",
      previousStatus: "active",
      newStatus: "revoked",
      triggeredBy: "health_check",
      metadata: { consecutiveFailures: newFailureCount },
    });

    await inngest.send({
      name: "platform/connection.lifecycle",
      data: {
        reason: "health_check_unreachable",
        installationId: installation.id,
        orgId: installation.orgId,
        provider: installation.provider,
        triggeredBy: "health_check",
      },
    });
  }
}
```

### 3.2 — Register in the serve route

**File**: `apps/gateway/src/routes/inngest.ts`

`healthCheck` is already imported in the Phase 1 stub. Confirm it is in the
`functions` array.

### Success Criteria

#### Automated Verification
- [ ] `pnpm typecheck --filter @lightfast/gateway` passes
- [ ] `pnpm test --filter @lightfast/gateway -- health-check` passes (see Phase 5)
- [ ] Inngest dashboard shows `apps-gateway/health.check` function registered

#### Manual Verification
- [ ] Trigger a manual run from the Inngest dashboard; observe step output
- [ ] For a GitHub installation that has been uninstalled, the cron fires
  `platform/connection.lifecycle` within 5 minutes

---

## Phase 4: Token Refresh Cron Function

### Overview

Implement the `tokenRefresh` Inngest function. It runs every 5 minutes, queries
installations with expiring OAuth tokens, and proactively refreshes them inside
the gateway before they expire.

### 4.1 — Create `src/functions/token-refresh.ts`

**New file**: `apps/gateway/src/functions/token-refresh.ts`

```ts
import { db } from "@db/app/client";
import {
  gatewayInstallations,
  gatewayTokens,
} from "@db/app/schema";
import type { RuntimeConfig, SourceType } from "@repo/app-providers";
import { getProvider, PROVIDERS } from "@repo/app-providers";
import { decrypt } from "@repo/lib";
import { and, eq, isNotNull, lt, sql } from "@vendor/db";
import { log } from "@vendor/observability/log/edge";
import { env } from "../env.js";
import { getEncryptionKey } from "../lib/encryption.js";
import { updateTokenRecord } from "../lib/token-store.js";
import { gatewayBaseUrl } from "../lib/urls.js";
import { inngest } from "../inngest/client.js";

const runtime: RuntimeConfig = { callbackBaseUrl: gatewayBaseUrl };

/** Refresh tokens expiring within this window. */
const REFRESH_WINDOW_MS = 10 * 60 * 1000; // 10 minutes

export const tokenRefresh = inngest.createFunction(
  {
    id: "apps-gateway/token.refresh",
    name: "Token Refresh (5m cron)",
    retries: 2,
    concurrency: [{ limit: 1 }],
  },
  { cron: "*/5 * * * *" },
  async ({ step }) => {
    // ── Step 1: Find installations with expiring tokens ──────────────────────
    const expiringSoon = await step.run(
      "list-expiring-tokens",
      async () => {
        const cutoff = new Date(Date.now() + REFRESH_WINDOW_MS).toISOString();

        return db
          .select({
            installationId: gatewayTokens.installationId,
            tokenId: gatewayTokens.id,
            encryptedRefreshToken: gatewayTokens.refreshToken,
            expiresAt: gatewayTokens.expiresAt,
            provider: gatewayInstallations.provider,
            externalId: gatewayInstallations.externalId,
            orgId: gatewayInstallations.orgId,
          })
          .from(gatewayTokens)
          .innerJoin(
            gatewayInstallations,
            eq(gatewayTokens.installationId, gatewayInstallations.id)
          )
          .where(
            and(
              eq(gatewayInstallations.status, "active"),
              isNotNull(gatewayTokens.refreshToken),
              isNotNull(gatewayTokens.expiresAt),
              lt(gatewayTokens.expiresAt, cutoff)
            )
          );
      }
    );

    log.info("[token-refresh] tokens expiring soon", {
      count: expiringSoon.length,
    });

    // ── Step 2: Refresh each token ───────────────────────────────────────────
    for (const row of expiringSoon) {
      await step.run(
        `refresh-${row.installationId}`,
        async () => {
          const providerName = row.provider as SourceType;
          const providerDef = getProvider(providerName);
          const auth = providerDef.auth;

          if (auth.kind !== "oauth" || !auth.refreshToken) {
            // Provider doesn't support token refresh — skip
            return;
          }

          const config = PROVIDERS[providerName]?.createConfig(
            env as unknown as Record<string, string>,
            runtime
          );

          if (!config) {
            log.warn("[token-refresh] provider not configured — skipping", {
              provider: providerName,
              installationId: row.installationId,
            });
            return;
          }

          try {
            const decryptedRefresh = await decrypt(
              row.encryptedRefreshToken!,
              getEncryptionKey()
            );
            const refreshed = await auth.refreshToken(
              config as never,
              decryptedRefresh
            );
            await updateTokenRecord(
              row.tokenId,
              refreshed,
              row.encryptedRefreshToken,
              row.expiresAt
            );

            log.info("[token-refresh] token refreshed", {
              installationId: row.installationId,
              provider: providerName,
            });
          } catch (err) {
            // Refresh failure is logged but not fatal — the request-time refresh
            // path in getActiveTokenForInstallation() is the fallback.
            log.warn("[token-refresh] refresh failed", {
              installationId: row.installationId,
              provider: providerName,
              error: err instanceof Error ? err.message : String(err),
            });
          }
        }
      );
    }

    return { refreshed: expiringSoon.length };
  }
);
```

### 4.2 — Register in the serve route

**File**: `apps/gateway/src/routes/inngest.ts`

`tokenRefresh` is already imported in the Phase 1 stub. Confirm it is in the
`functions` array.

### Success Criteria

#### Automated Verification
- [ ] `pnpm typecheck --filter @lightfast/gateway` passes
- [ ] `pnpm test --filter @lightfast/gateway -- token-refresh` passes (see Phase 5)
- [ ] Inngest dashboard shows `apps-gateway/token.refresh` function registered

#### Manual Verification
- [ ] Seed a token row with `expiresAt = now + 5min`; observe refresh within 5m
- [ ] Confirm token row has a new `expiresAt` after cron runs

---

## Phase 5: Tests

### Overview

Unit tests for both cron functions. Use Vitest. Mock the DB, provider API calls,
and `inngest.send()`.

### 5.1 — Health check tests

**New file**: `apps/gateway/src/functions/health-check.test.ts`

Test scenarios:

| Scenario | Expected behaviour |
|----------|--------------------|
| Provider has no `healthCheck` | Installation skipped — no DB update, no lifecycle event |
| `healthCheck.check()` returns `"healthy"` | `healthStatus='healthy'`, `healthCheckFailures=0`, `lastHealthCheckAt` set |
| `healthCheck.check()` returns `"revoked"` | Lifecycle log row inserted, `platform/connection.lifecycle` fired with `reason='health_check_revoked'` |
| `healthCheck.check()` throws (network error) | `healthCheckFailures` incremented; no lifecycle event if below threshold |
| `healthCheckFailures` reaches 6 | Lifecycle log row inserted, event fired with `reason='health_check_unreachable'` |
| `healthCheckFailures` reaches 3 | `healthStatus` set to `'degraded'` |
| Provider config returns null (not configured) | Installation skipped — logged as warn, no DB update |

Pattern for mocking — use `vi.mock` on `@db/app/client`, `@vendor/inngest`,
and individual provider modules. Follow the pattern in
`apps/gateway/src/routes/connections.test.ts`.

### 5.2 — Token refresh tests

**New file**: `apps/gateway/src/functions/token-refresh.test.ts`

Test scenarios:

| Scenario | Expected behaviour |
|----------|--------------------|
| No expiring tokens | Returns `{ refreshed: 0 }`, no DB writes |
| OAuth token expiring within 10m, refresh succeeds | `updateTokenRecord` called with new token, `expiresAt` updated |
| Provider auth kind is not `"oauth"` | Token skipped |
| `auth.refreshToken` throws | Warning logged, no DB write, step does not throw (best-effort) |
| `refreshToken` column is null | Row excluded from query (isNotNull filter) |

### Success Criteria

#### Automated Verification
- [ ] `pnpm test --filter @lightfast/gateway` passes (all tests green)
- [ ] Test coverage includes all scenarios above

---

## Phase 6: `listInstallations` Gateway Endpoint + Client Method

### Overview

Add `GET /connections?status=active` to the gateway and `listInstallations(status?)`
to `createGatewayClient`. This is not required by the health-check cron (which
queries DB directly) but is needed by any consumer that lacks DB access (e.g., a
future backfill-side health probe, or cross-service admin tooling).

This phase is lower priority than Phases 1–5 but completes the planned surface.

### 6.1 — Add the gateway endpoint

**File**: `apps/gateway/src/routes/connections.ts`

Add before the final export:

```ts
/**
 * GET /connections
 *
 * List installations, optionally filtered by status.
 * Internal-only, requires X-API-Key authentication.
 * Callers: backfill (token refresh cron, if moved there in future)
 */
connections.get("/", apiKeyAuth, async (c) => {
  const status = c.req.query("status");

  const rows = await db
    .select({
      id: gatewayInstallations.id,
      provider: gatewayInstallations.provider,
      externalId: gatewayInstallations.externalId,
      orgId: gatewayInstallations.orgId,
      status: gatewayInstallations.status,
    })
    .from(gatewayInstallations)
    .where(
      status
        ? eq(gatewayInstallations.status, status)
        : undefined
    );

  return c.json(rows);
});
```

### 6.2 — Add response schema to `@repo/app-providers/contracts`

**File**: `packages/console-providers/src/contracts/gateway.ts`
(or wherever `GatewayConnection` / `gatewayConnectionSchema` live)

```ts
export const gatewayInstallationSummarySchema = z.object({
  id: z.string(),
  provider: z.string(),
  externalId: z.string(),
  orgId: z.string(),
  status: z.string(),
});

export type GatewayInstallationSummary = z.infer<
  typeof gatewayInstallationSummarySchema
>;
```

### 6.3 — Add `listInstallations` to `createGatewayClient`

**File**: `packages/gateway-service-clients/src/gateway.ts`

Add after `getToken`:

```ts
async listInstallations(
  status?: string
): Promise<GatewayInstallationSummary[]> {
  const qs = status ? `?status=${encodeURIComponent(status)}` : "";
  const response = await fetch(`${gatewayUrl}${qs}`, {
    headers: h,
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) {
    throw new Error(
      `Gateway listInstallations failed: ${response.status}`
    );
  }
  const data = await response.json();
  return z.array(gatewayInstallationSummarySchema).parse(data);
},
```

Note: `gatewayUrl` currently points to
`/services/gateway/connections/:id`. The base path needs checking against
`packages/gateway-service-clients/src/urls.ts` to confirm the root URL resolves
to `/services/gateway/connections` (not `/services/gateway/connections/`).

### Success Criteria

#### Automated Verification
- [ ] `pnpm typecheck --filter @lightfast/gateway` passes
- [ ] `pnpm typecheck --filter @repo/gateway-service-clients` passes
- [ ] `curl -H "X-API-Key: $KEY" http://localhost:4110/services/gateway/connections?status=active`
  returns a JSON array

#### Manual Verification
- [ ] Response includes all active installations
- [ ] Filtering by `status=revoked` returns only revoked installations

---

## File Map

```
apps/gateway/
  package.json                         ← add @vendor/inngest dep
  src/
    env.ts                             ← extend with inngestEnv
    app.ts                             ← mount /inngest route
    inngest/
      client.ts                        ← NEW — Inngest instance + event schemas
    routes/
      connections.ts                   ← remove getActiveTokenForInstallation body
                                         + add GET / (listInstallations) endpoint
      inngest.ts                       ← NEW — serve route
    functions/
      health-check.ts                  ← NEW — healthCheck cron function
      health-check.test.ts             ← NEW — unit tests
      token-refresh.ts                 ← NEW — tokenRefresh cron function
      token-refresh.test.ts            ← NEW — unit tests
    lib/
      token-helpers.ts                 ← NEW — extracted from connections.ts

packages/
  console-providers/src/contracts/
    gateway.ts                         ← add GatewayInstallationSummary schema
  gateway-service-clients/src/
    gateway.ts                         ← add listInstallations()
```

---

## Dependencies & Sequencing

```
Phase 0 (DB migration — prerequisite, separate plan)
  └── Phase 1 (Wire Inngest into gateway)
        ├── Phase 2 (Extract token helpers)
        │     ├── Phase 3 (healthCheck cron)  ← uses helpers
        │     └── Phase 4 (tokenRefresh cron) ← uses helpers
        │           └── Phase 5 (Tests — covers both crons)
        └── Phase 6 (listInstallations — independent, lower priority)
```

Phases 3 and 4 can be implemented in parallel after Phase 2. Phase 6 is
independent of 3/4/5 and can be done any time after Phase 1.

---

## Testing Strategy

### Unit Tests

Both test files live in `apps/gateway/src/functions/`. Use `vi.mock` to stub:

- `@db/app/client` — return controlled rows
- `@repo/app-providers` — return mock `providerDef` with/without `healthCheck`
- `@vendor/inngest` — spy on `inngest.send()`
- `../lib/token-helpers.js` — spy on `getActiveTokenForInstallation`
- `../lib/token-store.js` — spy on `updateTokenRecord`

Follow the existing mock pattern in
`apps/gateway/src/routes/connections.test.ts` and
`apps/gateway/src/workflows/connection-teardown.test.ts`.

### Manual / Integration

1. Start gateway: `pnpm dev:gateway`
2. Open Inngest dev server dashboard (`http://localhost:8288`)
3. Trigger `apps-gateway/health.check` manually
4. Verify step output and DB state

---

## Performance Considerations

- **Sequential fan-out**: Each installation is probed in a sequential
  `step.run(...)` loop, not parallel. At 100 active installations with 1 provider
  API call each (avg 500ms), a full cron run takes ~50s. This is well within the
  5-minute interval. If installation count grows beyond ~500, switch to
  `inngest.sendMany` to fan out into per-installation child functions.
- **Inngest step overhead**: Each `step.run(...)` persists state. For large
  installation counts, the checkpoint overhead may dominate. Monitor step duration
  in the Inngest dashboard.
- **DB query**: The `status='active'` filter has no covering index in the current
  schema. If the table grows large, add `CREATE INDEX gateway_inst_status_idx ON
  lightfast_gateway_installations (status)` in a follow-on migration.

---

## References

- Research: `thoughts/shared/research/2026-03-18-health-check-token-refresh-crons.md`
- Architecture plan: `thoughts/shared/plans/2026-03-18-platform-architecture-redesign.md`
- DB schema plan: `thoughts/shared/research/2026-03-18-phase0-db-schema-migration.md`
- Inngest env preset: `vendor/inngest/env.ts`
- Inngest Hono adapter: `vendor/inngest/src/hono.ts`
- Backfill Inngest pattern: `apps/backfill/src/inngest/client.ts`,
  `apps/backfill/src/routes/inngest.ts`
- `HealthCheckDef`: `packages/console-providers/src/provider/api.ts:20-26`
- `connectionTeardown` workflow (current teardown, not yet replaced):
  `apps/gateway/src/workflows/connection-teardown.ts`
- `getActiveTokenForInstallation` (to extract):
  `apps/gateway/src/routes/connections.ts:557-613`
