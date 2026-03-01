/**
 * Shared base for all provider account info types.
 *
 * Every provider extends this with provider-specific fields.
 * Fields that already exist as columns on `gw_installations`
 * (provider, externalId, connectedBy, orgId, status, createdAt)
 * are intentionally excluded to avoid duplication.
 */
export interface BaseAccountInfo {
  version: 1;

  /**
   * Normalized scopes/permissions granted by the provider.
   *
   * GitHub: ["issues:write", "contents:read", "metadata:read"]
   * Vercel: ["read:project", "read-write:log-drain"]
   * Sentry: ["org:read", "project:read"]
   * Linear: ["read", "write"]
   */
  scopes: string[];

  /**
   * Webhook events this installation is subscribed to.
   *
   * GitHub: ["push", "pull_request", "issues"]
   * Vercel: ["deployment.created", "project.created"]
   * Sentry: ["issue", "error", "comment"]
   * Linear: ["Issue", "Comment", "Project"]
   */
  events: string[];

  /** When the provider says this was installed (provider timestamp or callback time). */
  installedAt: string;

  /** When we last validated this installation against the provider API. */
  lastValidatedAt: string;
}

export interface GitHubAccountInfo extends BaseAccountInfo {
  sourceType: "github";
  accountId: string;
  accountLogin: string;
  accountType: "User" | "Organization";
  avatarUrl: string;
}

export interface VercelAccountInfo extends BaseAccountInfo {
  sourceType: "vercel";
  userId: string;
  configurationId: string;
  teamId?: string;
}

export interface SentryAccountInfo extends BaseAccountInfo {
  sourceType: "sentry";
  installationId: string;
  organizationSlug: string;
}

export interface LinearAccountInfo extends BaseAccountInfo {
  sourceType: "linear";
  organizationName?: string;
  organizationUrlKey?: string;
}

export type ProviderAccountInfo =
  | GitHubAccountInfo
  | VercelAccountInfo
  | SentryAccountInfo
  | LinearAccountInfo;
