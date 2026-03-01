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
				provider: z.enum(["github", "vercel", "sentry"]),
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

			// Merge installations from all gwInstallation rows, tagging each with
			// its parent gwInstallationId so the UI can pass the correct
			// integrationId when fetching repositories.
			const allInstallations = results.flatMap((row) => {
				const info = row.providerAccountInfo;
				if (info?.sourceType !== "github") return [];
				return (info.installations ?? []).map((inst) => ({
					...inst,
					gwInstallationId: row.id,
				}));
			});

			const first = results[0]!;
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
				const refreshedInstallation = {
					id: installation.externalId,
					accountId: account.id.toString(),
					accountLogin: "login" in account ? account.login : "",
					accountType,
					avatarUrl: "avatar_url" in account ? account.avatar_url : "",
					permissions: githubInstallation.permissions as Record<string, string>,
					events: githubInstallation.events,
					installedAt: githubInstallation.created_at,
					lastValidatedAt: now,
				};

				const currentInstallations = providerAccountInfo.installations;

				// Update providerAccountInfo with refreshed data
				await ctx.db
					.update(gwInstallations)
					.set({
						providerAccountInfo: {
							version: 1 as const,
							sourceType: "github" as const,
							installations: [refreshedInstallation],
						},
						updatedAt: now,
					})
					.where(eq(gwInstallations.id, installation.id));

				return {
					added: currentInstallations.length === 0 ? 1 : 0,
					removed: Math.max(0, currentInstallations.length - 1),
					total: 1,
				};
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

				const providerAccountInfo = installation.providerAccountInfo;
				if (providerAccountInfo?.sourceType !== "github") {
					throw new TRPCError({
						code: "INTERNAL_SERVER_ERROR",
						message: "Invalid provider account info type",
					});
				}

				// Verify the GitHub App installation is accessible
				const installations = providerAccountInfo.installations;
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
				const githubInstallation = providerAccountInfo.installations.find(
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

			return {
				installations: results
					.map((inst) => {
						const info = inst.providerAccountInfo;
						if (info?.sourceType !== "vercel") return null;
						return {
							id: inst.id,
							orgId: inst.orgId,
							provider: inst.provider,
							connectedAt: inst.createdAt,
							status: inst.status,
							vercelUserId: info.userId,
							teamId: info.teamId ?? null,
							teamSlug: info.teamSlug ?? null,
							configurationId: info.configurationId,
						};
					})
					.filter((v): v is NonNullable<typeof v> => v !== null),
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
				const teamId = providerAccountInfo.teamId;

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
	 * Sentry-specific operations
	 */
	sentry: {
		/**
		 * Get org's Sentry installation
		 *
		 * Returns the org's Sentry OAuth connection.
		 * Sentry is org-level — no per-resource picker needed.
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
	},
} satisfies TRPCRouterRecord;
