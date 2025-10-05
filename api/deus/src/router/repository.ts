import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure } from "../trpc";
import { db } from "@db/deus/client";
import { DeusConnectedRepository } from "@db/deus";
import { desc, eq, and } from "drizzle-orm";

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

      const repositories = await db
        .select({
          id: DeusConnectedRepository.id,
          githubRepoId: DeusConnectedRepository.githubRepoId,
          githubInstallationId: DeusConnectedRepository.githubInstallationId,
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
        organizationId: z.string(),
      })
    )
    .query(async ({ ctx, input }) => {
      const repository = await db
        .select()
        .from(DeusConnectedRepository)
        .where(
          and(
            eq(DeusConnectedRepository.id, input.repositoryId),
            eq(DeusConnectedRepository.organizationId, input.organizationId)
          )
        )
        .limit(1);

      if (!repository[0]) {
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
      const existingRepo = await db
        .select()
        .from(DeusConnectedRepository)
        .where(
          and(
            eq(DeusConnectedRepository.organizationId, input.organizationId),
            eq(DeusConnectedRepository.githubRepoId, input.githubRepoId),
            eq(DeusConnectedRepository.isActive, true)
          )
        )
        .limit(1);

      if (existingRepo[0]) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "This repository is already connected to this organization.",
        });
      }

      // Check if this specific repository was previously connected (soft deleted)
      const previousConnection = await db
        .select()
        .from(DeusConnectedRepository)
        .where(
          and(
            eq(DeusConnectedRepository.organizationId, input.organizationId),
            eq(DeusConnectedRepository.githubRepoId, input.githubRepoId)
          )
        )
        .limit(1);

      if (previousConnection[0]) {
        // Reactivate previous connection
        await db
          .update(DeusConnectedRepository)
          .set({
            isActive: true,
            githubInstallationId: input.githubInstallationId,
            permissions: input.permissions,
            metadata: input.metadata,
          })
          .where(eq(DeusConnectedRepository.id, previousConnection[0].id));

        return {
          id: previousConnection[0].id,
          success: true,
        };
      }

      // Generate a new UUID for the repository
      const id = crypto.randomUUID();

      await db.insert(DeusConnectedRepository).values({
        id,
        organizationId: input.organizationId,
        githubRepoId: input.githubRepoId,
        githubInstallationId: input.githubInstallationId,
        permissions: input.permissions,
        metadata: input.metadata,
      });

      return {
        id,
        success: true,
      };
    }),
} satisfies TRPCRouterRecord;
