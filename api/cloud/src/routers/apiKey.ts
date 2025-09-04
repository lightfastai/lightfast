import type { TRPCRouterRecord } from "@trpc/server";
import { CloudApiKey } from "@db/cloud/schema";
import * as argon2 from "argon2";
import { and, desc, eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { z } from "zod";

import { uuidv4 } from "@repo/lib";

import {
  protectedProcedure,
  publicProcedure,
  TRPCError,
} from "../trpc";

// Constants for key generation
const API_KEY_PREFIX = "lf_";
const API_KEY_LENGTH = 32; // Total characters after prefix
const KEY_PREVIEW_LENGTH = 4; // Last 4 characters shown

/**
 * Generate a secure API key with proper entropy
 */
function generateApiKey(): string {
  // Using nanoid with custom alphabet for URL-safe keys
  // 32 characters with base62 alphabet gives us ~190 bits of entropy
  const key = nanoid(API_KEY_LENGTH);
  return `${API_KEY_PREFIX}${key}`;
}

/**
 * Extract the last N characters of a key for preview
 */
function getKeyPreview(key: string): string {
  return `...${key.slice(-KEY_PREVIEW_LENGTH)}`;
}

export const apiKeyRouter = {
  /**
   * Create a new API key for the authenticated user
   */
  create: protectedProcedure
    .input(
      z.object({
        name: z
          .string()
          .min(1, "Name is required")
          .max(100, "Name must be less than 100 characters"),
        expiresInDays: z
          .number()
          .optional()
          .refine(
            (val) => val === undefined || val > 0,
            "Expiry days must be positive",
          ),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { session, db } = ctx;
      const { name, expiresInDays } = input;

      // Generate the API key
      const apiKey = generateApiKey();

      // Hash the key for secure storage
      const keyHash = await argon2.hash(apiKey);

      // Calculate expiry date if specified
      const expiresAt = expiresInDays
        ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
        : null;

      // Generate a unique ID for the key
      const keyId = uuidv4();

      // Store the API key in the database
      await db.insert(CloudApiKey).values({
        id: keyId,
        clerkUserId: session.data.userId,
        keyHash,
        keyPreview: getKeyPreview(apiKey),
        name,
        active: true,
        expiresAt,
      });

      // Fetch the created key to return its details
      const [newKey] = await db
        .select({
          id: CloudApiKey.id,
          name: CloudApiKey.name,
          keyPreview: CloudApiKey.keyPreview,
          createdAt: CloudApiKey.createdAt,
          expiresAt: CloudApiKey.expiresAt,
        })
        .from(CloudApiKey)
        .where(eq(CloudApiKey.id, keyId))
        .limit(1);

      // Key should always exist since we just created it
      if (!newKey) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create API key",
        });
      }

      // Return the key details including the raw key
      // This is the ONLY time the raw key is returned
      return {
        ...newKey,
        key: apiKey, // Only returned during creation
        message: "Store this key securely. You won't be able to see it again.",
      };
    }),

  /**
   * List all API keys for the authenticated user
   */
  list: protectedProcedure
    .input(
      z.object({
        includeInactive: z.boolean().optional().default(false),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { session, db } = ctx;
      const { includeInactive } = input;

      // Build the where clause
      const whereClause = includeInactive
        ? eq(CloudApiKey.clerkUserId, session.data.userId)
        : and(
            eq(CloudApiKey.clerkUserId, session.data.userId!),
            eq(CloudApiKey.active, true),
          );

      // Fetch the keys
      const keys = await db
        .select({
          id: CloudApiKey.id,
          name: CloudApiKey.name,
          keyPreview: CloudApiKey.keyPreview,
          active: CloudApiKey.active,
          lastUsedAt: CloudApiKey.lastUsedAt,
          expiresAt: CloudApiKey.expiresAt,
          createdAt: CloudApiKey.createdAt,
        })
        .from(CloudApiKey)
        .where(whereClause)
        .orderBy(desc(CloudApiKey.createdAt));

      // Add computed fields
      return keys.map((key) => ({
        ...key,
        isExpired: key.expiresAt ? key.expiresAt < new Date() : false,
      }));
    }),

  /**
   * Revoke an API key (soft delete)
   */
  revoke: protectedProcedure
    .input(
      z.object({
        keyId: z.string().min(1, "Key ID is required"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { session, db } = ctx;
      const { keyId } = input;

      // Verify the key belongs to the user
      const [existingKey] = await db
        .select({ id: CloudApiKey.id })
        .from(CloudApiKey)
        .where(
          and(
            eq(CloudApiKey.id, keyId),
            eq(CloudApiKey.clerkUserId, session.data.userId!),
          ),
        )
        .limit(1);

      if (!existingKey) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message:
            "API key not found or you don't have permission to revoke it",
        });
      }

      // Revoke the key by setting active to false
      await db
        .update(CloudApiKey)
        .set({
          active: false,
        })
        .where(eq(CloudApiKey.id, keyId));

      // Fetch the revoked key details
      const [revokedKey] = await db
        .select({
          id: CloudApiKey.id,
          name: CloudApiKey.name,
        })
        .from(CloudApiKey)
        .where(eq(CloudApiKey.id, keyId))
        .limit(1);

      // Key should always exist since we just updated it
      if (!revokedKey) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch revoked key details",
        });
      }

      return {
        success: true,
        message: `API key "${revokedKey.name}" has been revoked`,
        revokedKey,
      };
    }),

  /**
   * Validate an API key (public endpoint for CLI authentication)
   */
  validate: publicProcedure
    .input(
      z.object({
        key: z
          .string()
          .min(1, "API key is required")
          .refine(
            (val) => val.startsWith(API_KEY_PREFIX),
            `API key must start with ${API_KEY_PREFIX}`,
          ),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { db } = ctx;
      const { key } = input;

      // Get all active keys (we need to check hashes)
      // In production, consider implementing a cache here
      const activeKeys = await db
        .select({
          id: CloudApiKey.id,
          keyHash: CloudApiKey.keyHash,
          clerkUserId: CloudApiKey.clerkUserId,
          expiresAt: CloudApiKey.expiresAt,
          active: CloudApiKey.active,
        })
        .from(CloudApiKey)
        .where(eq(CloudApiKey.active, true));

      // Find the matching key by verifying the hash
      let validKey = null;
      for (const dbKey of activeKeys) {
        const isValid = await argon2.verify(dbKey.keyHash, key);
        if (isValid) {
          validKey = dbKey;
          break;
        }
      }

      // Check if key was found and is valid
      if (!validKey) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Invalid API key",
        });
      }

      // Check if key is expired
      if (validKey.expiresAt && validKey.expiresAt < new Date()) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "API key has expired",
        });
      }

      // Update last used timestamp
      await db
        .update(CloudApiKey)
        .set({
          lastUsedAt: new Date(),
        })
        .where(eq(CloudApiKey.id, validKey.id));

      // Return validation result
      return {
        valid: true,
        userId: validKey.clerkUserId,
        keyId: validKey.id,
      };
    }),

  /**
   * Get user information using an API key (for CLI whoami command)
   */
  whoami: publicProcedure
    .input(
      z.object({
        key: z
          .string()
          .min(1, "API key is required")
          .refine(
            (val) => val.startsWith(API_KEY_PREFIX),
            `API key must start with ${API_KEY_PREFIX}`,
          ),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { db } = ctx;
      const { key } = input;

      // Get all active keys (we need to check hashes)
      const activeKeys = await db
        .select({
          id: CloudApiKey.id,
          keyHash: CloudApiKey.keyHash,
          clerkUserId: CloudApiKey.clerkUserId,
          expiresAt: CloudApiKey.expiresAt,
          active: CloudApiKey.active,
        })
        .from(CloudApiKey)
        .where(eq(CloudApiKey.active, true));

      // Find the matching key by verifying the hash
      let validKey = null;
      for (const dbKey of activeKeys) {
        const isValid = await argon2.verify(dbKey.keyHash, key);
        if (isValid) {
          validKey = dbKey;
          break;
        }
      }

      // Check if key was found and is valid
      if (!validKey) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Invalid API key",
        });
      }

      // Check if key is expired
      if (validKey.expiresAt && validKey.expiresAt < new Date()) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "API key has expired",
        });
      }

      // Update last used timestamp
      await db
        .update(CloudApiKey)
        .set({
          lastUsedAt: new Date(),
        })
        .where(eq(CloudApiKey.id, validKey.id));

      // Return user information
      // Note: We're returning limited info since we don't have Clerk session here
      return {
        userId: validKey.clerkUserId,
        email: null, // Would need to fetch from Clerk API if needed
        organizationId: null, // Would need to fetch from Clerk API if needed
        keyId: validKey.id,
      };
    }),

  /**
   * Delete an API key permanently (hard delete)
   * Only allowed for keys that have been revoked
   */
  delete: protectedProcedure
    .input(
      z.object({
        keyId: z.string().min(1, "Key ID is required"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { session, db } = ctx;
      const { keyId } = input;

      // Verify the key belongs to the user and is already revoked
      const [existingKey] = await db
        .select({
          id: CloudApiKey.id,
          active: CloudApiKey.active,
          name: CloudApiKey.name,
        })
        .from(CloudApiKey)
        .where(
          and(
            eq(CloudApiKey.id, keyId),
            eq(CloudApiKey.clerkUserId, session.data.userId!),
          ),
        )
        .limit(1);

      if (!existingKey) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message:
            "API key not found or you don't have permission to delete it",
        });
      }

      if (existingKey.active) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Cannot delete an active API key. Please revoke it first.",
        });
      }

      // Permanently delete the key
      await db.delete(CloudApiKey).where(eq(CloudApiKey.id, keyId));

      return {
        success: true,
        message: `API key "${existingKey.name}" has been permanently deleted`,
      };
    }),
} satisfies TRPCRouterRecord;
