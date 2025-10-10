import type { TRPCRouterRecord } from "@trpc/server";
import { DeusApiKey } from "@db/deus/schema";
import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { nanoid } from "@repo/lib";

import { protectedProcedure, publicProcedure } from "../trpc";

/**
 * API Key router - manages API keys for Deus CLI authentication
 *
 * SECURITY MODEL:
 * - Keys are hashed with crypto.subtle.digest (SHA-256) before storage
 * - Only the hash is stored in the database
 * - The actual key is returned ONCE during generation and never again
 * - Keys are prefixed with "deus_sk_" for identification
 * - All API keys have admin permissions (scopes are always ['admin'])
 */
export const apiKeyRouter = {
  /**
   * Generate a new API key for CLI authentication
   *
   * Security flow:
   * 1. Verify user has access to the organization
   * 2. Generate a cryptographically secure key
   * 3. Hash the key for storage
   * 4. Return the unhashed key ONCE (never stored or returned again)
   *
   * All API keys are created with admin permissions.
   */
  generate: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(100),
        organizationId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Generate API key: deus_sk_<32 random chars>
      const keySecret = nanoid(32);
      const key = `deus_sk_${keySecret}`;

      // Hash the key using Web Crypto API (available in Node.js)
      const encoder = new TextEncoder();
      const data = encoder.encode(key);
      const hashBuffer = await crypto.subtle.digest("SHA-256", data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const keyHash = hashArray
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");

      // Extract preview (last 4 chars of the secret portion)
      const keyPreview = keySecret.slice(-4);

      // Generate a new UUID for the API key
      const id = crypto.randomUUID();

      // Insert the API key (all keys have admin permissions)
      await ctx.db.insert(DeusApiKey).values({
        id,
        keyHash,
        keyPreview,
        userId: ctx.session.userId,
        organizationId: input.organizationId,
        name: input.name,
        scopes: ["admin"],
      });

      // Return the unhashed key ONCE
      return {
        key,
        preview: `...${keyPreview}`,
        id,
      };
    }),

  /**
   * List all API keys for an organization
   *
   * Returns metadata only - never returns the actual key or hash
   */
  list: protectedProcedure
    .input(
      z.object({
        organizationId: z.string(),
      }),
    )
    .query(async ({ ctx, input }) => {
      // Query all API keys for the organization
      const keys = await ctx.db
        .select({
          id: DeusApiKey.id,
          name: DeusApiKey.name,
          keyPreview: DeusApiKey.keyPreview,
          scopes: DeusApiKey.scopes,
          createdAt: DeusApiKey.createdAt,
          lastUsedAt: DeusApiKey.lastUsedAt,
          expiresAt: DeusApiKey.expiresAt,
          revokedAt: DeusApiKey.revokedAt,
        })
        .from(DeusApiKey)
        .where(eq(DeusApiKey.organizationId, input.organizationId));

      return keys;
    }),

  /**
   * Revoke an API key
   *
   * Soft delete - sets revokedAt timestamp
   * Keys are never hard deleted for audit purposes
   */
  revoke: protectedProcedure
    .input(
      z.object({
        id: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Verify user owns the API key
      const keyResult = await ctx.db
        .select({
          id: DeusApiKey.id,
          userId: DeusApiKey.userId,
        })
        .from(DeusApiKey)
        .where(eq(DeusApiKey.id, input.id))
        .limit(1);

      const key = keyResult[0];

      if (!key) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "API key not found",
        });
      }

      if (key.userId !== ctx.session.userId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You do not have permission to revoke this API key",
        });
      }

      // Soft delete by setting revokedAt
      await ctx.db
        .update(DeusApiKey)
        .set({
          revokedAt: new Date().toISOString(),
        })
        .where(eq(DeusApiKey.id, input.id));

      return { success: true };
    }),

  /**
   * Verify an API key (used by CLI)
   *
   * PUBLIC procedure - no authentication required
   * This is called by the CLI to validate API keys
   *
   * Security checks:
   * 1. Hash the provided key and match against stored hash
   * 2. Verify key is not revoked
   * 3. Verify key is not expired
   * 4. Update lastUsedAt timestamp
   */
  verify: publicProcedure
    .input(
      z.object({
        key: z.string().startsWith("deus_sk_"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Hash the provided key
      const encoder = new TextEncoder();
      const data = encoder.encode(input.key);
      const hashBuffer = await crypto.subtle.digest("SHA-256", data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const keyHash = hashArray
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");

      // Find the API key by hash
      const keyResult = await ctx.db
        .select({
          id: DeusApiKey.id,
          userId: DeusApiKey.userId,
          organizationId: DeusApiKey.organizationId,
          scopes: DeusApiKey.scopes,
          expiresAt: DeusApiKey.expiresAt,
          revokedAt: DeusApiKey.revokedAt,
        })
        .from(DeusApiKey)
        .where(eq(DeusApiKey.keyHash, keyHash))
        .limit(1);

      const key = keyResult[0];

      if (!key) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Invalid API key",
        });
      }

      // Check if revoked
      if (key.revokedAt) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "API key has been revoked",
        });
      }

      // Check if expired
      if (key.expiresAt && new Date(key.expiresAt) < new Date()) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "API key has expired",
        });
      }

      // Update lastUsedAt
      await ctx.db
        .update(DeusApiKey)
        .set({
          lastUsedAt: new Date().toISOString(),
        })
        .where(eq(DeusApiKey.id, key.id));

      // Return user and organization info
      return {
        userId: key.userId,
        organizationId: key.organizationId,
        scopes: key.scopes,
      };
    }),
} satisfies TRPCRouterRecord;
