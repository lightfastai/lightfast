import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { protectedProcedure, publicProcedure } from "../trpc";
import { DeusConnectedRepository } from "@db/deus/schema";

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
        organizationId: z.string(),
      })
    )
    .query(async ({ ctx, input }) => {
      const whereConditions = [
        eq(DeusConnectedRepository.organizationId, input.organizationId),
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
        organizationId: z.string(),
      })
    )
    .query(async ({ ctx, input }) => {
      const result = await ctx.db
        .select()
        .from(DeusConnectedRepository)
        .where(
          and(
            eq(DeusConnectedRepository.id, input.repositoryId),
            eq(DeusConnectedRepository.organizationId, input.organizationId)
          )
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
   * - Frontend calls this endpoint with: organizationId, githubRepoId, githubInstallationId
   * - We store minimal immutable data only
   *
   * SIMPLIFIED APPROACH:
   * - Store only immutable data: organizationId, githubRepoId, githubInstallationId
   * - Optionally cache metadata for UI display (can be stale)
   * - Fetch fresh repo details from GitHub API when needed
   */
  connect: protectedProcedure
    .input(
      z.object({
        organizationId: z.string(),
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
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Check if this repository is already connected to this organization
      const existingRepoResult = await ctx.db
        .select()
        .from(DeusConnectedRepository)
        .where(
          and(
            eq(DeusConnectedRepository.githubRepoId, input.githubRepoId),
            eq(DeusConnectedRepository.organizationId, input.organizationId)
          )
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
        organizationId: input.organizationId,
        githubRepoId: input.githubRepoId,
        githubInstallationId: input.githubInstallationId,
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
            eq(DeusConnectedRepository.isActive, true)
          )
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
      })
    )
    .mutation(async ({ ctx, input }) => {
      const whereConditions = [
        eq(DeusConnectedRepository.githubRepoId, input.githubRepoId),
      ];
      if (input.githubInstallationId) {
        whereConditions.push(
          eq(
            DeusConnectedRepository.githubInstallationId,
            input.githubInstallationId
          )
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
            input.githubInstallationId
          )
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
      })
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
} satisfies TRPCRouterRecord;
