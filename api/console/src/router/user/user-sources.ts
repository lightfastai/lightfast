import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { userSources, type UserSource } from "@db/console/schema";
import { protectedProcedure } from "../../trpc";
import {
	getUserInstallations,
	createGitHubApp,
} from "@repo/console-octokit-github";
import { decrypt } from "@repo/lib";
import { env } from "../../env";

/**
 * User Sources Router
 *
 * Manages user's personal OAuth connections (GitHub, Notion, Linear, etc.)
 * These are user-level integrations that can be reused across multiple workspaces.
 *
 * Table: userSources (lightfast_user_sources)
 * Scope: User-scoped (no org required)
 */

/**
 * Helper: Create GitHub App instance
 */
function getGitHubApp() {
	return createGitHubApp(
		{
			appId: env.GITHUB_APP_ID,
			privateKey: env.GITHUB_APP_PRIVATE_KEY,
		},
		true, // Format private key
	);
}

export const userSourcesRouter = {
	/**
	 * List user's OAuth integrations (all providers)
	 *
	 * Returns all OAuth integrations connected by the user
	 * (GitHub, Notion, Linear, Sentry, etc.)
	 */
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

	/**
	 * GitHub-specific operations
	 */
	github: {
		/**
		 * Get user's GitHub source with installations
		 *
		 * Returns the user's personal GitHub OAuth connection including
		 * all GitHub App installations they have access to.
		 */
		get: protectedProcedure.query(async ({ ctx }) => {
			// Get user's GitHub source
			const result = await ctx.db
				.select()
				.from(userSources)
				.where(
					and(
						eq(userSources.userId, ctx.auth.userId),
						eq(userSources.provider, "github"),
					),
				)
				.limit(1);

			const userSource = result[0];

			if (!userSource) {
				return null;
			}

			// Return user source with installations from providerMetadata
			const providerMetadata = userSource.providerMetadata;
			if (providerMetadata.provider !== "github") {
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Invalid provider metadata type",
				});
			}

			return {
				id: userSource.id,
				userId: userSource.userId,
				provider: userSource.provider,
				connectedAt: userSource.connectedAt,
				isActive: userSource.isActive,
				installations: providerMetadata.installations ?? [],
			};
		}),

		/**
		 * Validate and refresh installations from GitHub API
		 *
		 * Re-fetches installations from GitHub using stored access token
		 * and updates the integration's providerData.
		 *
		 * Returns counts of added/removed installations.
		 */
		validate: protectedProcedure.mutation(async ({ ctx }) => {
			// Get user's GitHub integration
			const result = await ctx.db
				.select()
				.from(userSources)
				.where(
					and(
						eq(userSources.userId, ctx.auth.userId),
						eq(userSources.provider, "github"),
					),
				)
				.limit(1);

			const userSource = result[0];

			if (!userSource) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "GitHub integration not found. Please connect GitHub first.",
				});
			}

			// Fetch fresh installations from GitHub
			try {
				// Decrypt access token before use
				const accessToken = decrypt(userSource.accessToken, env.ENCRYPTION_KEY);

				const { installations: githubInstallations } =
					await getUserInstallations(accessToken);

				// Get current installations from providerMetadata
				const providerMetadata = userSource.providerMetadata;
				if (providerMetadata.provider !== "github") {
					throw new TRPCError({
						code: "INTERNAL_SERVER_ERROR",
						message: "Invalid provider data type",
					});
				}

				const currentInstallations = providerMetadata.installations ?? [];
				const currentIds = new Set(
					currentInstallations.map((i: any) => i.id.toString()),
				);

				// Map GitHub installations to our format
				const now = new Date().toISOString();
				const newInstallations = githubInstallations.map((install: any) => {
					const account = install.account;
					// Handle both User and Organization account types
					const accountLogin =
						account && "login" in account ? account.login : "";
					const accountType: "User" | "Organization" =
						account && "type" in account && account.type === "User"
							? "User"
							: "Organization";

					return {
						id: install.id.toString(),
						accountId: account?.id?.toString() ?? "",
						accountLogin,
						accountType,
						avatarUrl: account?.avatar_url ?? "",
						permissions: (install.permissions as Record<string, string>) ?? {},
						installedAt: install.created_at ?? now,
						lastValidatedAt: now,
					};
				});

				const newIds = new Set(newInstallations.map((i: any) => i.id));

				// Calculate changes
				const added = newInstallations.filter((i: any) => !currentIds.has(i.id));
				const removed = currentInstallations.filter(
					(i: any) => !newIds.has(i.id),
				);

				// Update providerMetadata with fresh installations
				await ctx.db
					.update(userSources)
					.set({
						providerMetadata: {
							provider: "github" as const,
							installations: newInstallations,
						},
						lastSyncAt: new Date().toISOString(),
					})
					.where(eq(userSources.id, userSource.id));

				return {
					added: added.length,
					removed: removed.length,
					total: newInstallations.length,
				};
			} catch (error: any) {
				console.error("[tRPC] GitHub installation validation failed:", error);

				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Failed to validate GitHub installations",
					cause: error,
				});
			}
		}),

		/**
		 * Store OAuth result (called from OAuth callback route)
		 * Creates or updates integration with access token and installations
		 */
		storeOAuthResult: protectedProcedure
			.input(
				z.object({
					accessToken: z.string(),
					refreshToken: z.string().optional(),
					tokenExpiresAt: z.string().optional(),
					installations: z.array(
						z.object({
							id: z.string(),
							accountId: z.string(),
							accountLogin: z.string(),
							accountType: z.enum(["User", "Organization"]),
							avatarUrl: z.string(),
							permissions: z.record(z.string()),
							installedAt: z.string(),
							lastValidatedAt: z.string(),
						}),
					),
				}),
			)
			.mutation(async ({ ctx, input }) => {
				const now = new Date().toISOString();

				// Check if userSource already exists for this user
				const existingUserSource = await ctx.db
					.select()
					.from(userSources)
					.where(
						and(
							eq(userSources.userId, ctx.auth.userId),
							eq(userSources.provider, "github"),
						),
					)
					.limit(1);

				if (existingUserSource[0]) {
					// Update existing userSource
					await ctx.db
						.update(userSources)
						.set({
							accessToken: input.accessToken,
							refreshToken: input.refreshToken ?? null,
							tokenExpiresAt: input.tokenExpiresAt
								? new Date(input.tokenExpiresAt).toISOString()
								: null,
							providerMetadata: {
								provider: "github" as const,
								installations: input.installations,
							},
							isActive: true,
							lastSyncAt: now,
						})
						.where(eq(userSources.id, existingUserSource[0].id));

					return { id: existingUserSource[0].id, created: false };
				} else {
					// Create new userSource
					const result = await ctx.db
						.insert(userSources)
						.values({
							userId: ctx.auth.userId,
							provider: "github",
							accessToken: input.accessToken,
							refreshToken: input.refreshToken ?? null,
							tokenExpiresAt: input.tokenExpiresAt
								? new Date(input.tokenExpiresAt).toISOString()
								: null,
							providerMetadata: {
								provider: "github" as const,
								installations: input.installations,
							},
							isActive: true,
							connectedAt: now,
						})
						.returning({ id: userSources.id });

					return { id: result[0]!.id, created: true };
				}
			}),
	},
} satisfies TRPCRouterRecord;
