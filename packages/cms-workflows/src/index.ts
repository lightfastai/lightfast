export type {
  ContentType,
  BusinessGoal,
  CTAType,
  PostStatus,
  DistributionInput,
  EngagementInput,
  AIGeneratedPost,
} from "./mutations/blog";
export { createBlogPostFromAI, updatePostStatus } from "./mutations/blog";

export type { ChangelogSeoInput, ChangelogEntryInput } from "./mutations/changelog";
export { createChangelogEntry, updateChangelogEntry } from "./mutations/changelog";
