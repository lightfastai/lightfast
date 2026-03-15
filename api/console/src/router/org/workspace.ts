import { db } from "@db/console/client";
import {
  gatewayInstallations,
  orgWorkspaces,
  workspaceIngestLogs,
  workspaceIntegrations,
} from "@db/console/schema";
import { createCustomWorkspace, getWorkspaceKey } from "@db/console/utils";
import type {
  BackfillTriggerPayload,
  ProviderName,
  SourceType,
} from "@repo/console-providers";
import {
  getDefaultSyncEvents,
  PROVIDERS,
  sourceTypeSchema,
} from "@repo/console-providers";
import {
  workspaceCreateInputSchema,
  workspaceIntegrationDisconnectInputSchema,
  workspaceListInputSchema,
  workspaceStatisticsInputSchema,
  workspaceUpdateNameInputSchema,
} from "@repo/console-validation/schemas";
import { invalidateWorkspaceConfig } from "@repo/console-workspace-cache";
import {
  createBackfillClient,
  createGatewayClient,
} from "@repo/gateway-service-clients";
import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import { clerkClient } from "@vendor/clerk/server";
import { log } from "@vendor/observability/log";
import { and, desc, eq, gte, inArray, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import { z } from "zod";
import { env } from "../../env";
import { recordActivity } from "../../lib/activity";
import { orgScopedProcedure, resolveWorkspaceByName } from "../../trpc";

/**
 * Workspace router - internal procedures for API routes
 * PUBLIC procedures for webhook/API route usage
 */
export const workspaceRouter = {
  /**
   * List workspaces for a Clerk organization
   * Used by the org/workspace switcher to show available workspaces
   *
   * Returns basic workspace info only. Use granular endpoints for detailed data:
   * - workspace.sources.list
   * - workspace.stores.list
   * - workspace.jobs.stats
   *
   * IMPORTANT: This procedure verifies the user has access to the org from the URL.
   */
  listByClerkOrgSlug: orgScopedProcedure
    .input(workspaceListInputSchema)
    .query(async ({ ctx, input }) => {
      // Get org by slug from URL
      const clerk = await clerkClient();

      let clerkOrg;
      try {
        clerkOrg = await clerk.organizations.getOrganization({
          slug: input.clerkOrgSlug,
        });
      } catch {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `Organization not found: ${input.clerkOrgSlug}`,
        });
      }

      // Verify user has access to this organization
      const membership =
        await clerk.organizations.getOrganizationMembershipList({
          organizationId: clerkOrg.id,
        });

      const userMembership = membership.data.find(
        (m) => m.publicUserData?.userId === ctx.auth.userId
      );

      if (!userMembership) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Access denied to this organization",
        });
      }

      // Fetch all workspaces for this organization (basic info only)
      const orgWorkspacesData = await db.query.orgWorkspaces.findMany({
        where: eq(orgWorkspaces.clerkOrgId, clerkOrg.id),
        orderBy: [desc(orgWorkspaces.createdAt)],
      });

      return orgWorkspacesData.map((workspace) => ({
        id: workspace.id,
        name: workspace.name,
        slug: workspace.slug,
        createdAt: workspace.createdAt,
      }));
    }),

  /**
   * Get workspace details by name (user-facing)
   * Used by workspace settings and detail pages
   *
   * Returns:
   * - Full workspace record with id, name, slug, settings, etc.
   */
  getByName: orgScopedProcedure
    .input(workspaceStatisticsInputSchema)
    .query(async ({ ctx, input }) => {
      // Resolve workspace from name (user-facing)
      const { workspaceId } = await resolveWorkspaceByName({
        clerkOrgSlug: input.clerkOrgSlug,
        workspaceName: input.workspaceName,
        userId: ctx.auth.userId,
      });

      // Fetch full workspace details
      const workspace = await db.query.orgWorkspaces.findFirst({
        where: eq(orgWorkspaces.id, workspaceId),
      });

      if (!workspace) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Workspace not found",
        });
      }

      return {
        id: workspace.id,
        name: workspace.name,
        slug: workspace.slug,
        settings: workspace.settings,
        createdAt: workspace.createdAt,
        updatedAt: workspace.updatedAt,
        clerkOrgId: workspace.clerkOrgId,
      };
    }),

  /**
   * Create a custom workspace with user-provided name
   * Used by workspace creation form
   *
   * Returns:
   * - workspaceId: Database UUID for internal operations
   * - workspaceKey: External naming key (ws-<slug>) for Pinecone, etc.
   * - workspaceSlug: URL-safe identifier
   */
  create: orgScopedProcedure
    .input(workspaceCreateInputSchema)
    .mutation(async ({ ctx, input }) => {
      // Verify user has access to this organization
      const clerk = await clerkClient();

      const membership =
        await clerk.organizations.getOrganizationMembershipList({
          organizationId: input.clerkOrgId,
        });

      const userMembership = membership.data.find(
        (m) => m.publicUserData?.userId === ctx.auth.userId
      );

      if (!userMembership) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Access denied to this organization",
        });
      }

      // Create custom workspace with user-provided name
      try {
        const workspaceId = await createCustomWorkspace(
          input.clerkOrgId,
          input.workspaceName
        );

        // Fetch workspace to get slug
        const workspace = await db.query.orgWorkspaces.findFirst({
          where: eq(orgWorkspaces.id, workspaceId),
        });

        if (!workspace) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to fetch created workspace",
          });
        }

        // Compute workspace key from slug
        const workspaceKey = getWorkspaceKey(workspace.slug);

        // Record activity (Tier 2: Queue-based)
        await recordActivity({
          workspaceId,
          category: "workspace",
          action: "workspace.created",
          entityType: "workspace",
          entityId: workspaceId,
          metadata: {
            workspaceName: input.workspaceName,
            workspaceSlug: workspace.slug,
            clerkOrgId: input.clerkOrgId,
          },
        });

        // Trigger backfill for all active connections in this org (best-effort)
        const activeInstallations = await db
          .select({
            id: gatewayInstallations.id,
            provider: gatewayInstallations.provider,
          })
          .from(gatewayInstallations)
          .where(
            and(
              eq(gatewayInstallations.orgId, input.clerkOrgId),
              eq(gatewayInstallations.status, "active")
            )
          );

        for (const inst of activeInstallations) {
          void notifyBackfill({
            installationId: inst.id,
            provider: inst.provider,
            orgId: input.clerkOrgId,
          });
        }

        return {
          workspaceId,
          workspaceKey,
          workspaceSlug: workspace.slug, // Internal slug for Pinecone
          workspaceName: workspace.name, // User-facing name for URLs
        };
      } catch (error) {
        if (
          error instanceof Error &&
          error.message.includes("already exists")
        ) {
          throw new TRPCError({
            code: "CONFLICT",
            message: error.message,
          });
        }
        throw error;
      }
    }),

  /**
   * Update workspace name
   * Used by workspace settings page to update the user-facing name
   */
  updateName: orgScopedProcedure
    .input(workspaceUpdateNameInputSchema)
    .mutation(async ({ ctx, input }) => {
      // Resolve workspace from current name (user-facing)
      const { workspaceId, clerkOrgId } = await resolveWorkspaceByName({
        clerkOrgSlug: input.clerkOrgSlug,
        workspaceName: input.currentName,
        userId: ctx.auth.userId,
      });

      // Check if new name already exists in this organization
      const existingWorkspace = await db.query.orgWorkspaces.findFirst({
        where: and(
          eq(orgWorkspaces.clerkOrgId, clerkOrgId),
          eq(orgWorkspaces.name, input.newName)
        ),
      });

      if (existingWorkspace && existingWorkspace.id !== workspaceId) {
        throw new TRPCError({
          code: "CONFLICT",
          message: `A workspace with the name "${input.newName}" already exists in this organization`,
        });
      }

      // Update workspace name
      await db
        .update(orgWorkspaces)
        .set({
          name: input.newName,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(orgWorkspaces.id, workspaceId));

      // Invalidate workspace config cache (defensive, in case future updates touch config fields)
      await invalidateWorkspaceConfig(workspaceId);

      // Record activity (Tier 2: Queue-based)
      await recordActivity({
        workspaceId,
        category: "workspace",
        action: "workspace.updated",
        entityType: "workspace",
        entityId: workspaceId,
        metadata: {
          changes: {
            name: {
              from: input.currentName,
              to: input.newName,
            },
          },
        },
      });

      return {
        success: true,
        newWorkspaceName: input.newName,
      };
    }),

  // ============================================================================
  // Granular Data Queries (New API - preferred over monolithic statistics)
  // ============================================================================

  /**
   * Sources sub-router
   * Alias for workspace.integrations.list for backward compatibility
   */
  sources: {
    /**
     * List connected sources for a workspace
     * This is an alias - use workspace.integrations.list for new code
     */
    list: orgScopedProcedure
      .input(workspaceStatisticsInputSchema)
      .query(async ({ ctx, input }) => {
        // Resolve workspace from name (user-facing)
        const { workspaceId } = await resolveWorkspaceByName({
          clerkOrgSlug: input.clerkOrgSlug,
          workspaceName: input.workspaceName,
          userId: ctx.auth.userId,
        });

        // Get all workspace sources (read provider from denormalized column)
        // LEFT JOIN gatewayInstallations to include backfill config from the installation
        const sources = await db
          .select({
            id: workspaceIntegrations.id,
            installationId: workspaceIntegrations.installationId,
            sourceType: workspaceIntegrations.provider,
            isActive: workspaceIntegrations.isActive,
            connectedAt: workspaceIntegrations.connectedAt,
            lastSyncedAt: workspaceIntegrations.lastSyncedAt,
            lastSyncStatus: workspaceIntegrations.lastSyncStatus,
            documentCount: workspaceIntegrations.documentCount,
            providerResourceId: workspaceIntegrations.providerResourceId,
            providerConfig: workspaceIntegrations.providerConfig,
            backfillConfig: gatewayInstallations.backfillConfig,
          })
          .from(workspaceIntegrations)
          .innerJoin(
            gatewayInstallations,
            eq(workspaceIntegrations.installationId, gatewayInstallations.id)
          )
          .where(
            and(
              eq(workspaceIntegrations.workspaceId, workspaceId),
              eq(workspaceIntegrations.isActive, true)
            )
          )
          .orderBy(desc(workspaceIntegrations.connectedAt));

        // Format for compatibility with old interface
        return {
          workspaceId, // Include workspaceId for UI components that need it
          total: sources.length,
          byType: sources.reduce(
            (acc, s) => {
              acc[s.sourceType] = (acc[s.sourceType] ?? 0) + 1;
              return acc;
            },
            {} as Record<string, number>
          ),
          list: sources.map((s) => ({
            id: s.id,
            installationId: s.installationId,
            type: s.sourceType,
            sourceType: s.sourceType, // Canonical name
            displayName: s.providerResourceId,
            documentCount: s.documentCount,
            isActive: s.isActive, // For UI compatibility
            connectedAt: s.connectedAt, // For UI compatibility
            lastSyncedAt: s.lastSyncedAt,
            lastIngestedAt: s.lastSyncedAt,
            lastSyncAt: s.lastSyncedAt, // Alias for UI compatibility
            lastSyncStatus: s.lastSyncStatus, // For UI compatibility
            metadata: s.providerConfig,
            backfillConfig: s.backfillConfig,
            resource: {
              // For backward compatibility
              id: s.id,
              resourceData: s.providerConfig,
            },
          })),
        };
      }),
  },

  /**
   * Store sub-router (1:1 relationship: each workspace has exactly one store)
   */
  store: {
    /**
     * Get the workspace's embedding/store configuration
     */
    get: orgScopedProcedure
      .input(workspaceStatisticsInputSchema)
      .query(async ({ ctx, input }) => {
        // Resolve workspace from name (user-facing)
        const { workspaceId } = await resolveWorkspaceByName({
          clerkOrgSlug: input.clerkOrgSlug,
          workspaceName: input.workspaceName,
          userId: ctx.auth.userId,
        });

        // Get workspace settings
        const [workspace] = await db
          .select({
            id: orgWorkspaces.id,
            settings: orgWorkspaces.settings,
            createdAt: orgWorkspaces.createdAt,
          })
          .from(orgWorkspaces)
          .where(eq(orgWorkspaces.id, workspaceId))
          .limit(1);

        if (!workspace) {
          return null;
        }

        // Settings is always populated (NOT NULL)
        const { embedding } = workspace.settings;

        return {
          id: workspace.id,
          indexName: embedding.indexName,
          namespaceName: embedding.namespaceName,
          embeddingModel: embedding.embeddingModel,
          embeddingDim: embedding.embeddingDim,
          chunkMaxTokens: embedding.chunkMaxTokens,
          chunkOverlap: embedding.chunkOverlap,
          createdAt: workspace.createdAt,
        };
      }),
  },

  /**
   * Integrations sub-router
   * Provider-specific integration management
   */
  integrations: {
    /**
     * Disconnect an integration from workspace
     */
    disconnect: orgScopedProcedure
      .input(workspaceIntegrationDisconnectInputSchema)
      .mutation(async ({ ctx, input }) => {
        const integration = await ctx.db.query.workspaceIntegrations.findFirst({
          where: eq(workspaceIntegrations.id, input.integrationId),
          with: {
            workspace: true,
          },
        });

        if (integration?.workspace.clerkOrgId !== ctx.auth.orgId) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Integration not found",
          });
        }

        await ctx.db
          .update(workspaceIntegrations)
          .set({ isActive: false, updatedAt: new Date().toISOString() })
          .where(eq(workspaceIntegrations.id, input.integrationId));

        return { success: true };
      }),

    /**
     * Link Vercel project to workspace
     */
    linkVercelProject: orgScopedProcedure
      .input(
        z.object({
          workspaceId: z.string(),
          projectId: z.string(),
          projectName: z.string(),
          installationId: z.string(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const { workspaceId, projectId, installationId } = input;

        // Verify org owns the workspace
        const workspace = await ctx.db.query.orgWorkspaces.findFirst({
          where: and(
            eq(orgWorkspaces.id, workspaceId),
            eq(orgWorkspaces.clerkOrgId, ctx.auth.orgId)
          ),
        });

        if (!workspace) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Workspace not found",
          });
        }

        // Verify org owns the Vercel installation
        const installation = await ctx.db.query.gatewayInstallations.findFirst({
          where: and(
            eq(gatewayInstallations.id, installationId),
            eq(gatewayInstallations.orgId, ctx.auth.orgId),
            eq(gatewayInstallations.provider, "vercel")
          ),
        });

        if (!installation) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Vercel connection not found",
          });
        }

        const providerAccountInfo = installation.providerAccountInfo;
        if (providerAccountInfo?.sourceType !== "vercel") {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Invalid provider account info",
          });
        }

        // Check if already linked
        const existing = await ctx.db.query.workspaceIntegrations.findFirst({
          where: and(
            eq(workspaceIntegrations.workspaceId, workspaceId),
            eq(workspaceIntegrations.providerResourceId, projectId)
          ),
        });

        if (existing) {
          // Reactivate if inactive
          if (!existing.isActive) {
            await ctx.db
              .update(workspaceIntegrations)
              .set({ isActive: true, updatedAt: new Date().toISOString() })
              .where(eq(workspaceIntegrations.id, existing.id));
            await createGatewayClient({ apiKey: env.GATEWAY_API_KEY })
              .registerResource(installationId, {
                providerResourceId: projectId,
                resourceName: input.projectName,
              })
              .catch((err: unknown) =>
                log.error(
                  "[linkVercelProject] gateway registerResource failed",
                  {
                    installationId,
                    projectId,
                    err,
                  }
                )
              );
            void notifyBackfill({
              installationId,
              provider: "vercel",
              orgId: ctx.auth.orgId,
            });
            return { id: existing.id, created: false, reactivated: true };
          }
          return { id: existing.id, created: false, reactivated: false };
        }

        // Create workspace integration
        const now = new Date().toISOString();
        const result = await ctx.db
          .insert(workspaceIntegrations)
          .values({
            workspaceId,
            installationId,
            provider: "vercel",
            providerConfig: {
              provider: "vercel" as const,
              type: "project" as const,
              sync: {
                events: [...getDefaultSyncEvents("vercel")],
                autoSync: true,
              },
            },
            providerResourceId: projectId,
            isActive: true,
            connectedAt: now,
          })
          .returning({ id: workspaceIntegrations.id });

        const insertedId = result[0]?.id;
        if (!insertedId) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to create Vercel integration",
          });
        }
        await createGatewayClient({ apiKey: env.GATEWAY_API_KEY })
          .registerResource(installationId, {
            providerResourceId: projectId,
            resourceName: input.projectName,
          })
          .catch((err: unknown) =>
            log.error("[linkVercelProject] gateway registerResource failed", {
              installationId,
              projectId,
              err,
            })
          );
        void notifyBackfill({
          installationId,
          provider: "vercel",
          orgId: ctx.auth.orgId,
        });
        return { id: insertedId, created: true, reactivated: false };
      }),

    /**
     * Unlink Vercel project from workspace
     */
    unlinkVercelProject: orgScopedProcedure
      .input(
        z.object({
          integrationId: z.string(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const integration = await ctx.db.query.workspaceIntegrations.findFirst({
          where: eq(workspaceIntegrations.id, input.integrationId),
          with: {
            workspace: true,
          },
        });

        if (integration?.workspace.clerkOrgId !== ctx.auth.orgId) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Integration not found",
          });
        }

        await ctx.db
          .update(workspaceIntegrations)
          .set({ isActive: false, updatedAt: new Date().toISOString() })
          .where(eq(workspaceIntegrations.id, input.integrationId));

        return { success: true };
      }),

    /**
     * Update event subscriptions for a workspace integration
     */
    updateEvents: orgScopedProcedure
      .input(
        z.object({
          integrationId: z.string(),
          events: z.array(z.string()),
        })
      )
      .mutation(async ({ ctx, input }) => {
        // Verify integration belongs to user's org
        const integration = await ctx.db.query.workspaceIntegrations.findFirst({
          where: eq(workspaceIntegrations.id, input.integrationId),
          with: {
            workspace: true,
          },
        });

        if (integration?.workspace.clerkOrgId !== ctx.auth.orgId) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Integration not found",
          });
        }

        // Update provider_config.sync.events using JSON merge
        // The providerConfig is a discriminated union type, so we need to preserve it properly
        const currentConfig = integration.providerConfig;

        // Build the updated config preserving all existing fields
        // We cast through unknown to satisfy TypeScript while preserving the data structure
        const updatedConfig = {
          ...currentConfig,
          sync: {
            ...(currentConfig.sync as Record<string, unknown>),
            events: input.events,
          },
        } as typeof currentConfig;

        await ctx.db
          .update(workspaceIntegrations)
          .set({
            providerConfig: updatedConfig,
            updatedAt: new Date().toISOString(),
          })
          .where(eq(workspaceIntegrations.id, input.integrationId));

        return { success: true };
      }),

    /**
     * Bulk link resources (repositories, projects, teams) to a workspace.
     *
     * Generic mutation replacing provider-specific bulkLink* mutations.
     * Per-provider providerConfig construction is handled by PROVIDERS[provider].buildProviderConfig.
     */
    bulkLinkResources: orgScopedProcedure
      .input(
        z.object({
          provider: sourceTypeSchema,
          workspaceId: z.string(),
          gwInstallationId: z.string(),
          resources: z
            .array(
              z.object({
                resourceId: z.string(),
                resourceName: z.string(),
              })
            )
            .min(1)
            .max(50),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const { provider, workspaceId, gwInstallationId, resources } = input;

        log.info("[bulkLinkResources] starting", {
          provider,
          workspaceId,
          gwInstallationId,
          resourceCount: resources.length,
        });

        // 1. Verify workspace access
        const workspace = await ctx.db.query.orgWorkspaces.findFirst({
          where: and(
            eq(orgWorkspaces.id, workspaceId),
            eq(orgWorkspaces.clerkOrgId, ctx.auth.orgId)
          ),
        });

        if (!workspace) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Workspace not found",
          });
        }

        // 2. Verify org owns the installation for this provider
        const gwInstallation =
          await ctx.db.query.gatewayInstallations.findFirst({
            where: and(
              eq(gatewayInstallations.id, gwInstallationId),
              eq(gatewayInstallations.orgId, ctx.auth.orgId),
              eq(gatewayInstallations.provider, provider)
            ),
          });

        if (!gwInstallation) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: `${provider} connection not found`,
          });
        }

        // 3. Get existing integrations to avoid duplicates
        const existing = await ctx.db.query.workspaceIntegrations.findMany({
          where: and(
            eq(workspaceIntegrations.workspaceId, workspaceId),
            eq(workspaceIntegrations.installationId, gwInstallationId)
          ),
        });

        const existingMap = new Map(
          existing.map((e) => [e.providerResourceId, e])
        );

        // 4. Categorize resources
        const toCreate: typeof resources = [];
        const toReactivate: Array<{
          id: string;
          providerResourceId: string;
          resourceName: string;
        }> = [];
        const alreadyActive: string[] = [];

        for (const resource of resources) {
          const existingIntegration = existingMap.get(resource.resourceId);
          if (!existingIntegration) {
            toCreate.push(resource);
          } else if (existingIntegration.isActive) {
            alreadyActive.push(resource.resourceId);
          } else {
            toReactivate.push({
              id: existingIntegration.id,
              providerResourceId: resource.resourceId,
              resourceName: resource.resourceName,
            });
          }
        }

        log.info("[bulkLinkResources] resources categorized", {
          provider,
          gwInstallationId,
          toCreate: toCreate.length,
          toReactivate: toReactivate.length,
          alreadyActive: alreadyActive.length,
        });

        const now = new Date().toISOString();
        const typedProvider = provider as ProviderName;
        const defaultSyncEvents = getDefaultSyncEvents(typedProvider);
        const gw = createGatewayClient({ apiKey: env.GATEWAY_API_KEY });

        // 5. Reactivate inactive integrations
        if (toReactivate.length > 0) {
          await ctx.db
            .update(workspaceIntegrations)
            .set({ isActive: true, updatedAt: now })
            .where(
              inArray(
                workspaceIntegrations.id,
                toReactivate.map((r) => r.id)
              )
            );

          // Register reactivated resources in gateway (best-effort)
          await Promise.allSettled(
            toReactivate.map((r) =>
              gw
                .registerResource(gwInstallationId, {
                  providerResourceId: r.providerResourceId,
                  resourceName: r.resourceName,
                })
                .catch((err: unknown) =>
                  log.error(
                    "[bulkLinkResources] gateway registerResource failed (reactivate)",
                    {
                      installationId: gwInstallationId,
                      providerResourceId: r.providerResourceId,
                      err,
                    }
                  )
                )
            )
          );

          // Trigger backfill for reactivated sources (best-effort)
          const correlationId = nanoid();
          void notifyBackfill({
            installationId: gwInstallationId,
            provider,
            orgId: ctx.auth.orgId,
            correlationId,
          });
        }

        // 6. Create new integrations
        if (toCreate.length > 0) {
          const integrations = toCreate.map((resource) => ({
            workspaceId,
            installationId: gwInstallationId,
            provider,
            providerResourceId: resource.resourceId,
            providerConfig: PROVIDERS[typedProvider].buildProviderConfig({
              defaultSyncEvents,
            }),
            isActive: true,
            connectedAt: now,
          }));

          await ctx.db
            .insert(workspaceIntegrations)
            .values(integrations)
            .returning({ id: workspaceIntegrations.id });

          // Register new resources in gateway (best-effort)
          await Promise.allSettled(
            toCreate.map((resource) =>
              gw
                .registerResource(gwInstallationId, {
                  providerResourceId: resource.resourceId,
                  resourceName: resource.resourceName,
                })
                .catch((err: unknown) =>
                  log.error(
                    "[bulkLinkResources] gateway registerResource failed (create)",
                    {
                      installationId: gwInstallationId,
                      providerResourceId: resource.resourceId,
                      err,
                    }
                  )
                )
            )
          );

          // Trigger backfill (best-effort)
          const correlationId = nanoid();
          void notifyBackfill({
            installationId: gwInstallationId,
            provider,
            orgId: ctx.auth.orgId,
            correlationId,
          });
        }

        log.info("[bulkLinkResources] complete", {
          provider,
          gwInstallationId,
          created: toCreate.length,
          reactivated: toReactivate.length,
          skipped: alreadyActive.length,
        });

        return {
          created: toCreate.length,
          reactivated: toReactivate.length,
          skipped: alreadyActive.length,
        };
      }),
  },

  /**
   * Events sub-router
   * Queries the workspace_ingest_log table for transformed SourceEvent records
   */
  events: {
    /**
     * List events for a workspace with cursor pagination, search, and date filtering.
     */
    list: orgScopedProcedure
      .input(
        z.object({
          clerkOrgSlug: z.string(),
          workspaceName: z.string(),
          source: sourceTypeSchema.optional(),
          limit: z.number().min(1).max(100).default(30),
          cursor: z.number().optional(),
          search: z.string().max(200).optional(),
          receivedAfter: z.string().datetime().optional(),
        })
      )
      .query(async ({ ctx, input }) => {
        const { workspaceId, clerkOrgId } = await resolveWorkspaceByName({
          clerkOrgSlug: input.clerkOrgSlug,
          workspaceName: input.workspaceName,
          userId: ctx.auth.userId,
        });

        const { limit, cursor, search, receivedAfter } = input;

        const conditions = [eq(workspaceIngestLogs.workspaceId, workspaceId)];

        if (input.source) {
          conditions.push(
            sql`${workspaceIngestLogs.sourceEvent}->>'provider' = ${input.source}`
          );
        }

        if (cursor) {
          conditions.push(sql`${workspaceIngestLogs.id} < ${cursor}`);
        }

        if (search) {
          conditions.push(
            sql`${workspaceIngestLogs.sourceEvent}->>'title' ILIKE ${`%${search}%`}`
          );
        }

        if (receivedAfter) {
          conditions.push(gte(workspaceIngestLogs.receivedAt, receivedAfter));
        }

        const rows = await db
          .select({
            id: workspaceIngestLogs.id,
            source: sql<string>`${workspaceIngestLogs.sourceEvent}->>'provider'`,
            sourceType: sql<string>`${workspaceIngestLogs.sourceEvent}->>'eventType'`,
            sourceEvent: workspaceIngestLogs.sourceEvent,
            ingestionSource: workspaceIngestLogs.ingestionSource,
            receivedAt: workspaceIngestLogs.receivedAt,
            createdAt: workspaceIngestLogs.createdAt,
          })
          .from(workspaceIngestLogs)
          .where(and(...conditions))
          .orderBy(desc(workspaceIngestLogs.id))
          .limit(limit + 1);

        const hasMore = rows.length > limit;
        const events = hasMore ? rows.slice(0, limit) : rows;
        const nextCursor = hasMore ? (events.at(-1)?.id ?? null) : null;

        return {
          workspaceId,
          clerkOrgId,
          events,
          nextCursor,
          hasMore,
        };
      }),
  },
} satisfies TRPCRouterRecord;

/**
 * Notify the backfill service to trigger a historical backfill for a connection.
 * Best-effort — errors are logged but never thrown.
 *
 * If depth or entityTypes are omitted, they are loaded from gatewayInstallations.backfillConfig.
 */
export async function notifyBackfill(params: {
  installationId: string;
  provider: SourceType;
  orgId: string;
  depth?: 1 | 7 | 30 | 90;
  entityTypes?: string[];
  holdForReplay?: boolean;
  correlationId?: string;
}): Promise<void> {
  let resolvedDepth = params.depth;
  let resolvedEntityTypes = params.entityTypes;

  log.info("[notifyBackfill] starting", {
    installationId: params.installationId,
    provider: params.provider,
    orgId: params.orgId,
    depthOverride: params.depth,
    entityTypesOverride: params.entityTypes,
    correlationId: params.correlationId,
  });

  // Load stored defaults when caller omits depth or entityTypes
  if (resolvedDepth === undefined || resolvedEntityTypes === undefined) {
    try {
      const installation = await db.query.gatewayInstallations.findFirst({
        where: eq(gatewayInstallations.id, params.installationId),
        columns: { backfillConfig: true },
      });
      if (installation?.backfillConfig) {
        resolvedDepth ??= installation.backfillConfig.depth;
        resolvedEntityTypes ??= installation.backfillConfig.entityTypes;
        log.info("[notifyBackfill] loaded config from DB", {
          installationId: params.installationId,
          depth: resolvedDepth,
          entityTypes: resolvedEntityTypes,
          correlationId: params.correlationId,
        });
      } else {
        log.info(
          "[notifyBackfill] no backfillConfig in DB, using hardcoded fallback",
          {
            installationId: params.installationId,
            fallbackDepth: resolvedDepth ?? 1,
            correlationId: params.correlationId,
          }
        );
      }
    } catch (err) {
      log.error("[console] Failed to load backfill config defaults", {
        installationId: params.installationId,
        err,
        correlationId: params.correlationId,
      });
    }
  }

  const payload: BackfillTriggerPayload = {
    installationId: params.installationId,
    provider: params.provider,
    orgId: params.orgId,
    depth: resolvedDepth ?? 1,
    entityTypes: resolvedEntityTypes,
    holdForReplay: params.holdForReplay,
  };

  log.info("[notifyBackfill] triggering backfill", {
    ...payload,
    correlationId: params.correlationId,
  });

  try {
    const client = createBackfillClient({ apiKey: env.GATEWAY_API_KEY });
    await client.trigger(payload);
    log.info("[notifyBackfill] backfill triggered successfully", {
      installationId: params.installationId,
      provider: params.provider,
      correlationId: params.correlationId,
    });
  } catch (err) {
    log.error("[console] Failed to trigger backfill", {
      installationId: params.installationId,
      provider: params.provider,
      err,
      correlationId: params.correlationId,
    });
  }
}
