import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure } from "../trpc";
import { RepositoriesService } from "@repo/deus-api-services/repositories";

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
      const repositoriesService = new RepositoriesService();
      return await repositoriesService.listByOrganization({
        organizationId: input.organizationId,
        includeInactive: input.includeInactive,
      });
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
      const repositoriesService = new RepositoriesService();
      const repository = await repositoriesService.findByIdAndOrganization(
        input.repositoryId,
        input.organizationId
      );

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
      const repositoriesService = new RepositoriesService();

      // Check if this repository is already connected to this organization
      const existingRepo = await repositoriesService.findByGithubRepoId(
        input.githubRepoId,
        input.organizationId
      );

      if (existingRepo?.isActive) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "This repository is already connected to this organization.",
        });
      }

      if (existingRepo) {
        // Reactivate previous connection
        return await repositoriesService.reactivate(existingRepo.id, {
          githubInstallationId: input.githubInstallationId,
          permissions: input.permissions,
          metadata: input.metadata,
        });
      }

      // Generate a new UUID for the repository
      const id = crypto.randomUUID();

      return await repositoriesService.connect({
        id,
        organizationId: input.organizationId,
        githubRepoId: input.githubRepoId,
        githubInstallationId: input.githubInstallationId,
        permissions: input.permissions,
        metadata: input.metadata,
      });
    }),
} satisfies TRPCRouterRecord;
