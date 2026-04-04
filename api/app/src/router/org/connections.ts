import { gatewayInstallations, orgIntegrations } from "@db/app/schema";
import {
  getDefaultSyncEvents,
  getProvider,
  gwInstallationBackfillConfigSchema,
  type NormalizedInstallation,
  type ProviderName,
  type ResourcePickerExecuteApiFn,
  sourceTypeSchema,
} from "@repo/app-providers";
import type { SourceIdentifier } from "@repo/app-validation";
import { createMemoryCaller } from "@repo/platform-trpc/caller";
import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import { log } from "@vendor/observability/log/next";
import { and, eq } from "drizzle-orm";
import yaml from "yaml";
import { z } from "zod";
import { orgScopedProcedure } from "../../trpc";

/**
 * Connections Router
 *
 * Manages org-level OAuth connections (GitHub, Vercel, Linear, etc.)
 * Queries gw_installations directly (org-scoped).
 *
 * Proxies to memory service tRPC for token vault, OAuth, and API operations.
 *
 * Table: gatewayInstallations (lightfast_gateway_installations)
 * Scope: Org-scoped (active org required)
 */

export const connectionsRouter = {
  /**
   * Get OAuth authorize URL from the memory service.
   *
   * Proxies the memory service authorize endpoint since browsers
   * can't set custom headers (X-Org-Id) during popup navigation.
   */
  getAuthorizeUrl: orgScopedProcedure
    .input(
      z.object({
        provider: sourceTypeSchema,
      })
    )
    .query(async ({ ctx, input }) => {
      const memory = await createMemoryCaller();
      return memory.connections.getAuthorizeUrl({
        provider: input.provider,
        orgId: ctx.auth.orgId,
        connectedBy: ctx.auth.userId,
      });
    }),

  /**
   * List org's OAuth integrations (all providers)
   *
   * Returns all active OAuth integrations connected by the org.
   */
  list: orgScopedProcedure.query(async ({ ctx }) => {
    const installations = await ctx.db
      .select()
      .from(gatewayInstallations)
      .where(
        and(
          eq(gatewayInstallations.orgId, ctx.auth.orgId),
          eq(gatewayInstallations.status, "active")
        )
      );

    return installations.map((inst) => ({
      id: inst.id,
      sourceType: inst.provider,
      isActive: true,
      connectedAt: inst.createdAt,
      lastSyncAt: inst.updatedAt,
    }));
  }),

  /**
   * Disconnect an integration.
   *
   * Delegates to the memory service which triggers the durable
   * connection-teardown workflow (gate-first: closes ingress immediately).
   */
  disconnect: orgScopedProcedure
    .input(
      z.object({
        integrationId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Fetch installation to get provider (required for disconnect)
      // and enforce org scoping before calling the memory service
      const rows = await ctx.db
        .select({
          id: gatewayInstallations.id,
          provider: gatewayInstallations.provider,
        })
        .from(gatewayInstallations)
        .where(
          and(
            eq(gatewayInstallations.id, input.integrationId),
            eq(gatewayInstallations.orgId, ctx.auth.orgId)
          )
        )
        .limit(1);

      const installation = rows[0];
      if (!installation) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Integration not found or access denied",
        });
      }

      const memory = await createMemoryCaller();
      await memory.connections.disconnect({
        id: installation.id,
        provider: installation.provider,
      });

      // Cascade: mark all org integrations for this installation as disconnected.
      // This covers all providers (Vercel, Linear, Sentry, Apollo, GitHub).
      // The cascade here ensures the gate closes immediately on user-triggered disconnect.
      const now = new Date().toISOString();
      await ctx.db
        .update(orgIntegrations)
        .set({
          status: "disconnected",
          statusReason: "installation_revoked",
          updatedAt: now,
        })
        .where(eq(orgIntegrations.installationId, input.integrationId));

      return { success: true };
    }),

  /**
   * Update backfill configuration for a gateway installation.
   *
   * Stores depth + entityTypes on gatewayInstallations.backfillConfig.
   * Used by SourceSettingsForm and as defaults for notifyBackfill().
   */
  updateBackfillConfig: orgScopedProcedure
    .input(
      z.object({
        installationId: z.string().min(1),
        backfillConfig: gwInstallationBackfillConfigSchema,
      })
    )
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.db
        .update(gatewayInstallations)
        .set({ backfillConfig: input.backfillConfig })
        .where(
          and(
            eq(gatewayInstallations.id, input.installationId),
            eq(gatewayInstallations.orgId, ctx.auth.orgId)
          )
        )
        .returning({ id: gatewayInstallations.id });

      if (!result[0]) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Installation not found or access denied",
        });
      }

      return { success: true };
    }),

  /**
   * GitHub-specific operations
   */
  github: {
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
        .from(gatewayInstallations)
        .where(
          and(
            eq(gatewayInstallations.orgId, ctx.auth.orgId),
            eq(gatewayInstallations.provider, "github"),
            eq(gatewayInstallations.status, "active")
          )
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
        const memory = await createMemoryCaller();

        // Validate that the installation still exists on GitHub (App JWT auth via proxy)
        const result = await memory.proxy.execute({
          installationId: installation.id,
          endpointId: "get-app-installation",
          pathParams: { installation_id: installation.externalId },
        });

        if (result.status !== 200) {
          throw new Error(
            `GitHub installation not found: status ${result.status}`
          );
        }

        // Update only lastValidatedAt — display data is resolved live, not cached
        const existingInfo = installation.providerAccountInfo;
        const now = new Date().toISOString();
        if (existingInfo?.sourceType === "github") {
          await ctx.db
            .update(gatewayInstallations)
            .set({
              providerAccountInfo: { ...existingInfo, lastValidatedAt: now },
              updatedAt: now,
            })
            .where(eq(gatewayInstallations.id, installation.id));
        }

        return { added: 0, removed: 0, total: 1 };
      } catch (error: unknown) {
        log.error("[connections/github] validate failed", {
          clerkOrgId: ctx.auth.orgId,
          error: error instanceof Error ? error.message : String(error),
        });

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to validate GitHub installation",
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
          integrationId: z.string(), // gatewayInstallations.id
          installationId: z.string(), // GitHub App installation external ID
          fullName: z.string(), // "owner/repo"
          ref: z.string().optional(), // branch/tag/sha (defaults to default branch)
        })
      )
      .query(async ({ ctx, input }) => {
        // Verify org owns this installation
        const result = await ctx.db
          .select()
          .from(gatewayInstallations)
          .where(
            and(
              eq(gatewayInstallations.id, input.integrationId),
              eq(gatewayInstallations.orgId, ctx.auth.orgId)
            )
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
            message:
              "Installation not found or not accessible to this connection",
          });
        }

        const [owner, repo] = input.fullName.split("/");
        if (!(owner && repo)) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Invalid repository name format. Expected 'owner/repo'",
          });
        }

        try {
          const memory = await createMemoryCaller();

          let ref = input.ref;
          if (!ref) {
            const repoResult = await memory.proxy.execute({
              installationId: input.integrationId,
              endpointId: "get-repo",
              pathParams: { owner, repo },
            });
            if (repoResult.status !== 200) {
              throw new TRPCError({
                code: "INTERNAL_SERVER_ERROR",
                message: "Failed to fetch repository info from GitHub",
              });
            }
            ref = (repoResult.data as { default_branch: string })
              .default_branch;
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
            const queryParams: Record<string, string> = {};
            if (ref) {
              queryParams.ref = ref;
            }
            const fileResult = await memory.proxy.execute({
              installationId: input.integrationId,
              endpointId: "get-file-contents",
              pathParams: { owner, repo, path },
              queryParams,
            });

            if (fileResult.status === 404) {
              continue;
            }

            if (fileResult.status !== 200) {
              throw new TRPCError({
                code: "INTERNAL_SERVER_ERROR",
                message: "Failed to fetch file contents from GitHub",
              });
            }

            const data = fileResult.data as {
              content?: string;
              type?: string;
              size?: number;
              sha?: string;
            };

            if (
              !Array.isArray(data) &&
              data.content !== undefined &&
              data.type !== undefined
            ) {
              const maxSize = 50 * 1024;
              if (typeof data.size === "number" && data.size > maxSize) {
                throw new TRPCError({
                  code: "BAD_REQUEST",
                  message: `Config file too large. Maximum size is ${maxSize / 1024}KB.`,
                });
              }

              const content = Buffer.from(data.content, "base64").toString(
                "utf-8"
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
                sha: data.sha ?? "",
              };
            }
          }

          return { exists: false };
        } catch (error: unknown) {
          log.error("[connections/github] detectConfig failed", {
            clerkOrgId: ctx.auth.orgId,
            error: error instanceof Error ? error.message : String(error),
          });

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
     * Disconnect Vercel integration.
     *
     * Delegates to the memory service which triggers the durable
     * connection-teardown workflow (gate-first: closes ingress immediately).
     */
    disconnect: orgScopedProcedure.mutation(async ({ ctx }) => {
      // Fetch Vercel installation to get id; enforce org scoping
      const rows = await ctx.db
        .select({ id: gatewayInstallations.id })
        .from(gatewayInstallations)
        .where(
          and(
            eq(gatewayInstallations.orgId, ctx.auth.orgId),
            eq(gatewayInstallations.provider, "vercel")
          )
        )
        .limit(1);

      const installation = rows[0];
      if (!installation) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Vercel integration not found",
        });
      }

      const memory = await createMemoryCaller();
      await memory.connections.disconnect({
        id: installation.id,
        provider: "vercel",
      });

      // Cascade: mark all org integrations for this installation as disconnected
      const now = new Date().toISOString();
      await ctx.db
        .update(orgIntegrations)
        .set({
          status: "disconnected",
          statusReason: "installation_revoked",
          updatedAt: now,
        })
        .where(eq(orgIntegrations.installationId, installation.id));

      return { success: true };
    }),
  },

  // ── Generic Resource Picker Procedures ────────────────────────────────────

  // ── Linked Resources (orgIntegrations) ────────────────────────────────────

  resources: {
    /**
     * List linked resources for the current org.
     *
     * Joins orgIntegrations with gatewayInstallations to return
     * per-resource metadata including backfill config.
     */
    list: orgScopedProcedure.query(async ({ ctx }) => {
      const rows = await ctx.db
        .select({
          id: orgIntegrations.id,
          provider: orgIntegrations.provider,
          providerConfig: orgIntegrations.providerConfig,
          providerResourceId: orgIntegrations.providerResourceId,
          installationId: orgIntegrations.installationId,
          documentCount: orgIntegrations.documentCount,
          backfillConfig: gatewayInstallations.backfillConfig,
        })
        .from(orgIntegrations)
        .leftJoin(
          gatewayInstallations,
          eq(orgIntegrations.installationId, gatewayInstallations.id)
        )
        .where(
          and(
            eq(orgIntegrations.clerkOrgId, ctx.auth.orgId),
            eq(orgIntegrations.status, "active")
          )
        );

      const list = rows.map((row) => {
        // ProviderConfig is a discriminated union — access common fields via cast
        const config = row.providerConfig as {
          sync?: { events?: string[] };
          status?: { configStatus?: string };
        };
        return {
          id: row.id,
          metadata: {
            provider: row.provider,
            sync: config.sync
              ? { events: config.sync.events ?? [] }
              : undefined,
            status: config.status
              ? { configStatus: config.status.configStatus }
              : undefined,
          },
          displayName: row.providerResourceId,
          installationId: row.installationId,
          documentCount: row.documentCount,
          backfillConfig: row.backfillConfig,
        };
      });

      return { list };
    }),

    /**
     * Bulk-link resources from a gateway installation to this org.
     *
     * Creates new orgIntegration rows, or reactivates disconnected ones.
     * Returns counts of created / reactivated entries.
     */
    bulkLink: orgScopedProcedure
      .input(
        z.object({
          provider: sourceTypeSchema,
          gwInstallationId: z.string().min(1),
          resources: z
            .array(
              z.object({
                resourceId: z.string(),
                resourceName: z.string().optional(),
              })
            )
            .min(1),
        })
      )
      .mutation(async ({ ctx, input }) => {
        // Verify the installation belongs to this org
        const installation = await ctx.db
          .select({ id: gatewayInstallations.id })
          .from(gatewayInstallations)
          .where(
            and(
              eq(gatewayInstallations.id, input.gwInstallationId),
              eq(gatewayInstallations.orgId, ctx.auth.orgId),
              eq(gatewayInstallations.status, "active")
            )
          )
          .limit(1)
          .then((rows) => rows[0]);

        if (!installation) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Installation not found or not owned by this org",
          });
        }

        const providerDef = getProvider(input.provider);
        if (!providerDef) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Unknown provider: ${input.provider}`,
          });
        }

        const defaultSyncEvents = getDefaultSyncEvents(
          input.provider as ProviderName
        );
        const providerConfig = providerDef.buildProviderConfig({
          defaultSyncEvents: [...defaultSyncEvents],
        });

        let created = 0;
        let reactivated = 0;

        for (const resource of input.resources) {
          const existing = await ctx.db
            .select({ id: orgIntegrations.id })
            .from(orgIntegrations)
            .where(
              and(
                eq(orgIntegrations.installationId, input.gwInstallationId),
                eq(
                  orgIntegrations.providerResourceId,
                  resource.resourceId as SourceIdentifier
                )
              )
            )
            .then((rows) => rows[0]);

          await ctx.db
            .insert(orgIntegrations)
            .values({
              clerkOrgId: ctx.auth.orgId,
              installationId: input.gwInstallationId,
              provider: input.provider,
              providerConfig,
              providerResourceId: resource.resourceId as SourceIdentifier,
            })
            .onConflictDoUpdate({
              target: [
                orgIntegrations.installationId,
                orgIntegrations.providerResourceId,
              ],
              set: {
                status: "active",
                statusReason: null,
                updatedAt: new Date().toISOString(),
              },
            });

          if (existing) {
            reactivated++;
          } else {
            created++;
          }
        }

        return { created, reactivated };
      }),
  },

  generic: {
    listInstallations: orgScopedProcedure
      .input(z.object({ provider: sourceTypeSchema }))
      .query(async ({ ctx, input }) => {
        const providerDef = getProvider(input.provider);
        if (!providerDef) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Unknown provider: ${input.provider}`,
          });
        }

        const installations = await ctx.db
          .select()
          .from(gatewayInstallations)
          .where(
            and(
              eq(gatewayInstallations.orgId, ctx.auth.orgId),
              eq(gatewayInstallations.provider, input.provider),
              eq(gatewayInstallations.status, "active")
            )
          );

        if (installations.length === 0) {
          return {
            installationMode: providerDef.resourcePicker.installationMode,
            resourceLabel: providerDef.resourcePicker.resourceLabel,
            installations: [] as NormalizedInstallation[],
          };
        }

        const memory = await createMemoryCaller();

        const enriched = await Promise.all(
          installations.map(async (inst) => {
            const executeApi: ResourcePickerExecuteApiFn = (request) =>
              memory.proxy.execute({
                installationId: inst.id,
                ...request,
              });

            return providerDef.resourcePicker.enrichInstallation(executeApi, {
              id: inst.id,
              externalId: inst.externalId,
              // ProviderDefinition loses TAccountInfo generic — contravariance on
              // ResourcePickerDef method params collapses the union to never | null.
              // Runtime value is always the correct type for this provider.
              providerAccountInfo: inst.providerAccountInfo as any,
            });
          })
        );

        return {
          installationMode: providerDef.resourcePicker.installationMode,
          resourceLabel: providerDef.resourcePicker.resourceLabel,
          installations: enriched,
        };
      }),

    listResources: orgScopedProcedure
      .input(
        z.object({
          provider: sourceTypeSchema,
          installationId: z.string(),
        })
      )
      .query(async ({ ctx, input }) => {
        const providerDef = getProvider(input.provider);
        if (!providerDef) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Unknown provider: ${input.provider}`,
          });
        }

        // Verify org owns this installation
        const installation = await ctx.db
          .select()
          .from(gatewayInstallations)
          .where(
            and(
              eq(gatewayInstallations.id, input.installationId),
              eq(gatewayInstallations.orgId, ctx.auth.orgId),
              eq(gatewayInstallations.provider, input.provider),
              eq(gatewayInstallations.status, "active")
            )
          )
          .limit(1)
          .then((rows) => rows[0]);

        if (!installation) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Installation not found or not owned by this org",
          });
        }

        const memory = await createMemoryCaller();

        const executeApi: ResourcePickerExecuteApiFn = async (request) => {
          const result = await memory.proxy.execute({
            installationId: installation.id,
            ...request,
          });
          if (result.status === 401) {
            await ctx.db
              .update(gatewayInstallations)
              .set({ status: "error" })
              .where(eq(gatewayInstallations.id, installation.id));
            throw new TRPCError({
              code: "UNAUTHORIZED",
              message: "Provider connection expired. Please reconnect.",
            });
          }
          return result;
        };

        const resources = await providerDef.resourcePicker.listResources(
          executeApi,
          {
            id: installation.id,
            externalId: installation.externalId,
            // ProviderDefinition loses TAccountInfo generic — see comment above.
            providerAccountInfo: installation.providerAccountInfo as any,
          }
        );

        return { resources };
      }),
  },
} satisfies TRPCRouterRecord;
