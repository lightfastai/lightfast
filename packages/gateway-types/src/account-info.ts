/**
 * Shared base for all provider account info types.
 *
 * Only fields that are meaningful across ALL providers belong here.
 * Fields that already exist as columns on `gw_installations`
 * (provider, externalId, connectedBy, orgId, status, createdAt)
 * are intentionally excluded to avoid duplication.
 */
export interface BaseAccountInfo {
  version: 1;

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

// ── Provider Raw API Response Types ──

/** Raw shape from GitHub GET /app/installations/{id} */
export interface GitHubInstallationRaw {
  account: {
    login: string;
    id: number;
    type: "User" | "Organization";
    avatar_url: string;
  };
  permissions: Record<string, string>;
  events: string[];
  created_at: string;
}

/**
 * Raw shape from Vercel POST /v2/oauth/access_token (minus access_token secret).
 *
 * TODO: Store `team_slug` and `username` during OAuth callback so
 * `vercel.list` can read display names from cache instead of making
 * live API calls (same pattern as github.list).
 */
export interface VercelOAuthRaw {
  token_type: string;
  installation_id: string;
  user_id: string;
  team_id: string | null;
}

/** Raw shape from Linear POST /oauth/token (minus access_token secret) */
export interface LinearOAuthRaw {
  token_type: string;
  scope: string;
  expires_in: number;
}

/** Raw shape from Sentry POST /api/0/sentry-app-installations/:id/authorizations/ (minus token/refreshToken secrets) */
export interface SentryOAuthRaw {
  expiresAt?: string;
  scopes?: string[];
}

// ── Provider Account Info Types ──

export interface GitHubAccountInfo extends BaseAccountInfo {
  sourceType: "github";
  raw: GitHubInstallationRaw;
}

export interface VercelAccountInfo extends BaseAccountInfo {
  sourceType: "vercel";
  raw: VercelOAuthRaw;
}

export interface LinearAccountInfo extends BaseAccountInfo {
  sourceType: "linear";
  raw: LinearOAuthRaw;
  /** From GraphQL viewer query — not part of OAuth response */
  organization?: {
    id: string;
    name?: string;
    urlKey?: string;
  };
}

export interface SentryAccountInfo extends BaseAccountInfo {
  sourceType: "sentry";
  raw: SentryOAuthRaw;
  /** Sentry installation ID extracted from composite code param */
  installationId: string;
}

export type ProviderAccountInfo =
  | GitHubAccountInfo
  | VercelAccountInfo
  | SentryAccountInfo
  | LinearAccountInfo;
