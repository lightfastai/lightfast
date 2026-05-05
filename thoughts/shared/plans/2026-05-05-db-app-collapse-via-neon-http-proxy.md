# Collapse `@db/app` to a Single `neon-http` Path via Local Proxy

> Supersedes `2026-05-05-db-app-driver-polyfill-restructure.md`. That plan was implemented at commit `af1f8d21d` ("refactor(db/app): split client into drivers + batch polyfill") and now needs to be reworked: the four-file split was rearranging a workaround we can eliminate entirely.

## Overview

Replace the split DB client (today: neon-http in prod, postgres-js + `withBatchPolyfill` in dev) with a **single `drizzle-orm/neon-http` path used in every environment**. We get there by running [`timowilhelm/local-neon-http-proxy`](https://github.com/TimoWilhelm/local-neon-http-proxy) — a community Docker image that translates Neon's HTTP wire format to a backend Postgres — in front of the existing local Docker Postgres. Two-repo change: `mfe-sandbox/packages/dev-services` adds the proxy as a sibling container, then `lightfast` collapses `db/app/src/client.ts` to a single ~25-line file and deletes the drivers/polyfills folders the prior plan introduced.

The win is not just code deletion (~80 lines + 2 npm deps + 2 folders) — it's that local dev becomes byte-for-byte equivalent to prod. Same driver, same `.batch()` semantics with real atomicity, same `fetchEndpoint`-shaped error paths.

## Current State Analysis

### Lightfast repo (`@db/app`)

The four-file split from the prior plan is already committed at `af1f8d21d` on branch `desktop-portless-runtime-batch`:
- `db/app/src/client.ts` — orchestrator, branches on `isLocalDatabaseHost`
- `db/app/src/drivers/neon-http.ts` — prod driver
- `db/app/src/drivers/postgres.ts` — local-dev driver via postgres-js
- `db/app/src/polyfills/batch.ts` — `withBatchPolyfill` (Promise.all, not atomic)

19+ consumers import `import { db } from "@db/app/client"` (verified by grep). The single `.batch()` consumer is `api/app/src/router/org/org-api-keys.ts:231` (key rotation). `db/app/package.json:43-51` lists both `@neondatabase/serverless` and `postgres` as deps. `db/app/src/drizzle.config.ts:4-7` independently checks `isLocalDatabase` and uses TCP for migrations.

### Lightfast repo (consumer wiring)

`scripts/with-dev-services-env.mjs:55-72` calls `resolveDevPostgresConfig` from `@lightfastai/dev-services` and injects five env vars: `DATABASE_HOST`, `DATABASE_PORT`, `DATABASE_USERNAME`, `DATABASE_PASSWORD`, `DATABASE_NAME`. Per the user's "no new envs" constraint, this shape stays exactly the same — the runtime client will derive the HTTP proxy endpoint by hard-coding port 4444 inside `client.ts` when the host is local.

### dev-services repo (`mfe-sandbox/packages/dev-services`)

Singleton Postgres container provisioning via Docker CLI shell-out (`spawnSync("docker", [...])` in `docker/client.ts:26`). Image at `postgres/config.ts:41` is `postgres:17-alpine`, container name `lightfast-postgres`. Container has **no Docker network attached** — `ensurePostgresContainer` at `postgres/docker.ts:26-43` does a plain `docker run` with no `--network` flag.

Existing two-container precedent for what we're about to add: `redis/docker.ts:20-23` provisions both `lightfast-redis` (raw) and `lightfast-redis-http` (proxy) on a shared `lightfast-dev` Docker network. We'll mirror this exactly.

No teardown logic exists anywhere. Containers persist between sessions. `setup.ts:26-53` runs services strictly sequentially (Postgres → DB → Redis raw → Redis ping). No plugin abstraction — adding a service touches `setup.ts`, `doctor.ts`, `resolve.ts`, `reports/types.ts`, `reports/format.ts`, `public.ts`.

### Why the official Neon Local image was rejected

`neondatabase/neon_local` requires `NEON_API_KEY` + `NEON_PROJECT_ID` and proxies to a real Neon cloud project. It does not support a fully-local mode. Adopting it would require every dev to have a Neon cloud account and internet access for local development — and prod uses PlanetScale's HTTP endpoint, not Neon, so cloud-attached dev wouldn't even mirror prod. The community `timowilhelm/local-neon-http-proxy` is the only image that does what we need (HTTP wire-format translation against a local Postgres).

### Key Discoveries

- **`af1f8d21d` is the rollback target.** Cleanest path is `git revert` of that commit followed by a fresh single-file commit, rather than incrementally undoing each file.
- **Postgres container needs `--network lightfast-dev`** — currently has no network attached. Required so the proxy container can reach it as `lightfast-postgres:5432` over the internal Docker DNS.
- **drizzle-kit needs unmodified TCP access to Postgres.** The proxy is HTTP-only. Keeping the bare Postgres container exposed on 5432 means `drizzle.config.ts` works without changes.
- **Community proxy image is single-maintainer.** Mitigations: pin to a specific tag/digest in dev-services config; if the image vanishes, fallback path is to revert this work or vendor the proxy logic into `mfe-sandbox`.
- **Connection URL port is harmless for HTTP path.** `neon(url)` parses URL for credentials/host/db only. The actual transport endpoint comes from `neonConfig.fetchEndpoint(host)`. Port `5432` in the URL is ignored when the driver sends HTTP to port `4444`.
- **The `.batch()` consumer at `org-api-keys.ts:231` will gain real atomicity in local dev** — bug-finding upgrade, not just a refactor.

## Desired End State

### Lightfast `db/app/src/`

```
db/app/src/
  client.ts            # ~30 lines: single neon-http driver, env-aware fetchEndpoint
  env.ts               # unchanged
  index.ts             # unchanged
  drizzle.config.ts    # unchanged (still TCP for migrations)
  schema/, migrations/, utils/   # unchanged
```

`drivers/` and `polyfills/` folders deleted. `postgres` and the `drizzle-orm/postgres-js` import path removed from `db/app/package.json`.

### dev-services `src/`

```
mfe-sandbox/packages/dev-services/src/
  postgres/                # existing — Postgres container now joins lightfast-dev network
  redis/                   # unchanged
  inngest/                 # unchanged
  neon-http-proxy/         # NEW — sibling proxy container (mirrors redis/ shape)
    config.ts
    docker.ts
  setup.ts, doctor.ts, resolve.ts   # one new step each
  reports/types.ts, reports/format.ts   # new neonHttpProxy field
  public.ts                # exports new resolver + ensure function
```

### Verification end state

- `pnpm --filter @db/app typecheck` and `pnpm --filter @api/app typecheck` pass
- `pnpm dev:app` boots → app reaches DB through HTTP proxy → existing tRPC routes work
- `db.batch([...])` at `org-api-keys.ts:231` executes in local dev with real atomicity (verifiable by injecting a deliberate failure on the second statement and confirming the first rolls back — out of scope to wire as a test, in scope as a one-time human-review check)
- `pnpm db:migrate` against local services still works (drizzle-kit hits Postgres directly on 5432)
- Two containers running locally: `lightfast-postgres` and `lightfast-neon-http-proxy`, both on `lightfast-dev` Docker network

## What We're NOT Doing

- **Not dropping the Postgres container.** The proxy is HTTP-only and needs Postgres as its backend. It also keeps drizzle-kit working without modification. (Walks back the user's earlier "drop old postgres logic" framing — that was based on the assumption that `neon_local` bundles Postgres, which the cloud-only official image does but the community proxy does not.)
- **Not using the official `neondatabase/neon_local` image.** Cloud-only; would require every dev to have a Neon API key; doesn't even mirror prod (which uses PlanetScale).
- **Not adding new env vars.** `DATABASE_HOST/PORT/USERNAME/PASSWORD/NAME` stay as injected today (TCP-shaped). HTTP proxy port `4444` is a hard-coded constant in `client.ts`; the host comes from `DATABASE_HOST`.
- **Not adding plugin/extension abstractions to dev-services.** Add neon-http-proxy as a hard-coded sibling, exactly the way Redis is structured. Future-proof abstraction is out of scope.
- **Not adding teardown logic to dev-services.** Still out of scope; matches existing behavior.
- **Not vendoring/forking the community proxy image.** Pin to a specific tag in dev-services config; revisit only if the image disappears or proves unstable.
- **Not updating `lightfast.dev.json`.** Its `$schema` belongs to dev-proxy, not dev-services; per-service config continues to flow via env-var overrides.
- **Not changing prod.** PlanetScale HTTP path is byte-identical.

## Implementation Approach

Two repos, sequenced. dev-services must ship and publish first because Lightfast depends on its API. Lightfast Phase 2 cannot start until Phase 1 is published and the version bumped in `package.json`.

Each phase ends at a `pnpm` checkpoint (typecheck + smoke test). The phase boundary halts execution per the standard protocol.

## Execution Protocol

Phase boundaries halt execution. Automated checks passing is necessary but not sufficient — the next phase starts only on user go-ahead.

---

## Phase 1: dev-services — add `neon-http-proxy` as sibling container

**Repo**: `Code/mfe-sandbox/packages/dev-services`

### Overview

Add a new `neon-http-proxy/` service that mirrors the `redis/` two-container pattern. Postgres gains a `--network lightfast-dev` flag. The proxy container talks to `lightfast-postgres:5432` over the Docker DNS network. Publish a new minor version of `@lightfastai/dev-services` once verified locally.

### Changes Required

#### 1. Postgres container joins shared Docker network

**File**: `mfe-sandbox/packages/dev-services/src/postgres/docker.ts`
**Change**: In `ensurePostgresContainer` (around line 26-43), add `--network`, `lightfast-dev` to the `docker run` arg list. Also: ensure the network exists before any `docker run` that uses it. The Redis path likely already calls `docker network create` — locate that call (`grep -rn "network create"` in `docker/`) and apply the same to the Postgres path, or extract a small `ensureDockerNetwork(name)` helper used by both.

```diff
  docker run -d
    --name lightfast-postgres
    --restart unless-stopped
+   --network lightfast-dev
    -p ${port}:5432
    -e POSTGRES_USER=postgres
    ...
```

#### 2. New: `neon-http-proxy/config.ts`

**File**: `mfe-sandbox/packages/dev-services/src/neon-http-proxy/config.ts`
**Change**: New file. Mirrors the shape of `redis/config.ts` (or `postgres/config.ts`).

```ts
import type { ResolveDevServiceArgs } from "../resolve";
import type { DevPostgresConfig } from "../postgres/config";

export type DevNeonHttpProxyConfig = {
  containerName: string;
  image: string;
  network: string;
  hostPort: number;
  /** PG_CONNECTION_STRING the proxy uses to reach the backend Postgres. */
  backendConnectionString: string;
};

const NEON_HTTP_PROXY_IMAGE_DEFAULT =
  // Pin to a specific digest once we've validated one. Tag-only is acceptable for v1.
  "ghcr.io/timowilhelm/local-neon-http-proxy:main";
const NEON_HTTP_PROXY_CONTAINER_DEFAULT = "lightfast-neon-http-proxy";
const NEON_HTTP_PROXY_PORT_DEFAULT = 4444;
const NEON_HTTP_PROXY_NETWORK = "lightfast-dev";

export function resolveDevNeonHttpProxyConfig(
  args: ResolveDevServiceArgs,
  postgres: DevPostgresConfig
): DevNeonHttpProxyConfig {
  const env = args.env ?? process.env;
  return {
    containerName:
      env.LIGHTFAST_DEV_NEON_HTTP_PROXY_CONTAINER ??
      NEON_HTTP_PROXY_CONTAINER_DEFAULT,
    image:
      env.LIGHTFAST_DEV_NEON_HTTP_PROXY_IMAGE ??
      NEON_HTTP_PROXY_IMAGE_DEFAULT,
    network: NEON_HTTP_PROXY_NETWORK,
    hostPort: Number(
      env.LIGHTFAST_DEV_NEON_HTTP_PROXY_PORT ?? NEON_HTTP_PROXY_PORT_DEFAULT
    ),
    // Proxy connects to Postgres over the internal Docker network using the
    // container name as the hostname.
    backendConnectionString:
      `postgresql://${postgres.username}:${postgres.password}` +
      `@${postgres.containerName}:5432/${postgres.databaseName}`,
  };
}
```

The override env vars (`LIGHTFAST_DEV_NEON_HTTP_PROXY_*`) follow the existing pattern at `postgres/config.ts:58-73`. These are dev-services-internal overrides for power users — they don't affect the Lightfast app's runtime env, so they don't violate "no new envs" on the Lightfast side.

#### 3. New: `neon-http-proxy/docker.ts`

**File**: `mfe-sandbox/packages/dev-services/src/neon-http-proxy/docker.ts`
**Change**: New file. `ensureNeonHttpProxyContainer` follows the pattern of `redis/docker.ts`'s second-container provisioner.

```ts
import { spawnSync } from "node:child_process";
import { inspectDockerContainer } from "../docker/client";
import type { DevNeonHttpProxyConfig } from "./config";

export async function ensureNeonHttpProxyContainer(
  config: DevNeonHttpProxyConfig
) {
  const state = inspectDockerContainer(config.containerName);

  if (state === "missing") {
    const result = spawnSync(
      "docker",
      [
        "run",
        "-d",
        "--name", config.containerName,
        "--restart", "unless-stopped",
        "--network", config.network,
        "-p", `${config.hostPort}:4444`,
        "-e", `PG_CONNECTION_STRING=${config.backendConnectionString}`,
        config.image,
      ],
      { stdio: "inherit" }
    );
    if (result.status !== 0) {
      throw new Error(
        `Failed to start neon-http-proxy container ${config.containerName}`
      );
    }
  } else if (state === "stopped") {
    spawnSync("docker", ["start", config.containerName], { stdio: "inherit" });
  }

  await waitForNeonHttpProxy(config.hostPort);
}

async function waitForNeonHttpProxy(port: number, attempts = 40) {
  for (let i = 0; i < attempts; i++) {
    try {
      // Proxy responds 4xx to bare GETs but a connection refusal means it's
      // not listening. A reachable socket is a strong-enough readiness signal.
      const response = await fetch(`http://127.0.0.1:${port}/sql`, {
        method: "POST",
        body: "SELECT 1",
      });
      if (response.status < 500) return;
    } catch {
      // not ready yet
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`neon-http-proxy did not become ready on port ${port}`);
}
```

#### 4. Wire into `setup.ts`, `doctor.ts`, `resolve.ts`, `reports/`, `public.ts`

**Files**: `setup.ts`, `doctor.ts`, `resolve.ts`, `reports/types.ts`, `reports/format.ts`, `public.ts`
**Changes**: Add the new service following the existing Postgres/Redis pattern. No new abstraction — same hard-coded sequential plumbing.

- `setup.ts`: After `ensurePostgresDatabase`, call `ensureNeonHttpProxyContainer(neonHttpProxy)`. Sequential, awaited.
- `doctor.ts`: Add a diagnostics block that checks the proxy container is running and responsive.
- `resolve.ts`: Call `resolveDevNeonHttpProxyConfig(args, postgres)` and add the result to the resolved configs returned by `resolveDevServiceConfigs`.
- `reports/types.ts`: Add `neonHttpProxy: DevNeonHttpProxyReport` to `DevServicesReport` (next to `postgres` and `redis`).
- `reports/format.ts`: Add a formatter for the new report field — image, container, host port, status.
- `public.ts`: Re-export `resolveDevNeonHttpProxyConfig`, `ensureNeonHttpProxyContainer`, types.

#### 5. Version bump and publish

**File**: `mfe-sandbox/packages/dev-services/package.json`
**Change**: Bump `version` from `0.1.6` → `0.2.0` (minor — adds a feature).

```bash
pnpm --filter @lightfastai/dev-services run release:check
pnpm --filter @lightfastai/dev-services run publish:npm
```

### Success Criteria

#### Automated Verification

- [x] `pnpm --filter @lightfastai/dev-services run typecheck` passes
- [x] `pnpm --filter @lightfastai/dev-services run test` passes (14/14)
- [x] `pnpm --filter @lightfastai/dev-services run pack:check` passes (86 files, 24.1 kB)
- [ ] In a sibling Lightfast worktree using `pnpm link` to the local dev-services build: `pnpm dev:services:setup` (or whatever entrypoint exists) reports both `lightfast-postgres` and `lightfast-neon-http-proxy` running
- [ ] `docker network inspect lightfast-dev` shows both containers attached
- [ ] `curl -X POST http://127.0.0.1:4444/sql -d 'SELECT 1' -u postgres:postgres` returns a 200 with a row

#### Human Review

- [ ] In dev-services, walk through `setup.ts` end-to-end and confirm the new step is wired between Postgres and Redis without ordering issues
- [ ] Confirm the `doctor` output renders the new section legibly alongside Postgres and Redis
- [ ] Decide whether to pin the proxy image to a specific digest before publishing, or accept `:main` for v1 and tighten later

---

## Phase 2: Lightfast — bump dev-services and collapse `client.ts`

**Repo**: `Code/@lightfastai/lightfast`

### Overview

Roll back the four-file split from `af1f8d21d` and replace with a single ~30-line `client.ts` that uses `drizzle-orm/neon-http` everywhere with an env-aware `fetchEndpoint`. Bump `@lightfastai/dev-services` to the new published version. No env changes. No `with-dev-services-env.mjs` changes.

### Changes Required

#### 1. Bump `@lightfastai/dev-services`

**File**: `package.json` (root) and any workspace package that pins `@lightfastai/dev-services`
**Change**: Update version pin to `^0.2.0`. Run `pnpm install`.

#### 2. Roll back the four-file split

**Strategy**: `git revert af1f8d21d --no-commit`, then layer the new single-file `client.ts` on top, then a single fresh commit. This is cleaner than incremental deletes because the revert restores the exact pre-split file as a known-good baseline, and the diff that lands is "split-then-collapse" which is easier to review than a chain of partial undos.

After the revert, the working tree should have the pre-split single `client.ts`. Delete the now-empty `drivers/` and `polyfills/` directories explicitly if revert doesn't (it should).

#### 3. Rewrite `client.ts` for single neon-http path

**File**: `db/app/src/client.ts`
**Change**: Replace post-revert content with:

```ts
import { neon, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { env } from "./env";
import * as schema from "./schema";

// Local dev runs `timowilhelm/local-neon-http-proxy` (provisioned by
// @lightfastai/dev-services) on this port, in front of a Docker Postgres.
// Prod uses PlanetScale's HTTP endpoint over HTTPS:443. Both speak the
// Neon HTTP wire format, so a single drizzle-orm/neon-http driver works
// everywhere — drizzle-kit migrations still hit Postgres directly via TCP.
const NEON_HTTP_PROXY_PORT = 4444;

neonConfig.fetchEndpoint = (host) => {
  if (isLocalDatabaseHost(host)) {
    return `http://${host}:${NEON_HTTP_PROXY_PORT}/sql`;
  }
  return `https://${host}/sql`;
};

export function createClient() {
  return drizzle({ client: neon(resolveDatabaseUrl()), schema });
}

export const db = createClient();

// Connection URL used by the neon-http driver to extract auth + host + db.
// The URL's port is parsed but ignored at the transport layer — actual HTTP
// goes to whatever `neonConfig.fetchEndpoint` returns above.
function resolveDatabaseUrl() {
  const url = new URL("postgresql://localhost");
  url.hostname = env.DATABASE_HOST;
  url.username = env.DATABASE_USERNAME;
  url.password = env.DATABASE_PASSWORD;
  url.pathname = `/${env.DATABASE_NAME ?? "postgres"}`;
  // sslmode=require for prod hosts, omitted locally — the driver uses this
  // hint for its TLS config but the actual choice of http vs https is made
  // by fetchEndpoint above.
  if (!isLocalDatabaseHost(env.DATABASE_HOST)) {
    url.searchParams.set("sslmode", "require");
  }
  return url.toString();
}

function isLocalDatabaseHost(value: string) {
  const hostname = value.toLowerCase();
  return (
    hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1"
  );
}
```

Notes:
- DATABASE_PORT is **not** used in the URL anymore. Connection-URL port is irrelevant for the HTTP path, and we never set it for prod. Drizzle-kit reads its own port from `drizzle.config.ts:15` independently — that path is unchanged.
- `neonConfig.fetchEndpoint` is module-top side-effect assignment. `db/app/package.json:6` declares `"sideEffects": false`. Two acceptable resolutions:
  - **(a)** Accept the white lie — the assignment is idempotent and process-global, no realistic bundler issue.
  - **(b)** Move into `createClient()` to keep it call-time only (matches the prior plan's behavior).
  - **Pick (b)** for correctness with the package metadata. Move the `neonConfig.fetchEndpoint = ...` line inside `createClient` immediately before `neon(...)`.

#### 4. Drop unused deps

**File**: `db/app/package.json`
**Change**: Remove `"postgres": "catalog:"` from `dependencies`. (`drizzle-orm` stays — `drizzle-orm/postgres-js` was a sub-import, not a separate package.)

After change: `pnpm install` from repo root to update the lockfile.

#### 5. Confirm drizzle-kit is unaffected

**File**: `db/app/src/drizzle.config.ts`
**Change**: None. Verify by reading: it builds its own connection from `env.DATABASE_HOST`, `env.DATABASE_PORT`, etc. (lines 14-19). Postgres TCP is still on port 5432 of the unchanged `lightfast-postgres` container, which `with-dev-services-env.mjs` still injects unchanged.

#### 6. Sanity-check consumer imports

**File**: 19+ consumer sites (verified by grep)
**Change**: None expected. All consumers import `import { db } from "@db/app/client"` or `import { db } from "@db/app"`. Both subpaths still resolve. The exported `db` value's runtime methods are identical in shape; the type alias `AppDatabase` is gone but no consumer imported it.

### Success Criteria

#### Automated Verification

- [x] `pnpm --filter @db/app typecheck` passes
- [x] `pnpm --filter @api/app typecheck` passes
- [x] `pnpm --filter @api/platform typecheck` passes
- [x] `pnpm check` (Biome) passes for files touched by this plan (`db/app/src/client.ts`, `db/app/package.json`); single preexisting failure in untracked `.agents/skills/lightfast-desktop-signin/lib/write-auth-bin.mjs` is out of scope
- [x] `git grep -n "withBatchPolyfill\|withLocalBatch\|drizzle-orm/postgres-js\|from \"postgres\""` in `db/app/` and `api/` returns no results
- [x] `db/app/src/drivers/` and `db/app/src/polyfills/` directories do not exist
- [x] `db/app/package.json` no longer lists `postgres` in dependencies
- [x] `pnpm install` from repo root produces no errors; `postgres@3.4.9` remains in the lockfile because it is still a dependency of `@api/app`, `@api/platform`, `apps/app`, `vendor/db`, `packages/webhook-schemas`, and `packages/app-test-data` — out of scope to remove

#### Human Review

- [x] Run `pnpm dev:services:setup` (or the equivalent entrypoint) → both `lightfast-postgres` and `lightfast-neon-http-proxy` are running, both on `lightfast-dev` network — verified: `docker network inspect lightfast-dev` shows both containers, proxy on `127.0.0.1:4444` returns `HTTP 400 invalid header: neon-connection-string` for raw curl (alive)
- [x] Run `pnpm dev:app` against local services → app boots without DB errors → confirms the runtime client reaches Postgres through the HTTP proxy — verified: tRPC `account.get` query returned `ok: true` in 559ms with `orgId: 'org_3Bq7JX2P4GHXJvMzAf0P0QwSZ6W'`
- [x] In a signed-in browser session, trigger an org API key rotation (which calls `db.batch` at `api/app/src/router/org/org-api-keys.ts:231`) → response returns a new key, old key is marked inactive in DB → confirms the single-driver path works for the only `.batch()` consumer — verified: `POST /api/trpc/orgApiKeys.rotate 200 in 475ms`, `[org-api-keys] rotated` log, user confirmed rotation success in browser
- [x] Run `pnpm db:generate` and `pnpm db:migrate` against local services → drizzle-kit successfully connects via TCP to Postgres on 5432 → confirms migrations are unaffected — verified: `pnpm dev:setup` ran `db:migrate` successfully (`migrations applied successfully!`)
- [ ] Optional atomicity smoke test: temporarily inject a syntax error in the second statement of the rotation `db.batch([...])` call → trigger rotation → verify the first statement (revoke) did not commit → confirms real atomicity in local dev (this is a bug-finding upgrade we couldn't do under the polyfill)

---

## Testing Strategy

No new automated tests. The change is a refactor with two consumer-visible side effects:
1. Local dev now requires the proxy container to be running (covered by dev-services setup)
2. `db.batch` becomes truly atomic in local dev (covered by the optional smoke test above)

Existing tRPC routes and Inngest workflows are unchanged at the call-site level; they exercise the full driver path on every dev session.

## Performance Considerations

Local dev gains an HTTP hop (app → proxy → Postgres) instead of direct TCP (app → Postgres). Negligible for local dev workloads. Prod is unchanged. drizzle-kit migrations are unchanged (direct TCP).

## Migration Notes

**No data migration**. The Postgres backend is unchanged; only the routing in front of it changes.

**No prod deployment ordering**. Prod path is byte-identical.

## References

- Original investigation that surfaced the `withLocalBatch` polyfill cost: this conversation's earlier git-archaeology trace (commit `1d14f390d`)
- Prior plan, now superseded: `thoughts/shared/plans/2026-05-05-db-app-driver-polyfill-restructure.md`
- Prior plan implementation, to be reverted: commit `af1f8d21d`
- The single `.batch()` consumer: `api/app/src/router/org/org-api-keys.ts:231`
- Existing two-container precedent in dev-services: `mfe-sandbox/packages/dev-services/src/redis/docker.ts:20-23`
- Community proxy image: https://github.com/TimoWilhelm/local-neon-http-proxy
- Why not the official Neon Local: cloud-only (`NEON_API_KEY` + `NEON_PROJECT_ID` required) per https://neon.com/docs/local/neon-local
