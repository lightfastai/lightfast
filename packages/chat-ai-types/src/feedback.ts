/**
 * Feedback types for the chat application
 *
 * This module provides types for user feedback on messages
 */

/**
 * User feedback data structure
 * Maps message IDs to feedback type (upvote/downvote)
 */
export type FeedbackData = Record<string, "upvote" | "downvote">;

/**
 * Individual feedback type
 */
export type FeedbackType = "upvote" | "downvote";
