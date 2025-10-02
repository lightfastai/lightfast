import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure } from "../trpc";
import { db } from "@db/deus/client";
import { DeusConnectedRepository } from "@db/deus";
import { desc, eq, and } from "drizzle-orm";

export const repositoryRouter = {
  /**
   * List user's connected repositories
   * Returns all active repositories for the authenticated user
   *
   * Note: This returns minimal data from our DB. Frontend should fetch
   * fresh repo details (name, owner, description, etc.) from GitHub API
   * using the githubRepoId.
   */
  list: protectedProcedure
    .input(
      z.object({
        includeInactive: z.boolean().default(false),
      })
    )
    .query(async ({ ctx, input }) => {
      const whereConditions = [
        eq(DeusConnectedRepository.userId, ctx.session.userId),
      ];

      if (!input.includeInactive) {
        whereConditions.push(eq(DeusConnectedRepository.isActive, true));
      }

      const repositories = await db
        .select({
          id: DeusConnectedRepository.id,
          githubRepoId: DeusConnectedRepository.githubRepoId,
          installationId: DeusConnectedRepository.installationId,
          permissions: DeusConnectedRepository.permissions,
          isActive: DeusConnectedRepository.isActive,
          connectedAt: DeusConnectedRepository.connectedAt,
          lastSyncedAt: DeusConnectedRepository.lastSyncedAt,
          metadata: DeusConnectedRepository.metadata, // Optional cache for UI
        })
        .from(DeusConnectedRepository)
        .where(and(...whereConditions))
        .orderBy(desc(DeusConnectedRepository.connectedAt));

      return repositories;
    }),

  /**
   * Get a single repository by ID
   */
  get: protectedProcedure
    .input(
      z.object({
        repositoryId: z.string(),
      })
    )
    .query(async ({ ctx, input }) => {
      const repository = await db
        .select()
        .from(DeusConnectedRepository)
        .where(eq(DeusConnectedRepository.id, input.repositoryId))
        .limit(1);

      if (
        !repository[0] ||
        repository[0].userId !== ctx.session.userId
      ) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Repository not found",
        });
      }

      return repository[0];
    }),

  /**
   * Connect a new repository
   *
   * SIMPLIFIED APPROACH:
   * - Store only immutable data: githubRepoId, accessToken, permissions
   * - Optionally cache metadata for UI display (can be stale)
   * - Fetch fresh repo details from GitHub API when needed
   */
  connect: protectedProcedure
    .input(
      z.object({
        githubRepoId: z.string(),
        installationId: z.string().optional(),
        accessToken: z.string().optional(),
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
      // Check if repository is already connected
      const existing = await db
        .select()
        .from(DeusConnectedRepository)
        .where(
          and(
            eq(DeusConnectedRepository.userId, ctx.session.userId),
            eq(DeusConnectedRepository.githubRepoId, input.githubRepoId)
          )
        )
        .limit(1);

      if (existing[0]) {
        // If already connected, update and set to active
        await db
          .update(DeusConnectedRepository)
          .set({
            isActive: true,
            installationId: input.installationId,
            accessToken: input.accessToken,
            permissions: input.permissions,
            metadata: input.metadata,
          })
          .where(eq(DeusConnectedRepository.id, existing[0].id));

        return {
          id: existing[0].id,
          success: true,
          alreadyConnected: true,
        };
      }

      // Generate a new UUID for the repository
      const id = crypto.randomUUID();

      await db.insert(DeusConnectedRepository).values({
        id,
        userId: ctx.session.userId,
        githubRepoId: input.githubRepoId,
        installationId: input.installationId,
        accessToken: input.accessToken,
        permissions: input.permissions,
        metadata: input.metadata,
      });

      return {
        id,
        success: true,
        alreadyConnected: false,
      };
    }),

  /**
   * Disconnect a repository
   * Sets the repository connection to inactive (soft delete)
   */
  disconnect: protectedProcedure
    .input(
      z.object({
        repositoryId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify ownership
      const repository = await db
        .select()
        .from(DeusConnectedRepository)
        .where(eq(DeusConnectedRepository.id, input.repositoryId))
        .limit(1);

      if (
        !repository[0] ||
        repository[0].userId !== ctx.session.userId
      ) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Repository not found",
        });
      }

      // Soft delete by setting isActive to false
      await db
        .update(DeusConnectedRepository)
        .set({ isActive: false })
        .where(eq(DeusConnectedRepository.id, input.repositoryId));

      return { success: true };
    }),

  /**
   * Update repository metadata cache
   * Use this to refresh the metadata cache after fetching from GitHub API
   */
  updateMetadata: protectedProcedure
    .input(
      z.object({
        repositoryId: z.string(),
        metadata: z.record(z.unknown()),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify ownership
      const repository = await db
        .select()
        .from(DeusConnectedRepository)
        .where(eq(DeusConnectedRepository.id, input.repositoryId))
        .limit(1);

      if (
        !repository[0] ||
        repository[0].userId !== ctx.session.userId
      ) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Repository not found",
        });
      }

      // Update metadata cache
      await db
        .update(DeusConnectedRepository)
        .set({ metadata: input.metadata })
        .where(eq(DeusConnectedRepository.id, input.repositoryId));

      return { success: true };
    }),

  /**
   * Update last synced timestamp
   * Called after successful GitHub API interaction
   */
  updateLastSynced: protectedProcedure
    .input(
      z.object({
        repositoryId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify ownership
      const repository = await db
        .select()
        .from(DeusConnectedRepository)
        .where(eq(DeusConnectedRepository.id, input.repositoryId))
        .limit(1);

      if (
        !repository[0] ||
        repository[0].userId !== ctx.session.userId
      ) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Repository not found",
        });
      }

      await db
        .update(DeusConnectedRepository)
        .set({
          lastSyncedAt: new Date().toISOString(),
        })
        .where(eq(DeusConnectedRepository.id, input.repositoryId));

      return { success: true };
    }),
} satisfies TRPCRouterRecord;
