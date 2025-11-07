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
} from "@octokit/webhooks-types";

/**
 * Union type of all webhook events we handle
 */
export type WebhookEvent =
  | "push"
  | "installation"
  | "installation_repositories"
  | "repository";
