import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { gwInstallations, workspaceIntegrations } from "@db/console/schema";
import { orgScopedProcedure } from "../../trpc";
import {
	getUserInstallations,
	createGitHubApp,
	getInstallationRepositories,
} from "@repo/console-octokit-github";
import { getInstallationToken } from "../../lib/token-vault";
import { env } from "../../env";
import yaml from "yaml";
import type { VercelProjectsResponse } from "@repo/console-vercel/types";
import { withRelatedProject } from "@vercel/related-projects";

const isDevelopment =
	process.env.NEXT_PUBLIC_VERCEL_ENV !== "production" &&
	process.env.NEXT_PUBLIC_VERCEL_ENV !== "preview";

const connectionsUrl = withRelatedProject({
	projectName: "lightfast-connections",
	defaultHost: isDevelopment
		? "http://localhost:4110"
		: "https://connections.lightfast.ai",
});

/**
 * Connections Router
 *
 * Manages org-level OAuth connections (GitHub, Vercel, Linear, etc.)
 * Queries gw_installations directly (org-scoped).
 *
 * Table: gwInstallations (lightfast_gw_installations)
 * Scope: Org-scoped (active org required)
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

export const connectionsRouter = {
	/**
	 * Get OAuth authorize URL from the connections service.
	 *
	 * Proxies the connections service authorize endpoint since browsers
	 * can't set custom headers (X-Org-Id) during popup navigation.
	 */
	getAuthorizeUrl: orgScopedProcedure
		.input(
			z.object({
				provider: z.enum(["github", "vercel", "linear", "sentry"]),
			}),
		)
		.query(async ({ ctx, input }) => {
			const res = await fetch(
				`${connectionsUrl}/connections/${input.provider}/authorize`,
				{
					headers: {
						"X-Org-Id": ctx.auth.orgId,
						"X-User-Id": ctx.auth.userId,
					},
				},
			);
			if (!res.ok) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "Failed to get authorize URL",
				});
			}
			return res.json() as Promise<{ url: string; state: string }>;
		}),

	/**
	 * List org's OAuth integrations (all providers)
	 *
	 * Returns all active OAuth integrations connected by the org.
	 */
	list: orgScopedProcedure.query(async ({ ctx }) => {
		try {
			const installations = await ctx.db
				.select()
				.from(gwInstallations)
				.where(
					and(
						eq(gwInstallations.orgId, ctx.auth.orgId),
						eq(gwInstallations.status, "active"),
					),
				);

			return installations.map((inst) => ({
				id: inst.id,
				sourceType: inst.provider,
				isActive: true,
				connectedAt: inst.createdAt,
				lastSyncAt: inst.updatedAt,
			}));
		} catch (error: unknown) {
			console.error("[tRPC connections.list] Failed to fetch integrations:", error);

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
	disconnect: orgScopedProcedure
		.input(
			z.object({
				integrationId: z.string(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const result = await ctx.db
				.update(gwInstallations)
				.set({ status: "revoked" })
				.where(
					and(
						eq(gwInstallations.id, input.integrationId),
						eq(gwInstallations.orgId, ctx.auth.orgId),
					),
				)
				.returning({ id: gwInstallations.id });

			if (!result[0]) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Integration not found or access denied",
				});
			}

			return { success: true };
		}),

	/**
	 * GitHub-specific operations
	 */
	github: {
		/**
		 * Get org's GitHub installation with app installations
		 *
		 * Returns the org's GitHub OAuth connection including
		 * all GitHub App installations accessible to the org.
		 */
		get: orgScopedProcedure.query(async ({ ctx }) => {
			const result = await ctx.db
				.select()
				.from(gwInstallations)
				.where(
					and(
						eq(gwInstallations.orgId, ctx.auth.orgId),
						eq(gwInstallations.provider, "github"),
						eq(gwInstallations.status, "active"),
					),
				)
				.limit(1);

			const installation = result[0];

			if (!installation) {
				return null;
			}

			const providerAccountInfo = installation.providerAccountInfo;
			if (providerAccountInfo?.sourceType !== "github") {
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Invalid provider account info type",
				});
			}

			return {
				id: installation.id,
				orgId: installation.orgId,
				provider: installation.provider,
				connectedAt: installation.createdAt,
				status: installation.status,
				installations: providerAccountInfo.installations ?? [],
			};
		}),

		/**
		 * Validate and refresh installations from GitHub API
		 *
		 * Re-fetches installations from GitHub using stored access token
		 * and updates the installation's providerAccountInfo.
		 *
		 * Returns counts of added/removed installations.
		 */
		validate: orgScopedProcedure.mutation(async ({ ctx }) => {
			const result = await ctx.db
				.select()
				.from(gwInstallations)
				.where(
					and(
						eq(gwInstallations.orgId, ctx.auth.orgId),
						eq(gwInstallations.provider, "github"),
						eq(gwInstallations.status, "active"),
					),
				)
				.limit(1);

			const installation = result[0];

			if (!installation) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "GitHub integration not found. Please connect GitHub first.",
				});
			}

			try {
				// Get access token directly from gw_tokens vault
				const accessToken = await getInstallationToken(installation.id);

				const { installations: githubInstallations } =
					await getUserInstallations(accessToken);

				const providerAccountInfo = installation.providerAccountInfo;
				if (providerAccountInfo?.sourceType !== "github") {
					throw new TRPCError({
						code: "INTERNAL_SERVER_ERROR",
						message: "Invalid provider data type",
					});
				}

				const currentInstallations = providerAccountInfo.installations ?? [];
				const currentIds = new Set(
					currentInstallations.map((i) => i.id.toString()),
				);

				// Map GitHub installations to our format
				const now = new Date().toISOString();
				const newInstallations = githubInstallations.map((install) => {
					const account = install.account;
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

				const added = newInstallations.filter((i) => !currentIds.has(i.id));
				const removed = currentInstallations.filter(
					(i) => !newIds.has(i.id),
				);

				// Update providerAccountInfo with fresh installations
				await ctx.db
					.update(gwInstallations)
					.set({
						providerAccountInfo: {
							version: 1 as const,
							sourceType: "github" as const,
							installations: newInstallations,
						},
						updatedAt: now,
					})
					.where(eq(gwInstallations.id, installation.id));

				return {
					added: added.length,
					removed: removed.length,
					total: newInstallations.length,
				};
			} catch (error: unknown) {
				console.error("[tRPC connections.github.validate] GitHub installation validation failed:", error);

				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Failed to validate GitHub installations",
					cause: error,
				});
			}
		}),

		/**
		 * Get repositories for a GitHub App installation
		 *
		 * Validates org owns the installation, then fetches repositories
		 * using a GitHub App installation token.
		 */
		repositories: orgScopedProcedure
			.input(
				z.object({
					integrationId: z.string(), // gwInstallations.id
					installationId: z.string(), // GitHub App installation external ID
				}),
			)
			.query(async ({ ctx, input }) => {
				// Verify org owns this installation
				const result = await ctx.db
					.select()
					.from(gwInstallations)
					.where(
						and(
							eq(gwInstallations.id, input.integrationId),
							eq(gwInstallations.orgId, ctx.auth.orgId),
						),
					)
					.limit(1);

				const installation = result[0];

				if (!installation) {
					throw new TRPCError({
						code: "NOT_FOUND",
						message: "Installation not found or access denied",
					});
				}

				const providerAccountInfo = installation.providerAccountInfo;
				if (providerAccountInfo?.sourceType !== "github") {
					throw new TRPCError({
						code: "INTERNAL_SERVER_ERROR",
						message: "Invalid provider account info type",
					});
				}

				// Verify the GitHub App installation is accessible
				const installations = providerAccountInfo.installations ?? [];
				const githubInstallation = installations.find(
					(i) => i.id === input.installationId,
				);

				if (!githubInstallation) {
					throw new TRPCError({
						code: "NOT_FOUND",
						message: "Installation not found or not accessible to this connection",
					});
				}

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
					console.error("[tRPC connections.github.repositories] Failed to fetch repositories:", error);

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
		detectConfig: orgScopedProcedure
			.input(
				z.object({
					integrationId: z.string(), // gwInstallations.id
					installationId: z.string(), // GitHub App installation external ID
					fullName: z.string(), // "owner/repo"
					ref: z.string().optional(), // branch/tag/sha (defaults to default branch)
				}),
			)
			.query(async ({ ctx, input }) => {
				// Verify org owns this installation
				const result = await ctx.db
					.select()
					.from(gwInstallations)
					.where(
						and(
							eq(gwInstallations.id, input.integrationId),
							eq(gwInstallations.orgId, ctx.auth.orgId),
						),
					)
					.limit(1);

				const installation = result[0];

				if (!installation) {
					throw new TRPCError({
						code: "NOT_FOUND",
						message: "Installation not found or access denied",
					});
				}

				const providerAccountInfo = installation.providerAccountInfo;
				if (providerAccountInfo?.sourceType !== "github") {
					throw new TRPCError({
						code: "INTERNAL_SERVER_ERROR",
						message: "Invalid provider account info type",
					});
				}

				// Verify the GitHub App installation is accessible
				const githubInstallation = providerAccountInfo.installations?.find(
					(i) => i.id === input.installationId,
				);

				if (!githubInstallation) {
					throw new TRPCError({
						code: "NOT_FOUND",
						message: "Installation not found or not accessible to this connection",
					});
				}

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

					const octokit = await app.getInstallationOctokit(
						installationIdNumber,
					);

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

					if (ref && !/^[a-zA-Z0-9._/-]+$/.test(ref)) {
						throw new TRPCError({
							code: "BAD_REQUEST",
							message:
								"Invalid ref format. Only alphanumeric characters, dots, dashes, slashes, and underscores are allowed.",
						});
					}

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

							if ("content" in data && "type" in data) {
								const maxSize = 50 * 1024;
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
							if (error && typeof error === "object" && "status" in error && (error as { status: number }).status === 404) {
								continue;
							}
							throw error;
						}
					}

					return { exists: false };
				} catch (error: unknown) {
					console.error("[tRPC connections.github.detectConfig] Failed to detect config:", error);

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
		 * Get org's Vercel installation
		 *
		 * Returns the org's Vercel OAuth connection including
		 * team and configuration information.
		 */
		get: orgScopedProcedure.query(async ({ ctx }) => {
			const result = await ctx.db
				.select()
				.from(gwInstallations)
				.where(
					and(
						eq(gwInstallations.orgId, ctx.auth.orgId),
						eq(gwInstallations.provider, "vercel"),
						eq(gwInstallations.status, "active"),
					),
				)
				.limit(1);

			const installation = result[0];

			if (!installation) {
				return null;
			}

			const providerAccountInfo = installation.providerAccountInfo;
			if (providerAccountInfo?.sourceType !== "vercel") {
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Invalid provider account info type",
				});
			}

			return {
				id: installation.id,
				orgId: installation.orgId,
				provider: installation.provider,
				connectedAt: installation.createdAt,
				status: installation.status,
				vercelUserId: providerAccountInfo.userId,
				teamId: providerAccountInfo.teamId,
				teamSlug: providerAccountInfo.teamSlug,
				configurationId: providerAccountInfo.configurationId,
			};
		}),

		/**
		 * List Vercel projects for project selector
		 *
		 * Returns all projects from org's Vercel account with connection status.
		 * Used by the project selector modal to show available projects.
		 */
		listProjects: orgScopedProcedure
			.input(
				z.object({
					installationId: z.string(), // gwInstallations.id
					workspaceId: z.string(),
					cursor: z.string().optional(),
				}),
			)
			.query(async ({ ctx, input }) => {
				// 1. Verify org owns this installation
				const installation = await ctx.db.query.gwInstallations.findFirst({
					where: and(
						eq(gwInstallations.id, input.installationId),
						eq(gwInstallations.orgId, ctx.auth.orgId),
						eq(gwInstallations.provider, "vercel"),
						eq(gwInstallations.status, "active"),
					),
				});

				if (!installation) {
					throw new TRPCError({
						code: "NOT_FOUND",
						message: "Vercel connection not found",
					});
				}

				// 2. Get access token directly from gw_tokens vault
				const accessToken = await getInstallationToken(installation.id);

				// 3. Get team ID from providerAccountInfo
				const providerAccountInfo = installation.providerAccountInfo;
				if (providerAccountInfo?.sourceType !== "vercel") {
					throw new TRPCError({
						code: "INTERNAL_SERVER_ERROR",
						message: "Invalid provider account info",
					});
				}
				const teamId = providerAccountInfo.teamId;

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
					// Mark installation as needing re-auth
					await ctx.db
						.update(gwInstallations)
						.set({ status: "error" })
						.where(eq(gwInstallations.id, input.installationId));

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
						eq(workspaceIntegrations.installationId, input.installationId),
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
		disconnect: orgScopedProcedure.mutation(async ({ ctx }) => {
			const result = await ctx.db
				.update(gwInstallations)
				.set({ status: "revoked" })
				.where(
					and(
						eq(gwInstallations.orgId, ctx.auth.orgId),
						eq(gwInstallations.provider, "vercel"),
					),
				)
				.returning({ id: gwInstallations.id });

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
