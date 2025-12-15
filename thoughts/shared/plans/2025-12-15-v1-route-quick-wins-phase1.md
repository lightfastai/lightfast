# v1 Route Performance Optimizations - Phase 1 Quick Wins

## Overview

Implement the "Day 1" quick wins from the v1 route optimization research: findsimilar parallelization and workspace config caching. These optimizations require minimal infrastructure changes and provide immediate latency improvements.

## Current State Analysis

### Findsimilar Route (Sequential Operations)
**File**: `apps/console/src/app/(api)/v1/findsimilar/route.ts`

Current flow at lines 263-288:
1. **Line 264-270**: Fetch workspace config (~10-50ms)
2. **Line 279-282**: Generate embedding (~100-300ms)

Total: 110-350ms (sum of both operations)

**Problem**: These operations are independent - embedding generation doesn't need workspace config, and vice versa.

### Four-Path Search (Uncached Workspace Config)
**File**: `apps/console/src/lib/neural/four-path-search.ts`

Current flow at lines 357-368:
1. Every search queries the database for workspace config
2. Full workspace record fetched but only 4 fields used: `indexName`, `namespaceName`, `embeddingModel`, `embeddingDim`

**Problem**: Database round-trip on every request (~10-50ms) for data that rarely changes.

### Key Discoveries

| Finding | Location | Impact |
|---------|----------|--------|
| Existing cache pattern | `packages/console-clerk-cache/src/membership.ts` | Template to follow |
| Redis singleton available | `vendor/upstash/src/index.ts` | No infrastructure needed |
| Workspace config rarely changes | `db/console/src/schema/tables/org-workspaces.ts` | Long TTL viable (1 hour) |
| Findsimilar uses same pattern | `findsimilar/route.ts:264-270` | Both routes benefit from cache |

## Desired End State

After this plan is complete:

1. **Findsimilar latency reduced by 50-100ms** through parallel execution
2. **All v1 routes skip workspace DB lookup** on cache hit (~10-50ms savings)
3. **Cache pattern established** for future optimizations (embedding caching)

### Verification

```bash
# Test search latency (should see ~50-100ms improvement on warm cache)
curl -X POST http://localhost:4107/api/v1/search \
  -H "Authorization: Bearer $API_KEY" \
  -H "X-Workspace-ID: $WORKSPACE_ID" \
  -d '{"query": "test search", "mode": "fast"}' | jq '.latency'

# Test findsimilar latency (should see parallel execution benefit)
curl -X POST http://localhost:4107/api/v1/findsimilar \
  -H "Authorization: Bearer $API_KEY" \
  -H "X-Workspace-ID: $WORKSPACE_ID" \
  -d '{"id": "obs_xxx"}' | jq '.meta.took'
```

## What We're NOT Doing

- **Embedding caching**: Deferred to post-launch (added complexity, requires query hashing)
- **Full result caching**: Deferred due to invalidation complexity
- **Skip empty paths**: Requires capability detection (Phase 2)
- **Pinecone metadata expansion**: Requires ingestion pipeline changes (Phase 3)

## Implementation Approach

1. **Create new package** `@repo/console-workspace-cache` following the clerk-cache pattern
2. **Integrate into four-path-search** first (higher traffic)
3. **Integrate into findsimilar** with parallelization
4. **Add cache invalidation hook** for workspace updates

---

## Phase 1: Workspace Config Cache Package

### Overview
Create a new package `@repo/console-workspace-cache` that provides cached workspace config lookup, following the established pattern in `@repo/console-clerk-cache`.

### Changes Required

#### 1. Create Package Structure

**File**: `packages/console-workspace-cache/package.json`
```json
{
  "name": "@repo/console-workspace-cache",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "default": "./dist/index.js"
    }
  },
  "scripts": {
    "build": "tsup",
    "dev": "tsup --watch",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@db/console": "workspace:*",
    "@vendor/upstash": "workspace:*",
    "@vendor/observability": "workspace:*",
    "drizzle-orm": "catalog:"
  },
  "devDependencies": {
    "@repo/typescript-config": "workspace:*",
    "tsup": "catalog:",
    "typescript": "catalog:"
  }
}
```

**File**: `packages/console-workspace-cache/tsconfig.json`
```json
{
  "extends": "@repo/typescript-config/base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

**File**: `packages/console-workspace-cache/tsup.config.ts`
```typescript
import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  dts: true,
  clean: true,
  sourcemap: true,
});
```

#### 2. Implement Cache Logic

**File**: `packages/console-workspace-cache/src/index.ts`
```typescript
export { getCachedWorkspaceConfig, invalidateWorkspaceConfig } from "./config";
export type { CachedWorkspaceConfig } from "./types";
```

**File**: `packages/console-workspace-cache/src/types.ts`
```typescript
/**
 * Cached workspace configuration for neural search operations.
 * Contains only the fields needed for Pinecone queries and embedding generation.
 */
export interface CachedWorkspaceConfig {
  indexName: string;
  namespaceName: string;
  embeddingModel: string;
  embeddingDim: number;
}
```

**File**: `packages/console-workspace-cache/src/keys.ts`
```typescript
/**
 * Cache key utilities for workspace config caching.
 * Pattern: ws:{workspaceId}:config
 */

const CACHE_PREFIX = "ws";

export function getWorkspaceConfigCacheKey(workspaceId: string): string {
  return `${CACHE_PREFIX}:${workspaceId}:config`;
}
```

**File**: `packages/console-workspace-cache/src/config.ts`
```typescript
import { redis } from "@vendor/upstash";
import { db } from "@db/console/client";
import { orgWorkspaces } from "@db/console/schema";
import { eq } from "drizzle-orm";
import { log } from "@vendor/observability/log";
import { getWorkspaceConfigCacheKey } from "./keys";
import type { CachedWorkspaceConfig } from "./types";

/** Cache TTL in seconds (1 hour - workspace config rarely changes) */
const CACHE_TTL_SECONDS = 3600;

/**
 * Get workspace configuration with Redis caching.
 *
 * Strategy: Cache the minimal config needed for search operations.
 * Workspace config changes infrequently, so 1-hour TTL is safe.
 *
 * Flow:
 * 1. Try Redis cache lookup
 * 2. On hit: return cached data
 * 3. On miss: fetch from DB, cache result, return
 * 4. On error: log warning, fall back to direct DB query
 *
 * @param workspaceId - Workspace ID
 * @returns Workspace config or null if not configured for search
 */
export async function getCachedWorkspaceConfig(
  workspaceId: string
): Promise<CachedWorkspaceConfig | null> {
  const cacheKey = getWorkspaceConfigCacheKey(workspaceId);

  // 1. Try cache lookup
  try {
    const cached = await redis.get<CachedWorkspaceConfig>(cacheKey);

    if (cached !== null) {
      log.debug("Workspace config cache hit", { workspaceId });
      return cached;
    }

    log.debug("Workspace config cache miss", { workspaceId });
  } catch (cacheError) {
    // Cache read failed - log and continue to DB
    log.warn("Workspace config cache read failed", {
      workspaceId,
      error: cacheError instanceof Error ? cacheError.message : String(cacheError),
    });
  }

  // 2. Fetch from database
  const config = await fetchWorkspaceConfigFromDB(workspaceId);

  if (!config) {
    // Workspace not configured for search - don't cache null
    return null;
  }

  // 3. Cache the result (fire-and-forget, don't block response)
  cacheWorkspaceConfig(workspaceId, config).catch((cacheError) => {
    log.warn("Workspace config cache write failed", {
      workspaceId,
      error: cacheError instanceof Error ? cacheError.message : String(cacheError),
    });
  });

  return config;
}

/**
 * Fetch workspace config directly from database.
 * Used on cache miss or as fallback on cache failure.
 */
async function fetchWorkspaceConfigFromDB(
  workspaceId: string
): Promise<CachedWorkspaceConfig | null> {
  const workspace = await db.query.orgWorkspaces.findFirst({
    where: eq(orgWorkspaces.id, workspaceId),
    columns: {
      indexName: true,
      namespaceName: true,
      embeddingModel: true,
      embeddingDim: true,
    },
  });

  if (!workspace?.indexName || !workspace.namespaceName) {
    return null;
  }

  return {
    indexName: workspace.indexName,
    namespaceName: workspace.namespaceName,
    embeddingModel: workspace.embeddingModel,
    embeddingDim: workspace.embeddingDim,
  };
}

/**
 * Cache workspace config in Redis.
 */
async function cacheWorkspaceConfig(
  workspaceId: string,
  config: CachedWorkspaceConfig
): Promise<void> {
  const cacheKey = getWorkspaceConfigCacheKey(workspaceId);
  await redis.set(cacheKey, config, { ex: CACHE_TTL_SECONDS });
  log.debug("Workspace config cached", { workspaceId });
}

/**
 * Invalidate cached workspace config.
 * Call this when workspace settings are updated.
 */
export async function invalidateWorkspaceConfig(workspaceId: string): Promise<void> {
  const cacheKey = getWorkspaceConfigCacheKey(workspaceId);
  await redis.del(cacheKey);
  log.info("Workspace config cache invalidated", { workspaceId });
}
```

### Success Criteria

#### Automated Verification
- [x] Package builds: `pnpm --filter @repo/console-workspace-cache build`
- [x] TypeScript passes: `pnpm --filter @repo/console-workspace-cache typecheck`
- [x] No lint errors: `pnpm lint`

#### Manual Verification
- [ ] Package exports are correct when imported

**Implementation Note**: After completing this phase and all automated verification passes, proceed to Phase 2.

---

## Phase 2: Integrate Cache into Four-Path Search

### Overview
Replace direct database lookup in `fourPathParallelSearch` with cached lookup.

### Changes Required

#### 1. Update four-path-search.ts

**File**: `apps/console/src/lib/neural/four-path-search.ts`

**Add import** (after line 18):
```typescript
import { getCachedWorkspaceConfig } from "@repo/console-workspace-cache";
```

**Replace workspace lookup** (lines 357-371):

Current code:
```typescript
  // 1. Look up workspace configuration
  const workspace = await db.query.orgWorkspaces.findFirst({
    where: eq(orgWorkspaces.id, workspaceId),
  });

  if (!workspace) {
    throw new Error(`Workspace not found: ${workspaceId}`);
  }

  if (!workspace.indexName || !workspace.namespaceName) {
    throw new Error(`Workspace not configured for search: ${workspaceId}`);
  }

  const indexName = workspace.indexName;
  const namespaceName = workspace.namespaceName;
```

New code:
```typescript
  // 1. Look up workspace configuration (cached)
  const workspace = await getCachedWorkspaceConfig(workspaceId);

  if (!workspace) {
    throw new Error(`Workspace not found or not configured for search: ${workspaceId}`);
  }

  const { indexName, namespaceName, embeddingModel, embeddingDim } = workspace;
```

**Update embedding provider** (lines 375-382):

Current code:
```typescript
  const embedding = createEmbeddingProviderForWorkspace(
    {
      id: workspace.id,
      embeddingModel: workspace.embeddingModel,
      embeddingDim: workspace.embeddingDim,
    },
    { inputType: "search_query" }
  );
```

New code:
```typescript
  const embedding = createEmbeddingProviderForWorkspace(
    {
      id: workspaceId,
      embeddingModel,
      embeddingDim,
    },
    { inputType: "search_query" }
  );
```

#### 2. Update package.json

**File**: `apps/console/package.json`

Add dependency:
```json
"@repo/console-workspace-cache": "workspace:*",
```

### Success Criteria

#### Automated Verification
- [x] Console builds: `pnpm build:console`
- [x] TypeScript passes: `pnpm --filter @lightfast/console typecheck`
- [x] No lint errors: `pnpm lint`

#### Manual Verification
- [ ] Search works on first request (cache miss path)
- [ ] Search works on second request (cache hit - check logs for "cache hit")
- [ ] Latency reduced on cache hit (~10-50ms improvement)

**Implementation Note**: After completing this phase and all automated verification passes, proceed to Phase 3.

---

## Phase 3: Integrate Cache into Findsimilar with Parallelization

### Overview
Replace sequential operations with parallel execution: workspace config (cached) and embedding generation run simultaneously.

### Changes Required

#### 1. Update findsimilar/route.ts

**File**: `apps/console/src/app/(api)/v1/findsimilar/route.ts`

**Add import** (after line 31):
```typescript
import { getCachedWorkspaceConfig } from "@repo/console-workspace-cache";
```

**Replace sequential with parallel** (lines 263-288):

Current code:
```typescript
    // 5. Get workspace config for Pinecone
    const workspace = await db.query.orgWorkspaces.findFirst({
      columns: {
        indexName: true,
        namespaceName: true,
      },
      where: eq(orgWorkspaces.id, workspaceId),
    });

    if (!workspace?.indexName || !workspace.namespaceName) {
      return NextResponse.json(
        { error: "CONFIG_ERROR", message: "Workspace not configured for search", requestId },
        { status: 500 }
      );
    }

    // 6. Generate embedding for source content
    const provider = createEmbeddingProvider({ inputType: "search_document" });
    const embedResult = await provider.embed([sourceContent.content]);
    const embedding = embedResult.embeddings[0];
    if (!embedding) {
      return NextResponse.json(
        { error: "INTERNAL_ERROR", message: "Failed to generate embedding", requestId },
        { status: 500 }
      );
    }
```

New code:
```typescript
    // 5. Get workspace config and generate embedding in parallel
    const [workspace, embedResult] = await Promise.all([
      getCachedWorkspaceConfig(workspaceId),
      (async () => {
        const provider = createEmbeddingProvider({ inputType: "search_document" });
        return provider.embed([sourceContent.content]);
      })(),
    ]);

    // 6. Validate results
    if (!workspace) {
      return NextResponse.json(
        { error: "CONFIG_ERROR", message: "Workspace not configured for search", requestId },
        { status: 500 }
      );
    }

    const embedding = embedResult.embeddings[0];
    if (!embedding) {
      return NextResponse.json(
        { error: "INTERNAL_ERROR", message: "Failed to generate embedding", requestId },
        { status: 500 }
      );
    }
```

**Update Pinecone query** (lines 308-317):

Current code uses `workspace.indexName` and `workspace.namespaceName` - these work with the new code since the cached config has these fields.

**Remove unused import** (line 26-27):
```typescript
// Remove orgWorkspaces from import if no longer used elsewhere in file
import {
  workspaceKnowledgeDocuments,
  // orgWorkspaces,  // Remove if getCachedWorkspaceConfig replaces all uses
} from "@db/console/schema";
```

Actually, keep the import - we only changed one usage and the import may be used elsewhere.

### Success Criteria

#### Automated Verification
- [x] Console builds: `pnpm build:console`
- [x] TypeScript passes: `pnpm --filter @lightfast/console typecheck`
- [x] No lint errors: `pnpm lint`

#### Manual Verification
- [ ] Findsimilar returns correct results
- [ ] Latency improved by ~50-100ms (parallel vs sequential)
- [ ] Check logs for "cache hit" on second request

**Implementation Note**: After completing this phase and all automated verification passes, proceed to Phase 4.

---

## Phase 4: Add Cache Invalidation Hook

### Overview
Add cache invalidation when workspace settings are updated via tRPC.

### Changes Required

#### 1. Find workspace update mutation

**File**: `api/console/src/routers/org/workspace.ts` (or similar)

Locate the workspace update procedure and add invalidation call.

**Add import**:
```typescript
import { invalidateWorkspaceConfig } from "@repo/console-workspace-cache";
```

**After successful update**:
```typescript
// After workspace update succeeds
await invalidateWorkspaceConfig(workspaceId);
```

#### 2. Add dependency to api package

**File**: `api/console/package.json`

Add dependency:
```json
"@repo/console-workspace-cache": "workspace:*",
```

### Success Criteria

#### Automated Verification
- [x] API builds: `pnpm --filter @api/console build`
- [x] TypeScript passes: `pnpm typecheck`

#### Manual Verification
- [ ] Update workspace settings
- [ ] Verify cache invalidated (check logs for "cache invalidated")
- [ ] Next search uses fresh config

**Implementation Note**: After completing this phase, all Phase 1 optimizations are complete.

---

## Testing Strategy

### Unit Tests
- Cache hit returns cached value
- Cache miss fetches from DB and caches
- Cache write failure doesn't break request
- Invalid workspace returns null

### Integration Tests
- Full search flow with cache
- Findsimilar parallel execution
- Cache invalidation on update

### Manual Testing Steps
1. Start dev server: `pnpm dev:console`
2. Make first search request (cache miss - check logs)
3. Make second search request (cache hit - faster, check logs)
4. Update workspace settings
5. Make third search request (cache miss after invalidation)

---

## Performance Considerations

| Optimization | Expected Savings | Conditions |
|-------------|------------------|------------|
| Workspace config cache | 10-50ms | Cache hit |
| Findsimilar parallelization | 50-100ms | Always (parallel vs sequential) |
| Combined | 60-150ms | Warm cache + parallel |

### Cache Sizing
- Key size: ~30 bytes (`ws:{uuid}:config`)
- Value size: ~100 bytes (4 string fields)
- Expected keys: ~1000 workspaces (active)
- Memory: ~130KB (negligible for Upstash free tier)

### TTL Rationale
- 1 hour chosen because:
  - Workspace config changes rarely (days/weeks)
  - Long enough to benefit from caching
  - Short enough to catch updates without explicit invalidation
  - Explicit invalidation handles immediate updates

---

## References

- Original research: `thoughts/shared/research/2025-12-15-v1-route-optimization-integration-analysis.md`
- Auth cache pattern: `packages/console-clerk-cache/src/membership.ts`
- Findsimilar route: `apps/console/src/app/(api)/v1/findsimilar/route.ts:263-288`
- Four-path search: `apps/console/src/lib/neural/four-path-search.ts:357-390`
- Redis client: `vendor/upstash/src/index.ts`
