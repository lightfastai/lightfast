import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { eq, and } from "drizzle-orm";
import {
	generateApiKey,
	hashApiKey,
	extractKeyPreview,
	LIGHTFAST_API_KEY_PREFIX,
} from "@repo/console-api-key";
import { userApiKeys } from "@db/console/schema";
import { userScopedProcedure } from "../../trpc";

/**
 * User API Keys Router
 *
 * Manages user API keys for authentication with Lightfast APIs.
 * Handles creation, rotation, revocation, and deletion of API keys.
 *
 * Table: userApiKeys (lightfast_user_api_keys)
 * Scope: User-scoped (no org required)
 */
export const userApiKeysRouter = {
	/**
	 * List user's API keys
	 * Does NOT return the actual key values, only metadata
	 */
	list: userScopedProcedure.query(async ({ ctx }) => {
		try {
			const userKeys = await ctx.db
				.select()
				.from(userApiKeys)
				.where(eq(userApiKeys.userId, ctx.auth.userId));

			return userKeys.map((key) => ({
				id: key.id,
				name: key.name,
				keyPreview: key.keyPreview,
				isActive: key.isActive,
				expiresAt: key.expiresAt,
				lastUsedAt: key.lastUsedAt,
				createdAt: key.createdAt,
			}));
		} catch (error: unknown) {
			console.error("[tRPC] Failed to fetch API keys:", error);

			throw new TRPCError({
				code: "INTERNAL_SERVER_ERROR",
				message: "Failed to fetch API keys",
				cause: error,
			});
		}
	}),

	/**
	 * Create a new API key
	 *
	 * Returns the generated key ONLY ONCE - it cannot be retrieved again.
	 * The key is hashed before storage.
	 */
	create: userScopedProcedure
		.input(
			z.object({
				name: z.string().min(1).max(100),
				expiresAt: z.string().optional(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			// Generate API key with lf_ prefix
			const apiKey = generateApiKey(LIGHTFAST_API_KEY_PREFIX);
			const keyHash = await hashApiKey(apiKey);
			const keyPreview = extractKeyPreview(apiKey);

			try {
				// Store hashed key
				const result = await ctx.db
					.insert(userApiKeys)
					.values({
						userId: ctx.auth.userId,
						name: input.name,
						keyHash,
						keyPreview,
						isActive: true,
						expiresAt: input.expiresAt || null,
					})
					.returning({
						id: userApiKeys.id,
						name: userApiKeys.name,
						keyPreview: userApiKeys.keyPreview,
						createdAt: userApiKeys.createdAt,
					});

				// Return the plaintext key ONLY THIS ONCE
				return {
					...result[0],
					key: apiKey, // ⚠️ Only returned on creation
				};
			} catch (error: unknown) {
				console.error("[tRPC] Failed to create API key:", error);

				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Failed to create API key",
					cause: error,
				});
			}
		}),

	/**
	 * Revoke an API key
	 */
	revoke: userScopedProcedure
		.input(
			z.object({
				keyId: z.string(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			// Verify ownership
			const result = await ctx.db
				.select()
				.from(userApiKeys)
				.where(
					and(eq(userApiKeys.id, input.keyId), eq(userApiKeys.userId, ctx.auth.userId)),
				)
				.limit(1);

			if (!result[0]) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "API key not found or access denied",
				});
			}

			// Soft delete (mark as inactive)
			await ctx.db
				.update(userApiKeys)
				.set({ isActive: false })
				.where(eq(userApiKeys.id, input.keyId));

			return { success: true };
		}),

	/**
	 * Delete an API key permanently
	 */
	delete: userScopedProcedure
		.input(
			z.object({
				keyId: z.string(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			// Verify ownership
			const result = await ctx.db
				.select()
				.from(userApiKeys)
				.where(
					and(eq(userApiKeys.id, input.keyId), eq(userApiKeys.userId, ctx.auth.userId)),
				)
				.limit(1);

			if (!result[0]) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "API key not found or access denied",
				});
			}

			// Hard delete
			await ctx.db.delete(userApiKeys).where(eq(userApiKeys.id, input.keyId));

			return { success: true };
		}),

	/**
	 * Rotate an API key
	 *
	 * Replaces an existing API key with a new one atomically.
	 * The old key is immediately revoked and the new key inherits
	 * the same name and expiration settings.
	 *
	 * This is the recommended way to replace a potentially compromised key
	 * while maintaining the same key identity and settings.
	 *
	 * ⚠️ The new key is returned ONLY ONCE and cannot be retrieved again.
	 */
	rotate: userScopedProcedure
		.input(
			z.object({
				keyId: z.string(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			// 1. Verify ownership and get old key
			const [oldKey] = await ctx.db
				.select()
				.from(userApiKeys)
				.where(
					and(eq(userApiKeys.id, input.keyId), eq(userApiKeys.userId, ctx.auth.userId)),
				)
				.limit(1);

			if (!oldKey) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "API key not found or access denied",
				});
			}

			// 2. Generate new key with same prefix as old key
			const newApiKey = generateApiKey(LIGHTFAST_API_KEY_PREFIX);
			const newKeyHash = await hashApiKey(newApiKey);
			const newKeyPreview = extractKeyPreview(newApiKey);

			try {
				// 3. Atomically swap keys in transaction
				const result = await ctx.db.transaction(async (tx) => {
					// Revoke old key
					await tx
						.update(userApiKeys)
						.set({ isActive: false })
						.where(eq(userApiKeys.id, input.keyId));

					// Create new key with same settings
					const [created] = await tx
						.insert(userApiKeys)
						.values({
							userId: ctx.auth.userId,
							name: oldKey.name, // Same name
							keyHash: newKeyHash,
							keyPreview: newKeyPreview,
							isActive: true,
							expiresAt: oldKey.expiresAt, // Same expiration
						})
						.returning({
							id: userApiKeys.id,
							name: userApiKeys.name,
							keyPreview: userApiKeys.keyPreview,
							createdAt: userApiKeys.createdAt,
						});

					return created;
				});

				// 4. Return new key ONLY THIS ONCE
				return {
					...result,
					key: newApiKey, // ⚠️ Only returned on rotation
				};
			} catch (error: unknown) {
				console.error("[tRPC] Failed to rotate API key:", error);

				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Failed to rotate API key",
					cause: error,
				});
			}
		}),
} satisfies TRPCRouterRecord;
