import type { TRPCRouterRecord } from "@trpc/server";
import {
  // New 2-table system
  userSources,
  workspaceSources,
  type UserSource,
  // Common
  workspaces,
} from "@db/console/schema";
import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import {
  getUserInstallations,
  getInstallationRepositories,
  createGitHubApp,
  type GitHubInstallation,
} from "@repo/console-octokit-github";
import { decrypt } from "@repo/lib";
import { getWorkspaceKey } from "@db/console/utils";
import { inngest } from "@api/console/inngest";
import { env } from "../env";

import { protectedProcedure, resolveWorkspaceByName } from "../trpc";

/**
 * Integration Router (Simplified 2-Table Model)
 *
 * Manages user OAuth connections and workspace sources.
 *
 * New Flow:
 * 1. User completes OAuth → creates userSource (personal connection)
 * 2. User picks repo/team → creates workspaceSource (directly links to workspace)
 *
 * No more intermediate integrationResources table!
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
    true // Format private key
  );
}

/**
 * Helper: Verify user owns source
 */
async function verifyUserSourceOwnership(
  ctx: any,
  userSourceId: string
): Promise<UserSource> {
  const result = await ctx.db
    .select()
    .from(userSources)
    .where(
      and(
        eq(userSources.id, userSourceId),
        eq(userSources.userId, ctx.auth.userId)
      )
    )
    .limit(1);

  const userSource = result[0];

  if (!userSource) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "User source not found or access denied",
    });
  }

  return userSource;
}

export const integrationRouter = {
  /**
   * GitHub: List user's GitHub source with installations
   *
   * Returns the user's personal GitHub OAuth connection including
   * all GitHub App installations they have access to.
   */
  github: {
    list: protectedProcedure.query(async ({ ctx }) => {
      // Get user's GitHub source
      const result = await ctx.db
        .select()
        .from(userSources)
        .where(
          and(
            eq(userSources.userId, ctx.auth.userId),
            eq(userSources.provider, "github")
          )
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
            eq(userSources.provider, "github")
          )
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
          currentInstallations.map((i: any) => i.id.toString())
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
        const removed = currentInstallations.filter((i: any) => !newIds.has(i.id));

        // Update providerMetadata with fresh installations
        await ctx.db
          .update(userSources)
          .set({
            providerMetadata: {
              provider: "github" as const,
              installations: newInstallations,
            },
            lastSyncAt: new Date(),
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
     * Get repositories for a GitHub App installation
     *
     * Validates user owns the installation, then fetches repositories
     * using a GitHub App installation token.
     */
    repositories: protectedProcedure
      .input(
        z.object({
          integrationId: z.string(), // userSource.id
          installationId: z.string(),
        })
      )
      .query(async ({ ctx, input }) => {
        // Verify user owns this userSource
        const userSource = await verifyUserSourceOwnership(ctx, input.integrationId);

        // Verify provider is GitHub
        const providerMetadata = userSource.providerMetadata;
        if (providerMetadata.provider !== "github") {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Invalid provider metadata type",
          });
        }

        // Find the installation
        const installations = providerMetadata.installations ?? [];
        const installation = installations.find(
          (i) => i.id === input.installationId
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
            10
          );

          const { repositories } = await getInstallationRepositories(
            app,
            installationIdNumber
          );

          // Return repository data
          return repositories.map((repo) => ({
            id: repo.id.toString(),
            name: repo.name,
            fullName: repo.full_name,
            owner: repo.owner?.login ?? "",
            description: repo.description ?? null,
            defaultBranch: repo.default_branch ?? "main",
            isPrivate: repo.private ?? false,
            isArchived: repo.archived ?? false,
            url: repo.html_url ?? "",
            language: repo.language ?? null,
            stargazersCount: repo.stargazers_count ?? 0,
            updatedAt: repo.updated_at ?? new Date().toISOString(),
          }));
        } catch (error: any) {
          console.error("[tRPC] Failed to fetch repositories:", error);

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
    detectConfig: protectedProcedure
      .input(
        z.object({
          integrationId: z.string(), // userSource.id
          installationId: z.string(),
          fullName: z.string(), // "owner/repo"
          ref: z.string().optional(), // branch/tag/sha (defaults to default branch)
        })
      )
      .query(async ({ ctx, input }) => {
        // Verify user owns this userSource
        const userSource = await verifyUserSourceOwnership(ctx, input.integrationId);

        // Verify provider is GitHub
        const providerMetadata = userSource.providerMetadata;
        if (providerMetadata.provider !== "github") {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Invalid provider metadata type",
          });
        }

        // Find the installation
        const installation = providerMetadata.installations?.find(
          (i) => i.id === input.installationId
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
            10
          );

          // Get installation octokit
          const octokit = await app.getInstallationOctokit(
            installationIdNumber
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
              }
            );
            ref = repoInfo.default_branch;
          }

          // Validate ref format to prevent injection attacks
          // Allow: alphanumeric, dots, dashes, slashes, underscores
          if (ref && !/^[a-zA-Z0-9._/-]+$/.test(ref)) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "Invalid ref format. Only alphanumeric characters, dots, dashes, slashes, and underscores are allowed.",
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
                }
              );

              // Check if it's a file (not directory)
              if ("content" in data && "type" in data && data.type === "file") {
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
                  "utf-8"
                );

                // Validate YAML format before returning
                try {
                  const yaml = await import("yaml");
                  yaml.parse(content);
                } catch (yamlError) {
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
            } catch (error: any) {
              // 404 means file doesn't exist, try next candidate
              if (error.status === 404) {
                continue;
              }
              // Other errors: log and continue
              console.error(
                `[tRPC] Error checking ${path} in ${owner}/${repo}:`,
                error
              );
              continue;
            }
          }

          // No config found
          return { exists: false };
        } catch (error: any) {
          console.error("[tRPC] Failed to detect config:", error);

          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to detect repository configuration",
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
            })
          ),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const now = new Date();

        // Check if userSource already exists for this user
        const existingUserSource = await ctx.db
          .select()
          .from(userSources)
          .where(
            and(
              eq(userSources.userId, ctx.auth.userId),
              eq(userSources.provider, "github")
            )
          )
          .limit(1);

        if (existingUserSource[0]) {
          // Update existing userSource
          await ctx.db
            .update(userSources)
            .set({
              accessToken: input.accessToken,
              refreshToken: input.refreshToken ?? null,
              tokenExpiresAt: input.tokenExpiresAt ? new Date(input.tokenExpiresAt) : null,
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
              tokenExpiresAt: input.tokenExpiresAt ? new Date(input.tokenExpiresAt) : null,
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


  /**
   * Workspace: Connect resources to workspaces (NEW 2-Table System)
   */
  workspace: {

    /**
     * Connect a repository directly to a workspace (Simplified 2-Table Model)
     *
     * This is the new simplified API that replaces the 2-step process:
     * OLD: resources.create → workspace.connect
     * NEW: workspace.connectDirect (single call)
     *
     * Creates a workspaceSource directly without intermediate integrationResource.
     */
    connectDirect: protectedProcedure
      .input(
        z.object({
          clerkOrgSlug: z.string(),
          workspaceName: z.string(),
          userSourceId: z.string(), // User's GitHub connection
          // Repository data
          installationId: z.string(),
          repoId: z.string(),
          repoName: z.string(),
          repoFullName: z.string(),
          defaultBranch: z.string(),
          isPrivate: z.boolean(),
          isArchived: z.boolean(),
          // Sync config
          syncConfig: z.object({
            branches: z.array(z.string()).optional(),
            paths: z.array(z.string()).optional(),
            events: z.array(z.string()).optional(),
            autoSync: z.boolean(),
          }),
        })
      )
      .mutation(async ({ ctx, input }) => {
        // 1. Verify workspace access
        const { workspaceId } = await resolveWorkspaceByName({
          clerkOrgSlug: input.clerkOrgSlug,
          workspaceName: input.workspaceName,
          userId: ctx.auth.userId,
        });

        // 2. Verify user owns the userSource
        await verifyUserSourceOwnership(ctx, input.userSourceId);

        // 3. Check if this repo is already connected to this workspace
        const existingResult = await ctx.db
          .select()
          .from(workspaceSources)
          .where(
            and(
              eq(workspaceSources.workspaceId, workspaceId),
              eq(workspaceSources.userSourceId, input.userSourceId)
            )
          );

        const existing = existingResult.find((ws) => {
          const data = ws.sourceConfig;
          return (
            data.provider === "github" &&
            data.type === "repository" &&
            data.repoId === input.repoId
          );
        });

        if (existing) {
          // Idempotent: Update existing with new sync config
          console.log(`[integration.workspace.connectDirect] Repository ${input.repoFullName} already connected, updating sync config`);

          // Get current sourceConfig and merge with new sync settings
          const currentConfig = existing.sourceConfig;
          if (currentConfig.provider === "github" && currentConfig.type === "repository") {
            await ctx.db
              .update(workspaceSources)
              .set({
                sourceConfig: {
                  ...currentConfig,
                  sync: input.syncConfig,
                },
                isActive: true,
              })
              .where(eq(workspaceSources.id, existing.id));
          }

          const updated = await ctx.db
            .select()
            .from(workspaceSources)
            .where(eq(workspaceSources.id, existing.id))
            .limit(1);

          return updated[0];
        }

        // 4. Create new workspaceSource
        const workspaceSourceId = crypto.randomUUID();

        await ctx.db.insert(workspaceSources).values({
          id: workspaceSourceId,
          workspaceId,
          userSourceId: input.userSourceId,
          connectedBy: ctx.auth.userId,
          sourceConfig: {
            provider: "github" as const,
            type: "repository" as const,
            installationId: input.installationId,
            repoId: input.repoId,
            repoName: input.repoName,
            repoFullName: input.repoFullName,
            defaultBranch: input.defaultBranch,
            isPrivate: input.isPrivate,
            isArchived: input.isArchived,
            sync: input.syncConfig,
          },
          providerResourceId: input.repoId,
          isActive: true,
        });

        const created = await ctx.db
          .select()
          .from(workspaceSources)
          .where(eq(workspaceSources.id, workspaceSourceId))
          .limit(1);

        const workspaceSource = created[0];

        // 5. Trigger initial sync via Inngest
        if (workspaceSource) {
          try {
            const workspaceResult = await ctx.db
              .select()
              .from(workspaces)
              .where(eq(workspaces.id, workspaceId))
              .limit(1);

            const workspace = workspaceResult[0];

            if (workspace) {
              await inngest.send({
                name: "apps-console/repository.connected",
                data: {
                  workspaceId,
                  workspaceKey: getWorkspaceKey(workspace.slug),
                  resourceId: workspaceSourceId,
                  repoFullName: input.repoFullName,
                  defaultBranch: input.defaultBranch,
                  installationId: input.installationId,
                  integrationId: input.userSourceId, // Use userSourceId
                  isPrivate: input.isPrivate,
                },
              });

              console.log(`[integration.workspace.connectDirect] Triggered initial sync for ${input.repoFullName}`);
            }
          } catch (inngestError) {
            console.error("[integration.workspace.connectDirect] Failed to trigger initial sync:", inngestError);
          }
        }

        return workspaceSource;
      }),
  },
} satisfies TRPCRouterRecord;
