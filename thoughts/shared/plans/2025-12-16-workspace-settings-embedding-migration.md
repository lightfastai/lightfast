# Workspace Settings Embedding Migration Plan

## Overview

Migrate all embedding configuration from individual database columns to a versioned `settings` JSONB column. This consolidates 10 embedding-related columns into a structured `settings.embedding` object with automatic population on workspace creation.

## Current State Analysis

### Problem
- `indexName` and `namespaceName` columns are NEVER populated during workspace creation
- All workflows fail with "Workspace is missing embedding configuration" on new workspaces
- 10 separate columns for what should be a single configuration object

### Current Schema (`db/console/src/schema/tables/org-workspaces.ts:96-151`)
| Column | Default | Nullable | Status |
|--------|---------|----------|--------|
| `indexName` | NULL | Yes | **Never populated** |
| `namespaceName` | NULL | Yes | **Never populated** |
| `embeddingDim` | 1024 | No | Works |
| `embeddingModel` | "embed-english-v3.0" | No | Works |
| `embeddingProvider` | "cohere" | No | Works |
| `pineconeMetric` | "cosine" | No | Works |
| `pineconeCloud` | "aws" | No | Works |
| `pineconeRegion` | "us-east-1" | No | Works |
| `chunkMaxTokens` | 512 | No | Works |
| `chunkOverlap` | 50 | No | Works |

## Desired End State

### New Settings Schema
```typescript
interface WorkspaceSettingsV1 {
  version: 1;
  embedding: {
    indexName: string;           // "lightfast-v1"
    namespaceName: string;       // "{clerkOrgId}:ws_{workspaceId}"
    embeddingDim: number;        // 1024
    embeddingModel: string;      // "embed-english-v3.0"
    embeddingProvider: string;   // "cohere"
    pineconeMetric: string;      // "cosine"
    pineconeCloud: string;       // "aws"
    pineconeRegion: string;      // "us-east-1"
    chunkMaxTokens: number;      // 512
    chunkOverlap: number;        // 50
  };
  repositories?: Record<string, { enabled: boolean }>;
  defaults?: { patterns?: string[]; ignore?: string[] };
  features?: { codeIndexing?: boolean; multiLanguage?: boolean };
}
```

### Verification
- Workspace creation populates `settings` with full embedding config
- All workflows read from `settings.embedding.*`
- No embedding columns remain in schema
- `pnpm build:console && pnpm typecheck` passes

## What We're NOT Doing

- Backward compatibility with old column-based schema (not in prod)
- Gradual migration with fallback logic
- Keeping old columns for any transition period

## Implementation Approach

Single migration that:
1. Drops all 10 embedding columns
2. Updates TypeScript types and Zod schemas
3. Updates workspace creation to populate settings
4. Updates all workflows to read from settings

---

## Phase 1: Schema & Types

### Overview
Define the new versioned settings schema and update TypeScript types.

### Changes Required:

#### 1. Workspace Settings Zod Schema
**File**: `packages/console-types/src/workspace.ts`
**Changes**: Add versioned settings schema with embedding configuration

```typescript
import { z } from "zod";

/**
 * Embedding configuration within workspace settings
 */
export const workspaceEmbeddingConfigSchema = z.object({
  indexName: z.string().min(1),
  namespaceName: z.string().min(1),
  embeddingDim: z.number().int().positive().default(1024),
  embeddingModel: z.string().default("embed-english-v3.0"),
  embeddingProvider: z.string().default("cohere"),
  pineconeMetric: z.string().default("cosine"),
  pineconeCloud: z.string().default("aws"),
  pineconeRegion: z.string().default("us-east-1"),
  chunkMaxTokens: z.number().int().min(64).max(4096).default(512),
  chunkOverlap: z.number().int().min(0).max(1024).default(50),
});

export type WorkspaceEmbeddingConfig = z.infer<typeof workspaceEmbeddingConfigSchema>;

/**
 * Workspace settings schema V1
 *
 * Version field enables future schema migrations
 */
export const workspaceSettingsV1Schema = z.object({
  version: z.literal(1),
  embedding: workspaceEmbeddingConfigSchema,
  repositories: z
    .record(z.object({ enabled: z.boolean() }))
    .optional(),
  defaults: z
    .object({
      patterns: z.array(z.string()).optional(),
      ignore: z.array(z.string()).optional(),
    })
    .optional(),
  features: z
    .object({
      codeIndexing: z.boolean().optional(),
      multiLanguage: z.boolean().optional(),
    })
    .optional(),
});

export type WorkspaceSettingsV1 = z.infer<typeof workspaceSettingsV1Schema>;

/**
 * Current workspace settings type (alias for latest version)
 */
export const workspaceSettingsSchema = workspaceSettingsV1Schema;
export type WorkspaceSettings = WorkspaceSettingsV1;
```

#### 2. Database Schema
**File**: `db/console/src/schema/tables/org-workspaces.ts`
**Changes**: Remove all embedding columns, update settings type

```typescript
import { sql } from "drizzle-orm";
import {
  index,
  jsonb,
  pgTable,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";
import { nanoid } from "@repo/lib";
import type { ClerkOrgId } from "@repo/console-validation";
import type { WorkspaceSettings } from "@repo/console-types";

/**
 * Organization Workspaces table represents isolated knowledge bases within an organization.
 */
export const orgWorkspaces = pgTable(
  "lightfast_org_workspaces",
  {
    id: varchar("id", { length: 191 })
      .notNull()
      .primaryKey()
      .$defaultFn(() => nanoid()),

    clerkOrgId: varchar("clerk_org_id", { length: 191 })
      .notNull()
      .$type<ClerkOrgId>(),

    name: varchar("name", { length: 191 }).notNull(),

    slug: varchar("slug", { length: 191 }).notNull(),

    /**
     * Workspace settings and configuration (versioned)
     *
     * Structure (V1):
     * {
     *   version: 1,
     *   embedding: {
     *     indexName: "lightfast-v1",
     *     namespaceName: "{clerkOrgId}:ws_{workspaceId}",
     *     embeddingDim: 1024,
     *     embeddingModel: "embed-english-v3.0",
     *     embeddingProvider: "cohere",
     *     pineconeMetric: "cosine",
     *     pineconeCloud: "aws",
     *     pineconeRegion: "us-east-1",
     *     chunkMaxTokens: 512,
     *     chunkOverlap: 50,
     *   },
     *   repositories?: { [repoId]: { enabled: boolean } },
     *   defaults?: { patterns?: string[], ignore?: string[] },
     *   features?: { codeIndexing?: boolean, multiLanguage?: boolean }
     * }
     */
    settings: jsonb("settings").notNull().$type<WorkspaceSettings>(),

    createdAt: timestamp("created_at", { mode: "string", withTimezone: true })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),

    updatedAt: timestamp("updated_at", { mode: "string", withTimezone: true })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (table) => ({
    clerkOrgIdIdx: index("workspace_clerk_org_id_idx").on(table.clerkOrgId),
    orgNameIdx: uniqueIndex("workspace_org_name_idx").on(
      table.clerkOrgId,
      table.name,
    ),
    slugIdx: index("workspace_slug_idx").on(table.slug),
  }),
);

// Type exports
export type OrgWorkspace = typeof orgWorkspaces.$inferSelect;
export type InsertOrgWorkspace = typeof orgWorkspaces.$inferInsert;
```

#### 3. Remove Unused Type Imports
**File**: `db/console/src/schema/tables/org-workspaces.ts`
**Changes**: Remove imports for embedding types no longer needed

Remove these imports:
```typescript
// REMOVE:
import type {
  EmbeddingProvider,
  PineconeMetric,
  PineconeCloud,
  PineconeRegion,
  ChunkMaxTokens,
  ChunkOverlap,
  EmbeddingModel,
  PineconeIndexName,
} from "@repo/console-validation";
```

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compiles: `pnpm --filter @repo/console-types build`
- [x] Types export correctly: `pnpm --filter @db/console build`

---

## Phase 2: Workspace Creation

### Overview
Update workspace creation to generate and populate the full settings object including embedding configuration.

### Changes Required:

#### 1. Namespace Generation Helper
**File**: `db/console/src/utils/workspace.ts`
**Changes**: Add namespace generation function and settings builder

```typescript
import { db } from "../client";
import { orgWorkspaces } from "../schema";
import { generateRandomSlug } from "./workspace-names";
import { PRIVATE_CONFIG } from "@repo/console-config";
import type { WorkspaceSettings } from "@repo/console-types";

/**
 * Compute workspace key from slug
 */
export function getWorkspaceKey(slug: string): string {
  return `ws-${slug}`;
}

/**
 * Build Pinecone namespace for a workspace
 *
 * Format: {sanitizedClerkOrgId}:ws_{sanitizedWorkspaceId}
 * Example: "org_abc123:ws_xyz789"
 */
export function buildWorkspaceNamespace(
  clerkOrgId: string,
  workspaceId: string,
): string {
  const sanitize = (s: string) =>
    s.toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 50);
  return `${sanitize(clerkOrgId)}:ws_${sanitize(workspaceId)}`;
}

/**
 * Build default workspace settings with embedding configuration
 */
export function buildWorkspaceSettings(
  clerkOrgId: string,
  workspaceId: string,
): WorkspaceSettings {
  return {
    version: 1,
    embedding: {
      indexName: PRIVATE_CONFIG.pinecone.index.name,
      namespaceName: buildWorkspaceNamespace(clerkOrgId, workspaceId),
      embeddingDim: PRIVATE_CONFIG.pinecone.index.embeddingDim,
      embeddingModel: PRIVATE_CONFIG.pinecone.index.embeddingModel,
      embeddingProvider: PRIVATE_CONFIG.pinecone.index.embeddingProvider,
      pineconeMetric: PRIVATE_CONFIG.pinecone.metric,
      pineconeCloud: PRIVATE_CONFIG.pinecone.cloud,
      pineconeRegion: PRIVATE_CONFIG.pinecone.region,
      chunkMaxTokens: PRIVATE_CONFIG.chunking.maxTokens,
      chunkOverlap: PRIVATE_CONFIG.chunking.overlap,
    },
  };
}

/**
 * Create a workspace with user-provided name
 */
export async function createCustomWorkspace(
  clerkOrgId: string,
  name: string,
): Promise<string> {
  const slug = generateRandomSlug();

  return await db.transaction(async (tx) => {
    const { and, eq } = await import("drizzle-orm");

    const existing = await tx.query.orgWorkspaces.findFirst({
      where: and(
        eq(orgWorkspaces.clerkOrgId, clerkOrgId),
        eq(orgWorkspaces.name, name),
      ),
    });

    if (existing) {
      throw new Error(`Workspace with name "${name}" already exists`);
    }

    // Generate workspace ID first (needed for namespace)
    const workspaceId = (await import("@repo/lib")).nanoid();

    const [newWorkspace] = await tx
      .insert(orgWorkspaces)
      .values({
        id: workspaceId,
        clerkOrgId,
        name,
        slug,
        settings: buildWorkspaceSettings(clerkOrgId, workspaceId),
      })
      .returning({ id: orgWorkspaces.id });

    if (!newWorkspace) {
      throw new Error("Failed to create workspace");
    }

    return newWorkspace.id;
  });
}
```

### Success Criteria:

#### Automated Verification:
- [x] Build passes: `pnpm --filter @db/console build`
- [x] Types check: `pnpm --filter @db/console typecheck`

---

## Phase 3: Database Migration

### Overview
Generate and apply Drizzle migration to drop embedding columns.

### Changes Required:

#### 1. Generate Migration
**Directory**: `db/console/`
**Command**: `pnpm db:generate`

This will generate a migration that:
- Drops columns: `index_name`, `namespace_name`, `embedding_dim`, `embedding_model`, `embedding_provider`, `pinecone_metric`, `pinecone_cloud`, `pinecone_region`, `chunk_max_tokens`, `chunk_overlap`
- Makes `settings` column NOT NULL

#### 2. Apply Migration
**Command**: `pnpm db:migrate`

### Success Criteria:

#### Automated Verification:
- [x] Migration generates without errors
- [x] Migration applies cleanly
- [ ] Drizzle Studio shows updated schema: `pnpm db:studio`

---

## Phase 4: Workflow Updates

### Overview
Update all Inngest workflows to read embedding config from `settings.embedding`.

### Changes Required:

#### 1. Observation Capture Workflow
**File**: `api/console/src/inngest/workflow/neural/observation-capture.ts`
**Changes**: Read from settings, remove buildWorkspaceNamespace (use stored value)

**Lines 138-141**: Remove local `buildWorkspaceNamespace` function (now in db/console)

**Lines 389-403**: Update workspace validation
```typescript
const workspace = await step.run("fetch-context", async () => {
  const ws = await db.query.orgWorkspaces.findFirst({
    where: eq(orgWorkspaces.id, workspaceId),
  });

  if (!ws) {
    throw new NonRetriableError(`Workspace not found: ${workspaceId}`);
  }

  // Settings is always populated (NOT NULL with version check)
  if (ws.settings.version !== 1) {
    throw new NonRetriableError(`Workspace ${workspaceId} has invalid settings version`);
  }

  return ws;
});
```

**Lines 424-431**: Update embedding provider creation
```typescript
const embeddingProvider = createEmbeddingProviderForWorkspace(
  {
    id: workspace.id,
    embeddingModel: workspace.settings.embedding.embeddingModel,
    embeddingDim: workspace.settings.embedding.embeddingDim,
  },
  { inputType: "search_document" }
);
```

**Lines 522-525**: Use stored namespace
```typescript
const namespace = workspace.settings.embedding.namespaceName;
```

**Lines 565-581**: Use stored index name
```typescript
await consolePineconeClient.upsertVectors<ObservationVectorMetadata>(
  workspace.settings.embedding.indexName,
  // ... rest unchanged
  namespace
);
```

#### 2. Process Documents Workflow
**File**: `api/console/src/inngest/workflow/processing/process-documents.ts`

**Lines 98-107**: Update config hash computation
```typescript
function computeConfigHash(workspace: OrgWorkspace): string {
  const configData = JSON.stringify({
    embeddingModel: workspace.settings.embedding.embeddingModel,
    embeddingDim: workspace.settings.embedding.embeddingDim,
    chunkMaxTokens: workspace.settings.embedding.chunkMaxTokens,
    chunkOverlap: workspace.settings.embedding.chunkOverlap,
  });
  return createHash("sha256").update(configData).digest("hex");
}
```

**Lines 367-393**: Update workspace validation
```typescript
async function getWorkspace(
  cache: Map<string, OrgWorkspace>,
  workspaceId: string,
): Promise<OrgWorkspace> {
  if (cache.has(workspaceId)) {
    return cache.get(workspaceId)!;
  }

  const workspace = await db.query.orgWorkspaces.findFirst({
    where: eq(orgWorkspaces.id, workspaceId),
  });

  if (!workspace) {
    throw new Error(`Workspace not found: ${workspaceId}`);
  }

  if (workspace.settings.version !== 1) {
    throw new Error(`Workspace ${workspaceId} has invalid settings version`);
  }

  cache.set(workspaceId, workspace);
  return workspace;
}
```

**Lines 282-291**: Update embedding provider
```typescript
const embeddingProvider = createEmbeddingProviderForWorkspace(
  {
    id: firstDoc.workspace.id,
    embeddingModel: firstDoc.workspace.settings.embedding.embeddingModel,
    embeddingDim: firstDoc.workspace.settings.embedding.embeddingDim,
  },
  { inputType: "search_document" },
);
```

**Lines 519-527**: Update Pinecone upsert
```typescript
await pineconeClient.upsertVectors(
  workspace.settings.embedding.indexName,
  { ids, vectors, metadata },
  workspace.settings.embedding.namespaceName,
);
```

#### 3. Delete Documents Workflow
**File**: `api/console/src/inngest/workflow/processing/delete-documents.ts`

**Lines 72-88**: Update workspace validation
```typescript
const workspace = await db.query.orgWorkspaces.findFirst({
  where: eq(orgWorkspaces.id, workspaceId),
});

if (!workspace) {
  log.warn("Workspace not found", { workspaceId });
  return null;
}

if (workspace.settings.version !== 1) {
  log.warn("Workspace has invalid settings version", { workspaceId });
  return null;
}
```

**Lines 170-176**: Update Pinecone delete
```typescript
await pineconeClient.deleteByMetadata(
  workspace.settings.embedding.indexName,
  { docId: docInfo.docId },
  workspace.settings.embedding.namespaceName,
);
```

#### 4. Sync Orchestrator Workflow
**File**: `api/console/src/inngest/workflow/orchestration/sync-orchestrator.ts`

**Lines 153-165**: Update verification
```typescript
await step.run("verify-workspace-config", async () => {
  if (metadata.workspace.settings.version !== 1) {
    throw new NonRetriableError(
      `Workspace ${workspaceId} has invalid settings version.`
    );
  }
  logger.info("Workspace config verified", {
    indexName: metadata.workspace.settings.embedding.indexName,
    embeddingModel: metadata.workspace.settings.embedding.embeddingModel,
  });
});
```

#### 5. Search Router
**File**: `api/console/src/router/org/search.ts`

**Lines 78-79, 94-95**: Update to read from settings
```typescript
const indexName = workspace.settings.embedding.indexName;
const namespaceName = workspace.settings.embedding.namespaceName;
// ...
embeddingModel: workspace.settings.embedding.embeddingModel,
embeddingDim: workspace.settings.embedding.embeddingDim,
```

#### 6. Workspace Store Endpoint
**File**: `api/console/src/router/org/workspace.ts`

**Lines 645-676**: Update select and null check
```typescript
.select({
  id: orgWorkspaces.id,
  settings: orgWorkspaces.settings,
  // ... other fields
})
// ...
// Remove null check for indexName - settings is always populated
```

### Success Criteria:

#### Automated Verification:
- [x] All workflows compile: `pnpm --filter @api/console build`
- [x] Type checking passes: `pnpm --filter @api/console typecheck`
- [x] Lint passes: `pnpm lint`

---

## Phase 5: Full Build Verification

### Overview
Verify the entire application builds and type-checks correctly.

### Commands:
```bash
# Build all packages
pnpm build:console

# Type check everything
pnpm typecheck

# Lint
pnpm lint
```

### Success Criteria:

#### Automated Verification:
- [x] `pnpm --filter @api/console build` completes without errors
- [x] `pnpm typecheck` passes
- [x] `pnpm lint` passes

#### Manual Verification:
- [ ] Create a new workspace via UI - verify it succeeds
- [ ] Trigger an observation capture - verify it processes without "missing embedding configuration" error
- [ ] Run a search query - verify it returns results

---

## Testing Strategy

### Unit Tests:
- Verify `buildWorkspaceNamespace` generates correct format
- Verify `buildWorkspaceSettings` includes all required fields
- Verify settings schema validation rejects invalid data

### Integration Tests:
- Create workspace and verify settings populated
- Trigger observation capture workflow end-to-end
- Search workspace with indexed content

### Manual Testing Steps:
1. Start dev server: `pnpm dev:console`
2. Create new workspace via `/new` page
3. Connect a GitHub repo
4. Wait for initial sync to complete
5. Verify observations captured (check Inngest dashboard)
6. Run search query via UI

## Migration Notes

Since this is not in production:
- No data migration needed for existing workspaces
- Clean database reset acceptable
- If needed: `pnpm db:push` to force schema sync

## References

- Research document: `thoughts/shared/research/2025-12-16-workspace-embedding-config-population.md`
- Workspace schema: `db/console/src/schema/tables/org-workspaces.ts`
- Workspace creation: `db/console/src/utils/workspace.ts`
- Private config: `packages/console-config/src/private-config.ts`
- Observation capture: `api/console/src/inngest/workflow/neural/observation-capture.ts`
