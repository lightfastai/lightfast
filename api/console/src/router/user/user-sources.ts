import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { userSources, workspaceIntegrations } from "@db/console/schema";
import { userScopedProcedure } from "../../trpc";
import {
	getUserInstallations,
	createGitHubApp,
	getInstallationRepositories,
} from "@repo/console-octokit-github";
import { decrypt } from "@repo/lib";
import { gatewayClient } from "../../lib/gateway";
import { env } from "../../env";
import yaml from "yaml";
import type { VercelProjectsResponse } from "@repo/console-vercel/types";

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
	list: userScopedProcedure.query(async ({ ctx }) => {
		try {
			const sources = await ctx.db
				.select()
				.from(userSources)
				.where(eq(userSources.userId, ctx.auth.userId));

			return sources.map((source) => ({
				id: source.id,
				sourceType: source.sourceType,
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
	disconnect: userScopedProcedure
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
		get: userScopedProcedure.query(async ({ ctx }) => {
			// Get user's GitHub source
			const result = await ctx.db
				.select()
				.from(userSources)
				.where(
					and(
						eq(userSources.userId, ctx.auth.userId),
						eq(userSources.sourceType, "github"),
					),
				)
				.limit(1);

			const userSource = result[0];

			if (!userSource) {
				return null;
			}

			// Return user source with installations from providerMetadata
			const providerMetadata = userSource.providerMetadata;
			if (providerMetadata.sourceType !== "github") {
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Invalid provider metadata type",
				});
			}

			return {
				id: userSource.id,
				userId: userSource.userId,
				sourceType: userSource.sourceType,
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
		validate: userScopedProcedure.mutation(async ({ ctx }) => {
			// Get user's GitHub integration
			const result = await ctx.db
				.select()
				.from(userSources)
				.where(
					and(
						eq(userSources.userId, ctx.auth.userId),
						eq(userSources.sourceType, "github"),
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
				// Get access token — Gateway vault if available, local decrypt otherwise
				const accessToken = userSource.gatewayInstallationId
					? (await gatewayClient.getToken(userSource.gatewayInstallationId)).accessToken
					: decrypt(userSource.accessToken, env.ENCRYPTION_KEY);

				const { installations: githubInstallations } =
					await getUserInstallations(accessToken);

				// Get current installations from providerMetadata
				const providerMetadata = userSource.providerMetadata;
				if (providerMetadata.sourceType !== "github") {
					throw new TRPCError({
						code: "INTERNAL_SERVER_ERROR",
						message: "Invalid provider data type",
					});
				}

				const currentInstallations = providerMetadata.installations ?? [];
				const currentIds = new Set(
					currentInstallations.map((i) => i.id.toString()),
				);

				// Map GitHub installations to our format
				const now = new Date().toISOString();
				const newInstallations = githubInstallations.map((install) => {
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
						accountId: account?.id.toString() ?? "",
						accountLogin,
						accountType,
						avatarUrl: account && "avatar_url" in account ? account.avatar_url : "",
						permissions: (install.permissions as Record<string, string>),
						installedAt: install.created_at,
						lastValidatedAt: now,
					};
				});

				const newIds = new Set(newInstallations.map((i) => i.id));

				// Calculate changes
				const added = newInstallations.filter((i) => !currentIds.has(i.id));
				const removed = currentInstallations.filter(
					(i) => !newIds.has(i.id),
				);

				// Update providerMetadata with fresh installations
				await ctx.db
					.update(userSources)
					.set({
						providerMetadata: {
							version: 1 as const,
							sourceType: "github" as const,
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
			} catch (error: unknown) {
				console.error("[tRPC] GitHub installation validation failed:", error);

				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Failed to validate GitHub installations",
					cause: error,
				});
			}
		}),

		/**
		 * Store GitHub OAuth result (called from OAuth callback route)
		 * Stores user's GitHub connection with access token and installations
		 *
		 * This is user-level data - the user's personal GitHub OAuth connection.
		 * Later, when creating a workspace, we'll create workspaceIntegrations
		 * that link specific repos from this userSource to workspaces.
		 */
		storeOAuthResult: userScopedProcedure
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
				console.log("[tRPC userSources.github.storeOAuthResult] ========== Starting ==========");
				console.log("[tRPC userSources.github.storeOAuthResult] User ID:", ctx.auth.userId);
				console.log("[tRPC userSources.github.storeOAuthResult] Auth type:", ctx.auth.type);
				console.log("[tRPC userSources.github.storeOAuthResult] Installations count:", input.installations.length);
				console.log("[tRPC userSources.github.storeOAuthResult] Installations:", input.installations.map(i => ({
					id: i.id,
					accountLogin: i.accountLogin,
					accountType: i.accountType,
				})));

				const now = new Date().toISOString();

				// Check if userSource already exists for this user
				console.log("[tRPC userSources.github.storeOAuthResult] Checking for existing userSource...");
				const existingUserSource = await ctx.db
					.select()
					.from(userSources)
					.where(
						and(
							eq(userSources.userId, ctx.auth.userId),
							eq(userSources.sourceType, "github"),
						),
					)
					.limit(1);

				console.log("[tRPC userSources.github.storeOAuthResult] Existing userSource found:", !!existingUserSource[0]);

				if (existingUserSource[0]) {
					// Update existing userSource
					console.log("[tRPC userSources.github.storeOAuthResult] Updating existing userSource:", existingUserSource[0].id);
					await ctx.db
						.update(userSources)
						.set({
							accessToken: input.accessToken,
							refreshToken: input.refreshToken ?? null,
							tokenExpiresAt: input.tokenExpiresAt
								? new Date(input.tokenExpiresAt).toISOString()
								: null,
							providerMetadata: {
								version: 1 as const,
								sourceType: "github" as const,
								installations: input.installations,
							},
							isActive: true,
							lastSyncAt: now,
						})
						.where(eq(userSources.id, existingUserSource[0].id));

					console.log("[tRPC userSources.github.storeOAuthResult] ========== Updated Successfully ==========");
					return { id: existingUserSource[0].id, created: false };
				} else {
					// Create new userSource
					console.log("[tRPC userSources.github.storeOAuthResult] Creating new userSource...");
					const result = await ctx.db
						.insert(userSources)
						.values({
							userId: ctx.auth.userId,
							sourceType: "github",
							accessToken: input.accessToken,
							refreshToken: input.refreshToken ?? null,
							tokenExpiresAt: input.tokenExpiresAt
								? new Date(input.tokenExpiresAt).toISOString()
								: null,
							providerMetadata: {
								version: 1 as const,
								sourceType: "github" as const,
								installations: input.installations,
							},
							isActive: true,
							connectedAt: now,
						})
						.returning({ id: userSources.id });

					const createdId = result[0]?.id;
					if (!createdId) {
						throw new TRPCError({
							code: "INTERNAL_SERVER_ERROR",
							message: "Failed to create GitHub user source",
						});
					}
					console.log("[tRPC userSources.github.storeOAuthResult] ========== Created Successfully ==========", createdId);
					return { id: createdId, created: true };
				}
			}),

		/**
		 * Get repositories for a GitHub App installation
		 *
		 * Validates user owns the installation, then fetches repositories
		 * using a GitHub App installation token.
		 */
		repositories: userScopedProcedure
			.input(
				z.object({
					integrationId: z.string(), // userSource.id
					installationId: z.string(),
				}),
			)
			.query(async ({ ctx, input }) => {
				// Verify user owns this userSource
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

				const userSource = result[0];

				if (!userSource) {
					throw new TRPCError({
						code: "NOT_FOUND",
						message: "User source not found or access denied",
					});
				}

				// Verify provider is GitHub
				const providerMetadata = userSource.providerMetadata;
				if (providerMetadata.sourceType !== "github") {
					throw new TRPCError({
						code: "INTERNAL_SERVER_ERROR",
						message: "Invalid provider metadata type",
					});
				}

				// Find the installation
				const installations = providerMetadata.installations ?? [];
				const installation = installations.find(
					(i) => i.id === input.installationId,
				);

				if (!installation) {
					throw new TRPCError({
						code: "NOT_FOUND",
						message: "Installation not found or not accessible to this source",
					});
				}

				// Fetch repositories using GitHub App
				try {
					const app = getGitHubApp();
					const installationIdNumber = Number.parseInt(
						input.installationId,
						10,
					);

					const { repositories } = await getInstallationRepositories(
						app,
						installationIdNumber,
					);

					// Return repository data
					return repositories.map((repo) => ({
						id: repo.id.toString(),
						name: repo.name,
						fullName: repo.full_name,
						owner: repo.owner.login,
						description: repo.description,
						defaultBranch: repo.default_branch,
						isPrivate: repo.private,
						isArchived: repo.archived,
						url: repo.html_url,
						language: repo.language,
						stargazersCount: repo.stargazers_count,
						updatedAt: repo.updated_at,
					}));
				} catch (error: unknown) {
					console.error("[tRPC userSources.github.repositories] Failed to fetch repositories:", error);

					throw new TRPCError({
						code: "INTERNAL_SERVER_ERROR",
						message: "Failed to fetch repositories from GitHub",
						cause: error,
					});
				}
			}),

		/**
		 * Detect repository configuration (lightfast.yml)
		 *
		 * Checks if the repository contains a lightfast.yml configuration file
		 * and returns its content if found.
		 */
		detectConfig: userScopedProcedure
			.input(
				z.object({
					integrationId: z.string(), // userSource.id
					installationId: z.string(),
					fullName: z.string(), // "owner/repo"
					ref: z.string().optional(), // branch/tag/sha (defaults to default branch)
				}),
			)
			.query(async ({ ctx, input }) => {
				// Verify user owns this userSource
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

				const userSource = result[0];

				if (!userSource) {
					throw new TRPCError({
						code: "NOT_FOUND",
						message: "User source not found or access denied",
					});
				}

				// Verify provider is GitHub
				const providerMetadata = userSource.providerMetadata;
				if (providerMetadata.sourceType !== "github") {
					throw new TRPCError({
						code: "INTERNAL_SERVER_ERROR",
						message: "Invalid provider metadata type",
					});
				}

				// Find the installation
				const installation = providerMetadata.installations?.find(
					(i) => i.id === input.installationId,
				);

				if (!installation) {
					throw new TRPCError({
						code: "NOT_FOUND",
						message: "Installation not found or not accessible to this source",
					});
				}

				// Parse repository owner and name
				const [owner, repo] = input.fullName.split("/");
				if (!owner || !repo) {
					throw new TRPCError({
						code: "BAD_REQUEST",
						message: "Invalid repository name format. Expected 'owner/repo'",
					});
				}

				try {
					const app = getGitHubApp();
					const installationIdNumber = Number.parseInt(
						input.installationId,
						10,
					);

					// Get installation octokit
					const octokit = await app.getInstallationOctokit(
						installationIdNumber,
					);

					// Resolve ref (default to repository default branch)
					let ref = input.ref;
					if (!ref) {
						const { data: repoInfo } = await octokit.request(
							"GET /repos/{owner}/{repo}",
							{
								owner,
								repo,
								headers: { "X-GitHub-Api-Version": "2022-11-28" },
							},
						);
						ref = repoInfo.default_branch;
					}

					// Validate ref format to prevent injection attacks
					// Allow: alphanumeric, dots, dashes, slashes, underscores
					if (ref && !/^[a-zA-Z0-9._/-]+$/.test(ref)) {
						throw new TRPCError({
							code: "BAD_REQUEST",
							message:
								"Invalid ref format. Only alphanumeric characters, dots, dashes, slashes, and underscores are allowed.",
						});
					}

					// Try common config file names
					const candidates = [
						"lightfast.yml",
						".lightfast.yml",
						"lightfast.yaml",
						".lightfast.yaml",
					];

					for (const path of candidates) {
						try {
							const { data } = await octokit.request(
								"GET /repos/{owner}/{repo}/contents/{path}",
								{
									owner,
									repo,
									path,
									ref,
									headers: { "X-GitHub-Api-Version": "2022-11-28" },
								},
							);

							// Check if it's a file (not directory) - octokit can return arrays for directories
							if ("content" in data && "type" in data) {
								// Validate file size (max 50KB to prevent abuse)
								const maxSize = 50 * 1024; // 50KB
								if ("size" in data && typeof data.size === "number") {
									if (data.size > maxSize) {
										throw new TRPCError({
											code: "BAD_REQUEST",
											message: `Config file too large. Maximum size is ${maxSize / 1024}KB.`,
										});
									}
								}

								const content = Buffer.from(data.content, "base64").toString(
									"utf-8",
								);

								// Validate YAML format before returning
								try {
									yaml.parse(content);
								} catch {
									throw new TRPCError({
										code: "BAD_REQUEST",
										message: "Invalid YAML format in config file.",
									});
								}

								return {
									exists: true,
									path,
									content,
									sha: data.sha,
								};
							}
						} catch (error: unknown) {
							// 404 means file doesn't exist, try next candidate
							if (error && typeof error === "object" && "status" in error && (error as { status: number }).status === 404) {
								continue;
							}
							// Other errors: log and continue
							console.error(
								`[tRPC userSources.github.detectConfig] Error checking ${path} in ${owner}/${repo}:`,
								error,
							);
							continue;
						}
					}

					// No config found
					return { exists: false };
				} catch (error: unknown) {
					console.error("[tRPC userSources.github.detectConfig] Failed to detect config:", error);

					throw new TRPCError({
						code: "INTERNAL_SERVER_ERROR",
						message: "Failed to detect repository configuration",
						cause: error,
					});
				}
			}),
	},

	/**
	 * Vercel-specific operations
	 */
	vercel: {
		/**
		 * Get user's Vercel source
		 *
		 * Returns the user's Vercel OAuth connection including
		 * team and configuration information.
		 */
		get: userScopedProcedure.query(async ({ ctx }) => {
			const result = await ctx.db
				.select()
				.from(userSources)
				.where(
					and(
						eq(userSources.userId, ctx.auth.userId),
						eq(userSources.sourceType, "vercel"),
					),
				)
				.limit(1);

			const userSource = result[0];

			if (!userSource) {
				return null;
			}

			const providerMetadata = userSource.providerMetadata;
			if (providerMetadata.sourceType !== "vercel") {
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Invalid provider metadata type",
				});
			}

			return {
				id: userSource.id,
				userId: userSource.userId,
				sourceType: userSource.sourceType,
				connectedAt: userSource.connectedAt,
				isActive: userSource.isActive,
				vercelUserId: providerMetadata.userId,
				teamId: providerMetadata.teamId,
				teamSlug: providerMetadata.teamSlug,
				configurationId: providerMetadata.configurationId,
			};
		}),

		/**
		 * Store Vercel OAuth result (called from OAuth callback route)
		 * Stores user's Vercel connection with access token
		 */
		storeOAuthResult: userScopedProcedure
			.input(
				z.object({
					accessToken: z.string(),
					userId: z.string(),
					teamId: z.string().optional(),
					teamSlug: z.string().optional(),
					configurationId: z.string(),
				}),
			)
			.mutation(async ({ ctx, input }) => {
				console.log("[tRPC userSources.vercel.storeOAuthResult] Starting");
				console.log("[tRPC userSources.vercel.storeOAuthResult] Clerk User ID:", ctx.auth.userId);
				console.log("[tRPC userSources.vercel.storeOAuthResult] Vercel User ID:", input.userId);
				console.log("[tRPC userSources.vercel.storeOAuthResult] Team ID:", input.teamId);
				console.log("[tRPC userSources.vercel.storeOAuthResult] Configuration ID:", input.configurationId);

				const now = new Date().toISOString();

				// Check if userSource already exists
				const existingUserSource = await ctx.db
					.select()
					.from(userSources)
					.where(
						and(
							eq(userSources.userId, ctx.auth.userId),
							eq(userSources.sourceType, "vercel"),
						),
					)
					.limit(1);

				if (existingUserSource[0]) {
					// Update existing
					console.log("[tRPC userSources.vercel.storeOAuthResult] Updating existing userSource:", existingUserSource[0].id);
					await ctx.db
						.update(userSources)
						.set({
							accessToken: input.accessToken,
							providerMetadata: {
								version: 1 as const,
								sourceType: "vercel" as const,
								userId: input.userId,
								teamId: input.teamId,
								teamSlug: input.teamSlug,
								configurationId: input.configurationId,
							},
							isActive: true,
							lastSyncAt: now,
						})
						.where(eq(userSources.id, existingUserSource[0].id));

					console.log("[tRPC userSources.vercel.storeOAuthResult] Updated successfully");
					return { id: existingUserSource[0].id, created: false };
				} else {
					// Create new
					console.log("[tRPC userSources.vercel.storeOAuthResult] Creating new userSource");
					const result = await ctx.db
						.insert(userSources)
						.values({
							userId: ctx.auth.userId,
							sourceType: "vercel",
							accessToken: input.accessToken,
							providerMetadata: {
								version: 1 as const,
								sourceType: "vercel" as const,
								userId: input.userId,
								teamId: input.teamId,
								teamSlug: input.teamSlug,
								configurationId: input.configurationId,
							},
							isActive: true,
							connectedAt: now,
						})
						.returning({ id: userSources.id });

					const vercelId = result[0]?.id;
					if (!vercelId) {
						throw new TRPCError({
							code: "INTERNAL_SERVER_ERROR",
							message: "Failed to create Vercel user source",
						});
					}
					console.log("[tRPC userSources.vercel.storeOAuthResult] Created successfully:", vercelId);
					return { id: vercelId, created: true };
				}
			}),

		/**
		 * List Vercel projects for project selector
		 *
		 * Returns all projects from user's Vercel account with connection status.
		 * Used by the project selector modal to show available projects.
		 */
		listProjects: userScopedProcedure
			.input(
				z.object({
					userSourceId: z.string(),
					workspaceId: z.string(),
					cursor: z.string().optional(),
				}),
			)
			.query(async ({ ctx, input }) => {
				// 1. Verify user owns this source
				const source = await ctx.db.query.userSources.findFirst({
					where: and(
						eq(userSources.id, input.userSourceId),
						eq(userSources.userId, ctx.auth.userId),
						eq(userSources.sourceType, "vercel"),
						eq(userSources.isActive, true),
					),
				});

				if (!source) {
					throw new TRPCError({
						code: "NOT_FOUND",
						message: "Vercel connection not found",
					});
				}

				// 2. Get access token — Gateway vault if available, local decrypt otherwise
				const accessToken = source.gatewayInstallationId
					? (await gatewayClient.getToken(source.gatewayInstallationId)).accessToken
					: decrypt(source.accessToken, env.ENCRYPTION_KEY);

				// 3. Get team ID from metadata
				const providerMetadata = source.providerMetadata;
				if (providerMetadata.sourceType !== "vercel") {
					throw new TRPCError({
						code: "INTERNAL_SERVER_ERROR",
						message: "Invalid provider metadata",
					});
				}
				const teamId = providerMetadata.teamId;

				// 4. Call Vercel API
				const url = new URL("https://api.vercel.com/v9/projects");
				if (teamId) url.searchParams.set("teamId", teamId);
				url.searchParams.set("limit", "100");
				if (input.cursor) url.searchParams.set("until", input.cursor);

				console.log("[Vercel Projects] Fetching from:", url.toString());
				console.log("[Vercel Projects] teamId:", teamId);

				const response = await fetch(url.toString(), {
					headers: { Authorization: `Bearer ${accessToken}` },
				});

				console.log("[Vercel Projects] Response status:", response.status);

				if (response.status === 401) {
					// Mark source as needing re-auth
					await ctx.db
						.update(userSources)
						.set({ isActive: false })
						.where(eq(userSources.id, input.userSourceId));

					throw new TRPCError({
						code: "UNAUTHORIZED",
						message: "Vercel connection expired. Please reconnect.",
					});
				}

				if (!response.ok) {
					const errorText = await response.text();
					console.error("[Vercel API Error]", response.status, errorText);
					throw new TRPCError({
						code: "INTERNAL_SERVER_ERROR",
						message: "Failed to fetch Vercel projects",
					});
				}

				const data = (await response.json()) as VercelProjectsResponse;
				console.log("[Vercel Projects] Response data:", JSON.stringify(data, null, 2));

				// 5. Get already-connected projects for this workspace
				const connected = await ctx.db.query.workspaceIntegrations.findMany({
					where: and(
						eq(workspaceIntegrations.workspaceId, input.workspaceId),
						eq(workspaceIntegrations.userSourceId, input.userSourceId),
						eq(workspaceIntegrations.isActive, true),
					),
					columns: { providerResourceId: true },
				});

				const connectedIds = new Set(connected.map((c) => c.providerResourceId));

				// 6. Return with connection status
				return {
					projects: data.projects.map((p) => ({
						id: p.id,
						name: p.name,
						framework: p.framework,
						updatedAt: p.updatedAt,
						isConnected: connectedIds.has(p.id),
					})),
					pagination: data.pagination,
				};
			}),

		/**
		 * Disconnect Vercel integration
		 */
		disconnect: userScopedProcedure.mutation(async ({ ctx }) => {
			const result = await ctx.db
				.update(userSources)
				.set({ isActive: false })
				.where(
					and(
						eq(userSources.userId, ctx.auth.userId),
						eq(userSources.sourceType, "vercel"),
					),
				)
				.returning({ id: userSources.id });

			if (!result[0]) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Vercel integration not found",
				});
			}

			return { success: true };
		}),
	},
} satisfies TRPCRouterRecord;
