/**
 * Shared code review tool definitions for Deus.
 */

/**
 * Supported code review tools.
 */
export const CODE_REVIEW_TOOLS = [
  "coderabbit",
  "claude",
  "vercel-agents",
  "custom",
] as const;

export type CodeReviewTool = (typeof CODE_REVIEW_TOOLS)[number];

/**
 * Code review status values.
 */
export const CODE_REVIEW_STATUS = [
  "pending",
  "running",
  "completed",
  "failed",
  "cancelled",
] as const;

export type CodeReviewStatus = (typeof CODE_REVIEW_STATUS)[number];

/**
 * Metadata stored for a code review run.
 */
export type CodeReviewMetadata = {
  command?: string;
  triggerCommentId?: string;
  prUrl?: string;
  prTitle?: string;
  prState?: string;
  prMerged?: boolean;
  prAuthor?: string;
  prAuthorAvatar?: string;
  branch?: string;
  lastSyncedAt?: string;
  deleted?: boolean;
  deletedAt?: string;
  taskCount?: number;
  error?: string;
};
