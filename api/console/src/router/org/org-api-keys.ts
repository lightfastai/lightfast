import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import { db } from "@db/console/client";
import { orgApiKeys, orgWorkspaces } from "@db/console/schema";
import { eq, and, desc } from "drizzle-orm";
import {
  createOrgApiKeySchema,
  revokeOrgApiKeySchema,
  deleteOrgApiKeySchema,
  rotateOrgApiKeySchema,
  listOrgApiKeysSchema,
} from "@repo/console-validation/schemas";
import { generateOrgApiKey, hashApiKey } from "@repo/console-api-key";
import { recordCriticalActivity } from "../../lib/activity";

import { orgScopedProcedure } from "../../trpc";

/**
 * Organization API Keys Router
 *
 * Manages organization-scoped API keys for secure, isolated API access.
 * Each key is bound to a specific workspace, eliminating the security gap
 * where user-scoped keys could access any workspace via X-Workspace-ID header.
 *
 * Security:
 * - Keys are hashed using SHA-256 before storage (never store plaintext)
 * - Full key is only returned once on creation (never again)
 * - Keys can be revoked (soft delete) or permanently deleted
 * - Key rotation atomically revokes old key and creates new one
 * - All operations are tracked via recordCriticalActivity (Tier 1)
 */
export const orgApiKeysRouter = {
  /**
   * List all API keys for a workspace
   * Returns keys with preview only (never full key)
   */
  list: orgScopedProcedure
    .input(listOrgApiKeysSchema)
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

      const keys = await db.query.orgApiKeys.findMany({
        where: eq(orgApiKeys.workspaceId, input.workspaceId),
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
        orderBy: [desc(orgApiKeys.createdAt)],
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
   * Create a new organization API key
   * Returns the full key ONLY on creation (never again)
   */
  create: orgScopedProcedure
    .input(createOrgApiKeySchema)
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

      // Generate key with unified sk-lf- prefix
      const { key, prefix, suffix } = generateOrgApiKey();
      const keyHash = await hashApiKey(key);

      const [created] = await db
        .insert(orgApiKeys)
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
          id: orgApiKeys.id,
          publicId: orgApiKeys.publicId,
        });

      if (!created) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create API key",
        });
      }

      // Track API key creation (security-critical)
      await recordCriticalActivity({
        workspaceId: input.workspaceId,
        actorType: "user",
        actorUserId: ctx.auth.userId,
        category: "api_key",
        action: "apikey.created",
        entityType: "org_api_key",
        entityId: created.publicId,
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
   * Key remains in database but becomes inactive
   */
  revoke: orgScopedProcedure
    .input(revokeOrgApiKeySchema)
    .mutation(async ({ ctx, input }) => {
      // Find key
      const existingKey = await db.query.orgApiKeys.findFirst({
        where: eq(orgApiKeys.publicId, input.keyId),
        columns: {
          id: true,
          publicId: true,
          workspaceId: true,
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

      if (!existingKey.isActive) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "API key is already revoked",
        });
      }

      await db
        .update(orgApiKeys)
        .set({ isActive: false, updatedAt: new Date().toISOString() })
        .where(eq(orgApiKeys.id, existingKey.id));

      // Track API key revocation (security-critical)
      await recordCriticalActivity({
        workspaceId: existingKey.workspaceId,
        actorType: "user",
        actorUserId: ctx.auth.userId,
        category: "api_key",
        action: "apikey.revoked",
        entityType: "org_api_key",
        entityId: existingKey.publicId,
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
   * Key is removed from database entirely
   */
  delete: orgScopedProcedure
    .input(deleteOrgApiKeySchema)
    .mutation(async ({ ctx, input }) => {
      // Find key
      const existingKey = await db.query.orgApiKeys.findFirst({
        where: eq(orgApiKeys.publicId, input.keyId),
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
        .delete(orgApiKeys)
        .where(eq(orgApiKeys.id, existingKey.id));

      // Track API key deletion (security-critical)
      await recordCriticalActivity({
        workspaceId: existingKey.workspaceId,
        actorType: "user",
        actorUserId: ctx.auth.userId,
        category: "api_key",
        action: "apikey.deleted",
        entityType: "org_api_key",
        entityId: existingKey.publicId,
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
   * Returns the new full key ONLY on rotation (never again)
   */
  rotate: orgScopedProcedure
    .input(rotateOrgApiKeySchema)
    .mutation(async ({ ctx, input }) => {
      // Find existing key
      const existingKey = await db.query.orgApiKeys.findFirst({
        where: eq(orgApiKeys.publicId, input.keyId),
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

      // Generate new key with unified sk-lf- prefix
      const { key, prefix, suffix } = generateOrgApiKey();
      const keyHash = await hashApiKey(key);

      // Transaction: revoke old, create new
      const [newKey] = await db.transaction(async (tx) => {
        // Revoke old key
        await tx
          .update(orgApiKeys)
          .set({ isActive: false, updatedAt: new Date().toISOString() })
          .where(eq(orgApiKeys.id, existingKey.id));

        // Create new key
        return tx
          .insert(orgApiKeys)
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
            id: orgApiKeys.id,
            publicId: orgApiKeys.publicId,
          });
      });

      if (!newKey) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to rotate API key",
        });
      }

      // Track API key rotation (security-critical)
      await recordCriticalActivity({
        workspaceId: existingKey.workspaceId,
        actorType: "user",
        actorUserId: ctx.auth.userId,
        category: "api_key",
        action: "apikey.rotated",
        entityType: "org_api_key",
        entityId: newKey.publicId,
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
} satisfies TRPCRouterRecord;
