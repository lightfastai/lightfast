import type { TRPCRouterRecord } from "@trpc/server";
import {
  integrations,
  integrationResources,
  workspaceIntegrations,
  type Integration,
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
import { env } from "../env";

import { protectedProcedure } from "../trpc";

/**
 * Integration Router
 *
 * Manages personal OAuth integrations (user-level connections to GitHub, Notion, etc.)
 * and their authorization for use in workspaces.
 *
 * Flow:
 * 1. User completes OAuth (handled in /api/github/callback) → creates integration record
 * 2. Integration stores access token + provider data (installations)
 * 3. User selects specific resources (repos, teams) → creates integrationResources
 * 4. User connects resources to workspaces → creates workspaceIntegrations
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
 * Helper: Verify user owns integration
 */
async function verifyIntegrationOwnership(
  ctx: any,
  integrationId: string
): Promise<Integration> {
  const result = await ctx.db
    .select()
    .from(integrations)
    .where(
      and(
        eq(integrations.id, integrationId),
        eq(integrations.userId, ctx.auth.userId)
      )
    )
    .limit(1);

  const integration = result[0];

  if (!integration) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Integration not found or access denied",
    });
  }

  return integration;
}

export const integrationRouter = {
  /**
   * GitHub: List user's GitHub integration with installations
   *
   * Returns the user's personal GitHub OAuth connection including
   * all GitHub App installations they have access to.
   */
  github: {
    list: protectedProcedure.query(async ({ ctx }) => {
      // Get user's GitHub integration
      const result = await ctx.db
        .select()
        .from(integrations)
        .where(
          and(
            eq(integrations.userId, ctx.auth.userId),
            eq(integrations.provider, "github")
          )
        )
        .limit(1);

      const integration = result[0];

      if (!integration) {
        return null;
      }

      // Return integration with installations from providerData
      const providerData = integration.providerData;
      if (providerData.provider !== "github") {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Invalid provider data type",
        });
      }

      return {
        id: integration.id,
        userId: integration.userId,
        provider: integration.provider,
        connectedAt: integration.connectedAt,
        isActive: integration.isActive,
        installations: providerData.installations ?? [],
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
        .from(integrations)
        .where(
          and(
            eq(integrations.userId, ctx.auth.userId),
            eq(integrations.provider, "github")
          )
        )
        .limit(1);

      const integration = result[0];

      if (!integration) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "GitHub integration not found. Please connect GitHub first.",
        });
      }

      // Fetch fresh installations from GitHub
      try {
        // Decrypt access token before use
        const accessToken = decrypt(integration.accessToken, env.ENCRYPTION_KEY);

        const { installations: githubInstallations } =
          await getUserInstallations(accessToken);

        // Get current installations from providerData
        const providerData = integration.providerData;
        if (providerData.provider !== "github") {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Invalid provider data type",
          });
        }

        const currentInstallations = providerData.installations ?? [];
        const currentIds = new Set(
          currentInstallations.map((i) => i.id.toString())
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
            accountId: account?.id?.toString() ?? "",
            accountLogin,
            accountType,
            avatarUrl: account?.avatar_url ?? "",
            permissions: (install.permissions as Record<string, string>) ?? {},
            installedAt: install.created_at ?? now,
            lastValidatedAt: now,
          };
        });

        const newIds = new Set(newInstallations.map((i) => i.id));

        // Calculate changes
        const added = newInstallations.filter((i) => !currentIds.has(i.id));
        const removed = currentInstallations.filter((i) => !newIds.has(i.id));

        // Update providerData with fresh installations
        await ctx.db
          .update(integrations)
          .set({
            providerData: {
              provider: "github" as const,
              installations: newInstallations,
            },
            lastSyncAt: new Date(),
          })
          .where(eq(integrations.id, integration.id));

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
          integrationId: z.string(),
          installationId: z.string(),
        })
      )
      .query(async ({ ctx, input }) => {
        // Verify ownership
        const integration = await verifyIntegrationOwnership(
          ctx,
          input.integrationId
        );

        // Verify provider is GitHub
        if (integration.provider !== "github") {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Integration is not a GitHub integration",
          });
        }

        // Verify user has access to this installation
        const providerData = integration.providerData;
        if (providerData.provider !== "github") {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Invalid provider data type",
          });
        }

        const installation = providerData.installations?.find(
          (i) => i.id === input.installationId
        );

        if (!installation) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message:
              "Installation not found or not accessible to this integration",
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

        // Check if integration already exists for this user
        const existingIntegration = await ctx.db
          .select()
          .from(integrations)
          .where(
            and(
              eq(integrations.userId, ctx.auth.userId),
              eq(integrations.provider, "github")
            )
          )
          .limit(1);

        if (existingIntegration[0]) {
          // Update existing integration
          await ctx.db
            .update(integrations)
            .set({
              accessToken: input.accessToken,
              refreshToken: input.refreshToken ?? null,
              tokenExpiresAt: input.tokenExpiresAt ? new Date(input.tokenExpiresAt) : null,
              providerData: {
                provider: "github" as const,
                installations: input.installations,
              },
              isActive: true,
              lastSyncAt: now,
            })
            .where(eq(integrations.id, existingIntegration[0].id));

          return { id: existingIntegration[0].id, created: false };
        } else {
          // Create new integration
          const result = await ctx.db
            .insert(integrations)
            .values({
              userId: ctx.auth.userId,
              provider: "github",
              accessToken: input.accessToken,
              refreshToken: input.refreshToken ?? null,
              tokenExpiresAt: input.tokenExpiresAt ? new Date(input.tokenExpiresAt) : null,
              providerData: {
                provider: "github" as const,
                installations: input.installations,
              },
              isActive: true,
              connectedAt: now,
            })
            .returning({ id: integrations.id });

          return { id: result[0]!.id, created: true };
        }
      }),
  },

  /**
   * Resources: Manage integration resources (repos, teams, projects)
   */
  resources: {
    /**
     * Create a new integration resource
     *
     * Stores a specific resource (e.g., GitHub repo) that can be
     * connected to workspaces.
     */
    create: protectedProcedure
      .input(
        z.object({
          integrationId: z.string(),
          installationId: z.string(),
          repoId: z.string(),
          repoName: z.string(),
          repoFullName: z.string(),
          defaultBranch: z.string(),
          isPrivate: z.boolean(),
          isArchived: z.boolean(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        // Verify ownership
        const integration = await verifyIntegrationOwnership(
          ctx,
          input.integrationId
        );

        // Verify provider is GitHub
        if (integration.provider !== "github") {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Only GitHub integrations are currently supported",
          });
        }

        // Check if resource already exists for this integration
        // We need to fetch all resources and check the resourceData manually
        // since we can't query JSONB fields directly with Drizzle
        const existingResources = await ctx.db
          .select()
          .from(integrationResources)
          .where(eq(integrationResources.integrationId, input.integrationId));

        const duplicateResource = existingResources.find((resource) => {
          const data = resource.resourceData;
          return (
            data.provider === "github" &&
            data.type === "repository" &&
            data.repoId === input.repoId
          );
        });

        if (duplicateResource) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "This repository is already added as a resource",
          });
        }

        // Create resource
        const resourceId = crypto.randomUUID();

        await ctx.db.insert(integrationResources).values({
          id: resourceId,
          integrationId: input.integrationId,
          resourceData: {
            provider: "github" as const,
            type: "repository" as const,
            installationId: input.installationId,
            repoId: input.repoId,
            repoName: input.repoName,
            repoFullName: input.repoFullName,
            defaultBranch: input.defaultBranch,
            isPrivate: input.isPrivate,
            isArchived: input.isArchived,
          },
        });

        // Return created resource
        const createdResult = await ctx.db
          .select()
          .from(integrationResources)
          .where(eq(integrationResources.id, resourceId))
          .limit(1);

        return createdResult[0];
      }),

    /**
     * List resources for an integration
     */
    list: protectedProcedure
      .input(
        z.object({
          integrationId: z.string(),
        })
      )
      .query(async ({ ctx, input }) => {
        // Verify ownership
        await verifyIntegrationOwnership(ctx, input.integrationId);

        // Fetch resources
        return await ctx.db
          .select()
          .from(integrationResources)
          .where(eq(integrationResources.integrationId, input.integrationId));
      }),
  },

  /**
   * Workspace: Connect resources to workspaces
   */
  workspace: {
    /**
     * Connect a resource to a workspace
     *
     * Creates a workspaceIntegrations record linking a resource
     * (e.g., GitHub repo) to a Lightfast workspace with sync config.
     */
    connect: protectedProcedure
      .input(
        z.object({
          workspaceId: z.string(),
          resourceId: z.string(),
          syncConfig: z.object({
            branches: z.array(z.string()).optional(),
            paths: z.array(z.string()).optional(),
            events: z.array(z.string()).optional(),
            autoSync: z.boolean(),
          }),
        })
      )
      .mutation(async ({ ctx, input }) => {
        // Verify resource exists and user has access
        const resourceResult = await ctx.db
          .select()
          .from(integrationResources)
          .where(eq(integrationResources.id, input.resourceId))
          .limit(1);

        const resource = resourceResult[0];

        if (!resource) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Resource not found",
          });
        }

        // Verify user owns the integration
        await verifyIntegrationOwnership(ctx, resource.integrationId);

        // Check if already connected
        const existingResult = await ctx.db
          .select()
          .from(workspaceIntegrations)
          .where(
            and(
              eq(workspaceIntegrations.workspaceId, input.workspaceId),
              eq(workspaceIntegrations.resourceId, input.resourceId)
            )
          )
          .limit(1);

        if (existingResult.length > 0) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "This resource is already connected to the workspace",
          });
        }

        // Create workspace integration
        const connectionId = crypto.randomUUID();

        await ctx.db.insert(workspaceIntegrations).values({
          id: connectionId,
          workspaceId: input.workspaceId,
          resourceId: input.resourceId,
          connectedByUserId: ctx.auth.userId,
          syncConfig: input.syncConfig,
          isActive: true,
        });

        // Return created connection
        const createdResult = await ctx.db
          .select()
          .from(workspaceIntegrations)
          .where(eq(workspaceIntegrations.id, connectionId))
          .limit(1);

        return createdResult[0];
      }),

    /**
     * List workspace connections for a resource
     */
    list: protectedProcedure
      .input(
        z.object({
          workspaceId: z.string(),
        })
      )
      .query(async ({ ctx, input }) => {
        // Fetch workspace integrations
        return await ctx.db
          .select()
          .from(workspaceIntegrations)
          .where(
            and(
              eq(workspaceIntegrations.workspaceId, input.workspaceId),
              eq(workspaceIntegrations.isActive, true)
            )
          );
      }),
  },
} satisfies TRPCRouterRecord;
