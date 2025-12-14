/**
 * Event Builders
 *
 * Pure functions that build SourceEvent objects matching transformer output.
 */

export { githubPush, githubPR, githubIssue } from "./github";
export type { GitHubPushOptions, GitHubPROptions, GitHubIssueOptions } from "./github";

export { vercelDeployment } from "./vercel";
export type { VercelDeploymentOptions } from "./vercel";

// Re-export types for convenience
export type { SourceEvent, SourceActor, SourceReference } from "@repo/console-types";
