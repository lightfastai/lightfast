import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { gwInstallations, workspaceIntegrations, orgWorkspaces } from "@db/console/schema";
import { orgScopedProcedure, apiKeyProcedure } from "../../trpc";
import {
	createGitHubApp,
	getInstallationRepositories,
	getAppInstallation,
} from "@repo/console-octokit-github";
import { getInstallationToken } from "../../lib/token-vault";
import { env } from "../../env";
import yaml from "yaml";
import type { VercelProjectsResponse } from "@repo/console-vercel/types";
import { withRelatedProject } from "@vendor/related-projects";

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
				`${connectionsUrl}/services/connections/${input.provider}/authorize`,
				{
					headers: {
						"X-Org-Id": ctx.auth.orgId,
						"X-User-Id": ctx.auth.userId,
						"X-API-Key": env.GATEWAY_API_KEY,
						"X-Request-Source": "console-trpc",
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
	 * CLI: Get OAuth authorize URL using API key auth.
	 *
	 * Resolves orgId from the API key's workspace, then proxies to
	 * connections service with redirect_to=inline for CLI mode.
	 */
	cliAuthorize: apiKeyProcedure
		.input(
			z.object({
				provider: z.enum(["github", "vercel", "linear", "sentry"]),
			}),
		)
		.query(async ({ ctx, input }) => {
			// Resolve clerkOrgId from workspace
			const workspace = await ctx.db.query.orgWorkspaces.findFirst({
				where: eq(orgWorkspaces.id, ctx.auth.workspaceId),
				columns: { clerkOrgId: true },
			});

			if (!workspace?.clerkOrgId) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Workspace not found or has no organization",
				});
			}

			const res = await fetch(
				`${connectionsUrl}/services/connections/${input.provider}/authorize?redirect_to=inline`,
				{
					headers: {
						"X-Org-Id": workspace.clerkOrgId,
						"X-User-Id": ctx.auth.userId,
						"X-API-Key": env.GATEWAY_API_KEY,
						"X-Request-Source": "console-trpc-cli",
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
		 * List org's GitHub installations
		 *
		 * Returns all active GitHub App installations accessible to the org,
		 * merged across gwInstallation rows with gwInstallationId tags.
		 */
		list: orgScopedProcedure.query(async ({ ctx }) => {
			const results = await ctx.db
				.select()
				.from(gwInstallations)
				.where(
					and(
						eq(gwInstallations.orgId, ctx.auth.orgId),
						eq(gwInstallations.provider, "github"),
						eq(gwInstallations.status, "active"),
					),
				);

			if (results.length === 0) {
				return null;
			}

			// Read account info from cached providerAccountInfo (populated during
			// OAuth callback and refreshed by github.validate). No live API calls —
			// keeps .list fast and resilient to stale/deleted installations.
			const allInstallations = results
				.filter((row) => row.providerAccountInfo?.sourceType === "github")
				.map((row) => {
					const info = row.providerAccountInfo as Extract<typeof row.providerAccountInfo, { sourceType: "github" }>;
					const account = info.raw.account;
					return {
						id: row.externalId,
						accountLogin: account.login || row.externalId,
						accountType: account.type === "User" ? "User" as const : "Organization" as const,
						avatarUrl: account.avatar_url || "",
						gwInstallationId: row.id,
					};
				});

			const first = results[0];
			if (!first) return null;
			return {
				id: first.id,
				orgId: first.orgId,
				provider: first.provider,
				connectedAt: first.createdAt,
				status: first.status,
				installations: allInstallations,
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

			const providerAccountInfo = installation.providerAccountInfo;
			if (providerAccountInfo?.sourceType !== "github") {
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Invalid provider data type",
				});
			}

			try {
				const app = getGitHubApp();
				const installationIdNumber = Number.parseInt(installation.externalId, 10);

				// Fetch fresh installation details using App JWT
				const githubInstallation = await getAppInstallation(app, installationIdNumber);

				const account = githubInstallation.account;
				if (!account || !("login" in account)) {
					throw new Error("Installation response missing account data");
				}

				const now = new Date().toISOString();
				const accountType: "User" | "Organization" =
					"type" in account && account.type === "User" ? "User" : "Organization";

				const refreshedAccountInfo = {
					version: 1 as const,
					sourceType: "github" as const,
					events: githubInstallation.events,
					installedAt: githubInstallation.created_at,
					lastValidatedAt: now,
					raw: {
						account: {
							login: "login" in account ? account.login : "",
							id: account.id,
							type: accountType,
							avatar_url: "avatar_url" in account ? account.avatar_url : "",
						},
						permissions: githubInstallation.permissions,
						events: githubInstallation.events,
						created_at: githubInstallation.created_at,
					},
				};

				// Update providerAccountInfo with refreshed data
				await ctx.db
					.update(gwInstallations)
					.set({
						providerAccountInfo: refreshedAccountInfo,
						updatedAt: now,
					})
					.where(eq(gwInstallations.id, installation.id));

				return { added: 0, removed: 0, total: 1 };
			} catch (error: unknown) {
				console.error("[tRPC connections.github.validate] GitHub installation validation failed:", error);

				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Failed to validate GitHub installation",
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

				// Verify the GitHub App installation is accessible via the table column
				if (installation.externalId !== input.installationId) {
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

				// Verify the GitHub App installation is accessible via the table column
				if (installation.externalId !== input.installationId) {
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
		 * List all org's Vercel installations
		 *
		 * Returns all active Vercel OAuth connections (one per team).
		 * Used by workspace creation to support multi-team selection.
		 */
		list: orgScopedProcedure.query(async ({ ctx }) => {
			const results = await ctx.db
				.select()
				.from(gwInstallations)
				.where(
					and(
						eq(gwInstallations.orgId, ctx.auth.orgId),
						eq(gwInstallations.provider, "vercel"),
						eq(gwInstallations.status, "active"),
					),
				);

			// Fetch live account info from Vercel API for each installation.
			// Wrapped in try/catch so a single failed token/network call doesn't
			// crash the entire list — falls back to cached IDs from providerAccountInfo.
			// TODO: Store team_slug/username in VercelOAuthRaw during callback so
			// this can become fully cached like github.list (no live API calls).
			const installations = await Promise.all(
				results
					.filter((inst) => inst.providerAccountInfo?.sourceType === "vercel")
					.map(async (inst) => {
						const info = inst.providerAccountInfo as Extract<typeof inst.providerAccountInfo, { sourceType: "vercel" }>;

						let accountLogin: string;
						let accountType: "Team" | "User";

						try {
							const accessToken = await getInstallationToken(inst.id);

							if (info.raw.team_id) {
								const res = await fetch(`https://api.vercel.com/v2/teams/${info.raw.team_id}`, {
									headers: { Authorization: `Bearer ${accessToken}` },
									signal: AbortSignal.timeout(10_000),
								});
								if (res.ok) {
									const data = (await res.json()) as Record<string, unknown>;
									accountLogin = typeof data.slug === "string" ? data.slug : info.raw.team_id;
								} else {
									accountLogin = info.raw.team_id;
								}
								accountType = "Team";
							} else {
								const res = await fetch("https://api.vercel.com/v2/user", {
									headers: { Authorization: `Bearer ${accessToken}` },
									signal: AbortSignal.timeout(10_000),
								});
								if (res.ok) {
									const data = (await res.json()) as Record<string, unknown>;
									const user = data.user as Record<string, unknown> | undefined;
									accountLogin = typeof user?.username === "string" ? user.username : info.raw.user_id;
								} else {
									accountLogin = info.raw.user_id;
								}
								accountType = "User";
							}
						} catch (error) {
							// Fall back to cached IDs when token retrieval or API call fails
							console.warn("[connections.vercel.list] Failed to fetch account info, using cached fallback:", error);
							accountLogin = info.raw.team_id ?? info.raw.user_id;
							accountType = info.raw.team_id ? "Team" : "User";
						}

						return {
							id: inst.id,
							orgId: inst.orgId,
							provider: inst.provider,
							connectedAt: inst.createdAt,
							status: inst.status,
							userId: info.raw.user_id,
							teamId: info.raw.team_id ?? null,
							configurationId: info.raw.installation_id,
							accountLogin,
							accountType,
						};
					}),
			);

			return { installations };
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
					workspaceId: z.string().optional(),
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
				const teamId = providerAccountInfo.raw.team_id;

				// 4. Call Vercel API
				const url = new URL("https://api.vercel.com/v9/projects");
				if (teamId) url.searchParams.set("teamId", teamId);
				url.searchParams.set("limit", "100");
				if (input.cursor) url.searchParams.set("until", input.cursor);

				const response = await fetch(url.toString(), {
					headers: { Authorization: `Bearer ${accessToken}` },
				});

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
					console.error("[Vercel API Error]", response.status);
					throw new TRPCError({
						code: "INTERNAL_SERVER_ERROR",
						message: "Failed to fetch Vercel projects",
					});
				}

				const data = (await response.json()) as VercelProjectsResponse;

				// 5. Get already-connected projects for this workspace (only when workspaceId provided)
				let connectedIds = new Set<string>();
				if (input.workspaceId) {
					const connected = await ctx.db.query.workspaceIntegrations.findMany({
						where: and(
							eq(workspaceIntegrations.workspaceId, input.workspaceId),
							eq(workspaceIntegrations.installationId, input.installationId),
							eq(workspaceIntegrations.isActive, true),
						),
						columns: { providerResourceId: true },
					});
					connectedIds = new Set(connected.map((c) => c.providerResourceId));
				}

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

	/**
	 * Linear-specific operations
	 */
	linear: {
		/**
		 * List org's Linear installations
		 *
		 * Returns all active Linear OAuth connections with organization info.
		 * Linear is org-level with per-team resource linking.
		 */
		get: orgScopedProcedure.query(async ({ ctx }) => {
			const result = await ctx.db
				.select()
				.from(gwInstallations)
				.where(
					and(
						eq(gwInstallations.orgId, ctx.auth.orgId),
						eq(gwInstallations.provider, "linear"),
						eq(gwInstallations.status, "active"),
					),
				);

			return result.map((installation) => {
				const info = installation.providerAccountInfo;
				const orgName =
					info?.sourceType === "linear"
						? info.organization?.name
						: undefined;
				const orgUrlKey =
					info?.sourceType === "linear"
						? info.organization?.urlKey
						: undefined;

				return {
					id: installation.id,
					orgId: installation.orgId,
					provider: installation.provider,
					connectedAt: installation.createdAt,
					status: installation.status,
					organizationName: orgName ?? null,
					organizationUrlKey: orgUrlKey ?? null,
				};
			});
		}),

		/**
		 * List Linear teams for team selector
		 *
		 * Fetches teams from the Linear GraphQL API using stored OAuth token.
		 * Used by workspace creation to select which team to link.
		 */
		listTeams: orgScopedProcedure
			.input(
				z.object({
					installationId: z.string(), // gwInstallations.id
				}),
			)
			.query(async ({ ctx, input }) => {
				// 1. Verify org owns this installation
				const installation = await ctx.db.query.gwInstallations.findFirst({
					where: and(
						eq(gwInstallations.id, input.installationId),
						eq(gwInstallations.orgId, ctx.auth.orgId),
						eq(gwInstallations.provider, "linear"),
						eq(gwInstallations.status, "active"),
					),
				});

				if (!installation) {
					throw new TRPCError({
						code: "NOT_FOUND",
						message: "Linear connection not found",
					});
				}

				// 2. Get access token from gw_tokens vault
				const accessToken = await getInstallationToken(installation.id);

				// 3. Call Linear GraphQL API
				const response = await fetch("https://api.linear.app/graphql", {
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						Authorization: accessToken,
					},
					body: JSON.stringify({
						query: `{
							teams {
								nodes {
									id
									name
									key
									description
									color
								}
							}
						}`,
					}),
					signal: AbortSignal.timeout(10_000),
				});

				if (response.status === 401) {
					await ctx.db
						.update(gwInstallations)
						.set({ status: "error" })
						.where(eq(gwInstallations.id, input.installationId));

					throw new TRPCError({
						code: "UNAUTHORIZED",
						message: "Linear connection expired. Please reconnect.",
					});
				}

				if (!response.ok) {
					console.error("[Linear API Error]", response.status);
					throw new TRPCError({
						code: "INTERNAL_SERVER_ERROR",
						message: "Failed to fetch Linear teams",
					});
				}

				const data = (await response.json()) as {
					data?: {
						teams?: {
							nodes?: {
								id: string;
								name: string;
								key: string;
								description?: string;
								color?: string;
							}[];
						};
					};
				};

				const teams = data.data?.teams?.nodes ?? [];

				return {
					teams: teams.map((t) => ({
						id: t.id,
						name: t.name,
						key: t.key,
						description: t.description ?? null,
						color: t.color ?? null,
					})),
				};
			}),
	},

	/**
	 * Sentry-specific operations
	 */
	sentry: {
		/**
		 * Get org's Sentry installation
		 *
		 * Returns the org's Sentry OAuth connection with organization info.
		 */
		get: orgScopedProcedure.query(async ({ ctx }) => {
			const result = await ctx.db
				.select()
				.from(gwInstallations)
				.where(
					and(
						eq(gwInstallations.orgId, ctx.auth.orgId),
						eq(gwInstallations.provider, "sentry"),
						eq(gwInstallations.status, "active"),
					),
				)
				.limit(1);

			const installation = result[0];

			if (!installation) {
				return null;
			}

			return {
				id: installation.id,
				orgId: installation.orgId,
				provider: installation.provider,
				connectedAt: installation.createdAt,
				status: installation.status,
			};
		}),

		/**
		 * List Sentry projects for project selector
		 *
		 * Returns all projects from org's Sentry account with connection status.
		 * Used by workspace creation to select which project to link.
		 */
		listProjects: orgScopedProcedure
			.input(
				z.object({
					installationId: z.string(),
					workspaceId: z.string().optional(),
				}),
			)
			.query(async ({ ctx, input }) => {
				// 1. Verify org owns this installation
				const installation = await ctx.db.query.gwInstallations.findFirst({
					where: and(
						eq(gwInstallations.id, input.installationId),
						eq(gwInstallations.orgId, ctx.auth.orgId),
						eq(gwInstallations.provider, "sentry"),
						eq(gwInstallations.status, "active"),
					),
				});

				if (!installation) {
					throw new TRPCError({
						code: "NOT_FOUND",
						message: "Sentry connection not found",
					});
				}

				// 2. Get access token from gw_tokens vault
				const accessToken = await getInstallationToken(installation.id);

				// 3. Call Sentry API — /api/0/projects/ works with installation tokens
				// (scoped to the org the app is installed on, no org slug needed)
				const response = await fetch(
					"https://sentry.io/api/0/projects/",
					{
						headers: { Authorization: `Bearer ${accessToken}` },
						signal: AbortSignal.timeout(10_000),
					},
				);

				if (response.status === 401) {
					await ctx.db
						.update(gwInstallations)
						.set({ status: "error" })
						.where(eq(gwInstallations.id, input.installationId));

					throw new TRPCError({
						code: "UNAUTHORIZED",
						message: "Sentry connection expired. Please reconnect.",
					});
				}

				if (!response.ok) {
					console.error("[Sentry API Error]", response.status);
					throw new TRPCError({
						code: "INTERNAL_SERVER_ERROR",
						message: "Failed to fetch Sentry projects",
					});
				}

				const data = (await response.json()) as {
					id: string;
					slug: string;
					name: string;
					platform: string | null;
					status: string;
				}[];

				// 5. Get already-connected projects for this workspace
				let connectedIds = new Set<string>();
				if (input.workspaceId) {
					const connected = await ctx.db.query.workspaceIntegrations.findMany({
						where: and(
							eq(workspaceIntegrations.workspaceId, input.workspaceId),
							eq(workspaceIntegrations.installationId, input.installationId),
							eq(workspaceIntegrations.isActive, true),
						),
						columns: { providerResourceId: true },
					});
					connectedIds = new Set(connected.map((c) => c.providerResourceId));
				}

				// 6. Return with connection status
				return {
					projects: data.map((p) => ({
						id: p.id,
						slug: p.slug,
						name: p.name,
						platform: p.platform,
						isConnected: connectedIds.has(p.id),
					})),
				};
			}),
	},
} satisfies TRPCRouterRecord;
