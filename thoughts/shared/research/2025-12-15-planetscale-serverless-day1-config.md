---
date: 2025-12-15T22:30:00+08:00
researcher: Claude (Opus 4.5)
git_commit: 1037fb5f1d11c7dc07a89f4b91bab313368bb4fa
branch: feat/memory-layer-foundation
repository: lightfast
topic: "PlanetScale Postgres Day 1 Configuration for Serverless (Next.js + Vercel)"
tags: [research, postgresql, planetscale, serverless, vercel, nextjs, day1]
status: complete
last_updated: 2025-12-15
last_updated_by: Claude (Opus 4.5)
---

# Day 1: PlanetScale Postgres Configuration for Serverless Architecture

**Date**: 2025-12-15T22:30:00+08:00
**Researcher**: Claude (Opus 4.5)
**Git Commit**: 1037fb5f1d11c7dc07a89f4b91bab313368bb4fa
**Branch**: feat/memory-layer-foundation

## Research Question

What are the Day 1 critical configuration changes needed for PlanetScale Postgres with a serverless architecture (Next.js on Vercel)?

## Executive Summary

All Day 1 configuration changes have been implemented. The database client now has proper PgBouncer settings, ESLint is configured, and BIGINT migrations have been applied.

---

## Day 1 Checklist - COMPLETED

| Task | Status | Details |
|------|--------|---------|
| Update `db/console/src/client.ts` | Done | Added `prepare: false`, `max: 20`, `idle_timeout: 20`, `connect_timeout: 10` |
| Add ESLint to `@db/console` | Done | Created `eslint.config.js`, fixed lint errors |
| Add `SKIP_ENV_VALIDATION` to turbo.json | Done | Added to `globalPassThroughEnv` |
| Apply BIGINT migrations (0015-0017) | Done | `pnpm db:migrate` executed |
| Remove unused imports | Done | Removed `text` from `workspace-knowledge-documents.ts` |

---

## Configuration Applied

**File**: `db/console/src/client.ts`

```typescript
const client = postgres(connectionString, {
  ssl: "require",
  max: 20,              // Match PlanetScale default_pool_size
  prepare: false,       // Required for PgBouncer transaction mode
  idle_timeout: 20,     // Serverless: close idle connections after 20s
  connect_timeout: 10,  // Fail fast on connection issues
});
```

### Option Explanations

| Option | Value | Rationale |
|--------|-------|-----------|
| `ssl` | `"require"` | Enforce TLS connections |
| `max` | `20` | Match PlanetScale's `default_pool_size` (20 connections per user/database) |
| `prepare` | `false` | **CRITICAL**: PgBouncer transaction mode cannot maintain prepared statements across transactions |
| `idle_timeout` | `20` | Vercel recommends ~5s for serverless; 20s balances reuse with cleanup |
| `connect_timeout` | `10` | Fail fast rather than hanging on connection issues |

---

## Why `prepare: false` is Critical

PlanetScale uses **PgBouncer in transaction pooling mode** (port 6432). In this mode:
- Each transaction may use a different backend PostgreSQL connection
- Prepared statements are **connection-specific**
- A prepared statement created on connection A won't exist on connection B

Without `prepare: false`:
```
1. Query Q1 executes on connection A -> creates prepared statement "p1"
2. Transaction commits -> connection A returned to pool
3. Query Q1 executes again -> assigned connection B
4. postgres.js tries to execute prepared statement "p1" on connection B
5. ERROR: prepared statement "p1" does not exist
```

From postgres.js README:
> "Prepared statements will automatically be created for any queries where it can be inferred that the query is static. This can be disabled by using the `prepare: false` option. For instance - this is useful when **using PGBouncer in `transaction mode`**."

---

## Why `idle_timeout: 20` for Serverless

From Vercel's Connection Pooling Guide (November 2025):
> "Use a relatively short idle timeout (e.g., 5 seconds) to balance connection reuse during traffic spikes with quick cleanup of unused connections."

Vercel's Fluid Compute keeps instances alive long enough for idle timeouts to fire. Setting `idle_timeout: 20` ensures:
- Connections are reused during request bursts
- Idle connections are cleaned up between deployments
- No connection leaks during function suspension

---

## PgBouncer Limitations

### Do NOT Use via PgBouncer (Port 6432)

| Feature | Alternative |
|---------|-------------|
| Schema migrations (DDL) | Use port 5432 (direct) |
| `LISTEN`/`NOTIFY` | Use port 5432 (direct) |
| Temporary tables | Avoid or use direct connection |
| Session-level `SET` commands | Avoid |
| Session advisory locks | Use transactional locks instead |

Migrations already use port 5432 (direct connection) via `drizzle.config.ts`.

---

## Previously Implemented (Verified)

| Item | Status | Evidence |
|------|--------|----------|
| OAuth Token Encryption | Done | `packages/lib/src/encryption.ts` - AES-256-GCM |
| BIGINT Migration | Done | Migrations 0015-0017 applied |
| SSL/TLS Enforced | Done | `ssl: "require"` in client.ts |
| API Keys Hashed | Done | `packages/console-api-key/src/crypto.ts` - SHA-256 |
| externalId Pattern | Done | 4 API tables have nanoid external IDs |

---

## Week 1: Index Optimization (Not Yet Implemented)

### BRIN Indexes for Time-Series Tables

BRIN (Block Range Index) provides ~1000x smaller indexes for time-ordered data.

| Table | Column | Rationale |
|-------|--------|-----------|
| `workspace_operations_metrics` | `timestamp` | Append-only metrics |
| `workspace_user_activities` | `timestamp` | Append-only audit log |
| `workspace_webhook_payloads` | `received_at` | Append-only webhook storage |
| `workspace_neural_observations` | `occurred_at` | Time-ordered observations |

### GIN Indexes for JSONB Columns

GIN indexes enable fast containment queries on JSONB arrays/objects.

| Table | Column | Use Case |
|-------|--------|----------|
| `workspace_neural_observations` | `topics` | Topic-based filtering |
| `workspace_neural_observations` | `metadata` | Flexible metadata queries |
| `workspace_neural_entities` | `aliases` | Alias search |
| `workspace_observation_clusters` | `keywords` | Keyword search |
| `workspace_observation_clusters` | `primary_entities` | Entity filtering |

### Implementation Notes

Drizzle ORM does not natively support BRIN/GIN index types. Options:
1. Raw SQL migration via `sql` helper
2. Post-migration script with `CREATE INDEX CONCURRENTLY`
3. PlanetScale Schema Recommendations (auto-suggests indexes)

---

## Sources

### Official Documentation
- [PlanetScale PgBouncer Docs](https://planetscale.com/docs/postgres/connecting/pgbouncer)
- [Vercel Connection Pooling Guide](https://vercel.com/guides/connection-pooling-with-functions) (November 2025)
- [postgres.js README - Connection Details](https://github.com/porsager/postgres#connection-details)

### Key Quotes

**PlanetScale on PgBouncer**:
> "Transaction pooling assigns client connections to pooled server connections on a per-transaction level. This is the most suitable mode for the vast majority of workloads."

**Vercel on Serverless Connections**:
> "In traditional serverless, idle connection timeouts don't run while suspended, causing connections to remain open indefinitely."

### Related Research
- `thoughts/shared/research/2025-12-15-postgresql-optimization-security-planetscale.md`
- `thoughts/shared/plans/2025-12-15-database-id-strategy-bigint-migration.md`

---

**Last Updated**: 2025-12-15
**Confidence Level**: High - based on official PlanetScale, Vercel, and postgres.js documentation
