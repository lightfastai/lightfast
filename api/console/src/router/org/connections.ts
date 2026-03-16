import { gatewayInstallations } from "@db/console/schema";
import {
  getProvider,
  gwInstallationBackfillConfigSchema,
  type NormalizedInstallation,
  type ResourcePickerExecuteApiFn,
  sourceTypeSchema,
} from "@repo/console-providers";
import { createGatewayClient } from "@repo/gateway-service-clients";
import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import yaml from "yaml";
import { z } from "zod";
import { env } from "../../env";
import { apiKeyProcedure, orgScopedProcedure } from "../../trpc";

/**
 * Connections Router
 *
 * Manages org-level OAuth connections (GitHub, Vercel, Linear, etc.)
 * Queries gw_installations directly (org-scoped).
 *
 * Table: gatewayInstallations (lightfast_gateway_installations)
 * Scope: Org-scoped (active org required)
 */

export const connectionsRouter = {
  /**
   * Get OAuth authorize URL from the gateway service.
   *
   * Proxies the gateway service authorize endpoint since browsers
   * can't set custom headers (X-Org-Id) during popup navigation.
   */
  getAuthorizeUrl: orgScopedProcedure
    .input(
      z.object({
        provider: sourceTypeSchema,
      })
    )
    .query(async ({ ctx, input }) => {
      const gw = createGatewayClient({
        apiKey: env.GATEWAY_API_KEY,
        requestSource: "console-trpc",
        correlationId: crypto.randomUUID(),
      });
      return gw.getAuthorizeUrl(input.provider, {
        orgId: ctx.auth.orgId,
        userId: ctx.auth.userId,
      });
    }),

  /**
   * CLI: Get OAuth authorize URL using API key auth.
   *
   * Uses orgId from API key auth context, proxies to connections service
   * with redirect_to=inline for CLI mode.
   */
  cliAuthorize: apiKeyProcedure
    .input(
      z.object({
        provider: sourceTypeSchema,
      })
    )
    .query(async ({ ctx, input }) => {
      const gw = createGatewayClient({
        apiKey: env.GATEWAY_API_KEY,
        requestSource: "console-trpc-cli",
        correlationId: crypto.randomUUID(),
      });
      return gw.getAuthorizeUrl(input.provider, {
        orgId: ctx.auth.orgId,
        userId: ctx.auth.userId,
        redirectTo: "inline",
      });
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
    } catch (error: unknown) {
      console.error(
        "[tRPC connections.list] Failed to fetch integrations:",
        error
      );

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
      })
    )
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.db
        .update(gatewayInstallations)
        .set({ status: "revoked" })
        .where(
          and(
            eq(gatewayInstallations.id, input.integrationId),
            eq(gatewayInstallations.orgId, ctx.auth.orgId)
          )
        )
        .returning({ id: gatewayInstallations.id });

      if (!result[0]) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Integration not found or access denied",
        });
      }

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
        const gwValidate = createGatewayClient({
          apiKey: env.GATEWAY_API_KEY,
          requestSource: "console-trpc",
          correlationId: crypto.randomUUID(),
        });

        // Validate that the installation still exists on GitHub (App JWT auth via proxy)
        const result = await gwValidate.executeApi(installation.id, {
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
        console.error(
          "[tRPC connections.github.validate] GitHub installation validation failed:",
          error
        );

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
          const gw = createGatewayClient({
            apiKey: env.GATEWAY_API_KEY,
            requestSource: "console-trpc",
            correlationId: crypto.randomUUID(),
          });

          let ref = input.ref;
          if (!ref) {
            const repoResult = await gw.executeApi(input.integrationId, {
              endpointId: "get-repo",
              pathParams: { owner, repo },
            });
            if (repoResult.status !== 200) {
              throw new TRPCError({
                code: "INTERNAL_SERVER_ERROR",
                message: "Failed to fetch repository info from GitHub",
              });
            }
            const repoData = repoResult.data as { default_branch: string };
            ref = repoData.default_branch;
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
            const fileResult = await gw.executeApi(input.integrationId, {
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
              type?: string;
              content?: string;
              sha?: string;
              size?: number;
            };

            if (data.content !== undefined && data.type !== undefined) {
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
          console.error(
            "[tRPC connections.github.detectConfig] Failed to detect config:",
            error
          );

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
     * Disconnect Vercel integration
     */
    disconnect: orgScopedProcedure.mutation(async ({ ctx }) => {
      const result = await ctx.db
        .update(gatewayInstallations)
        .set({ status: "revoked" })
        .where(
          and(
            eq(gatewayInstallations.orgId, ctx.auth.orgId),
            eq(gatewayInstallations.provider, "vercel")
          )
        )
        .returning({ id: gatewayInstallations.id });

      if (!result[0]) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Vercel integration not found",
        });
      }

      return { success: true };
    }),
  },

  // ── Generic Resource Picker Procedures ────────────────────────────────────

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

        const gw = createGatewayClient({
          apiKey: env.GATEWAY_API_KEY,
          correlationId: crypto.randomUUID(),
          requestSource: "console:generic-list-installations",
        });

        const enriched = await Promise.all(
          installations.map(async (inst) => {
            const executeApi: ResourcePickerExecuteApiFn = (request) =>
              gw.executeApi(inst.id, request);

            return providerDef.resourcePicker.enrichInstallation(executeApi, {
              id: inst.id,
              externalId: inst.externalId,
              providerAccountInfo: inst.providerAccountInfo,
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

        const gw = createGatewayClient({
          apiKey: env.GATEWAY_API_KEY,
          correlationId: crypto.randomUUID(),
          requestSource: "console:generic-list-resources",
        });

        const executeApi: ResourcePickerExecuteApiFn = async (request) => {
          const result = await gw.executeApi(installation.id, request);
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
            providerAccountInfo: installation.providerAccountInfo,
          }
        );

        return { resources };
      }),
  },
} satisfies TRPCRouterRecord;
