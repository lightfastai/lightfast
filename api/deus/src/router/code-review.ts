import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure } from "../trpc";
import {
  CODE_REVIEW_STATUS,
  CODE_REVIEW_TOOLS,
} from "@repo/deus-types/code-review";
import type { CodeReviewStatus } from "@repo/deus-types/code-review";
import { syncPRMetadata, createInitialPRMetadata } from "../lib/sync-pr-metadata";
import { listOpenPullRequests } from "../lib/github-app";
import { clerkClient } from "@clerk/nextjs/server";
import { OrganizationsService } from "@repo/deus-api-services/organizations";
import { RepositoriesService } from "@repo/deus-api-services/repositories";
import { CodeReviewsService } from "@repo/deus-api-services/code-reviews";

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
      // Verify user is a member of the organization
      // Get Clerk org ID from Deus organization
      const organizationsService = new OrganizationsService();
      const deusOrg = await organizationsService.findById(input.organizationId);

      if (!deusOrg?.clerkOrgId) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Organization not found",
        });
      }

      // Verify user is a member of the Clerk organization
      const clerk = await clerkClient();
      const clerkMemberships = await clerk.organizations.getOrganizationMembershipList({
        organizationId: deusOrg.clerkOrgId,
        limit: 500,
      });

      const userMembership = clerkMemberships.data.find(
        (m) => m.publicUserData?.userId === ctx.session.userId
      );

      if (!userMembership) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You are not a member of this organization",
        });
      }

      // First, get all repositories for this organization
      const repositoriesService = new RepositoriesService();
      const repositories = await repositoriesService.listByOrganization({
        organizationId: input.organizationId,
        includeInactive: false,
      });

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

      // Get code reviews
      const codeReviewsService = new CodeReviewsService();
      const reviews = await codeReviewsService.listByRepositories({
        repositoryIds,
        repositoryId: input.repositoryId,
        status: input.status,
        limit: input.limit,
      });

      // Join with repository data to get repo metadata
      const reviewsWithRepoData = await Promise.all(
        reviews.map(async (review) => {
          const repo = await repositoriesService.findById(review.repositoryId);

          return {
            ...review,
            repository: repo
              ? {
                  githubRepoId: repo.githubRepoId,
                  metadata: repo.metadata,
                }
              : null,
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
      // Verify user is a member of the organization
      // Get Clerk org ID from Deus organization
      const organizationsService = new OrganizationsService();
      const deusOrg = await organizationsService.findById(input.organizationId);

      if (!deusOrg?.clerkOrgId) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Organization not found",
        });
      }

      // Verify user is a member of the Clerk organization
      const clerk = await clerkClient();
      const clerkMemberships = await clerk.organizations.getOrganizationMembershipList({
        organizationId: deusOrg.clerkOrgId,
        limit: 500,
      });

      const userMembership = clerkMemberships.data.find(
        (m) => m.publicUserData?.userId === ctx.session.userId
      );

      if (!userMembership) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You are not a member of this organization",
        });
      }

      const codeReviewsService = new CodeReviewsService();
      const review = await codeReviewsService.findById(input.reviewId);

      if (!review) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Code review not found",
        });
      }

      // Verify this review belongs to a repository in the organization
      const repositoriesService = new RepositoriesService();
      const repository = await repositoriesService.findByIdAndOrganization(
        review.repositoryId,
        input.organizationId
      );

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
      // Verify user is a member of the organization
      // Get Clerk org ID from Deus organization
      const organizationsService = new OrganizationsService();
      const deusOrg = await organizationsService.findById(input.organizationId);

      if (!deusOrg?.clerkOrgId) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Organization not found",
        });
      }

      // Verify user is a member of the Clerk organization
      const clerk = await clerkClient();
      const clerkMemberships = await clerk.organizations.getOrganizationMembershipList({
        organizationId: deusOrg.clerkOrgId,
        limit: 500,
      });

      const userMembership = clerkMemberships.data.find(
        (m) => m.publicUserData?.userId === ctx.session.userId
      );

      if (!userMembership) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You are not a member of this organization",
        });
      }

      // Verify repository belongs to organization
      const repositoriesService = new RepositoriesService();
      const repository = await repositoriesService.findByIdAndOrganization(
        input.repositoryId,
        input.organizationId
      );

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
        Number(repository.githubInstallationId),
        owner,
        repoName,
        input.pullRequestNumber
      );

      // Create code review record
      const reviewId = crypto.randomUUID();

      const codeReviewsService = new CodeReviewsService();
      await codeReviewsService.create({
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
      // Verify user is a member of the organization
      // Get Clerk org ID from Deus organization
      const organizationsService = new OrganizationsService();
      const deusOrg = await organizationsService.findById(input.organizationId);

      if (!deusOrg?.clerkOrgId) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Organization not found",
        });
      }

      // Verify user is a member of the Clerk organization
      const clerk = await clerkClient();
      const clerkMemberships = await clerk.organizations.getOrganizationMembershipList({
        organizationId: deusOrg.clerkOrgId,
        limit: 500,
      });

      const userMembership = clerkMemberships.data.find(
        (m) => m.publicUserData?.userId === ctx.session.userId
      );

      if (!userMembership) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You are not a member of this organization",
        });
      }

      // Verify access to this review
      const codeReviewsService = new CodeReviewsService();
      const review = await codeReviewsService.findById(input.reviewId);

      if (!review) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Code review not found",
        });
      }

      const repositoriesService = new RepositoriesService();
      const repository = await repositoriesService.findByIdAndOrganization(
        review.repositoryId,
        input.organizationId
      );

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
  scanRepository: protectedProcedure
    .input(
      z.object({
        organizationId: z.string(),
        repositoryId: z.string(),
        reviewTool: z.enum(CODE_REVIEW_TOOLS).default("claude"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify user is a member of the organization
      // Get Clerk org ID from Deus organization
      const organizationsService = new OrganizationsService();
      const deusOrg = await organizationsService.findById(input.organizationId);

      if (!deusOrg?.clerkOrgId) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Organization not found",
        });
      }

      // Verify user is a member of the Clerk organization
      const clerk = await clerkClient();
      const clerkMemberships = await clerk.organizations.getOrganizationMembershipList({
        organizationId: deusOrg.clerkOrgId,
        limit: 500,
      });

      const userMembership = clerkMemberships.data.find(
        (m) => m.publicUserData?.userId === ctx.session.userId
      );

      if (!userMembership) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You are not a member of this organization",
        });
      }

      // Verify repository belongs to organization
      const repositoriesService = new RepositoriesService();
      const repository = await repositoriesService.findByIdAndOrganization(
        input.repositoryId,
        input.organizationId
      );

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
        Number(repository.githubInstallationId),
        owner,
        repoName,
        100 // Limit to 100 most recent open PRs
      );

      let created = 0;
      let skipped = 0;

      const codeReviewsService = new CodeReviewsService();

      // Process each PR
      for (const pr of openPRs) {
        // Check if review already exists for this PR
        const existing = await codeReviewsService.existsForPr(
          input.repositoryId,
          pr.id.toString()
        );

        if (existing) {
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

        await codeReviewsService.create({
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
