# `@db/app` Driver/Polyfill Restructure Implementation Plan

## Overview

Split the monolithic `db/app/src/client.ts` into a clearer mental model: drivers know how to connect, polyfills paper over driver-API mismatches, and `client.ts` is a thin orchestrator that picks a driver and applies polyfills. Pure refactor — no behavior change, no API change to external consumers.

## Current State Analysis

`db/app/src/client.ts` (69 lines) currently mixes four concerns in one file:

1. **Driver: neon-http** (prod, PlanetScale HTTP SQL endpoint) — `createNeonDatabase` at `db/app/src/client.ts:34-40`
2. **Driver: postgres-js** (local dev, Docker Postgres over TCP) — inlined in `createClient` at `db/app/src/client.ts:19-24`
3. **Polyfill** — `withLocalBatch` at `db/app/src/client.ts:42-47` — gives postgres-js a `.batch()` shim because `drizzle-orm/postgres-js` doesn't expose one. Currently `Promise.all` (not atomic; non-load-bearing for the single consumer).
4. **Orchestration** — `createClient`, `resolveDatabaseUrl`, `isLocalDatabaseHost` — env-based routing and URL construction.

External-facing surface is stable and well-defined:
- `package.json` exports `./client` → `./src/client.ts` (`db/app/package.json:16-19`)
- 19+ consumers import via `import { db } from "@db/app/client"` — verified by grep across `api/`, `apps/`, `packages/`
- Zero consumers reach into `client.ts`'s internal symbols (`createNeonDatabase`, `withLocalBatch`, etc.) — verified

The single `.batch()` call site is `api/app/src/router/org/org-api-keys.ts:231` (key rotation: revoke + insert). Atomicity is provided by neon-http in prod and is a known no-op in local dev (acceptable).

`db/app/src/drizzle.config.ts:4-7` independently duplicates the local-host check. drizzle-kit is a separate build-time CLI; sharing the helper would require it to import from `client.ts` (which would also pull in driver imports just to read a hostname check). Not worth it. Out of scope.

### Key Discoveries

- The `@db/app/client` subpath export means `client.ts` must remain at this exact path with its `db` and `createClient` exports — `db/app/package.json:16-19`
- All consumers import the public `db` symbol; none reach for internals — safe to reorganize freely
- `neonConfig.fetchEndpoint = (host) => \`https://${host}/sql\`` is a process-global side-effect assignment. Currently inside `createNeonDatabase` (idempotent on each call). Keep it inside the driver function for the same reason — `package.json` declares `"sideEffects": false`, so module-top side effects would be a lie.
- The local branch uses `as unknown as AppDatabase` because postgres-js + polyfill doesn't structurally match neon-http's drizzle type. The cast survives the move; this plan doesn't fix it (the polyfill philosophy is "lie convincingly enough that call sites work").

## Desired End State

```
db/app/src/
  client.ts                  # orchestrator: env → driver pick → polyfill → export `db`
  drivers/
    neon-http.ts             # createNeonHttpClient(url) — prod
    postgres.ts              # createPostgresClient(url)  — local Docker
  polyfills/
    batch.ts                 # withBatchPolyfill — postgres-js gets .batch()
  env.ts                     # unchanged
  index.ts                   # unchanged
  drizzle.config.ts          # unchanged
  schema/                    # unchanged
  migrations/                # unchanged
  utils/                     # unchanged
```

Verification:
- `pnpm --filter @db/app typecheck` passes
- `pnpm --filter @api/app typecheck` passes (largest downstream consumer)
- `pnpm check` (Biome) passes repo-wide
- Local dev still works — `pnpm dev:app` boots, a request that hits `db` returns rows
- The single `.batch()` consumer (org-api-keys rotate) still functions in local dev

## What We're NOT Doing

- **Not changing the polyfill semantics.** `withBatchPolyfill` still calls `Promise.all`. Upgrading to a real `database.transaction()` is a separate decision (revisit if a second consumer ever needs atomicity in local dev).
- **Not unifying `drizzle.config.ts`'s host check** with `client.ts`. Different lifecycles (build-time CLI vs runtime), 3 lines of duplication, not worth coupling.
- **Not introducing an environment-based naming convention** (`prod.ts` / `dev.ts`). Drivers are named by transport (neon-http / postgres) because a future preview env using neon-http against a Neon branch would still be the "neon-http driver" — the env→driver mapping is `client.ts`'s job, not the driver's identity.
- **Not changing public exports.** `@db/app/client` keeps exporting `db` and `createClient` with the same types. No consumer changes.
- **Not touching `index.ts`, `env.ts`, `schema/`, `migrations/`, or `utils/`.**
- **Not adding tests.** No test infrastructure exists for `db/app`; adding one for a refactor is scope creep. Behavior parity is verified by typecheck + the existing call sites continuing to work.

## Implementation Approach

Single-phase mechanical refactor. Splitting into multiple phases (drivers first, polyfill second) would only create intermediate broken states with no benefit. Pure all-or-nothing.

The `AppDatabase` type continues to alias the neon-http driver's drizzle return type — that's the canonical surface. The local branch's structural mismatch is bridged by the polyfill plus a single cast, exactly as today.

## Execution Protocol

Phase boundaries halt execution. Automated checks passing is necessary but not sufficient — the next phase starts only on user go-ahead.

## Phase 1: Extract drivers and polyfill; rewrite `client.ts` as orchestrator

### Overview

Create three new files (`drivers/neon-http.ts`, `drivers/postgres.ts`, `polyfills/batch.ts`), rewrite `client.ts` to import from them. No symbol reaches outside `db/app/src/`; this is purely an internal reshuffle.

### Changes Required

#### 1. New: `db/app/src/drivers/neon-http.ts`

**File**: `db/app/src/drivers/neon-http.ts`
**Changes**: New file. Owns the neon-http driver and its global `neonConfig` side-effect.

```ts
import { neon, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "../schema";

export type NeonHttpDatabase = ReturnType<typeof createNeonHttpClient>;

/**
 * Drizzle client over the Neon HTTP driver, pointed at PlanetScale's
 * HTTP SQL endpoint. Edge-compatible (uses fetch, not TCP). Exposes
 * `.batch([...])` natively for atomic multi-statement execution.
 */
export function createNeonHttpClient(databaseUrl: string) {
  // Required: point Neon driver at PlanetScale's HTTP SQL endpoint.
  // Idempotent assignment — safe to run on every call.
  neonConfig.fetchEndpoint = (host) => `https://${host}/sql`;
  const sql = neon(databaseUrl);
  return drizzle({ client: sql, schema });
}
```

#### 2. New: `db/app/src/drivers/postgres.ts`

**File**: `db/app/src/drivers/postgres.ts`
**Changes**: New file. Owns the postgres-js driver for local Docker.

```ts
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../schema";

export type PostgresJsDatabase = ReturnType<typeof createPostgresClient>;

/**
 * Drizzle client over postgres-js, used for local development against
 * the dev-services Docker Postgres (TCP). Does NOT expose `.batch()` —
 * apply `withBatchPolyfill` in `client.ts` to bridge the surface.
 */
export function createPostgresClient(databaseUrl: string) {
  const sql = postgres(databaseUrl, { max: 10 });
  return drizzle(sql, { schema });
}
```

#### 3. New: `db/app/src/polyfills/batch.ts`

**File**: `db/app/src/polyfills/batch.ts`
**Changes**: New file. Lifts `withLocalBatch` here, renamed to `withBatchPolyfill`. Header comment carries the *why* so a future reader doesn't need to re-derive it.

```ts
/**
 * `.batch([...])` polyfill for drivers that don't expose it natively.
 *
 * neon-http exposes `db.batch([...])` which runs queries in a single
 * atomic HTTP round-trip — Neon's substitute for transactions over HTTP.
 * drizzle-orm/postgres-js does not expose `.batch()` at all.
 *
 * This polyfill gives the local postgres-js driver a `.batch()` shim so
 * call sites that use `db.batch([...])` (today: only
 * api/app/src/router/org/org-api-keys.ts key rotation) still work in
 * local dev without branching on driver.
 *
 * IMPORTANT: this is `Promise.all`, NOT a real transaction. If revoke
 * succeeds and insert fails, you get a partial state. Acceptable for the
 * current consumer (key rotation is recoverable). If a future consumer
 * needs real atomicity in local dev, upgrade this to wrap
 * `database.transaction(async () => Promise.all(queries))` — postgres-js
 * supports real transactions.
 */
export function withBatchPolyfill<T extends object>(database: T) {
  return Object.assign(database, {
    batch: async (queries: readonly PromiseLike<unknown>[]) =>
      Promise.all(queries),
  });
}
```

#### 4. Rewrite: `db/app/src/client.ts`

**File**: `db/app/src/client.ts`
**Changes**: Becomes a thin orchestrator. Keeps the public `db` and `createClient` exports (consumed via `@db/app/client` by 19+ files). `resolveDatabaseUrl` and `isLocalDatabaseHost` stay here as orchestration concerns. Explicit comments explain why each helper lives where it does (per the user's note).

```ts
import {
  createNeonHttpClient,
  type NeonHttpDatabase,
} from "./drivers/neon-http";
import { createPostgresClient } from "./drivers/postgres";
import { env } from "./env";
import { withBatchPolyfill } from "./polyfills/batch";

// Canonical DB surface. Both drivers must satisfy this type — neon-http
// does so natively; postgres-js + withBatchPolyfill is bridged by an
// `as unknown as AppDatabase` cast in the local branch below.
type AppDatabase = NeonHttpDatabase;

/**
 * Create a new database client.
 *
 * Routing:
 *   - Local dev (DATABASE_HOST is localhost / 127.0.0.1 / ::1)
 *       → postgres-js over TCP against the dev-services Docker Postgres,
 *         wrapped with `withBatchPolyfill` so `.batch()` call sites work.
 *   - Everything else
 *       → neon-http against PlanetScale's HTTP SQL endpoint.
 */
export function createClient(): AppDatabase {
  const databaseUrl = resolveDatabaseUrl({
    ssl: !isLocalDatabaseHost(env.DATABASE_HOST),
  });

  if (isLocalDatabaseHost(env.DATABASE_HOST)) {
    return withBatchPolyfill(
      createPostgresClient(databaseUrl),
    ) as unknown as AppDatabase;
  }

  return createNeonHttpClient(databaseUrl);
}

/**
 * Default database client instance.
 */
export const db = createClient();

// URL construction lives here (not in drivers/) because both drivers
// take a connection URL and the build logic — including ssl=require for
// remote hosts — is shared. Using URL/URL avoids string-interpolation
// bugs with special characters in passwords.
function resolveDatabaseUrl({ ssl }: { ssl: boolean }) {
  const url = new URL("postgresql://localhost");
  url.hostname = env.DATABASE_HOST;
  url.port = env.DATABASE_PORT ? String(env.DATABASE_PORT) : "";
  url.username = env.DATABASE_USERNAME;
  url.password = env.DATABASE_PASSWORD;
  url.pathname = `/${env.DATABASE_NAME ?? "postgres"}`;
  if (ssl) {
    url.searchParams.set("sslmode", "require");
  }
  return url.toString();
}

// Driver-routing predicate lives here (not in env.ts, not in drivers/)
// because picking a driver is the orchestrator's job. Drivers don't
// know what "local" means — they just connect to the URL they're given.
// Note: drizzle.config.ts intentionally duplicates this 3-line check
// because drizzle-kit runs at build time with its own sync config and
// shouldn't depend on the runtime client module.
function isLocalDatabaseHost(value: string) {
  const hostname = value.toLowerCase();
  return (
    hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1"
  );
}
```

### Success Criteria

#### Automated Verification

- [x] `pnpm --filter @db/app typecheck` passes
- [x] `pnpm --filter @api/app typecheck` passes (largest consumer of `@db/app/client`)
- [x] `pnpm --filter @api/platform typecheck` passes (second-largest consumer)
- [x] `pnpm check` passes (Biome lint/format repo-wide)
- [x] `git grep -n "withLocalBatch\|createNeonDatabase"` returns no results (old symbols fully retired)
- [x] `git grep -n "from \"@db/app/client\""` count is unchanged from before refactor (no consumer was accidentally broken or moved) — 39 files, matches pre-refactor
- [x] New files exist: `db/app/src/drivers/neon-http.ts`, `db/app/src/drivers/postgres.ts`, `db/app/src/polyfills/batch.ts`

#### Human Review

- [x] Start `pnpm dev:app` against local Docker Postgres → app boots without DB connection errors → confirms local postgres-js path still works
- [x] In a signed-in browser session, trigger an org API key rotation (which calls `db.batch` at `api/app/src/router/org/org-api-keys.ts:231`) → response returns a new key and the old key is marked inactive in the DB → confirms the polyfill still bridges the surface in local dev — TODO: automate via lightfast-clerk skill driving the rotation endpoint
- [x] Skim the four files for the explicit comments the user requested → each helper's location is justified inline (driver-routing in `client.ts`, polyfill `why` in `polyfills/batch.ts`, side-effect note in `drivers/neon-http.ts`)

---

## Testing Strategy

No new tests. This is a pure-refactor with no behavior change; typecheck plus the existing 19 consumers continuing to compile is the regression guard. The single `.batch()` consumer is exercised by the human-review key-rotation step.

## Performance Considerations

None. Identical runtime code paths; only file boundaries change. Module load is one extra import hop (negligible). The `neonConfig.fetchEndpoint` assignment remains inside the create function (same idempotent semantics as before).

## Migration Notes

No data migration. No deployment ordering. Single PR, single commit. Production behavior is byte-identical because the neon-http path is unchanged in shape.

## References

- Original investigation: this conversation's earlier `withLocalBatch` provenance trace (commit `1d14f390d`, "Wire dev services into Lightfast repo", 2026-05-04)
- Polyfill consumer: `api/app/src/router/org/org-api-keys.ts:231` (key rotation)
- Subpath export contract: `db/app/package.json:16-19`
- Drizzle-kit duplicate of host check (out of scope): `db/app/src/drizzle.config.ts:4-7`
