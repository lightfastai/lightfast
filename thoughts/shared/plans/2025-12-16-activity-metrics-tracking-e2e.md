# Workspace API Keys & Activity Tracking End-to-End Implementation Plan

## Overview

This plan addresses the tracking gaps identified in `thoughts/shared/research/2025-12-15-database-activity-metrics-architecture-analysis.md`, **plus creates a proper workspace-scoped API key system**. The current `userApiKeys` table is user-scoped and the v1 auth (`withApiKeyAuth`) blindly trusts `X-Workspace-ID` headers - a security gap. This plan implements workspace-scoped API keys with proper access control, then adds comprehensive activity tracking.

## Current State Analysis

### Critical Security Gap

**Current Implementation**:
1. `userApiKeys` table stores user-scoped keys (tied to `userId`, no `workspaceId`)
2. `withApiKeyAuth` validates the key exists but **trusts `X-Workspace-ID` header blindly**
3. A user with a valid API key could access ANY workspace by passing different `X-Workspace-ID` values

**Evidence** (`apps/console/src/app/(api)/v1/lib/with-api-key-auth.ts:78-89`):
```typescript
// Current code trusts this header without validation!
const workspaceId = request.headers.get("x-workspace-id");
```

### What's Working

**Activity Recording System** (`api/console/src/lib/activity.ts`):
- **Tier 1** `recordCriticalActivity()` - Synchronous, 0% data loss - **0 usages**
- **Tier 2** `recordActivity()` - Queue-based via Inngest - **6 usages**
- **Tier 3** `recordSystemActivity()` - Fire-and-forget - **5 usages**

**Operations Metrics** (`api/console/src/lib/jobs.ts`):
- `recordJobMetric()` - Non-blocking metric recording - **3 usages**

## Desired End State

After implementation:
1. **Workspace-scoped API keys** with proper access control
2. **v1 routes validate workspace access** via key binding (no trusted headers)
3. All API key operations tracked via `recordCriticalActivity` (Tier 1)
4. All v1 API routes record `recordSystemActivity` with audit trail
5. Neural workflows emit `recordJobMetric` at key points

### Success Criteria Verification

```bash
# Verify workspace API keys table exists
psql -c "SELECT * FROM lightfast_workspace_api_keys LIMIT 1;"

# Verify auth validates workspace binding
curl -H "Authorization: Bearer sk_..." \
     -H "X-Workspace-ID: wrong_workspace" \
     https://api.lightfast.ai/v1/search
# Should return 403 Forbidden (not 200)

# Find files using recording functions
rg "recordCriticalActivity|recordActivity|recordSystemActivity" --type ts -c
```

## What We're NOT Doing

1. **NOT migrating existing user API keys** - Starting fresh with workspace keys
2. **NOT keeping user-level API key UI** - Will be replaced with workspace-scoped UI
3. **NOT adding BRIN/GIN indexes** - Deferred to post-PlanetScale migration
4. **NOT implementing dashboards** - Out of scope

## Implementation Approach

The implementation is organized by dependency order:
1. **Phase 0**: Workspace API Keys Infrastructure (foundation - fixes security gap)
2. **Phase 1**: Validation Schema Extensions (types for tracking)
3. **Phase 2**: API Key Activity Tracking (security audit trail)
4. **Phase 3**: OAuth/Integration Tracking (user actions)
5. **Phase 4**: v1 API Route Tracking (API audit trail)
6. **Phase 5**: Neural Workflow Metrics (performance monitoring)

Each phase is independently deployable and testable.

---

## Phase 0: Workspace API Keys Infrastructure

### Overview

Create a workspace-scoped API key system that replaces the insecure user-scoped implementation. Keys are bound to specific workspaces and validated during authentication.

### Changes Required

#### 0.1 Database Schema
**File**: `db/console/src/schema/tables/workspace-api-keys.ts` (NEW FILE)

```typescript
import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  pgTable,
  text,
  timestamp,
  varchar,
  bigint,
} from "drizzle-orm/pg-core";
import { nanoid } from "@repo/lib";
import { orgWorkspaces } from "./org-workspaces";

/**
 * Workspace API Keys table for workspace-scoped API authentication
 *
 * Workspace-scoped: Each key is bound to a specific workspace and can only
 * access that workspace's resources. This prevents the security gap where
 * user-scoped keys could access any workspace via X-Workspace-ID header.
 *
 * Design:
 * - Each workspace can have multiple API keys
 * - Keys are stored as hashed values (NEVER store plaintext)
 * - Display only last 4 characters of key to user
 * - Support key expiration and revocation
 * - Track last used timestamp for security auditing
 * - Track created by user for audit trail
 */
export const workspaceApiKeys = pgTable(
  "lightfast_workspace_api_keys",
  {
    /**
     * Unique API key identifier
     * Using BIGINT for high-volume table (consistent with Phase 5 migration)
     */
    id: bigint("id", { mode: "number" })
      .primaryKey()
      .generatedAlwaysAsIdentity(),

    /**
     * Public key ID for external reference (nanoid)
     * Used in API responses and URLs instead of exposing BIGINT
     */
    publicId: varchar("public_id", { length: 191 })
      .notNull()
      .unique()
      .$defaultFn(() => nanoid()),

    /**
     * Workspace this key belongs to (required, enforced FK)
     */
    workspaceId: varchar("workspace_id", { length: 191 })
      .notNull()
      .references(() => orgWorkspaces.id, { onDelete: "cascade" }),

    /**
     * Clerk Org ID for faster lookups (denormalized)
     */
    clerkOrgId: varchar("clerk_org_id", { length: 191 }).notNull(),

    /**
     * User who created this key (audit trail)
     */
    createdByUserId: varchar("created_by_user_id", { length: 191 }).notNull(),

    /**
     * User-provided name/description for the key
     * e.g., "Production API", "CI/CD Pipeline", "Development"
     */
    name: varchar("name", { length: 100 }).notNull(),

    /**
     * Hashed API key value (NEVER store plaintext)
     * Uses SHA-256 hashing
     */
    keyHash: text("key_hash").notNull(),

    /**
     * Key prefix for identification (e.g., "sk_live_")
     * Helps users identify key type without exposing full key
     */
    keyPrefix: varchar("key_prefix", { length: 20 }).notNull(),

    /**
     * Last 4 characters of the original key (for display purposes)
     */
    keySuffix: varchar("key_suffix", { length: 4 }).notNull(),

    /**
     * Whether this key is currently active
     * Allows soft deletion/revocation
     */
    isActive: boolean("is_active").notNull().default(true),

    /**
     * Optional expiration timestamp
     * If set, key becomes invalid after this time
     */
    expiresAt: timestamp("expires_at", {
      mode: "string",
      withTimezone: true,
    }),

    /**
     * Last time this key was used
     * Updated on each authenticated request
     */
    lastUsedAt: timestamp("last_used_at", {
      mode: "string",
      withTimezone: true,
    }),

    /**
     * IP address of last usage (for security auditing)
     */
    lastUsedFromIp: varchar("last_used_from_ip", { length: 45 }),

    /**
     * Timestamp when key was created
     */
    createdAt: timestamp("created_at", {
      mode: "string",
      withTimezone: true,
    })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),

    /**
     * Timestamp when key was last updated
     */
    updatedAt: timestamp("updated_at", {
      mode: "string",
      withTimezone: true,
    })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (table) => ({
    // Index for finding all keys for a workspace
    workspaceIdIdx: index("ws_api_key_workspace_id_idx").on(table.workspaceId),

    // Index for org-level queries
    clerkOrgIdIdx: index("ws_api_key_clerk_org_id_idx").on(table.clerkOrgId),

    // Index for efficient key validation (hash lookup)
    keyHashIdx: index("ws_api_key_hash_idx").on(table.keyHash),

    // Index for active keys lookup
    isActiveIdx: index("ws_api_key_is_active_idx").on(table.isActive),

    // Composite for workspace + active keys
    workspaceActiveIdx: index("ws_api_key_workspace_active_idx").on(
      table.workspaceId,
      table.isActive
    ),
  })
);

// Type exports
export type WorkspaceApiKey = typeof workspaceApiKeys.$inferSelect;
export type InsertWorkspaceApiKey = typeof workspaceApiKeys.$inferInsert;
```

**Update schema index** (`db/console/src/schema/tables/index.ts`):

```typescript
// Add export
export * from "./workspace-api-keys";
```

#### 0.2 Generate Migration

```bash
cd db/console
pnpm db:generate
pnpm db:migrate
```

#### 0.3 Validation Schema
**File**: `packages/console-validation/src/schemas/workspace-api-key.ts` (NEW FILE)

```typescript
import { z } from "zod";

/**
 * Workspace API Key Validation Schemas
 */

export const createWorkspaceApiKeySchema = z.object({
  workspaceId: z.string().min(1),
  name: z.string().min(1).max(100),
  expiresAt: z.coerce.date().optional(),
});

export const revokeWorkspaceApiKeySchema = z.object({
  keyId: z.string().min(1), // publicId
});

export const deleteWorkspaceApiKeySchema = z.object({
  keyId: z.string().min(1), // publicId
});

export const rotateWorkspaceApiKeySchema = z.object({
  keyId: z.string().min(1), // publicId
  expiresAt: z.coerce.date().optional(),
});

export const listWorkspaceApiKeysSchema = z.object({
  workspaceId: z.string().min(1),
});

export type CreateWorkspaceApiKey = z.infer<typeof createWorkspaceApiKeySchema>;
export type RevokeWorkspaceApiKey = z.infer<typeof revokeWorkspaceApiKeySchema>;
export type DeleteWorkspaceApiKey = z.infer<typeof deleteWorkspaceApiKeySchema>;
export type RotateWorkspaceApiKey = z.infer<typeof rotateWorkspaceApiKeySchema>;
export type ListWorkspaceApiKeys = z.infer<typeof listWorkspaceApiKeysSchema>;
```

**Update validation index** (`packages/console-validation/src/schemas/index.ts`):

```typescript
export * from "./workspace-api-key";
```

#### 0.4 tRPC Router
**File**: `api/console/src/router/org/workspace-api-keys.ts` (NEW FILE)

```typescript
import { TRPCError } from "@trpc/server";
import { eq, and, desc } from "@vendor/db";
import { db } from "@db/console/client";
import { workspaceApiKeys, orgWorkspaces } from "@db/console/schema";
import { orgProcedure, router } from "../../trpc";
import {
  createWorkspaceApiKeySchema,
  revokeWorkspaceApiKeySchema,
  deleteWorkspaceApiKeySchema,
  rotateWorkspaceApiKeySchema,
  listWorkspaceApiKeysSchema,
} from "@repo/console-validation/schemas";
import { generateApiKey, hashApiKey } from "@repo/console-api-key";
import { recordCriticalActivity } from "../../lib/activity";

export const workspaceApiKeysRouter = router({
  /**
   * List all API keys for a workspace
   */
  list: orgProcedure
    .input(listWorkspaceApiKeysSchema)
    .query(async ({ ctx, input }) => {
      // Verify workspace belongs to org
      const workspace = await db.query.orgWorkspaces.findFirst({
        where: and(
          eq(orgWorkspaces.id, input.workspaceId),
          eq(orgWorkspaces.clerkOrgId, ctx.auth.orgId)
        ),
        columns: { id: true },
      });

      if (!workspace) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Workspace not found",
        });
      }

      const keys = await db.query.workspaceApiKeys.findMany({
        where: eq(workspaceApiKeys.workspaceId, input.workspaceId),
        columns: {
          publicId: true,
          name: true,
          keyPrefix: true,
          keySuffix: true,
          isActive: true,
          expiresAt: true,
          lastUsedAt: true,
          createdAt: true,
          createdByUserId: true,
        },
        orderBy: [desc(workspaceApiKeys.createdAt)],
      });

      return keys.map((key) => ({
        id: key.publicId,
        name: key.name,
        keyPreview: `${key.keyPrefix}...${key.keySuffix}`,
        isActive: key.isActive,
        expiresAt: key.expiresAt,
        lastUsedAt: key.lastUsedAt,
        createdAt: key.createdAt,
        createdByUserId: key.createdByUserId,
      }));
    }),

  /**
   * Create a new workspace API key
   */
  create: orgProcedure
    .input(createWorkspaceApiKeySchema)
    .mutation(async ({ ctx, input }) => {
      // Verify workspace belongs to org
      const workspace = await db.query.orgWorkspaces.findFirst({
        where: and(
          eq(orgWorkspaces.id, input.workspaceId),
          eq(orgWorkspaces.clerkOrgId, ctx.auth.orgId)
        ),
        columns: { id: true, clerkOrgId: true },
      });

      if (!workspace) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Workspace not found",
        });
      }

      // Generate key with workspace prefix
      const { key, prefix, suffix } = generateApiKey("sk_live_");
      const keyHash = await hashApiKey(key);

      const [created] = await db
        .insert(workspaceApiKeys)
        .values({
          workspaceId: input.workspaceId,
          clerkOrgId: workspace.clerkOrgId,
          createdByUserId: ctx.auth.userId,
          name: input.name,
          keyHash,
          keyPrefix: prefix,
          keySuffix: suffix,
          expiresAt: input.expiresAt?.toISOString(),
        })
        .returning({
          id: workspaceApiKeys.id,
          publicId: workspaceApiKeys.publicId,
        });

      // Track API key creation (security-critical)
      await recordCriticalActivity({
        workspaceId: input.workspaceId,
        actorType: "user",
        actorUserId: ctx.auth.userId,
        category: "api_key",
        action: "apikey.created",
        entityType: "workspace_api_key",
        entityId: created.publicId,
        entityName: input.name,
        metadata: {
          keyId: created.publicId,
          keyName: input.name,
          keyPreview: `${prefix}...${suffix}`,
          expiresAt: input.expiresAt?.toISOString() ?? null,
        },
      });

      // Return the full key ONLY on creation (never again)
      return {
        id: created.publicId,
        key, // Full key - only returned once!
        name: input.name,
        keyPreview: `${prefix}...${suffix}`,
        expiresAt: input.expiresAt?.toISOString() ?? null,
        createdAt: new Date().toISOString(),
      };
    }),

  /**
   * Revoke (soft delete) an API key
   */
  revoke: orgProcedure
    .input(revokeWorkspaceApiKeySchema)
    .mutation(async ({ ctx, input }) => {
      // Find key and verify workspace ownership
      const existingKey = await db.query.workspaceApiKeys.findFirst({
        where: eq(workspaceApiKeys.publicId, input.keyId),
        columns: {
          id: true,
          publicId: true,
          workspaceId: true,
          name: true,
          keyPrefix: true,
          keySuffix: true,
          isActive: true,
        },
        with: {
          // We need to verify org ownership
        },
      });

      if (!existingKey) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "API key not found",
        });
      }

      // Verify workspace belongs to org
      const workspace = await db.query.orgWorkspaces.findFirst({
        where: and(
          eq(orgWorkspaces.id, existingKey.workspaceId),
          eq(orgWorkspaces.clerkOrgId, ctx.auth.orgId)
        ),
        columns: { id: true },
      });

      if (!workspace) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Access denied",
        });
      }

      if (!existingKey.isActive) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "API key is already revoked",
        });
      }

      await db
        .update(workspaceApiKeys)
        .set({ isActive: false, updatedAt: new Date().toISOString() })
        .where(eq(workspaceApiKeys.id, existingKey.id));

      // Track API key revocation (security-critical)
      await recordCriticalActivity({
        workspaceId: existingKey.workspaceId,
        actorType: "user",
        actorUserId: ctx.auth.userId,
        category: "api_key",
        action: "apikey.revoked",
        entityType: "workspace_api_key",
        entityId: existingKey.publicId,
        entityName: existingKey.name,
        metadata: {
          keyId: existingKey.publicId,
          keyName: existingKey.name,
          keyPreview: `${existingKey.keyPrefix}...${existingKey.keySuffix}`,
        },
      });

      return { success: true };
    }),

  /**
   * Permanently delete an API key
   */
  delete: orgProcedure
    .input(deleteWorkspaceApiKeySchema)
    .mutation(async ({ ctx, input }) => {
      // Find key
      const existingKey = await db.query.workspaceApiKeys.findFirst({
        where: eq(workspaceApiKeys.publicId, input.keyId),
        columns: {
          id: true,
          publicId: true,
          workspaceId: true,
          name: true,
          keyPrefix: true,
          keySuffix: true,
          createdAt: true,
        },
      });

      if (!existingKey) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "API key not found",
        });
      }

      // Verify workspace belongs to org
      const workspace = await db.query.orgWorkspaces.findFirst({
        where: and(
          eq(orgWorkspaces.id, existingKey.workspaceId),
          eq(orgWorkspaces.clerkOrgId, ctx.auth.orgId)
        ),
        columns: { id: true },
      });

      if (!workspace) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Access denied",
        });
      }

      await db
        .delete(workspaceApiKeys)
        .where(eq(workspaceApiKeys.id, existingKey.id));

      // Track API key deletion (security-critical)
      await recordCriticalActivity({
        workspaceId: existingKey.workspaceId,
        actorType: "user",
        actorUserId: ctx.auth.userId,
        category: "api_key",
        action: "apikey.deleted",
        entityType: "workspace_api_key",
        entityId: existingKey.publicId,
        entityName: existingKey.name,
        metadata: {
          keyId: existingKey.publicId,
          keyName: existingKey.name,
          keyPreview: `${existingKey.keyPrefix}...${existingKey.keySuffix}`,
          originallyCreatedAt: existingKey.createdAt,
        },
      });

      return { success: true };
    }),

  /**
   * Rotate an API key (revoke old, create new with same name)
   */
  rotate: orgProcedure
    .input(rotateWorkspaceApiKeySchema)
    .mutation(async ({ ctx, input }) => {
      // Find existing key
      const existingKey = await db.query.workspaceApiKeys.findFirst({
        where: eq(workspaceApiKeys.publicId, input.keyId),
        columns: {
          id: true,
          publicId: true,
          workspaceId: true,
          clerkOrgId: true,
          name: true,
          keyPrefix: true,
          keySuffix: true,
          isActive: true,
        },
      });

      if (!existingKey) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "API key not found",
        });
      }

      // Verify workspace belongs to org
      const workspace = await db.query.orgWorkspaces.findFirst({
        where: and(
          eq(orgWorkspaces.id, existingKey.workspaceId),
          eq(orgWorkspaces.clerkOrgId, ctx.auth.orgId)
        ),
        columns: { id: true },
      });

      if (!workspace) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Access denied",
        });
      }

      // Generate new key
      const { key, prefix, suffix } = generateApiKey("sk_live_");
      const keyHash = await hashApiKey(key);

      // Transaction: revoke old, create new
      const [newKey] = await db.transaction(async (tx) => {
        // Revoke old key
        await tx
          .update(workspaceApiKeys)
          .set({ isActive: false, updatedAt: new Date().toISOString() })
          .where(eq(workspaceApiKeys.id, existingKey.id));

        // Create new key
        return tx
          .insert(workspaceApiKeys)
          .values({
            workspaceId: existingKey.workspaceId,
            clerkOrgId: existingKey.clerkOrgId,
            createdByUserId: ctx.auth.userId,
            name: existingKey.name,
            keyHash,
            keyPrefix: prefix,
            keySuffix: suffix,
            expiresAt: input.expiresAt?.toISOString(),
          })
          .returning({
            id: workspaceApiKeys.id,
            publicId: workspaceApiKeys.publicId,
          });
      });

      // Track API key rotation (security-critical)
      await recordCriticalActivity({
        workspaceId: existingKey.workspaceId,
        actorType: "user",
        actorUserId: ctx.auth.userId,
        category: "api_key",
        action: "apikey.rotated",
        entityType: "workspace_api_key",
        entityId: newKey.publicId,
        entityName: existingKey.name,
        metadata: {
          oldKeyId: existingKey.publicId,
          newKeyId: newKey.publicId,
          keyName: existingKey.name,
          newKeyPreview: `${prefix}...${suffix}`,
        },
        relatedActivityId: existingKey.publicId,
      });

      return {
        id: newKey.publicId,
        key, // Full key - only returned once!
        name: existingKey.name,
        keyPreview: `${prefix}...${suffix}`,
        expiresAt: input.expiresAt?.toISOString() ?? null,
        createdAt: new Date().toISOString(),
      };
    }),
});
```

**Register router** (`api/console/src/router/org/index.ts`):

```typescript
import { workspaceApiKeysRouter } from "./workspace-api-keys";

// Add to orgRouter
workspaceApiKeys: workspaceApiKeysRouter,
```

#### 0.5 Update API Key Auth Middleware
**File**: `apps/console/src/app/(api)/v1/lib/with-api-key-auth.ts`

Replace the entire file:

```typescript
/**
 * API Key Authentication Middleware for v1 Routes
 *
 * SECURITY: Validates workspace-scoped API keys.
 * Keys are bound to specific workspaces - no more trusting X-Workspace-ID headers.
 */

import type { NextRequest } from "next/server";
import { db } from "@db/console/client";
import { workspaceApiKeys } from "@db/console/schema";
import { eq, and, sql } from "drizzle-orm";
import { hashApiKey } from "@repo/console-api-key";
import { log } from "@vendor/observability/log";

export interface ApiKeyAuthContext {
  workspaceId: string;
  userId: string; // createdByUserId for audit
  apiKeyId: string; // publicId
  clerkOrgId: string;
}

export interface AuthSuccess {
  success: true;
  auth: ApiKeyAuthContext;
}

export interface AuthError {
  success: false;
  error: {
    code: string;
    message: string;
  };
  status: number;
}

export type AuthResult = AuthSuccess | AuthError;

/**
 * Verify workspace-scoped API key
 *
 * Required headers:
 * - Authorization: Bearer <api-key>
 *
 * The workspace is determined by the key binding, NOT by X-Workspace-ID header.
 * This prevents unauthorized access to other workspaces.
 *
 * @returns AuthResult with workspace context from the key binding
 */
export async function withApiKeyAuth(
  request: NextRequest,
  requestId?: string
): Promise<AuthResult> {
  // 1. Extract Authorization header
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    log.warn("Missing or invalid Authorization header", { requestId });
    return {
      success: false,
      error: {
        code: "UNAUTHORIZED",
        message: "API key required. Provide 'Authorization: Bearer <api-key>' header.",
      },
      status: 401,
    };
  }

  const apiKey = authHeader.slice(7); // Remove "Bearer " prefix

  // 2. Validate key format (should start with sk_live_ or similar prefix)
  if (!apiKey.startsWith("sk_")) {
    log.warn("Invalid API key format", { requestId });
    return {
      success: false,
      error: {
        code: "UNAUTHORIZED",
        message: "Invalid API key format",
      },
      status: 401,
    };
  }

  // 3. Hash and verify API key
  try {
    const keyHash = await hashApiKey(apiKey);

    const [foundKey] = await db
      .select({
        id: workspaceApiKeys.id,
        publicId: workspaceApiKeys.publicId,
        workspaceId: workspaceApiKeys.workspaceId,
        clerkOrgId: workspaceApiKeys.clerkOrgId,
        createdByUserId: workspaceApiKeys.createdByUserId,
        isActive: workspaceApiKeys.isActive,
        expiresAt: workspaceApiKeys.expiresAt,
      })
      .from(workspaceApiKeys)
      .where(and(eq(workspaceApiKeys.keyHash, keyHash), eq(workspaceApiKeys.isActive, true)))
      .limit(1);

    if (!foundKey) {
      log.warn("Invalid API key", { requestId });
      return {
        success: false,
        error: {
          code: "UNAUTHORIZED",
          message: "Invalid API key",
        },
        status: 401,
      };
    }

    // 4. Check expiration
    if (foundKey.expiresAt && new Date(foundKey.expiresAt) < new Date()) {
      log.warn("Expired API key", { requestId, apiKeyId: foundKey.publicId });
      return {
        success: false,
        error: {
          code: "UNAUTHORIZED",
          message: "API key expired",
        },
        status: 401,
      };
    }

    // 5. Get client IP for tracking
    const clientIp =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      "unknown";

    // 6. Update last used timestamp and IP (non-blocking)
    void db
      .update(workspaceApiKeys)
      .set({
        lastUsedAt: sql`CURRENT_TIMESTAMP`,
        lastUsedFromIp: clientIp.substring(0, 45),
      })
      .where(eq(workspaceApiKeys.id, foundKey.id))
      .catch((err: unknown) => {
        log.error("Failed to update API key lastUsedAt", {
          error: err instanceof Error ? err.message : String(err),
          apiKeyId: foundKey.publicId,
        });
      });

    // 7. Log warning if X-Workspace-ID header doesn't match (for migration awareness)
    const headerWorkspaceId = request.headers.get("x-workspace-id");
    if (headerWorkspaceId && headerWorkspaceId !== foundKey.workspaceId) {
      log.warn("X-Workspace-ID header does not match key binding - header ignored", {
        requestId,
        headerWorkspaceId,
        keyWorkspaceId: foundKey.workspaceId,
        apiKeyId: foundKey.publicId,
      });
    }

    log.info("API key verified", {
      requestId,
      apiKeyId: foundKey.publicId,
      workspaceId: foundKey.workspaceId,
    });

    return {
      success: true,
      auth: {
        workspaceId: foundKey.workspaceId, // From key binding, NOT header!
        userId: foundKey.createdByUserId,
        apiKeyId: foundKey.publicId,
        clerkOrgId: foundKey.clerkOrgId,
      },
    };
  } catch (error) {
    log.error("API key verification failed", { requestId, error });
    return {
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "Authentication failed",
      },
      status: 500,
    };
  }
}

/**
 * Helper to create error response from AuthError
 */
export function createAuthErrorResponse(result: AuthError, requestId: string): Response {
  return Response.json(
    {
      error: result.error.code,
      message: result.error.message,
      requestId,
    },
    { status: result.status }
  );
}
```

#### 0.6 Update API Key Generation Utility
**File**: `packages/console-api-key/src/index.ts`

Add or update the `generateApiKey` function:

```typescript
import { nanoid } from "@repo/lib";
import { createHash } from "crypto";

/**
 * Generate a new API key with prefix
 *
 * @param prefix - Key prefix (e.g., "sk_live_", "sk_test_")
 * @returns Object with full key, prefix, and suffix (last 4 chars)
 */
export function generateApiKey(prefix: string = "sk_live_"): {
  key: string;
  prefix: string;
  suffix: string;
} {
  // Generate 32 character random string
  const randomPart = nanoid(32);
  const key = `${prefix}${randomPart}`;
  const suffix = randomPart.slice(-4);

  return {
    key,
    prefix,
    suffix,
  };
}

/**
 * Hash an API key for storage
 *
 * @param key - Full API key
 * @returns SHA-256 hash of the key
 */
export async function hashApiKey(key: string): Promise<string> {
  return createHash("sha256").update(key).digest("hex");
}
```

### Success Criteria

#### Automated Verification:
- [x] Migration generated: `cd db/console && pnpm db:generate`
- [x] Migration applied: `pnpm db:migrate`
- [x] TypeScript compilation: `pnpm --filter @api/console typecheck`
- [x] Build succeeds: `pnpm build:console`

#### Manual Verification:
- [ ] Create workspace API key via tRPC → key returned with full value
- [ ] List workspace API keys → shows keys with preview only
- [ ] Use key to call `/v1/search` → returns data for bound workspace
- [ ] Use key with wrong `X-Workspace-ID` header → still uses key's workspace (header ignored)
- [ ] Revoke key → subsequent API calls fail with 401
- [ ] Rotate key → old key fails, new key works

**Implementation Note**: After completing this phase, the security gap is closed. Proceed to Phase 1 for schema extensions.

---

## Phase 1: Validation Schema Extensions

### Overview
Add new activity types and metric types to the validation schemas. This is prerequisite for tracking in subsequent phases.

### Changes Required

#### 1. Activity Schema Extensions
**File**: `packages/console-validation/src/schemas/activities.ts`

**Add new metadata schemas** (after line 258):

```typescript
// ============================================================================
// API Key Activities
// ============================================================================

/**
 * Metadata for apikey.created action
 */
export const apiKeyCreatedMetadataSchema = z
  .object({
    keyId: z.string(),
    keyName: z.string(),
    keyPreview: z.string(), // e.g., "sk_live_...abc1"
    expiresAt: z.string().datetime().nullable(),
  })
  .passthrough();

/**
 * Metadata for apikey.revoked action
 */
export const apiKeyRevokedMetadataSchema = z
  .object({
    keyId: z.string(),
    keyName: z.string(),
    keyPreview: z.string(),
  })
  .passthrough();

/**
 * Metadata for apikey.deleted action
 */
export const apiKeyDeletedMetadataSchema = z
  .object({
    keyId: z.string(),
    keyName: z.string(),
    keyPreview: z.string(),
    originallyCreatedAt: z.string().datetime(),
  })
  .passthrough();

/**
 * Metadata for apikey.rotated action
 */
export const apiKeyRotatedMetadataSchema = z
  .object({
    oldKeyId: z.string(),
    newKeyId: z.string(),
    keyName: z.string(),
    newKeyPreview: z.string(),
  })
  .passthrough();

// ============================================================================
// Search Activities (v1 API)
// ============================================================================

/**
 * Metadata for search.query action
 */
export const searchQueryMetadataSchema = z
  .object({
    query: z.string(),
    limit: z.number(),
    offset: z.number(),
    mode: z.enum(["fast", "balanced", "thorough"]),
    hasFilters: z.boolean(),
    resultCount: z.number(),
    totalMatches: z.number(),
    latencyMs: z.number(),
    authType: z.enum(["api-key", "session"]),
    apiKeyId: z.string().optional(),
  })
  .passthrough();

/**
 * Metadata for search.findsimilar action
 */
export const searchFindSimilarMetadataSchema = z
  .object({
    sourceId: z.string(),
    sourceType: z.string(),
    inputMethod: z.enum(["id", "url"]),
    limit: z.number(),
    threshold: z.number(),
    similarCount: z.number(),
    latencyMs: z.number(),
    authType: z.enum(["api-key", "session"]),
    apiKeyId: z.string().optional(),
  })
  .passthrough();

/**
 * Metadata for search.contents action
 */
export const searchContentsMetadataSchema = z
  .object({
    requestedCount: z.number(),
    foundCount: z.number(),
    missingCount: z.number(),
    latencyMs: z.number(),
    authType: z.enum(["api-key", "session"]),
    apiKeyId: z.string().optional(),
  })
  .passthrough();
```

**Add corresponding activity schemas** (before the discriminated union):

```typescript
// API Key Activity Schemas
export const apiKeyCreatedActivitySchema = z.object({
  category: z.literal("api_key"),
  action: z.literal("apikey.created"),
  metadata: apiKeyCreatedMetadataSchema,
});

export const apiKeyRevokedActivitySchema = z.object({
  category: z.literal("api_key"),
  action: z.literal("apikey.revoked"),
  metadata: apiKeyRevokedMetadataSchema,
});

export const apiKeyDeletedActivitySchema = z.object({
  category: z.literal("api_key"),
  action: z.literal("apikey.deleted"),
  metadata: apiKeyDeletedMetadataSchema,
});

export const apiKeyRotatedActivitySchema = z.object({
  category: z.literal("api_key"),
  action: z.literal("apikey.rotated"),
  metadata: apiKeyRotatedMetadataSchema,
});

// Search Activity Schemas
export const searchQueryActivitySchema = z.object({
  category: z.literal("search"),
  action: z.literal("search.query"),
  metadata: searchQueryMetadataSchema,
});

export const searchFindSimilarActivitySchema = z.object({
  category: z.literal("search"),
  action: z.literal("search.findsimilar"),
  metadata: searchFindSimilarMetadataSchema,
});

export const searchContentsActivitySchema = z.object({
  category: z.literal("search"),
  action: z.literal("search.contents"),
  metadata: searchContentsMetadataSchema,
});
```

**Update discriminated union** to include new schemas:

```typescript
export const activityTypeSchema = z.discriminatedUnion("action", [
  // Existing schemas...
  workspaceCreatedActivitySchema,
  workspaceUpdatedActivitySchema,
  integrationConnectedActivitySchema,
  integrationStatusUpdatedActivitySchema,
  integrationConfigUpdatedActivitySchema,
  integrationDisconnectedActivitySchema,
  integrationDeletedActivitySchema,
  integrationMetadataUpdatedActivitySchema,
  storeCreatedActivitySchema,
  jobCancelledActivitySchema,
  jobRestartedActivitySchema,
  // New - API Keys
  apiKeyCreatedActivitySchema,
  apiKeyRevokedActivitySchema,
  apiKeyDeletedActivitySchema,
  apiKeyRotatedActivitySchema,
  // New - Search
  searchQueryActivitySchema,
  searchFindSimilarActivitySchema,
  searchContentsActivitySchema,
]);
```

**Add type exports**:

```typescript
// API Key Metadata Types
export type ApiKeyCreatedMetadata = z.infer<typeof apiKeyCreatedMetadataSchema>;
export type ApiKeyRevokedMetadata = z.infer<typeof apiKeyRevokedMetadataSchema>;
export type ApiKeyDeletedMetadata = z.infer<typeof apiKeyDeletedMetadataSchema>;
export type ApiKeyRotatedMetadata = z.infer<typeof apiKeyRotatedMetadataSchema>;

// Search Metadata Types
export type SearchQueryMetadata = z.infer<typeof searchQueryMetadataSchema>;
export type SearchFindSimilarMetadata = z.infer<typeof searchFindSimilarMetadataSchema>;
export type SearchContentsMetadata = z.infer<typeof searchContentsMetadataSchema>;
```

#### 2. Metrics Schema Extensions
**File**: `packages/console-validation/src/schemas/metrics.ts`

**Update metric type enum**:

```typescript
export const operationMetricTypeSchema = z.enum([
  "job_duration",
  "documents_indexed",
  "errors",
  // Neural workflow metrics
  "observation_captured",
  "observation_filtered",
  "observation_duplicate",
  "observation_below_threshold",
  "entities_extracted",
  "cluster_assigned",
  "cluster_summary_generated",
  "profile_updated",
]);
```

**Add neural metric tag and schema definitions** (see original Phase 1 content for full details).

### Success Criteria

#### Automated Verification:
- [x] TypeScript compilation: `pnpm --filter @repo/console-validation typecheck`
- [x] Build succeeds: `pnpm --filter @repo/console-validation build`

---

## Phase 2: v1 API Route Tracking

### Overview
Add `recordSystemActivity` to all v1 API routes. Note: API key tracking is already included in Phase 0's router.

### Changes Required

#### 1. Search Route
**File**: `apps/console/src/app/(api)/v1/search/route.ts`

**Add import**:

```typescript
import { recordSystemActivity } from "@api/console/lib/activity";
```

**Add tracking before return** (before `return NextResponse.json(response)`):

```typescript
// Track search query (Tier 3 - fire-and-forget for low latency)
recordSystemActivity({
  workspaceId,
  actorType: authType === "api-key" ? "api" : "user",
  actorUserId: userId,
  category: "search",
  action: "search.query",
  entityType: "search_query",
  entityId: requestId,
  metadata: {
    query: query.substring(0, 200), // Truncate for storage
    limit,
    offset,
    mode,
    hasFilters: filters !== undefined,
    resultCount: results.length,
    totalMatches: searchResult.total,
    latencyMs: response.latency.total,
    authType,
    apiKeyId: apiKeyId ?? undefined,
  },
  requestId,
});
```

#### 2. FindSimilar Route
**File**: `apps/console/src/app/(api)/v1/findsimilar/route.ts`

Similar pattern - add tracking before return.

#### 3. Contents Route
**File**: `apps/console/src/app/(api)/v1/contents/route.ts`

Similar pattern - add tracking before return.

### Success Criteria

#### Automated Verification:
- [x] TypeScript compilation: `pnpm build:console`
- [ ] Lint passes: `pnpm --filter @lightfast/console lint`

#### Manual Verification:
- [ ] Call `/v1/search` with API key → activity appears with `actorType: "api"`
- [ ] Call `/v1/search` with session → activity appears with `actorType: "user"`

---

## Phase 3-5: Remaining Tracking

Phases 3-5 remain largely the same as the original plan:
- **Phase 3**: OAuth & Integration Tracking
- **Phase 4**: Neural Workflow Metrics

See original plan content for detailed implementation.

---

## Testing Strategy

### End-to-End Security Test

```bash
# 1. Create workspace API key
KEY=$(curl -X POST .../trpc/org.workspaceApiKeys.create -d '{"workspaceId":"ws_123","name":"Test"}' | jq -r '.key')

# 2. Use key to access correct workspace
curl -H "Authorization: Bearer $KEY" https://api.lightfast.ai/v1/search -d '{"query":"test"}'
# Should succeed

# 3. Try to access different workspace (should fail or be ignored)
curl -H "Authorization: Bearer $KEY" -H "X-Workspace-ID: ws_other" https://api.lightfast.ai/v1/search -d '{"query":"test"}'
# Should still use ws_123 (header ignored), NOT ws_other

# 4. Revoke key
curl -X POST .../trpc/org.workspaceApiKeys.revoke -d '{"keyId":"..."}'

# 5. Verify key no longer works
curl -H "Authorization: Bearer $KEY" https://api.lightfast.ai/v1/search -d '{"query":"test"}'
# Should return 401 Unauthorized
```

### Activity Verification

```sql
-- Verify API key activities are tracked
SELECT * FROM lightfast_workspace_user_activities
WHERE category = 'api_key'
ORDER BY timestamp DESC LIMIT 10;

-- Verify search activities include apiKeyId
SELECT * FROM lightfast_workspace_user_activities
WHERE category = 'search' AND metadata->>'apiKeyId' IS NOT NULL
ORDER BY timestamp DESC LIMIT 10;
```

## References

- Original research: `thoughts/shared/research/2025-12-15-database-activity-metrics-architecture-analysis.md`
- Current insecure auth: `apps/console/src/app/(api)/v1/lib/with-api-key-auth.ts`
- User API keys (to be replaced): `db/console/src/schema/tables/user-api-keys.ts`
