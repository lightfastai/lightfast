import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { clerkClient } from "@clerk/nextjs/server";
import { eq, and } from "drizzle-orm";
import {
	generateApiKey,
	hashApiKey,
	extractKeyPreview,
	LIGHTFAST_API_KEY_PREFIX,
} from "@repo/console-api-key";
import { apiKeys, userSources } from "@db/console/schema";
import { protectedProcedure } from "../trpc";

/**
 * Account Router
 *
 * Manages user account settings including:
 * - User profile information (from Clerk)
 * - Personal integrations (GitHub, etc.)
 * - API key management
 */

export const accountRouter = {
	/**
	 * Profile: Get user profile information
	 *
	 * Returns user data from Clerk including:
	 * - Full name
	 * - Email addresses
	 * - Username
	 * - Profile image
	 */
	profile: {
		get: protectedProcedure.query(async ({ ctx }) => {
			try {
				const clerk = await clerkClient();
				const user = await clerk.users.getUser(ctx.auth.userId);

				return {
					id: user.id,
					firstName: user.firstName,
					lastName: user.lastName,
					fullName:
						user.firstName && user.lastName
							? `${user.firstName} ${user.lastName}`
							: user.firstName || user.lastName || null,
					username: user.username,
					primaryEmailAddress: user.primaryEmailAddress?.emailAddress || null,
					imageUrl: user.imageUrl,
					createdAt: new Date(user.createdAt).toISOString(),
				};
			} catch (error: unknown) {
				console.error("[tRPC] Failed to fetch user profile:", error);

				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Failed to fetch user profile",
					cause: error,
				});
			}
		}),
	},

	/**
	 * Integrations: List user's personal integrations
	 *
	 * Returns all OAuth integrations connected by the user
	 * (GitHub, Notion, Linear, Sentry, etc.)
	 */
	integrations: {
		list: protectedProcedure.query(async ({ ctx }) => {
			try {
				const sources = await ctx.db
					.select()
					.from(userSources)
					.where(eq(userSources.userId, ctx.auth.userId));

				return sources.map((source) => ({
					id: source.id,
					provider: source.provider,
					isActive: source.isActive,
					connectedAt: source.connectedAt,
					lastSyncAt: source.lastSyncAt,
				}));
			} catch (error: unknown) {
				console.error("[tRPC] Failed to fetch integrations:", error);

				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Failed to fetch integrations",
					cause: error,
				});
			}
		}),

		/**
		 * Disconnect an integration
		 */
		disconnect: protectedProcedure
			.input(
				z.object({
					integrationId: z.string(),
				}),
			)
			.mutation(async ({ ctx, input }) => {
				// Verify ownership
				const result = await ctx.db
					.select()
					.from(userSources)
					.where(
						and(
							eq(userSources.id, input.integrationId),
							eq(userSources.userId, ctx.auth.userId),
						),
					)
					.limit(1);

				if (!result[0]) {
					throw new TRPCError({
						code: "NOT_FOUND",
						message: "Integration not found or access denied",
					});
				}

				// Soft delete (mark as inactive)
				await ctx.db
					.update(userSources)
					.set({ isActive: false })
					.where(eq(userSources.id, input.integrationId));

				return { success: true };
			}),
	},

	/**
	 * API Keys: Manage user API keys
	 */
	apiKeys: {
		/**
		 * List user's API keys
		 * Does NOT return the actual key values, only metadata
		 */
		list: protectedProcedure.query(async ({ ctx }) => {
			try {
				const userKeys = await ctx.db
					.select()
					.from(apiKeys)
					.where(eq(apiKeys.userId, ctx.auth.userId));

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
		create: protectedProcedure
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
						.insert(apiKeys)
						.values({
							userId: ctx.auth.userId,
							name: input.name,
							keyHash,
							keyPreview,
							isActive: true,
							expiresAt: input.expiresAt || null,
						})
						.returning({
							id: apiKeys.id,
							name: apiKeys.name,
							keyPreview: apiKeys.keyPreview,
							createdAt: apiKeys.createdAt,
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
		revoke: protectedProcedure
			.input(
				z.object({
					keyId: z.string(),
				}),
			)
			.mutation(async ({ ctx, input }) => {
				// Verify ownership
				const result = await ctx.db
					.select()
					.from(apiKeys)
					.where(
						and(eq(apiKeys.id, input.keyId), eq(apiKeys.userId, ctx.auth.userId)),
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
					.update(apiKeys)
					.set({ isActive: false })
					.where(eq(apiKeys.id, input.keyId));

				return { success: true };
			}),

		/**
		 * Delete an API key permanently
		 */
		delete: protectedProcedure
			.input(
				z.object({
					keyId: z.string(),
				}),
			)
			.mutation(async ({ ctx, input }) => {
				// Verify ownership
				const result = await ctx.db
					.select()
					.from(apiKeys)
					.where(
						and(eq(apiKeys.id, input.keyId), eq(apiKeys.userId, ctx.auth.userId)),
					)
					.limit(1);

				if (!result[0]) {
					throw new TRPCError({
						code: "NOT_FOUND",
						message: "API key not found or access denied",
					});
				}

				// Hard delete
				await ctx.db.delete(apiKeys).where(eq(apiKeys.id, input.keyId));

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
		rotate: protectedProcedure
			.input(
				z.object({
					keyId: z.string(),
				}),
			)
			.mutation(async ({ ctx, input }) => {
				// 1. Verify ownership and get old key
				const [oldKey] = await ctx.db
					.select()
					.from(apiKeys)
					.where(
						and(eq(apiKeys.id, input.keyId), eq(apiKeys.userId, ctx.auth.userId)),
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
							.update(apiKeys)
							.set({ isActive: false })
							.where(eq(apiKeys.id, input.keyId));

						// Create new key with same settings
						const [created] = await tx
							.insert(apiKeys)
							.values({
								userId: ctx.auth.userId,
								name: oldKey.name, // Same name
								keyHash: newKeyHash,
								keyPreview: newKeyPreview,
								isActive: true,
								expiresAt: oldKey.expiresAt, // Same expiration
							})
							.returning({
								id: apiKeys.id,
								name: apiKeys.name,
								keyPreview: apiKeys.keyPreview,
								createdAt: apiKeys.createdAt,
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
	},
} satisfies TRPCRouterRecord;
