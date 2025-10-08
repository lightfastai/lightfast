import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure } from "../trpc";
import { db } from "@db/deus/client";
import { DeusCodeReview, DeusConnectedRepository } from "@db/deus";
import {
  CODE_REVIEW_STATUS,
  CODE_REVIEW_TOOLS,
} from "@repo/deus-types/code-review";
import type { CodeReviewStatus } from "@repo/deus-types/code-review";
import { desc, eq, and, inArray } from "drizzle-orm";
import { syncPRMetadata, createInitialPRMetadata } from "../lib/sync-pr-metadata";
import { listOpenPullRequests } from "../lib/github-app";

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
  list: protectedProcedure
    .input(
      z.object({
        organizationId: z.string(),
        repositoryId: z.string().optional(),
        status: z.enum(CODE_REVIEW_STATUS).optional(),
        limit: z.number().min(1).max(100).default(50),
      })
    )
    .query(async ({ ctx, input }) => {
      // First, get all repositories for this organization
      const repositories = await db
        .select({ id: DeusConnectedRepository.id })
        .from(DeusConnectedRepository)
        .where(
          and(
            eq(DeusConnectedRepository.organizationId, input.organizationId),
            eq(DeusConnectedRepository.isActive, true)
          )
        );

      if (repositories.length === 0) {
        return [];
      }

      const repositoryIds = repositories.map((r) => r.id);

      // Build where conditions
      const whereConditions = [
        inArray(DeusCodeReview.repositoryId, repositoryIds),
      ];

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
        whereConditions.push(eq(DeusCodeReview.repositoryId, input.repositoryId));
      }

      // Filter by status if provided
      if (input.status) {
        whereConditions.push(eq(DeusCodeReview.status, input.status));
      }

      const reviews = await db
        .select({
          id: DeusCodeReview.id,
          repositoryId: DeusCodeReview.repositoryId,
          pullRequestNumber: DeusCodeReview.pullRequestNumber,
          githubPrId: DeusCodeReview.githubPrId,
          reviewTool: DeusCodeReview.reviewTool,
          status: DeusCodeReview.status,
          triggeredBy: DeusCodeReview.triggeredBy,
          triggeredAt: DeusCodeReview.triggeredAt,
          startedAt: DeusCodeReview.startedAt,
          completedAt: DeusCodeReview.completedAt,
          metadata: DeusCodeReview.metadata,
        })
        .from(DeusCodeReview)
        .where(and(...whereConditions))
        .orderBy(desc(DeusCodeReview.triggeredAt))
        .limit(input.limit);

      // Join with repository data to get repo metadata
      const reviewsWithRepoData = await Promise.all(
        reviews.map(async (review) => {
          const repo = await db
            .select({
              githubRepoId: DeusConnectedRepository.githubRepoId,
              metadata: DeusConnectedRepository.metadata,
            })
            .from(DeusConnectedRepository)
            .where(eq(DeusConnectedRepository.id, review.repositoryId))
            .limit(1);

          return {
            ...review,
            repository: repo[0] || null,
          };
        })
      );

      return reviewsWithRepoData;
    }),

  /**
   * Get a single code review by ID
   */
  get: protectedProcedure
    .input(
      z.object({
        reviewId: z.string(),
        organizationId: z.string(),
      })
    )
    .query(async ({ ctx, input }) => {
      const review = await db
        .select()
        .from(DeusCodeReview)
        .where(eq(DeusCodeReview.id, input.reviewId))
        .limit(1);

      if (!review[0]) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Code review not found",
        });
      }

      // Verify this review belongs to a repository in the organization
      const repository = await db
        .select()
        .from(DeusConnectedRepository)
        .where(
          and(
            eq(DeusConnectedRepository.id, review[0].repositoryId),
            eq(DeusConnectedRepository.organizationId, input.organizationId)
          )
        )
        .limit(1);

      if (!repository[0]) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You don't have access to this code review",
        });
      }

      return {
        ...review[0],
        repository: repository[0],
      };
    }),

  /**
   * Create a new code review
   * Fetches initial PR metadata from GitHub API
   */
  create: protectedProcedure
    .input(
      z.object({
        organizationId: z.string(),
        repositoryId: z.string(),
        pullRequestNumber: z.number().int().positive(),
        githubPrId: z.string(),
        reviewTool: z.enum(CODE_REVIEW_TOOLS),
        command: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify repository belongs to organization
      const repository = await db
        .select()
        .from(DeusConnectedRepository)
        .where(
          and(
            eq(DeusConnectedRepository.id, input.repositoryId),
            eq(DeusConnectedRepository.organizationId, input.organizationId),
            eq(DeusConnectedRepository.isActive, true)
          )
        )
        .limit(1);

      if (!repository[0]) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Repository not found or not connected to this organization",
        });
      }

      // Extract owner/repo from metadata
      const fullName = repository[0].metadata?.fullName;
      if (!fullName || typeof fullName !== "string") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Repository metadata is missing. Please reconnect the repository.",
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
        Number(repository[0].githubInstallationId),
        owner,
        repoName,
        input.pullRequestNumber
      );

      // Create code review record
      const reviewId = crypto.randomUUID();

      await db.insert(DeusCodeReview).values({
        id: reviewId,
        repositoryId: input.repositoryId,
        pullRequestNumber: input.pullRequestNumber,
        githubPrId: input.githubPrId,
        reviewTool: input.reviewTool,
        status: DEFAULT_REVIEW_STATUS,
        triggeredBy: ctx.session.userId,
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
  sync: protectedProcedure
    .input(
      z.object({
        reviewId: z.string(),
        organizationId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify access to this review
      const review = await db
        .select()
        .from(DeusCodeReview)
        .where(eq(DeusCodeReview.id, input.reviewId))
        .limit(1);

      if (!review[0]) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Code review not found",
        });
      }

      const repository = await db
        .select()
        .from(DeusConnectedRepository)
        .where(
          and(
            eq(DeusConnectedRepository.id, review[0].repositoryId),
            eq(DeusConnectedRepository.organizationId, input.organizationId)
          )
        )
        .limit(1);

      if (!repository[0]) {
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
  scanRepository: protectedProcedure
    .input(
      z.object({
        organizationId: z.string(),
        repositoryId: z.string(),
        reviewTool: z.enum(CODE_REVIEW_TOOLS).default("claude"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify repository belongs to organization
      const repository = await db
        .select()
        .from(DeusConnectedRepository)
        .where(
          and(
            eq(DeusConnectedRepository.id, input.repositoryId),
            eq(DeusConnectedRepository.organizationId, input.organizationId),
            eq(DeusConnectedRepository.isActive, true)
          )
        )
        .limit(1);

      if (!repository[0]) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Repository not found or not connected to this organization",
        });
      }

      // Extract owner/repo from metadata
      const fullName = repository[0].metadata?.fullName;
      if (!fullName || typeof fullName !== "string") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Repository metadata is missing. Please reconnect the repository.",
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
      const openPRs = await listOpenPullRequests(
        Number(repository[0].githubInstallationId),
        owner,
        repoName,
        100 // Limit to 100 most recent open PRs
      );

      let created = 0;
      let skipped = 0;

      // Process each PR
      for (const pr of openPRs) {
        // Check if review already exists for this PR
        const existing = await db
          .select({ id: DeusCodeReview.id })
          .from(DeusCodeReview)
          .where(
            and(
              eq(DeusCodeReview.repositoryId, input.repositoryId),
              eq(DeusCodeReview.githubPrId, pr.id.toString())
            )
          )
          .limit(1);

        if (existing[0]) {
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

        await db.insert(DeusCodeReview).values({
          id: reviewId,
          repositoryId: input.repositoryId,
          pullRequestNumber: pr.number,
          githubPrId: pr.id.toString(),
          reviewTool: input.reviewTool,
          status: DEFAULT_REVIEW_STATUS,
          triggeredBy: ctx.session.userId,
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
} satisfies TRPCRouterRecord;
