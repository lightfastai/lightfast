import type { TRPCRouterRecord } from "@trpc/server";
import { clerkClient } from "@clerk/nextjs/server";
import {
  DeusCodeReview,
  DeusConnectedRepository,
  organizations,
} from "@db/deus/schema";
import { TRPCError } from "@trpc/server";
import { and, desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";

import type { CodeReviewStatus } from "@repo/deus-types/code-review";
import {
  CODE_REVIEW_STATUS,
  CODE_REVIEW_TOOLS,
} from "@repo/deus-types/code-review";

import { createGitHubApp, listOpenPullRequests } from "@repo/deus-octokit-github";
import {
  createInitialPRMetadata,
  syncPRMetadata,
} from "../lib/sync-pr-metadata";
import {
  clerkProtectedProcedure,
  publicProcedure,
} from "../trpc";
import { env } from "../env";

const DEFAULT_REVIEW_STATUS: CodeReviewStatus = CODE_REVIEW_STATUS[0];

export const codeReviewRouter = {
  /**
   * List code reviews for an organization
   * Returns all reviews with cached PR metadata from database
   *
   * DESIGN:
   * - Fast: DB only, zero GitHub API calls
   * - Uses cached metadata (prTitle, prState, etc.)
   * - Webhooks keep metadata fresh
   * - Gracefully handles deleted PRs
   */
  list: clerkProtectedProcedure
    .input(
      z.object({
        organizationId: z.string(),
        repositoryId: z.string().optional(),
        status: z.enum(CODE_REVIEW_STATUS).optional(),
        limit: z.number().min(1).max(100).default(50),
      }),
    )
    .query(async ({ ctx, input }) => {
      // Verify user is a member of the organization
      // Get Clerk org ID from Deus organization
      const deusOrgResult = await ctx.db.query.organizations.findFirst({
        where: eq(organizations.id, input.organizationId),
      });

      if (!deusOrgResult?.clerkOrgId) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Organization not found",
        });
      }

      // Verify user is a member of the Clerk organization
      const clerk = await clerkClient();
      const clerkMemberships =
        await clerk.organizations.getOrganizationMembershipList({
          organizationId: deusOrgResult.clerkOrgId,
          limit: 500,
        });

      const userMembership = clerkMemberships.data.find(
        (m) => m.publicUserData?.userId === ctx.auth.userId,
      );

      if (!userMembership) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You are not a member of this organization",
        });
      }

      // First, get all repositories for this organization
      const repositories = await ctx.db
        .select()
        .from(DeusConnectedRepository)
        .where(
          and(
            eq(DeusConnectedRepository.organizationId, input.organizationId),
            eq(DeusConnectedRepository.isActive, true),
          ),
        );

      if (repositories.length === 0) {
        return [];
      }

      const repositoryIds = repositories.map((r) => r.id);

      // Filter by specific repository if provided
      if (input.repositoryId) {
        // Verify the repository belongs to this organization
        const repoExists = repositoryIds.includes(input.repositoryId);
        if (!repoExists) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Repository does not belong to this organization",
          });
        }
      }

      // Build where conditions for code reviews query
      const reviewWhereConditions = [
        inArray(DeusCodeReview.repositoryId, repositoryIds),
      ];

      if (input.repositoryId) {
        reviewWhereConditions.push(
          eq(DeusCodeReview.repositoryId, input.repositoryId),
        );
      }

      if (input.status) {
        reviewWhereConditions.push(eq(DeusCodeReview.status, input.status));
      }

      // Get code reviews
      const reviews = await ctx.db
        .select()
        .from(DeusCodeReview)
        .where(and(...reviewWhereConditions))
        .orderBy(desc(DeusCodeReview.createdAt))
        .limit(input.limit);

      // Join with repository data to get repo metadata
      const reviewsWithRepoData = await Promise.all(
        reviews.map(async (review) => {
          const repoResult = await ctx.db
            .select()
            .from(DeusConnectedRepository)
            .where(eq(DeusConnectedRepository.id, review.repositoryId))
            .limit(1);

          const repo = repoResult[0];

          return {
            ...review,
            repository: repo
              ? {
                  githubRepoId: repo.githubRepoId,
                  metadata: repo.metadata,
                }
              : null,
          };
        }),
      );

      return reviewsWithRepoData;
    }),

  /**
   * Get a single code review by ID
   */
  get: clerkProtectedProcedure
    .input(
      z.object({
        reviewId: z.string(),
        organizationId: z.string(),
      }),
    )
    .query(async ({ ctx, input }) => {
      // Verify user is a member of the organization
      // Get Clerk org ID from Deus organization
      const deusOrgResult = await ctx.db.query.organizations.findFirst({
        where: eq(organizations.id, input.organizationId),
      });

      if (!deusOrgResult?.clerkOrgId) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Organization not found",
        });
      }

      // Verify user is a member of the Clerk organization
      const clerk = await clerkClient();
      const clerkMemberships =
        await clerk.organizations.getOrganizationMembershipList({
          organizationId: deusOrgResult.clerkOrgId,
          limit: 500,
        });

      const userMembership = clerkMemberships.data.find(
        (m) => m.publicUserData?.userId === ctx.auth.userId,
      );

      if (!userMembership) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You are not a member of this organization",
        });
      }

      const reviewResult = await ctx.db
        .select()
        .from(DeusCodeReview)
        .where(eq(DeusCodeReview.id, input.reviewId))
        .limit(1);

      const review = reviewResult[0];

      if (!review) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Code review not found",
        });
      }

      // Verify this review belongs to a repository in the organization
      const repositoryResult = await ctx.db
        .select()
        .from(DeusConnectedRepository)
        .where(
          and(
            eq(DeusConnectedRepository.id, review.repositoryId),
            eq(DeusConnectedRepository.organizationId, input.organizationId),
          ),
        )
        .limit(1);

      const repository = repositoryResult[0];

      if (!repository) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You don't have access to this code review",
        });
      }

      return {
        ...review,
        repository,
      };
    }),

  /**
   * Create a new code review
   * Fetches initial PR metadata from GitHub API
   */
  create: clerkProtectedProcedure
    .input(
      z.object({
        organizationId: z.string(),
        repositoryId: z.string(),
        pullRequestNumber: z.number().int().positive(),
        githubPrId: z.string(),
        reviewTool: z.enum(CODE_REVIEW_TOOLS),
        command: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Verify user is a member of the organization
      // Get Clerk org ID from Deus organization
      const deusOrgResult = await ctx.db.query.organizations.findFirst({
        where: eq(organizations.id, input.organizationId),
      });

      if (!deusOrgResult?.clerkOrgId) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Organization not found",
        });
      }

      // Verify user is a member of the Clerk organization
      const clerk = await clerkClient();
      const clerkMemberships =
        await clerk.organizations.getOrganizationMembershipList({
          organizationId: deusOrgResult.clerkOrgId,
          limit: 500,
        });

      const userMembership = clerkMemberships.data.find(
        (m) => m.publicUserData?.userId === ctx.auth.userId,
      );

      if (!userMembership) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You are not a member of this organization",
        });
      }

      // Verify repository belongs to organization
      const repositoryResult = await ctx.db
        .select()
        .from(DeusConnectedRepository)
        .where(
          and(
            eq(DeusConnectedRepository.id, input.repositoryId),
            eq(DeusConnectedRepository.organizationId, input.organizationId),
          ),
        )
        .limit(1);

      const repository = repositoryResult[0];

      if (!repository || !repository.isActive) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Repository not found or not connected to this organization",
        });
      }

      // Extract owner/repo from metadata
      const fullName = repository.metadata?.fullName;
      if (!fullName || typeof fullName !== "string") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            "Repository metadata is missing. Please reconnect the repository.",
        });
      }

      const [owner, repoName] = fullName.split("/");
      if (!owner || !repoName) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invalid repository metadata format",
        });
      }

      // Fetch initial PR metadata from GitHub
      const initialMetadata = await createInitialPRMetadata(
        Number(repository.githubInstallationId),
        owner,
        repoName,
        input.pullRequestNumber,
      );

      // Create code review record
      const reviewId = crypto.randomUUID();

      await ctx.db.insert(DeusCodeReview).values({
        id: reviewId,
        repositoryId: input.repositoryId,
        pullRequestNumber: input.pullRequestNumber,
        githubPrId: input.githubPrId,
        reviewTool: input.reviewTool,
        status: DEFAULT_REVIEW_STATUS,
        triggeredBy: ctx.auth.userId,
        metadata: {
          command: input.command,
          ...initialMetadata,
        },
      });

      return {
        id: reviewId,
        success: true,
        synced: Boolean(initialMetadata),
      };
    }),

  /**
   * Sync PR metadata from GitHub API
   * Manually refresh cached PR data (title, state, etc.)
   */
  sync: clerkProtectedProcedure
    .input(
      z.object({
        reviewId: z.string(),
        organizationId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Verify user is a member of the organization
      // Get Clerk org ID from Deus organization
      const deusOrgResult = await ctx.db.query.organizations.findFirst({
        where: eq(organizations.id, input.organizationId),
      });

      if (!deusOrgResult?.clerkOrgId) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Organization not found",
        });
      }

      // Verify user is a member of the Clerk organization
      const clerk = await clerkClient();
      const clerkMemberships =
        await clerk.organizations.getOrganizationMembershipList({
          organizationId: deusOrgResult.clerkOrgId,
          limit: 500,
        });

      const userMembership = clerkMemberships.data.find(
        (m) => m.publicUserData?.userId === ctx.auth.userId,
      );

      if (!userMembership) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You are not a member of this organization",
        });
      }

      // Verify access to this review
      const reviewResult = await ctx.db
        .select()
        .from(DeusCodeReview)
        .where(eq(DeusCodeReview.id, input.reviewId))
        .limit(1);

      const review = reviewResult[0];

      if (!review) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Code review not found",
        });
      }

      const repositoryResult = await ctx.db
        .select()
        .from(DeusConnectedRepository)
        .where(
          and(
            eq(DeusConnectedRepository.id, review.repositoryId),
            eq(DeusConnectedRepository.organizationId, input.organizationId),
          ),
        )
        .limit(1);

      const repository = repositoryResult[0];

      if (!repository) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You don't have access to this code review",
        });
      }

      // Sync metadata from GitHub API
      const updatedMetadata = await syncPRMetadata(input.reviewId);

      if (!updatedMetadata) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to sync PR metadata from GitHub",
        });
      }

      return {
        success: true,
        metadata: updatedMetadata,
      };
    }),

  /**
   * Scan repository for open PRs and create code reviews
   * Used when first connecting a repository or manually refreshing PR list
   */
  scanRepository: clerkProtectedProcedure
    .input(
      z.object({
        organizationId: z.string(),
        repositoryId: z.string(),
        reviewTool: z.enum(CODE_REVIEW_TOOLS).default("claude"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Verify user is a member of the organization
      // Get Clerk org ID from Deus organization
      const deusOrgResult = await ctx.db.query.organizations.findFirst({
        where: eq(organizations.id, input.organizationId),
      });

      if (!deusOrgResult?.clerkOrgId) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Organization not found",
        });
      }

      // Verify user is a member of the Clerk organization
      const clerk = await clerkClient();
      const clerkMemberships =
        await clerk.organizations.getOrganizationMembershipList({
          organizationId: deusOrgResult.clerkOrgId,
          limit: 500,
        });

      const userMembership = clerkMemberships.data.find(
        (m) => m.publicUserData?.userId === ctx.auth.userId,
      );

      if (!userMembership) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You are not a member of this organization",
        });
      }

      // Verify repository belongs to organization
      const repositoryResult = await ctx.db
        .select()
        .from(DeusConnectedRepository)
        .where(
          and(
            eq(DeusConnectedRepository.id, input.repositoryId),
            eq(DeusConnectedRepository.organizationId, input.organizationId),
          ),
        )
        .limit(1);

      const repository = repositoryResult[0];

      if (!repository || !repository.isActive) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Repository not found or not connected to this organization",
        });
      }

      // Extract owner/repo from metadata
      const fullName = repository.metadata?.fullName;
      if (!fullName || typeof fullName !== "string") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            "Repository metadata is missing. Please reconnect the repository.",
        });
      }

      const [owner, repoName] = fullName.split("/");
      if (!owner || !repoName) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invalid repository metadata format",
        });
      }

      // Fetch open PRs from GitHub
      const app = createGitHubApp(
        {
          appId: env.GITHUB_APP_ID,
          privateKey: env.GITHUB_APP_PRIVATE_KEY,
        },
        true, // Format the private key
      );
      const openPRs = await listOpenPullRequests(
        app,
        Number(repository.githubInstallationId),
        owner,
        repoName,
        100, // Limit to 100 most recent open PRs
      );

      let created = 0;
      let skipped = 0;

      // Process each PR
      for (const pr of openPRs) {
        // Check if review already exists for this PR
        const existingResult = await ctx.db
          .select({ id: DeusCodeReview.id })
          .from(DeusCodeReview)
          .where(
            and(
              eq(DeusCodeReview.repositoryId, input.repositoryId),
              eq(DeusCodeReview.githubPrId, pr.id.toString()),
            ),
          )
          .limit(1);

        if (existingResult[0]) {
          skipped++;
          continue;
        }

        // Create initial metadata from PR data
        const metadata = {
          prTitle: pr.title,
          prState: pr.state,
          prMerged: false, // Open PRs are never merged
          prAuthor: pr.user?.login,
          prAuthorAvatar: pr.user?.avatar_url,
          prUrl: pr.html_url,
          branch: pr.head.ref,
          lastSyncedAt: new Date().toISOString(),
        };

        // Create code review record
        const reviewId = crypto.randomUUID();

        await ctx.db.insert(DeusCodeReview).values({
          id: reviewId,
          repositoryId: input.repositoryId,
          pullRequestNumber: pr.number,
          githubPrId: pr.id.toString(),
          reviewTool: input.reviewTool,
          status: DEFAULT_REVIEW_STATUS,
          triggeredBy: ctx.auth.userId,
          metadata,
        });

        created++;
      }

      return {
        success: true,
        total: openPRs.length,
        created,
        skipped,
      };
    }),

  /**
   * Internal procedures for webhooks (PUBLIC - no auth needed)
   * These are used by GitHub webhooks to manage code review state
   */

  /**
   * Find reviews by repository and PR ID
   * Used by webhooks to lookup code reviews for a specific PR
   */
  findByRepositoryAndPrId: publicProcedure
    .input(
      z.object({
        repositoryId: z.string(),
        githubPrId: z.string(),
      }),
    )
    .query(async ({ ctx, input }) => {
      return await ctx.db
        .select()
        .from(DeusCodeReview)
        .where(
          and(
            eq(DeusCodeReview.repositoryId, input.repositoryId),
            eq(DeusCodeReview.githubPrId, input.githubPrId),
          ),
        );
    }),

  /**
   * Update metadata for multiple reviews
   * Used by webhooks to batch update review metadata
   */
  updateMetadataBatch: publicProcedure
    .input(
      z.array(
        z.object({
          id: z.string(),
          metadata: z.record(z.unknown()),
        }),
      ),
    )
    .mutation(async ({ ctx, input }) => {
      for (const review of input) {
        await ctx.db
          .update(DeusCodeReview)
          .set({ metadata: review.metadata })
          .where(eq(DeusCodeReview.id, review.id));
      }
    }),
} satisfies TRPCRouterRecord;
