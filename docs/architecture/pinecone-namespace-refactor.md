---
title: Pinecone Shared Index + Namespace Architecture
description: Migration from one-index-per-store to shared-index with hierarchical namespaces
status: draft
owner: engineering
audience: engineering
last_updated: 2025-01-25
tags: [pinecone, architecture, refactor, namespaces, cost-optimization]
---

# Pinecone Shared Index + Namespace Architecture

## Executive Summary

**Current:** One Pinecone index per store (`workspace-slug-store-slug`)
**New:** One shared Pinecone index for all customers with hierarchical namespaces

**Benefits:**
- ✅ **Massive cost savings**: $50/month vs $7,500+/month for 3000 stores
- ✅ **Scales to 25,000 stores** (Standard plan namespace limit)
- ✅ **Physical isolation** via Pinecone's serverless architecture
- ✅ **Pinecone best practices** (shared index + namespaces for multi-tenancy)
- ✅ **No noisy neighbors** (independent namespace scaling)
- ✅ **Instant operations** (namespace deletion is instantaneous)
- ✅ **Simpler architecture** (single table, config-driven index management)

---

## Understanding Pinecone Namespaces (ELI5)

### The Apartment Building Analogy 🏢

Think of a **Pinecone index** as a **huge apartment building**:

**❌ Current Approach: Everyone Gets Their Own Building**
```
🏢 Building for Alice (index: "alice-workspace-docs")
🏢 Building for Bob (index: "bob-workspace-docs")
🏢 Building for Carol (index: "carol-workspace-docs")

Problems:
- 1000 customers = 1000 buildings = SUPER EXPENSIVE 💸
- Pinecone limit: Only 20 buildings (indexes) per project
- Need 50 projects × $50/month = $2,500/month JUST for minimums
```

**✅ New Approach: Everyone Shares ONE Building**
```
🏢 One Big Building (index: "lightfast-production-v1")
   ├── 🚪 Apartment 101 (namespace: "org-alice:ws-main:store-docs")
   ├── 🚪 Apartment 102 (namespace: "org-bob:ws-main:store-docs")
   └── 🚪 Apartment 103 (namespace: "org-carol:ws-main:store-docs")

Benefits:
- 1 building holds 25,000 apartments (namespaces)
- Way cheaper - share building infrastructure
- Each apartment has its OWN lock (physical isolation)
- No "noisy neighbors" - Bob's party doesn't affect Alice
```

### How Namespaces Work Physically

From Pinecone documentation:

> **"In the serverless architecture, each namespace is stored separately, ensuring physical isolation of each tenant's data"**

**Key Points:**
1. **Physical Separation**: Namespaces are stored in separate files ("slabs") on disk
2. **Query Isolation**: Queries only scan the namespace you specify
3. **Independent Scaling**: Activity in one namespace doesn't affect others
4. **Cost Efficiency**: Pay only for records scanned (namespace = fewer records)

**Storage Structure:**
```
Index: "lightfast-production-v1"

Namespace: "org-acme:ws-platform:store-docs"
└── Stored as slabs (immutable files)
    ├── slab-001.bin (1000 vectors)
    ├── slab-002.bin (1000 vectors)
    └── slab-003.bin (1000 vectors)

Namespace: "org-beta:ws-eng:store-knowledge"
└── Stored as DIFFERENT slabs (completely separate!)
    ├── slab-101.bin (500 vectors)
    └── slab-102.bin (500 vectors)

When you query "org-acme:ws-platform:store-docs":
✅ Pinecone loads ONLY slab-001, slab-002, slab-003
❌ NEVER touches slab-101, slab-102 (different namespace)
→ Faster queries + Lower cost + Complete isolation
```

---

## Current vs New Architecture

### Current Architecture (Expensive & Limited)

```
Organization: acme-corp
├── Workspace: platform-engineering
│   ├── Store: api-docs → Index: "platform-engineering-api-docs"
│   └── Store: user-guides → Index: "platform-engineering-user-guides"
└── Workspace: product
    ├── Store: specs → Index: "product-specs"
    └── Store: feedback → Index: "product-feedback"

Problems:
- 4 stores = 4 Pinecone indexes
- 1000 workspaces × 3 stores = 3000 indexes needed
- Pinecone Standard plan limit: 20 indexes per project
- Need 150 projects × $50/month = $7,500/month in minimums alone
```

### New Architecture (Shared Index)

```
Config-Driven Shared Indexes (no database table needed):
- Production: "lightfast-production-v1" (serves ALL production customers)
- Staging: "lightfast-staging-v1" (serves ALL staging customers)

Database Tracks Only Namespaces:

Organization: acme-corp (org_abc123)
├── Workspace: platform-engineering (ws_def456)
│   ├── Namespace: "org_abc123:ws_def456:docs" (environment: production)
│   └── Namespace: "org_abc123:ws_def456:guides" (environment: production)
└── Workspace: product (ws_ghi789)
    ├── Namespace: "org_abc123:ws_ghi789:specs" (environment: production)
    └── Namespace: "org_abc123:ws_ghi789:feedback" (environment: production)

Organization: beta-inc (org_xyz000)
└── Workspace: engineering (ws_111222)
    └── Namespace: "org_xyz000:ws_111222:knowledge" (environment: production)

Benefits:
- ALL customers share 1 production index
- 25,000 namespace limit (Standard plan)
- 1 project × $50/month = $50/month minimum
- Savings: $7,450/month vs current approach!
- Simpler: 1 table instead of 2
```

---

## Namespace Naming Strategy

### Hierarchical Format

```
Format: "org_{orgId}:ws_{workspaceId}:store_{storeSlug}"

Examples:
- "org_acme123:ws_platform:store_docs"
- "org_acme123:ws_platform:store_ops"
- "org_beta456:ws_eng:store_knowledge"
```

**Why this format?**
1. **Organization isolation** - Easy to filter by org
2. **Workspace isolation** - Easy to filter by workspace
3. **Store identification** - Unique per store
4. **Human readable** - Easy to debug in Pinecone console
5. **Consistent** - Same pattern everywhere

### Sanitization Rules

```typescript
function sanitizeNamespaceName(
  organizationId: string,
  workspaceId: string,
  storeSlug: string
): string {
  // Remove special characters, enforce lowercase
  const sanitize = (s: string) =>
    s
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, "")
      .slice(0, 50); // Namespace max length safety

  return `org_${sanitize(organizationId)}:ws_${sanitize(workspaceId)}:store_${sanitize(storeSlug)}`;
}

// Examples
sanitizeNamespaceName("acme-corp", "platform-eng", "api-docs")
// → "org_acmecorp:ws_platformeng:store_apidocs"
```

---

## Schema Changes

### Simplified: Single Table

**Why only one table?**
- Shared indexes are **platform-level infrastructure** (only 2 rows: prod + staging)
- Better to manage via **application config** than database
- Simpler migrations, simpler queries, less complexity
- Database only tracks **user-created namespaces**, not platform resources

### New Table: `pinecone_namespaces`

**File:** `db/console/src/schema/tables/pinecone-namespaces.ts`

```typescript
/**
 * Pinecone Namespaces Table
 *
 * User-defined stores from lightfast.yml.
 * Each row represents a namespace within a shared Pinecone index.
 *
 * Shared index info lives in PRIVATE_CONFIG, not database.
 */
export const pineconeNamespaces = pgTable(
  "lightfast_pinecone_namespaces",
  {
    /** Unique identifier for the namespace record */
    id: varchar("id", { length: 191 }).primaryKey(),

    /** Organization + Workspace hierarchy */
    organizationId: varchar("organization_id", { length: 191 })
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),

    workspaceId: varchar("workspace_id", { length: 191 })
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),

    /** User-facing store name from lightfast.yml */
    storeSlug: varchar("store_slug", { length: 191 }).notNull(),

    /** Hierarchical namespace name */
    namespaceName: varchar("namespace_name", { length: 191 }).notNull(),
    // Format: "org_{orgId}:ws_{workspaceId}:store_{storeSlug}"

    /** Environment determines which shared index to use */
    environment: varchar("environment", { length: 50 })
      .notNull()
      .default("production"),
    // "production" → uses PRIVATE_CONFIG.pinecone.indexes.production
    // "staging" → uses PRIVATE_CONFIG.pinecone.indexes.staging

    /** Store-specific chunking config */
    chunkMaxTokens: integer("chunk_max_tokens").notNull(),
    chunkOverlap: integer("chunk_overlap").notNull(),

    /** Timestamps */
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => ({
    byOrganization: index("idx_pinecone_namespaces_org").on(t.organizationId),
    byWorkspace: index("idx_pinecone_namespaces_ws").on(t.workspaceId),
    byEnvironment: index("idx_pinecone_namespaces_env").on(t.environment),

    // Unique store per workspace
    uniqueStoreSlug: uniqueIndex("uq_pinecone_namespaces_ws_slug").on(
      t.workspaceId,
      t.storeSlug,
    ),

    // Unique namespace per environment
    uniqueNamespace: uniqueIndex("uq_pinecone_namespaces_env_name").on(
      t.environment,
      t.namespaceName,
    ),
  }),
);

export type PineconeNamespace = typeof pineconeNamespaces.$inferSelect;
export type InsertPineconeNamespace = typeof pineconeNamespaces.$inferInsert;
```

### Configuration: Shared Index Config

**File:** `packages/console-config/src/private-config.ts`

```typescript
export const PRIVATE_CONFIG = {
  // ... existing config

  pinecone: {
    // Shared indexes (platform-level resources)
    indexes: {
      production: {
        name: "lightfast-production-v1",
        embeddingDim: 1024,
        embeddingModel: "embed-english-v3.0",
        embeddingProvider: "cohere" as const,
      },
      staging: {
        name: "lightfast-staging-v1",
        embeddingDim: 1024,
        embeddingModel: "embed-english-v3.0",
        embeddingProvider: "cohere" as const,
      },
    },

    // Existing Pinecone config
    metric: "cosine" as const,
    cloud: "aws" as const,
    region: "us-east-1",
    deletionProtection: "enabled" as const,
  },
};

// Helper to get index config
export function getPineconeIndexConfig(environment: "production" | "staging") {
  return PRIVATE_CONFIG.pinecone.indexes[environment];
}
```

### Deprecate Old Table: `stores`

**File:** `db/console/src/schema/tables/stores.ts`

**Action:** Mark as deprecated, keep for backward compatibility during migration.

```typescript
/**
 * @deprecated Use pineconeNamespaces table instead
 *
 * Old architecture: one Pinecone index per store
 * This table will be removed after migration is complete.
 */
export const stores = pgTable("lightfast_stores", {
  // ... existing schema unchanged
});
```

### Update Related Tables

#### `db/console/src/schema/tables/docs-documents.ts`

```typescript
// BEFORE
export const docsDocuments = pgTable("lightfast_docs_documents", {
  storeId: varchar("store_id", { length: 191 })
    .notNull()
    .references(() => stores.id, { onDelete: "cascade" }),
  // ...
});

// AFTER
export const docsDocuments = pgTable("lightfast_docs_documents", {
  namespaceId: varchar("namespace_id", { length: 191 })
    .notNull()
    .references(() => pineconeNamespaces.id, { onDelete: "cascade" }),
  // ...
});
```

#### `db/console/src/schema/tables/vector-entries.ts`

```typescript
// BEFORE
export const vectorEntries = pgTable("lightfast_vector_entries", {
  storeId: varchar("store_id", { length: 191 }).notNull(),
  indexName: varchar("index_name", { length: 191 }).notNull(),
  // ...
});

// AFTER
export const vectorEntries = pgTable("lightfast_vector_entries", {
  namespaceId: varchar("namespace_id", { length: 191 })
    .notNull()
    .references(() => pineconeNamespaces.id, { onDelete: "cascade" }),

  // Environment determines index (via config lookup)
  environment: varchar("environment", { length: 50 })
    .notNull()
    .default("production"),
  // ...
});
```

#### `db/console/src/schema/tables/connected-repository.ts`

```typescript
// BEFORE
export const connectedRepositories = pgTable("lightfast_connected_repositories", {
  storeId: varchar("store_id", { length: 191 })
    .references(() => stores.id, { onDelete: "set null" }),
  // ...
});

// AFTER
export const connectedRepositories = pgTable("lightfast_connected_repositories", {
  namespaceId: varchar("namespace_id", { length: 191 })
    .references(() => pineconeNamespaces.id, { onDelete: "set null" }),
  // ...
});
```

---

## Migration Files

### Migration 1: Create `pinecone_namespaces` table

**File:** `db/console/src/migrations/0009_create_pinecone_namespaces.sql`

```sql
-- Create pinecone_namespaces table
CREATE TABLE lightfast_pinecone_namespaces (
  id VARCHAR(191) PRIMARY KEY,
  organization_id VARCHAR(191) NOT NULL,
  workspace_id VARCHAR(191) NOT NULL,
  store_slug VARCHAR(191) NOT NULL,
  namespace_name VARCHAR(191) NOT NULL,
  environment VARCHAR(50) NOT NULL DEFAULT 'production',
  chunk_max_tokens INT NOT NULL,
  chunk_overlap INT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

  CONSTRAINT fk_pinecone_namespaces_org
    FOREIGN KEY (organization_id)
    REFERENCES lightfast_organizations(id)
    ON DELETE CASCADE,

  CONSTRAINT fk_pinecone_namespaces_workspace
    FOREIGN KEY (workspace_id)
    REFERENCES lightfast_workspaces(id)
    ON DELETE CASCADE
);

-- Indexes
CREATE INDEX idx_pinecone_namespaces_org ON lightfast_pinecone_namespaces(organization_id);
CREATE INDEX idx_pinecone_namespaces_ws ON lightfast_pinecone_namespaces(workspace_id);
CREATE INDEX idx_pinecone_namespaces_env ON lightfast_pinecone_namespaces(environment);

CREATE UNIQUE INDEX uq_pinecone_namespaces_ws_slug
  ON lightfast_pinecone_namespaces(workspace_id, store_slug);

CREATE UNIQUE INDEX uq_pinecone_namespaces_env_name
  ON lightfast_pinecone_namespaces(environment, namespace_name);
```

### Migration 2: Data migration from `stores` to `namespaces`

**File:** `db/console/src/migrations/0010_migrate_stores_to_namespaces.sql`

```sql
-- Migrate existing stores to pinecone_namespaces
-- All existing stores use production environment

INSERT INTO lightfast_pinecone_namespaces (
  id,
  organization_id,
  workspace_id,
  store_slug,
  namespace_name,
  environment,
  chunk_max_tokens,
  chunk_overlap,
  created_at,
  updated_at
)
SELECT
  s.id,
  w.organization_id,
  s.workspace_id,
  s.slug,
  -- Generate hierarchical namespace name
  CONCAT(
    'org_', LOWER(REGEXP_REPLACE(w.organization_id, '[^a-z0-9]', '', 'g')),
    ':ws_', LOWER(REGEXP_REPLACE(s.workspace_id, '[^a-z0-9]', '', 'g')),
    ':store_', LOWER(REGEXP_REPLACE(s.slug, '[^a-z0-9]', '', 'g'))
  ),
  'production', -- All existing stores use production
  s.chunk_max_tokens,
  s.chunk_overlap,
  s.created_at,
  s.updated_at
FROM lightfast_stores s
JOIN lightfast_workspaces w ON s.workspace_id = w.id;

-- Add new columns to docs_documents
ALTER TABLE lightfast_docs_documents
  ADD COLUMN namespace_id VARCHAR(191);

-- Migrate data: storeId -> namespaceId
UPDATE lightfast_docs_documents
SET namespace_id = store_id;

-- Add new columns to vector_entries
ALTER TABLE lightfast_vector_entries
  ADD COLUMN namespace_id VARCHAR(191),
  ADD COLUMN environment VARCHAR(50) DEFAULT 'production';

-- Migrate data: storeId -> namespaceId
UPDATE lightfast_vector_entries
SET namespace_id = store_id;

-- Add new column to connected_repositories
ALTER TABLE lightfast_connected_repositories
  ADD COLUMN namespace_id VARCHAR(191);

-- Migrate data: storeId -> namespaceId
UPDATE lightfast_connected_repositories
SET namespace_id = store_id;

-- Add foreign key constraints (after data is populated)
ALTER TABLE lightfast_docs_documents
  ADD CONSTRAINT fk_docs_namespace
  FOREIGN KEY (namespace_id)
  REFERENCES lightfast_pinecone_namespaces(id)
  ON DELETE CASCADE;

ALTER TABLE lightfast_vector_entries
  ADD CONSTRAINT fk_vector_namespace
  FOREIGN KEY (namespace_id)
  REFERENCES lightfast_pinecone_namespaces(id)
  ON DELETE CASCADE;

ALTER TABLE lightfast_connected_repositories
  ADD CONSTRAINT fk_repo_namespace
  FOREIGN KEY (namespace_id)
  REFERENCES lightfast_pinecone_namespaces(id)
  ON DELETE SET NULL;

-- After verification, drop old columns (run this manually after testing):
-- ALTER TABLE lightfast_docs_documents DROP COLUMN store_id;
-- ALTER TABLE lightfast_vector_entries DROP COLUMN store_id;
-- ALTER TABLE lightfast_vector_entries DROP COLUMN index_name;
-- ALTER TABLE lightfast_connected_repositories DROP COLUMN store_id;
```

---

## Workflow Changes

### Simplified Workflow: `ensure-namespace.ts`

**File:** `api/console/src/inngest/workflow/infrastructure/ensure-namespace.ts`

```typescript
/**
 * Ensure Namespace Exists
 *
 * Idempotently provisions Pinecone namespace (store) within shared index.
 * Shared index config comes from PRIVATE_CONFIG, not database.
 */

import { inngest } from "../../client/client";
import { createInngestCaller } from "../../lib";
import { PRIVATE_CONFIG, getPineconeIndexConfig } from "@repo/console-config";
import { createConsolePineconeClient } from "@repo/console-pinecone";

export const ensureNamespace = inngest.createFunction(
  {
    id: "apps-console/namespace.ensure",
    name: "Ensure Namespace",
    retries: PRIVATE_CONFIG.workflow.ensureStore.retries,

    // Idempotency by workspace + store
    idempotency: 'event.data.workspaceId + "-" + event.data.storeSlug',

    timeouts: PRIVATE_CONFIG.workflow.ensureStore.timeout,
  },
  { event: "apps-console/namespace.ensure" },
  async ({ event, step }) => {
    const {
      organizationId,
      workspaceId,
      storeSlug,
      environment = "production",
    } = event.data;

    const trpc = await createInngestCaller();

    // Step 1: Check if namespace exists
    const existingNamespace = await step.run("check-namespace-exists", async () => {
      return await trpc.pineconeNamespaces.get({
        workspaceId,
        storeSlug,
      });
    });

    if (existingNamespace) {
      return { status: "exists", namespace: existingNamespace };
    }

    // Step 2: Get shared index config from PRIVATE_CONFIG
    const indexConfig = getPineconeIndexConfig(environment);

    // Step 3: Ensure shared Pinecone index exists (idempotent check)
    await step.run("ensure-pinecone-index", async () => {
      const pinecone = createConsolePineconeClient();
      const exists = await pinecone.indexExists(indexConfig.name);

      if (!exists) {
        // Create shared index
        await pinecone.createIndex(indexConfig.name, indexConfig.embeddingDim);

        // Configure index
        await pinecone.configureIndex(indexConfig.name, {
          deletionProtection: PRIVATE_CONFIG.pinecone.deletionProtection,
          tags: {
            environment,
            platform: "lightfast",
          },
        });
      }
    });

    // Step 4: Resolve hierarchical namespace name
    const namespaceName = await step.run("resolve-namespace-name", () => {
      return resolveNamespaceName(organizationId, workspaceId, storeSlug);
    });

    // Step 5: Create namespace record
    const namespace = await step.run("create-namespace-record", async () => {
      return await trpc.pineconeNamespaces.create({
        id: `${workspaceId}_${storeSlug}`,
        organizationId,
        workspaceId,
        storeSlug,
        namespaceName,
        environment,
        chunkMaxTokens: PRIVATE_CONFIG.chunking.maxTokens,
        chunkOverlap: PRIVATE_CONFIG.chunking.overlap,
      });
    });

    return { status: "created", namespace };
  }
);

/**
 * Resolve hierarchical namespace name
 * Format: "org_{orgId}:ws_{workspaceId}:store_{storeSlug}"
 */
function resolveNamespaceName(
  organizationId: string,
  workspaceId: string,
  storeSlug: string
): string {
  const sanitize = (s: string) =>
    s
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, "")
      .slice(0, 50); // Safety limit

  return `org_${sanitize(organizationId)}:ws_${sanitize(workspaceId)}:store_${sanitize(storeSlug)}`;
}
```

**Note:** No separate `ensure-pinecone-index` workflow needed! It's just an idempotent check within `ensure-namespace`.

### Update Event Types

**File:** `api/console/src/inngest/client/client.ts`

```typescript
export type Events = {
  // ... existing events

  // New: Ensure namespace (per store)
  "apps-console/namespace.ensure": {
    data: {
      organizationId: string;
      workspaceId: string;
      storeSlug: string;
      environment?: "production" | "staging";
    };
  };

  // Deprecate old event (keep for backward compatibility)
  /** @deprecated Use namespace.ensure instead */
  "apps-console/store.ensure": {
    data: {
      workspaceId: string;
      workspaceKey?: string;
      storeSlug: string;
      embeddingDim?: number;
    };
  };
};
```

---

## tRPC Router Changes

### New Router: `pineconeNamespaces`

**File:** `api/console/src/router/org/pinecone-namespaces.ts`

```typescript
import type { TRPCRouterRecord } from "@trpc/server";
import { protectedProcedure } from "../../trpc";
import { z } from "zod";
import { pineconeNamespaces } from "@db/console/schema";
import { eq, and } from "drizzle-orm";

export const pineconeNamespacesRouter = {
  /**
   * Get namespace by workspace + store slug
   */
  get: protectedProcedure
    .input(
      z.object({
        workspaceId: z.string(),
        storeSlug: z.string(),
      })
    )
    .query(async ({ ctx, input }) => {
      const namespace = await ctx.db
        .select()
        .from(pineconeNamespaces)
        .where(
          and(
            eq(pineconeNamespaces.workspaceId, input.workspaceId),
            eq(pineconeNamespaces.storeSlug, input.storeSlug)
          )
        )
        .limit(1);

      return namespace[0] ?? null;
    }),

  /**
   * Create namespace (for Inngest)
   */
  create: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        organizationId: z.string(),
        workspaceId: z.string(),
        storeSlug: z.string(),
        namespaceName: z.string(),
        environment: z.enum(["production", "staging"]).default("production"),
        chunkMaxTokens: z.number(),
        chunkOverlap: z.number(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [namespace] = await ctx.db
        .insert(pineconeNamespaces)
        .values(input)
        .onConflictDoNothing()
        .returning();

      if (!namespace) {
        const existing = await ctx.db
          .select()
          .from(pineconeNamespaces)
          .where(eq(pineconeNamespaces.id, input.id))
          .limit(1);

        return { created: false, namespace: existing[0]! };
      }

      return { created: true, namespace };
    }),

  /**
   * List namespaces by workspace
   */
  listByWorkspace: protectedProcedure
    .input(z.object({ workspaceId: z.string() }))
    .query(async ({ ctx, input }) => {
      return await ctx.db
        .select()
        .from(pineconeNamespaces)
        .where(eq(pineconeNamespaces.workspaceId, input.workspaceId));
    }),

  /**
   * List namespaces by organization
   */
  listByOrganization: protectedProcedure
    .input(z.object({ organizationId: z.string() }))
    .query(async ({ ctx, input }) => {
      return await ctx.db
        .select()
        .from(pineconeNamespaces)
        .where(eq(pineconeNamespaces.organizationId, input.organizationId));
    }),

  /**
   * Delete namespace
   */
  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Note: This only deletes the DB record
      // Pinecone namespace cleanup happens via workflow
      await ctx.db
        .delete(pineconeNamespaces)
        .where(eq(pineconeNamespaces.id, input.id));

      return { success: true };
    }),
} satisfies TRPCRouterRecord;
```

### Update Root Router

**File:** `api/console/src/root.ts`

```typescript
import { pineconeNamespacesRouter } from "./router/org/pinecone-namespaces";

export const appRouter = createTRPCRouter({
  // ... existing routers

  // New router
  pineconeNamespaces: pineconeNamespacesRouter,

  // Keep old router for backward compatibility (mark as deprecated)
  stores: storesRouter, // @deprecated - use pineconeNamespaces
});
```

---

## Pinecone Client Updates

### Update Namespace Operations

**File:** `packages/console-pinecone/src/index.ts`

```typescript
export class ConsolePineconeClient {
  // ... existing methods

  /**
   * Upsert vectors to specific namespace
   */
  async upsertToNamespace(
    indexName: string,
    namespace: string,
    vectors: Array<{ id: string; values: number[]; metadata?: object }>
  ): Promise<void> {
    const index = this.client.index(indexName);
    await index.namespace(namespace).upsert(vectors);
  }

  /**
   * Query vectors in specific namespace
   */
  async queryNamespace(
    indexName: string,
    namespace: string,
    vector: number[],
    topK: number,
    filter?: object
  ) {
    const index = this.client.index(indexName);
    return await index.namespace(namespace).query({
      vector,
      topK,
      filter,
      includeMetadata: true,
    });
  }

  /**
   * Delete all vectors in namespace
   * Note: This is instant and cheaper than deleting an index
   */
  async deleteNamespace(indexName: string, namespace: string): Promise<void> {
    const index = this.client.index(indexName);
    await index.namespace(namespace).deleteAll();
  }

  /**
   * Get namespace stats
   */
  async getNamespaceStats(indexName: string, namespace: string) {
    const index = this.client.index(indexName);
    const stats = await index.describeIndexStats();

    return {
      namespace,
      vectorCount: stats.namespaces?.[namespace]?.vectorCount ?? 0,
    };
  }

  /**
   * Delete specific vectors from namespace
   */
  async deleteFromNamespace(
    indexName: string,
    namespace: string,
    ids: string[]
  ): Promise<void> {
    const index = this.client.index(indexName);
    await index.namespace(namespace).deleteMany(ids);
  }
}
```

---

## Document Processing Updates

### Update Upsert Operations

**File:** `api/console/src/inngest/workflow/processing/process-documents.ts`

```typescript
// BEFORE
const { indexName } = store;
await pinecone.upsert(indexName, vectors);

// AFTER
const namespace = await trpc.pineconeNamespaces.get({
  workspaceId,
  storeSlug,
});

// Get index config from PRIVATE_CONFIG
const indexConfig = getPineconeIndexConfig(namespace.environment);

// Upsert to shared index with hierarchical namespace
await pinecone.upsertToNamespace(
  indexConfig.name, // e.g., "lightfast-production-v1"
  namespace.namespaceName, // e.g., "org_acme:ws_platform:store_docs"
  vectors
);
```

### Update Delete Operations

**File:** `api/console/src/inngest/workflow/processing/delete-documents.ts`

```typescript
// BEFORE
const { indexName } = store;
await pinecone.delete(indexName, vectorIds);

// AFTER
const namespace = await trpc.pineconeNamespaces.get({
  workspaceId,
  storeSlug,
});

// Get index config from PRIVATE_CONFIG
const indexConfig = getPineconeIndexConfig(namespace.environment);

// Delete from shared index with namespace
await pinecone.deleteFromNamespace(
  indexConfig.name,
  namespace.namespaceName,
  vectorIds
);
```

---

## GitHub Integration Updates

### Update Webhook Handler

**File:** `apps/console/src/app/(github)/api/github/webhooks/route.ts`

```typescript
// BEFORE
await inngest.send({
  name: "apps-console/store.ensure",
  data: {
    workspaceId,
    workspaceKey,
    storeSlug,
  },
});

// AFTER
await inngest.send({
  name: "apps-console/namespace.ensure",
  data: {
    organizationId: workspace.organizationId,
    workspaceId,
    storeSlug,
    environment: process.env.NODE_ENV === "production" ? "production" : "staging",
  },
});
```

### Update Setup Flow

**File:** `apps/console/src/app/(github)/api/github/setup/route.ts`

```typescript
// BEFORE
const store = await trpc.stores.getOrCreate({
  workspaceId,
  storeSlug
});

// AFTER
const namespace = await trpc.pineconeNamespaces.get({
  workspaceId,
  storeSlug,
});

if (!namespace) {
  // Trigger namespace creation workflow
  await inngest.send({
    name: "apps-console/namespace.ensure",
    data: {
      organizationId: workspace.organizationId,
      workspaceId,
      storeSlug,
    },
  });
}
```

---

## Cost Analysis

### Current Architecture (Per-Store Indexes)

```
Scenario: 1000 workspaces × 3 stores each = 3000 stores

Pinecone Limits:
- Standard plan: 20 indexes per project
- Need: 3000 indexes ÷ 20 = 150 projects

Cost Breakdown:
- 150 projects × $50/month minimum = $7,500/month
- Plus storage costs: 3000 stores × 10GB × $0.33/GB = $9,900/month
- Plus read/write costs (variable)

Total Minimum: $17,400/month
```

### New Architecture (Shared Index + Namespaces)

```
Scenario: Same 3000 stores

Pinecone Limits:
- Standard plan: 25,000 namespaces per index
- Need: 1 index for ALL 3000 stores

Cost Breakdown:
- 1 project × $50/month minimum = $50/month
- Plus storage costs: 3000 namespaces × 10GB × $0.33/GB = $9,900/month
- Plus read/write costs (same as before)

Total Minimum: $9,950/month

SAVINGS: $7,450/month in project minimums alone!
(42% total cost reduction)
```

### Scale Projections

```
At 10,000 stores:
- Current: Need 500 projects = $25,000/month minimums
- New: Need 1 project = $50/month minimum
- Savings: $24,950/month

At 25,000 stores (namespace limit):
- Current: Need 1,250 projects = $62,500/month minimums
- New: Need 1 project = $50/month minimum
- Savings: $62,450/month

At 50,000 stores:
- Current: Need 2,500 projects = $125,000/month minimums
- New: Need 2 projects = $100/month minimum (split into 2 indexes)
- Savings: $124,900/month
```

---

## Rollout Plan

### Phase 1: Infrastructure Setup (Week 1)

1. **Update config**
   - Add shared index config to `PRIVATE_CONFIG`
   - Test config access in staging

2. **Create new table**
   - Run migration 0009: Create `pinecone_namespaces`
   - Verify table creation in staging

3. **Bootstrap shared indexes**
   - Create production index: `lightfast-production-v1`
   - Create staging index: `lightfast-staging-v1`
   - Verify indexes in Pinecone console

4. **Deploy new workflow**
   - Deploy `ensure-namespace` workflow
   - Test in staging environment

### Phase 2: Data Migration (Week 2)

1. **Run data migration**
   - Run migration 0010: Migrate stores → namespaces
   - Verify all stores have namespace records
   - Verify hierarchical namespace names

2. **Dual-write period**
   - Update workflows to write to BOTH old and new tables
   - Monitor for data inconsistencies
   - Run reconciliation scripts daily

3. **Vector data migration**
   - For each old store index:
     - Read all vectors from old index
     - Upsert to shared index with new namespace
     - Verify vector count matches
   - This can run in background over time

### Phase 3: Read Migration (Week 3)

1. **Update query paths**
   - Change document processing to use namespaces
   - Update search queries to use shared index
   - Deploy gradually with feature flag

2. **Monitor performance**
   - Compare query latency (old vs new)
   - Monitor namespace isolation (no cross-contamination)
   - Check cost metrics

### Phase 4: Write Cutover (Week 4)

1. **Stop writing to old stores table**
   - Remove dual-write code
   - Only write to `pinecone_namespaces`
   - Monitor for errors

2. **Deprecate old indexes**
   - Mark old per-store indexes for deletion
   - Wait 7 days for safety period
   - Delete old indexes (recover storage costs)

### Phase 5: Cleanup (Week 5+)

1. **Drop old columns**
   - Remove `store_id` from `docs_documents`
   - Remove `store_id` and `index_name` from `vector_entries`
   - Remove `store_id` from `connected_repositories`

2. **Drop old table**
   - Drop `lightfast_stores` table
   - Remove deprecated code paths
   - Update documentation

---

## Backward Compatibility

### Deprecated API (Keep for 2-4 weeks)

```typescript
// Keep old store router working during transition
export const storesRouter = {
  getOrCreate: protectedProcedure
    .input(storeGetOrCreateInputSchema)
    .mutation(async ({ ctx, input }) => {
      console.warn("stores.getOrCreate is deprecated, use pineconeNamespaces.create");

      // Internally delegate to namespace creation
      const namespace = await ctx.db.transaction(async (tx) => {
        // Create namespace via new path
        // Return in old "store" format for compatibility
      });

      return namespace;
    }),
};
```

### Feature Flag for Gradual Rollout

```typescript
// packages/console-config/src/private-config.ts
export const PRIVATE_CONFIG = {
  // ... existing config

  pinecone: {
    useSharedIndex: process.env.PINECONE_USE_SHARED_INDEX === "true",
    // ... rest of config
  },
};

// In workflows, check flag:
if (PRIVATE_CONFIG.pinecone.useSharedIndex) {
  // Use new shared index + namespace path
} else {
  // Use old per-store index path
}
```

---

## Monitoring & Alerts

### Key Metrics

1. **Namespace count per environment**
   - Alert if approaching 25,000 limit
   - Dashboard showing namespace growth over time

2. **Query latency by namespace**
   - Compare hot vs cold namespaces
   - Alert on latency degradation

3. **Cross-namespace contamination**
   - Verify queries never return data from wrong namespace
   - Alert on any cross-contamination

4. **Cost tracking**
   - Storage cost per namespace
   - Read/write units per namespace
   - Total cost comparison (old vs new)

5. **Migration progress**
   - % of stores migrated to namespaces
   - % of vectors migrated to shared index
   - Estimated time to completion

### Sample Dashboard Queries

```typescript
// Namespace count per environment
SELECT
  environment,
  COUNT(id) as namespace_count
FROM lightfast_pinecone_namespaces
GROUP BY environment;

// Stores per organization
SELECT
  pn.organization_id,
  COUNT(pn.id) as store_count,
  SUM(ve.vector_count) as total_vectors
FROM lightfast_pinecone_namespaces pn
LEFT JOIN (
  SELECT namespace_id, COUNT(*) as vector_count
  FROM lightfast_vector_entries
  GROUP BY namespace_id
) ve ON pn.id = ve.namespace_id
GROUP BY pn.organization_id;
```

---

## Rollback Strategy

### If Migration Fails

1. **Stop new namespace creation**
   - Revert to old `ensure-store` workflow
   - Continue using per-store indexes for new stores

2. **Keep dual-write active**
   - Don't delete old `stores` table
   - Don't drop old columns
   - Both systems run in parallel

3. **Vector data is safe**
   - Old indexes still have all data
   - New shared index can be deleted
   - No data loss

4. **Database rollback**
   - Drop new table (`pinecone_namespaces`)
   - Remove new columns (`namespace_id`, `environment`)
   - Restore from backup if needed

---

## Real-World Examples

### Example 1: Notion's Architecture

From Pinecone case studies:
> "Notion leverages **thousands of namespaces** within a single index for cost-effectiveness at scale while ensuring isolation"

**Lesson:** Shared index + namespaces is battle-tested at massive scale.

### Example 2: Multi-Workspace Query

```typescript
// User searches across multiple workspaces
async function searchAcrossWorkspaces(
  organizationId: string,
  query: string
) {
  // Get all workspaces for org
  const workspaces = await getWorkspaces(organizationId);

  // Get all namespaces for these workspaces
  const namespaces = await db
    .select()
    .from(pineconeNamespaces)
    .where(eq(pineconeNamespaces.organizationId, organizationId));

  // Get shared index config
  const indexConfig = getPineconeIndexConfig("production");

  // Query each namespace in parallel
  const results = await Promise.all(
    namespaces.map(ns =>
      pinecone.queryNamespace(
        indexConfig.name,
        ns.namespaceName, // e.g., "org_acme:ws_platform:store_docs"
        embedQuery(query),
        10
      )
    )
  );

  // Merge and rerank results
  return mergeAndRerank(results);
}
```

---

## Security Considerations

### Namespace Isolation Guarantees

From Pinecone documentation:
> "In serverless architecture, each namespace is stored separately, ensuring **physical isolation**"
>
> "Queries and other operations are limited to one namespace, so different requests can search different subsets of your index"

**What this means:**
- ✅ Customer A CANNOT query Customer B's namespace
- ✅ Namespaces are stored in separate files on disk
- ✅ Query filtering happens at the infrastructure level
- ✅ No risk of data leakage between namespaces

### Access Control

```typescript
// Verify user has access to namespace before querying
async function queryWithAuth(
  userId: string,
  workspaceId: string,
  storeSlug: string,
  query: string
) {
  // 1. Verify user has access to workspace
  const hasAccess = await checkWorkspaceAccess(userId, workspaceId);
  if (!hasAccess) {
    throw new Error("Unauthorized");
  }

  // 2. Get namespace for this workspace + store
  const namespace = await trpc.pineconeNamespaces.get({
    workspaceId,
    storeSlug,
  });

  // 3. Query ONLY this namespace
  const indexConfig = getPineconeIndexConfig(namespace.environment);

  return await pinecone.queryNamespace(
    indexConfig.name,
    namespace.namespaceName,
    embedQuery(query),
    10
  );
}
```

---

## Questions & Answers

### Q: What happens if we hit the 25,000 namespace limit?

**A:** Two options:
1. **Upgrade to Enterprise plan** (100,000 namespaces per index)
2. **Create second shared index** (`lightfast-production-v1-b`)
   - Still way cheaper than per-store indexes
   - Split namespaces across indexes by organization
   - Update config:
   ```typescript
   indexes: {
     production: { name: "lightfast-production-v1" },
     production_b: { name: "lightfast-production-v1-b" },
   }
   ```

### Q: How do we handle embedding version migrations (v1 → v2)?

**A:** Create new shared index in config:
```typescript
indexes: {
  production: {
    name: "lightfast-production-v1",
    embeddingModel: "embed-english-v3.0"
  },
  production_v2: {
    name: "lightfast-production-v2",
    embeddingModel: "embed-multilingual-v4.0"
  },
}
```

Then create namespaces with `environment: "production_v2"` and migrate gradually.

### Q: What if a customer needs a different embedding dimension?

**A:** Add to config:
```typescript
indexes: {
  production: {
    name: "lightfast-production-v1",
    embeddingDim: 1024
  },
  production_1536: {
    name: "lightfast-production-v1-1536",
    embeddingDim: 1536
  },
}
```

Still better than per-store indexes!

### Q: How do we test namespace isolation?

**A:** Integration test:
```typescript
test("namespace isolation", async () => {
  // Create two namespaces
  const ns1 = "org_test1:ws_main:store_docs";
  const ns2 = "org_test2:ws_main:store_docs";

  const indexConfig = getPineconeIndexConfig("production");

  // Upsert to ns1
  await pinecone.upsertToNamespace(indexConfig.name, ns1, [
    { id: "doc1", values: [0.1, 0.2], metadata: { text: "secret1" } }
  ]);

  // Upsert to ns2
  await pinecone.upsertToNamespace(indexConfig.name, ns2, [
    { id: "doc2", values: [0.1, 0.2], metadata: { text: "secret2" } }
  ]);

  // Query ns1 - should NEVER see ns2 data
  const results = await pinecone.queryNamespace(
    indexConfig.name,
    ns1,
    [0.1, 0.2],
    10
  );

  expect(results.matches.every(m => m.id === "doc1")).toBe(true);
  expect(results.matches.every(m => m.metadata.text === "secret1")).toBe(true);
});
```

---

## Files to Create/Modify Summary

### New Files (3 total)
- `db/console/src/schema/tables/pinecone-namespaces.ts`
- `db/console/src/migrations/0009_create_pinecone_namespaces.sql`
- `db/console/src/migrations/0010_migrate_stores_to_namespaces.sql`

### Files to Modify (11 total)
- `db/console/src/schema/tables/stores.ts` (deprecate)
- `db/console/src/schema/tables/docs-documents.ts` (add `namespace_id`)
- `db/console/src/schema/tables/vector-entries.ts` (add `namespace_id`, `environment`)
- `db/console/src/schema/tables/connected-repository.ts` (add `namespace_id`)
- `db/console/src/schema/index.ts` (export new table)
- `packages/console-config/src/private-config.ts` (add shared index config)
- `api/console/src/router/org/pinecone-namespaces.ts` (new router)
- `api/console/src/root.ts` (add new router)
- `api/console/src/inngest/client/client.ts` (add new events)
- `api/console/src/inngest/workflow/infrastructure/ensure-namespace.ts` (simplified workflow)
- `api/console/src/inngest/workflow/processing/process-documents.ts` (use config)
- `apps/console/src/app/(github)/api/github/webhooks/route.ts` (new event)
- `packages/console-pinecone/src/index.ts` (add namespace methods)

### Files to Eventually Delete (2 total)
- `db/console/src/schema/tables/stores.ts` (after migration)
- `api/console/src/inngest/workflow/infrastructure/ensure-store.ts` (replaced)

---

## Key Simplifications from One-Table Approach

1. **No `pinecone_indexes` table** - Config-driven instead
2. **Simpler migrations** - Only 2 migration files vs 3
3. **Simpler workflows** - No separate index creation workflow
4. **Less complexity** - Fewer tables, fewer foreign keys
5. **Easier config updates** - Change index name without migration

---

## Next Steps

1. **Review this document** with engineering team
2. **Validate cost savings** with actual usage data
3. **Test namespace isolation** in staging
4. **Create migration runbook** with rollback steps
5. **Set up monitoring dashboards** for namespace metrics
6. **Schedule migration window** (low-traffic period)
7. **Communicate changes** to stakeholders

---

## References

- [Pinecone Multi-tenancy Guide](https://docs.pinecone.io/guides/index-data/implement-multitenancy)
- [Pinecone Serverless Architecture](https://www.pinecone.io/blog/serverless-architecture/)
- [Pinecone Namespace Documentation](https://docs.pinecone.io/guides/indexes/using-namespaces)
- [Pinecone Pricing & Limits](https://docs.pinecone.io/reference/quotas-and-limits)
- Internal: `SPEC.md` line 89 ("namespaced per workspace and embedding version")
