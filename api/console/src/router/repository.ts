import type { TRPCRouterRecord } from "@trpc/server";
import { DeusConnectedRepository, workspaces } from "@db/console/schema";
import { getOrCreateDefaultWorkspace } from "@db/console/utils";
import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { createGitHubApp, ConfigDetectorService } from "@repo/console-octokit-github";
import { randomUUID } from "node:crypto";
import { minimatch } from "minimatch";
import yaml from "yaml";
import { inngest } from "@api/console/inngest";
import { env } from "../env";
import { getWorkspaceKey } from "@db/console/utils";

import { protectedProcedure, publicProcedure } from "../trpc";

// Helper to create GitHub App instance
function getGitHubApp() {
  return createGitHubApp(
    {
      appId: env.GITHUB_APP_ID,
      privateKey: env.GITHUB_APP_PRIVATE_KEY,
    },
    true // Format private key
  );
}

export const repositoryRouter = {
  /**
   * List organization's connected repositories
   * Returns all active repositories for the specified organization
   *
   * Note: This returns minimal data from our DB. Frontend should fetch
   * fresh repo details (name, owner, description, etc.) from GitHub API
   * using the githubRepoId.
   */
  list: protectedProcedure
    .input(
      z.object({
        includeInactive: z.boolean().default(false),
        clerkOrgSlug: z.string(), // Clerk org slug from URL
      }),
    )
    .query(async ({ ctx, input }) => {
      // Verify org access and resolve org ID
      const { verifyOrgAccessAndResolve } = await import("../trpc");
      const { clerkOrgId } = await verifyOrgAccessAndResolve({
        clerkOrgSlug: input.clerkOrgSlug,
        userId: ctx.auth.userId,
      });

      const whereConditions = [
        eq(DeusConnectedRepository.clerkOrgId, clerkOrgId),
      ];

      if (!input.includeInactive) {
        whereConditions.push(eq(DeusConnectedRepository.isActive, true));
      }

      return await ctx.db
        .select()
        .from(DeusConnectedRepository)
        .where(and(...whereConditions));
    }),

  /**
   * Get a single repository by ID
   */
  get: protectedProcedure
    .input(
      z.object({
        repositoryId: z.string(),
        clerkOrgSlug: z.string(), // Clerk org slug from URL
      }),
    )
    .query(async ({ ctx, input }) => {
      // Verify org access and resolve org ID
      const { verifyOrgAccessAndResolve } = await import("../trpc");
      const { clerkOrgId } = await verifyOrgAccessAndResolve({
        clerkOrgSlug: input.clerkOrgSlug,
        userId: ctx.auth.userId,
      });

      const result = await ctx.db
        .select()
        .from(DeusConnectedRepository)
        .where(
          and(
            eq(DeusConnectedRepository.id, input.repositoryId),
            eq(DeusConnectedRepository.clerkOrgId, clerkOrgId),
          ),
        )
        .limit(1);

      const repository = result[0];

      if (!repository) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Repository not found",
        });
      }

      return repository;
    }),

  /**
   * Connect a new repository
   *
   * GITHUB APP FLOW:
   * - Organization has GitHub App installed
   * - We use installation ID to get installation access tokens
   * - Frontend calls this endpoint with: clerkOrgId, githubRepoId, githubInstallationId
   * - We store minimal immutable data only
   *
   * SIMPLIFIED APPROACH:
   * - Store only immutable data: clerkOrgId, githubRepoId, githubInstallationId
   * - Optionally cache metadata for UI display (can be stale)
   * - Fetch fresh repo details from GitHub API when needed
   */
  connect: protectedProcedure
    .input(
      z.object({
        clerkOrgSlug: z.string(), // Clerk org slug from URL
        githubRepoId: z.string(),
        githubInstallationId: z.string(),
        permissions: z
          .object({
            admin: z.boolean(),
            push: z.boolean(),
            pull: z.boolean(),
          })
          .optional(),
        metadata: z.record(z.unknown()).optional(), // Optional cache (fullName, description, etc.)
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Verify org access and resolve org ID
      const { verifyOrgAccessAndResolve } = await import("../trpc");
      const { clerkOrgId } = await verifyOrgAccessAndResolve({
        clerkOrgSlug: input.clerkOrgSlug,
        userId: ctx.auth.userId,
      });

      // Get or create default workspace for organization
      const workspaceId = await getOrCreateDefaultWorkspace(clerkOrgId);

      // Check if this repository is already connected to this organization
      const existingRepoResult = await ctx.db
        .select()
        .from(DeusConnectedRepository)
        .where(
          and(
            eq(DeusConnectedRepository.githubRepoId, input.githubRepoId),
            eq(DeusConnectedRepository.clerkOrgId, clerkOrgId),
          ),
        )
        .limit(1);

      const existingRepo = existingRepoResult[0];

      if (existingRepo?.isActive) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "This repository is already connected to this organization.",
        });
      }

      if (existingRepo) {
        // Reactivate previous connection
        await ctx.db
          .update(DeusConnectedRepository)
          .set({
            isActive: true,
            githubInstallationId: input.githubInstallationId,
            workspaceId,
            permissions: input.permissions,
            metadata: input.metadata,
            lastSyncedAt: new Date().toISOString(),
          })
          .where(eq(DeusConnectedRepository.id, existingRepo.id));

        // Return the updated repository
        const updatedResult = await ctx.db
          .select()
          .from(DeusConnectedRepository)
          .where(eq(DeusConnectedRepository.id, existingRepo.id))
          .limit(1);

        return updatedResult[0];
      }

      // Generate a new UUID for the repository
      const id = crypto.randomUUID();

      // Create new connection
      await ctx.db.insert(DeusConnectedRepository).values({
        id,
        clerkOrgId,
        githubRepoId: input.githubRepoId,
        githubInstallationId: input.githubInstallationId,
        workspaceId,
        permissions: input.permissions,
        metadata: input.metadata,
        isActive: true,
      });

      // Return the created repository
      const createdResult = await ctx.db
        .select()
        .from(DeusConnectedRepository)
        .where(eq(DeusConnectedRepository.id, id))
        .limit(1);

      return createdResult[0];
    }),

  /**
   * Internal procedures for webhooks (PUBLIC - no auth needed)
   * These are used by GitHub webhooks to manage repository state
   */

  /**
   * Find active repository by GitHub repo ID
   * Used by webhooks to lookup repositories
   */
  findActiveByGithubRepoId: publicProcedure
    .input(z.object({ githubRepoId: z.string() }))
    .query(async ({ ctx, input }) => {
      const result = await ctx.db
        .select({ id: DeusConnectedRepository.id })
        .from(DeusConnectedRepository)
        .where(
          and(
            eq(DeusConnectedRepository.githubRepoId, input.githubRepoId),
            eq(DeusConnectedRepository.isActive, true),
          ),
        )
        .limit(1);
      return result[0] ?? null;
    }),

  /**
   * Mark repository as inactive
   * Used by webhooks when repository is disconnected or deleted
   */
  markInactive: publicProcedure
    .input(
      z.object({
        githubRepoId: z.string(),
        githubInstallationId: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const whereConditions = [
        eq(DeusConnectedRepository.githubRepoId, input.githubRepoId),
      ];
      if (input.githubInstallationId) {
        whereConditions.push(
          eq(
            DeusConnectedRepository.githubInstallationId,
            input.githubInstallationId,
          ),
        );
      }
      await ctx.db
        .update(DeusConnectedRepository)
        .set({ isActive: false })
        .where(and(...whereConditions));
    }),

  /**
   * Mark all repositories for an installation as inactive
   * Used by webhooks when GitHub App is uninstalled
   */
  markInstallationInactive: publicProcedure
    .input(z.object({ githubInstallationId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .update(DeusConnectedRepository)
        .set({ isActive: false })
        .where(
          eq(
            DeusConnectedRepository.githubInstallationId,
            input.githubInstallationId,
          ),
        );
    }),

  /**
   * Update repository metadata
   * Used by webhooks to keep cached metadata fresh
   */
  updateMetadata: publicProcedure
    .input(
      z.object({
        githubRepoId: z.string(),
        metadata: z.record(z.unknown()),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const repos = await ctx.db
        .select()
        .from(DeusConnectedRepository)
        .where(eq(DeusConnectedRepository.githubRepoId, input.githubRepoId));

      for (const repo of repos) {
        await ctx.db
          .update(DeusConnectedRepository)
          .set({
            metadata: { ...repo.metadata, ...input.metadata },
          })
          .where(eq(DeusConnectedRepository.id, repo.id));
      }
    }),

  /**
   * Mark repository as deleted
   * Used by webhooks when repository is deleted on GitHub
   */
  markDeleted: publicProcedure
    .input(z.object({ githubRepoId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .update(DeusConnectedRepository)
        .set({
          isActive: false,
          metadata: { deleted: true, deletedAt: new Date().toISOString() },
        })
        .where(eq(DeusConnectedRepository.githubRepoId, input.githubRepoId));
    }),

  /**
   * Update repository config status
   * Used by webhooks when lightfast.yml is modified
   */
  updateConfigStatus: publicProcedure
    .input(
      z.object({
        githubRepoId: z.string(),
        configStatus: z.enum(["configured", "unconfigured"]),
        configPath: z.string().nullable(),
        workspaceId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .update(DeusConnectedRepository)
        .set({
          configStatus: input.configStatus,
          configPath: input.configPath,
          configDetectedAt: new Date().toISOString(),
          workspaceId: input.workspaceId,
        })
        .where(eq(DeusConnectedRepository.githubRepoId, input.githubRepoId));
    }),

  /**
   * Detect lightfast.yml configuration in repository
   * Can be called manually to re-check config status
   */
  detectConfig: protectedProcedure
    .input(
      z.object({
        repositoryId: z.string(),
        clerkOrgSlug: z.string(), // Clerk org slug from URL
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify org access and resolve org ID
      const { verifyOrgAccessAndResolve } = await import("../trpc");
      const { clerkOrgId } = await verifyOrgAccessAndResolve({
        clerkOrgSlug: input.clerkOrgSlug,
        userId: ctx.auth.userId,
      });

      // Get repository
      const repoResult = await ctx.db
        .select()
        .from(DeusConnectedRepository)
        .where(
          and(
            eq(DeusConnectedRepository.id, input.repositoryId),
            eq(DeusConnectedRepository.clerkOrgId, clerkOrgId)
          )
        )
        .limit(1);

      const repository = repoResult[0];

      if (!repository) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Repository not found",
        });
      }

      // Extract owner and repo name from metadata
      const fullName = repository.metadata?.fullName;
      if (!fullName) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Repository metadata missing fullName",
        });
      }

      const [owner, repo] = fullName.split("/");
      if (!owner || !repo) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invalid repository fullName format",
        });
      }

      // Detect config
      try {
        const app = getGitHubApp();
        const detector = new ConfigDetectorService(app);

        // Resolve the repository default branch from GitHub API; fallback to "main"
        let ref = "main";
        try {
          const octokit = await app.getInstallationOctokit(
            Number.parseInt(repository.githubInstallationId, 10),
          );
          const { data: repoInfo } = await octokit.request(
            "GET /repos/{owner}/{repo}",
            {
              owner,
              repo,
              headers: { "X-GitHub-Api-Version": "2022-11-28" },
            },
          );
          if (repoInfo?.default_branch && typeof repoInfo.default_branch === "string") {
            ref = repoInfo.default_branch as string;
          }
        } catch (e) {
          // Non-fatal; keep fallback to "main"
        }

        const result = await detector.detectConfig(
          owner,
          repo,
          ref,
          Number.parseInt(repository.githubInstallationId, 10),
        );

        // Resolve workspace (DB UUID) and compute workspaceKey from slug
        const wsId = await getOrCreateDefaultWorkspace(clerkOrgId);
        const ws = await ctx.db.query.workspaces.findFirst({ where: eq(workspaces.id, wsId) });
        const workspaceId = ws?.id ?? wsId;

        // Update repository with detection result
        await ctx.db
          .update(DeusConnectedRepository)
          .set({
            configStatus: result.exists ? "configured" : "unconfigured",
            configPath: result.path,
            configDetectedAt: new Date().toISOString(),
            workspaceId,
          })
          .where(eq(DeusConnectedRepository.id, repository.id));

        return {
          exists: result.exists,
          path: result.path,
          workspaceId,
        };
      } catch (error: any) {
        console.error("[tRPC] Config detection failed:", error);

        // Update status to error
        await ctx.db
          .update(DeusConnectedRepository)
          .set({
            configStatus: "error",
            configDetectedAt: new Date().toISOString(),
          })
          .where(eq(DeusConnectedRepository.id, repository.id));

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to detect configuration",
          cause: error,
        });
      }
    }),

  /**
   * Manually start an ingestion job for a repository
   *
   * Enumerates repository files on the default branch, filters by lightfast.yml include globs,
   * and triggers an Inngest event equivalent to a push with all matched files marked as modified.
   */
  reindex: protectedProcedure
    .input(
      z.object({
        repositoryId: z.string(),
        clerkOrgSlug: z.string(), // Clerk org slug from URL
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify org access and resolve org ID
      const { verifyOrgAccessAndResolve } = await import("../trpc");
      const { clerkOrgId } = await verifyOrgAccessAndResolve({
        clerkOrgSlug: input.clerkOrgSlug,
        userId: ctx.auth.userId,
      });

      // Resolve repository
      const [repository] = await ctx.db
        .select()
        .from(DeusConnectedRepository)
        .where(
          and(
            eq(DeusConnectedRepository.id, input.repositoryId),
            eq(DeusConnectedRepository.clerkOrgId, clerkOrgId),
          ),
        )
        .limit(1);

      if (!repository) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Repository not found" });
      }

      const fullName = repository.metadata?.fullName;
      if (!fullName) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Repository metadata missing fullName" });
      }
      const [owner, repo] = fullName.split("/");
      if (!owner || !repo) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid repository fullName format" });
      }

      // GitHub App client
      const app = getGitHubApp();
      const octokit = await app.getInstallationOctokit(Number.parseInt(repository.githubInstallationId, 10));

      // Resolve default branch and HEAD commit SHA
      const { data: repoInfo } = await octikitSafe(async () =>
        octokit.request("GET /repos/{owner}/{repo}", {
          owner,
          repo,
          headers: { "X-GitHub-Api-Version": "2022-11-28" },
        }),
      );
      const defaultBranch = (repoInfo.default_branch as string) ?? "main";
      const { data: head } = await octikitSafe(async () =>
        octokit.request("GET /repos/{owner}/{repo}/commits/{ref}", {
          owner,
          repo,
          ref: defaultBranch,
          headers: { "X-GitHub-Api-Version": "2022-11-28" },
        }),
      );
      const headSha = (head.sha as string) ?? defaultBranch;

      // Detect config path and load config contents
      const detector = new ConfigDetectorService(app);
      const detection = await detector.detectConfig(owner, repo, defaultBranch, Number.parseInt(repository.githubInstallationId, 10));

      let includeGlobs: string[] = ["docs/**/*.md", "docs/**/*.mdx", "README.md"]; // sensible defaults
      let configuredStore: string | undefined;
      if (detection.exists && detection.path) {
        const { data } = await octikitSafe(async () =>
          octokit.request("GET /repos/{owner}/{repo}/contents/{path}", {
            owner,
            repo,
            path: detection.path!,
            ref: defaultBranch,
            headers: { "X-GitHub-Api-Version": "2022-11-28" },
          }),
        );
        if ("content" in data && data.type === "file") {
          const yamlText = Buffer.from((data.content as string) ?? "", "base64").toString("utf-8");
          try {
            const parsed = yaml.parse(yamlText) as any;
            if (parsed && Array.isArray(parsed.include) && parsed.include.length > 0) {
              includeGlobs = parsed.include as string[];
            }
            if (parsed && typeof parsed.store === "string" && parsed.store.length > 0) {
              configuredStore = parsed.store as string;
            }
          } catch {
            // ignore parse errors; keep defaults
          }
        }
      }

      // Enumerate repo tree and filter by globs
      const { data: tree } = await octikitSafe(async () =>
        octokit.request("GET /repos/{owner}/{repo}/git/trees/{tree_sha}", {
          owner,
          repo,
          tree_sha: headSha,
          recursive: "true",
          headers: { "X-GitHub-Api-Version": "2022-11-28" },
        }),
      );

      const allPaths: string[] = Array.isArray((tree as any).tree)
        ? (tree as any).tree.filter((n: any) => n.type === "blob" && typeof n.path === "string").map((n: any) => n.path as string)
        : [];

      const matches = allPaths.filter((p) => includeGlobs.some((g) => minimatch(p, g)));
      if (matches.length === 0) {
        return { queued: 0, matched: 0, message: "No files match include globs" };
      }

      // Prepare Inngest event
      const deliveryId = randomUUID();
      // Resolve default workspace (DB UUID) + workspaceKey
      const wsId = await getOrCreateDefaultWorkspace(clerkOrgId);
      const ws = await ctx.db.query.workspaces.findFirst({ where: eq(workspaces.id, wsId) });
      const workspaceId = ws?.id ?? wsId; // DB UUID
      const workspaceKey = ws ? getWorkspaceKey(ws.slug) : `ws-default`;
      const changedFiles = matches.map((path) => ({ path, status: "modified" as const }));

      // Send event to Inngest
      await inngest.send({
        name: "apps-console/docs.push",
        data: {
          workspaceId,
          workspaceKey,
          repoFullName: fullName,
          githubRepoId: Number.parseInt(repository.githubRepoId, 10),
          githubInstallationId: Number.parseInt(repository.githubInstallationId, 10),
          beforeSha: headSha,
          afterSha: headSha,
          deliveryId,
          source: "manual",
          changedFiles,
        },
      });

      return { queued: matches.length, matched: matches.length, deliveryId, ref: defaultBranch };
    }),
} satisfies TRPCRouterRecord;

// Helper to safely call Octokit and unwrap data
async function octikitSafe<T>(fn: () => Promise<{ data: T }>): Promise<{ data: T }> {
  return await fn();
}
