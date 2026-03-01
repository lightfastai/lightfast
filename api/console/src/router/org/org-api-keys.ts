import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import { db } from "@db/console/client";
import { orgApiKeys } from "@db/console/schema";
import { eq, and, desc } from "drizzle-orm";
import {
  createOrgApiKeySchema,
  revokeOrgApiKeySchema,
  deleteOrgApiKeySchema,
  rotateOrgApiKeySchema,
} from "@repo/console-validation/schemas";
import { generateOrgApiKey, hashApiKey } from "@repo/console-api-key";

import { orgScopedProcedure } from "../../trpc";

/**
 * Organization API Keys Router
 *
 * Manages org-scoped API keys for secure API access.
 * Each key authenticates the org and can access all workspaces within it.
 * Workspace context moves to request-level input (body params).
 *
 * Security:
 * - Keys are hashed using SHA-256 before storage (never store plaintext)
 * - Full key is only returned once on creation (never again)
 * - Keys can be revoked (soft delete) or permanently deleted
 * - Key rotation atomically revokes old key and creates new one
 */
export const orgApiKeysRouter = {
  /**
   * List all API keys for the org
   * Returns keys with preview only (never full key)
   */
  list: orgScopedProcedure.query(async ({ ctx }) => {
    const keys = await db
      .select({
        publicId: orgApiKeys.publicId,
        name: orgApiKeys.name,
        keyPrefix: orgApiKeys.keyPrefix,
        keySuffix: orgApiKeys.keySuffix,
        isActive: orgApiKeys.isActive,
        expiresAt: orgApiKeys.expiresAt,
        lastUsedAt: orgApiKeys.lastUsedAt,
        createdAt: orgApiKeys.createdAt,
        createdByUserId: orgApiKeys.createdByUserId,
      })
      .from(orgApiKeys)
      .where(eq(orgApiKeys.clerkOrgId, ctx.auth.orgId))
      .orderBy(desc(orgApiKeys.createdAt));

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
      const { key, prefix, suffix } = generateOrgApiKey();
      const keyHash = await hashApiKey(key);

      const [created] = await db
        .insert(orgApiKeys)
        .values({
          clerkOrgId: ctx.auth.orgId,
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
      const [existingKey] = await db
        .select({
          id: orgApiKeys.id,
          isActive: orgApiKeys.isActive,
        })
        .from(orgApiKeys)
        .where(
          and(
            eq(orgApiKeys.publicId, input.keyId),
            eq(orgApiKeys.clerkOrgId, ctx.auth.orgId)
          )
        )
        .limit(1);

      if (!existingKey) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "API key not found",
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

      return { success: true };
    }),

  /**
   * Permanently delete an API key
   * Key is removed from database entirely
   */
  delete: orgScopedProcedure
    .input(deleteOrgApiKeySchema)
    .mutation(async ({ ctx, input }) => {
      const [existingKey] = await db
        .select({ id: orgApiKeys.id })
        .from(orgApiKeys)
        .where(
          and(
            eq(orgApiKeys.publicId, input.keyId),
            eq(orgApiKeys.clerkOrgId, ctx.auth.orgId)
          )
        )
        .limit(1);

      if (!existingKey) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "API key not found",
        });
      }

      await db
        .delete(orgApiKeys)
        .where(eq(orgApiKeys.id, existingKey.id));

      return { success: true };
    }),

  /**
   * Rotate an API key (revoke old, create new with same name)
   * Returns the new full key ONLY on rotation (never again)
   */
  rotate: orgScopedProcedure
    .input(rotateOrgApiKeySchema)
    .mutation(async ({ ctx, input }) => {
      const [existingKey] = await db
        .select({
          id: orgApiKeys.id,
          name: orgApiKeys.name,
          isActive: orgApiKeys.isActive,
        })
        .from(orgApiKeys)
        .where(
          and(
            eq(orgApiKeys.publicId, input.keyId),
            eq(orgApiKeys.clerkOrgId, ctx.auth.orgId)
          )
        )
        .limit(1);

      if (!existingKey) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "API key not found",
        });
      }

      const { key, prefix, suffix } = generateOrgApiKey();
      const keyHash = await hashApiKey(key);

      // Batch: revoke old, create new (atomic — neon-http doesn't support transactions)
      const [, insertResult] = await db.batch([
        // Revoke old key
        db
          .update(orgApiKeys)
          .set({ isActive: false, updatedAt: new Date().toISOString() })
          .where(eq(orgApiKeys.id, existingKey.id)),
        // Create new key
        db
          .insert(orgApiKeys)
          .values({
            clerkOrgId: ctx.auth.orgId,
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
          }),
      ] as const);

      const [newKey] = insertResult;

      if (!newKey) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to rotate API key",
        });
      }

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
