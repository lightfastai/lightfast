export type {
  AIGeneratedPost,
  BusinessGoal,
  ContentType,
  CTAType,
  DistributionInput,
  EngagementInput,
  PostStatus,
} from "./mutations/blog";
export { createBlogPostFromAI, updatePostStatus } from "./mutations/blog";

export type {
  ChangelogEntryInput,
  ChangelogSeoInput,
} from "./mutations/changelog";
export {
  createChangelogEntry,
  updateChangelogEntry,
} from "./mutations/changelog";
