import { db } from "@db/app/client";
import { orgApiKeys } from "@db/app/schema";
import { generateOrgApiKey, hashApiKey } from "@repo/app-api-key";
import {
  createOrgApiKeySchema,
  deleteOrgApiKeySchema,
  revokeOrgApiKeySchema,
} from "@repo/app-validation/schemas";
import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import { log } from "@vendor/observability/log/next";
import { and, desc, eq } from "drizzle-orm";
import { orgScopedProcedure } from "../../trpc";

/**
 * Organization API Keys Router
 *
 * Manages org-scoped API keys for secure API access.
 * Each key authenticates the org and can access all resources within it.
 *
 * Security:
 * - Keys are hashed using SHA-256 before storage (never store plaintext)
 * - Full key is only returned once on creation (never again)
 * - Keys can be revoked (soft delete) or permanently deleted
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
      const keyHash = hashApiKey(key);

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
        log.error("[org-api-keys] create failed", {
          clerkOrgId: ctx.auth.orgId,
          name: input.name,
        });
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create API key",
        });
      }

      log.info("[org-api-keys] created", {
        clerkOrgId: ctx.auth.orgId,
        keyId: created.publicId,
        name: input.name,
      });

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

      log.info("[org-api-keys] revoked", {
        clerkOrgId: ctx.auth.orgId,
        keyId: input.keyId,
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

      await db.delete(orgApiKeys).where(eq(orgApiKeys.id, existingKey.id));

      log.info("[org-api-keys] deleted", {
        clerkOrgId: ctx.auth.orgId,
        keyId: input.keyId,
      });

      return { success: true };
    }),
} satisfies TRPCRouterRecord;
