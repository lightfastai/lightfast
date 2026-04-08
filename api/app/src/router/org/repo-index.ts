import { db } from "@db/app/client";
import { orgIntegrations, orgRepoIndexes } from "@db/app/schema";
import { createPlatformCaller } from "@repo/platform-trpc/caller";
import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { orgScopedProcedure } from "../../trpc";

export const repoIndexRouter = {
  /**
   * Get the current .lightfast repo index status for this org.
   *
   * Returns:
   * - { status: "not_connected" } if no .lightfast repo is connected as a Source
   * - { status: "inactive", ... } if connected but indexing not activated
   * - { status: "active", ... } if connected and actively indexing
   */
  status: orgScopedProcedure.query(async ({ ctx }) => {
    // Check if there's already a repo index config
    const existing = await db
      .select({
        id: orgRepoIndexes.id,
        repoFullName: orgRepoIndexes.repoFullName,
        isActive: orgRepoIndexes.isActive,
        lastSyncedAt: orgRepoIndexes.lastSyncedAt,
        cachedContent: orgRepoIndexes.cachedContent,
        indexingStatus: orgRepoIndexes.indexingStatus,
      })
      .from(orgRepoIndexes)
      .where(eq(orgRepoIndexes.clerkOrgId, ctx.auth.orgId))
      .limit(1);

    if (existing[0]) {
      const config = existing[0];
      return {
        status: config.isActive ? ("active" as const) : ("inactive" as const),
        configId: config.id,
        repoFullName: config.repoFullName,
        lastSyncedAt: config.lastSyncedAt,
        hasContent: config.cachedContent !== null,
        indexingStatus: config.indexingStatus,
      };
    }

    // No index exists — check if a .lightfast repo is connected via Sources.
    // Get all GitHub integrations for this org, grouped by installation.
    const githubIntegrations = await db
      .select({
        id: orgIntegrations.id,
        installationId: orgIntegrations.installationId,
        providerResourceId: orgIntegrations.providerResourceId,
      })
      .from(orgIntegrations)
      .where(
        and(
          eq(orgIntegrations.clerkOrgId, ctx.auth.orgId),
          eq(orgIntegrations.provider, "github"),
          eq(orgIntegrations.status, "active")
        )
      );

    if (githubIntegrations.length === 0) {
      return { status: "not_connected" as const };
    }

    // Group integrations by installationId to minimize API calls.
    // One list-installation-repos call per installation (not per integration).
    const byInstallation = new Map<string, typeof githubIntegrations>();
    for (const integration of githubIntegrations) {
      const group = byInstallation.get(integration.installationId) ?? [];
      group.push(integration);
      byInstallation.set(integration.installationId, group);
    }

    const platform = await createPlatformCaller();

    for (const [installationId, integrations] of byInstallation) {
      try {
        const reposResult = await platform.proxy.execute({
          installationId,
          endpointId: "list-installation-repos",
        });

        const data = reposResult.data as {
          repositories?: Array<{
            id: number;
            name: string;
            full_name: string;
          }>;
        };

        if (!data.repositories) {
          continue;
        }

        // Find a .lightfast repo that matches one of this org's connected sources
        const connectedResourceIds = new Set(
          integrations.map((i) => String(i.providerResourceId))
        );

        const dotLightfastRepo = data.repositories.find(
          (r) =>
            r.name === ".lightfast" && connectedResourceIds.has(String(r.id))
        );

        if (dotLightfastRepo) {
          const matchingIntegration = integrations.find(
            (i) => String(i.providerResourceId) === String(dotLightfastRepo.id)
          )!;
          return {
            status: "inactive" as const,
            integrationId: matchingIntegration.id,
            installationId,
            repoFullName: dotLightfastRepo.full_name,
            providerResourceId: matchingIntegration.providerResourceId,
          };
        }
      } catch {
        // Skip installations that fail — might be revoked
      }
    }

    return { status: "not_connected" as const };
  }),

  /**
   * Activate .lightfast repo indexing.
   * Fetches README.md from the repo and caches it.
   */
  activate: orgScopedProcedure
    .input(
      z.object({
        integrationId: z.string(),
        installationId: z.string(),
        repoFullName: z.string(),
        providerResourceId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify the integration belongs to this org
      const [integration] = await db
        .select({ id: orgIntegrations.id })
        .from(orgIntegrations)
        .where(
          and(
            eq(orgIntegrations.id, input.integrationId),
            eq(orgIntegrations.clerkOrgId, ctx.auth.orgId),
            eq(orgIntegrations.status, "active")
          )
        )
        .limit(1);

      if (!integration) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Integration not found or not active",
        });
      }

      // Fetch README.md content from GitHub
      const [owner, repo] = input.repoFullName.split("/");
      const platform = await createPlatformCaller();

      let cachedContent: string | null = null;
      let contentSha: string | null = null;

      try {
        const fileResult = await platform.proxy.execute({
          installationId: input.installationId,
          endpointId: "get-file-contents",
          pathParams: { owner: owner!, repo: repo!, path: "README.md" },
        });

        if (fileResult.status === 200) {
          const fileData = fileResult.data as {
            content?: string;
            sha?: string;
          };
          if (fileData.content) {
            cachedContent = Buffer.from(fileData.content, "base64").toString(
              "utf-8"
            );
            contentSha = fileData.sha ?? null;
          }
        }
      } catch {
        // README.md might not exist yet — that's OK, we'll sync on first push
      }

      // Upsert the repo index
      const [config] = await db
        .insert(orgRepoIndexes)
        .values({
          clerkOrgId: ctx.auth.orgId,
          integrationId: input.integrationId,
          repoFullName: input.repoFullName,
          providerResourceId: input.providerResourceId,
          cachedContent,
          contentSha,
          isActive: true,
          indexingStatus: "idle",
          lastSyncedAt: cachedContent ? new Date().toISOString() : null,
        })
        .onConflictDoUpdate({
          target: orgRepoIndexes.clerkOrgId,
          set: {
            integrationId: input.integrationId,
            repoFullName: input.repoFullName,
            providerResourceId: input.providerResourceId,
            cachedContent,
            contentSha,
            isActive: true,
            indexingStatus: "idle",
            lastSyncedAt: cachedContent ? new Date().toISOString() : null,
            updatedAt: new Date().toISOString(),
          },
        })
        .returning({
          id: orgRepoIndexes.id,
          lastSyncedAt: orgRepoIndexes.lastSyncedAt,
          hasContent: orgRepoIndexes.cachedContent,
        });

      return {
        configId: config!.id,
        lastSyncedAt: config!.lastSyncedAt,
        hasContent: config!.hasContent !== null,
      };
    }),

  /**
   * Deactivate .lightfast repo indexing.
   */
  deactivate: orgScopedProcedure.mutation(async ({ ctx }) => {
    await db
      .update(orgRepoIndexes)
      .set({
        isActive: false,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(orgRepoIndexes.clerkOrgId, ctx.auth.orgId));

    return { status: "deactivated" as const };
  }),
} satisfies TRPCRouterRecord;
