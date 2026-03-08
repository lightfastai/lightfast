/**
 * Shared base for all provider account info types.
 *
 * Only fields that are meaningful across ALL providers belong here.
 * Fields that already exist as columns on `gw_installations`
 * (provider, externalId, connectedBy, orgId, status, createdAt)
 * are intentionally excluded to avoid duplication.
 */
export interface BaseAccountInfo {
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
  version: 1;
}

// ── Provider Raw API Response Types ──

/** Raw shape from GitHub GET /app/installations/{id} */
export interface GitHubInstallationRaw {
  account: {
    login: string;
    id: number;
    type: "User" | "Organization";
    avatar_url: string;
  };
  created_at: string;
  events: string[];
  permissions: Record<string, string>;
}

/**
 * Raw shape from Vercel POST /v2/oauth/access_token (minus access_token secret).
 *
 * TODO: Store `team_slug` and `username` during OAuth callback so
 * `vercel.list` can read display names from cache instead of making
 * live API calls (same pattern as github.list).
 */
export interface VercelOAuthRaw {
  installation_id: string;
  team_id: string | null;
  token_type: string;
  user_id: string;
}

/** Raw shape from Linear POST /oauth/token (minus access_token secret) */
export interface LinearOAuthRaw {
  expires_in: number;
  scope: string;
  token_type: string;
}

/** Raw shape from Sentry POST /api/0/sentry-app-installations/:id/authorizations/ (minus token/refreshToken secrets) */
export interface SentryOAuthRaw {
  expiresAt?: string;
  scopes?: string[];
}

// ── Provider Account Info Types ──

export interface GitHubAccountInfo extends BaseAccountInfo {
  raw: GitHubInstallationRaw;
  sourceType: "github";
}

export interface VercelAccountInfo extends BaseAccountInfo {
  raw: VercelOAuthRaw;
  sourceType: "vercel";
}

export interface LinearAccountInfo extends BaseAccountInfo {
  /** From GraphQL viewer query — not part of OAuth response */
  organization?: {
    id: string;
    name?: string;
    urlKey?: string;
  };
  raw: LinearOAuthRaw;
  sourceType: "linear";
}

export interface SentryAccountInfo extends BaseAccountInfo {
  /** Sentry installation ID extracted from composite code param */
  installationId: string;
  raw: SentryOAuthRaw;
  sourceType: "sentry";
}

export type ProviderAccountInfo =
  | GitHubAccountInfo
  | VercelAccountInfo
  | SentryAccountInfo
  | LinearAccountInfo;
