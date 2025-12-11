/**
 * GitHub Webhook Event Types
 *
 * Re-exports from @octokit/webhooks-types for convenient access
 * https://github.com/octokit/webhooks/tree/main/payload-types
 */

export type {
  PushEvent,
  InstallationEvent,
  InstallationRepositoriesEvent,
  RepositoryEvent,
  // Neural observation event types
  PullRequestEvent,
  IssuesEvent,
  ReleaseEvent,
  DiscussionEvent,
} from "@octokit/webhooks-types";

/**
 * Union type of all webhook events we handle
 */
export type WebhookEvent =
  | "push"
  | "installation"
  | "installation_repositories"
  | "repository"
  // Neural observation events
  | "pull_request"
  | "issues"
  | "release"
  | "discussion";
