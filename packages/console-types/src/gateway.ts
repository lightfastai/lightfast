/**
 * Gateway Types
 *
 * TypeScript interfaces for gateway services (relay, gateway, backfill).
 * Previously in @repo/gateway-types — consolidated here.
 */

import type { SourceType } from "@repo/console-providers";

// ── OAuth Tokens ──

export interface OAuthTokens {
  accessToken: string;
  refreshToken?: string;
  expiresIn?: number;
  scope?: string;
  tokenType?: string;
  raw: Record<string, unknown>;
}

// ── Per-Provider Auth Options ──

export interface GitHubAuthOptions {
  redirectPath?: string;
}

export interface LinearAuthOptions {
  scopes?: string[];
}

export type ProviderOptions = GitHubAuthOptions | LinearAuthOptions;

// ── Webhook Types ──

/**
 * Payload passed from the thin webhook route to the durable receipt workflow.
 * Contains all data extracted after signature verification and JSON parsing.
 */
export interface WebhookReceiptPayload {
  provider: SourceType;
  deliveryId: string;
  eventType: string;
  resourceId: string | null;
  payload: unknown;
  receivedAt: number;
  /** Cross-service correlation ID for distributed tracing */
  correlationId?: string;
}

/**
 * Envelope sent from Gateway to Console ingress via QStash.
 * This is the Gateway→Console contract for webhook delivery.
 */
export interface WebhookEnvelope {
  /** Unique delivery ID for deduplication */
  deliveryId: string;
  /** Gateway installation ID (gw_installations.id) */
  connectionId: string;
  /** Clerk organization ID */
  orgId: string;
  /** Provider name */
  provider: SourceType;
  /** Provider-specific event type (e.g., "push", "deployment.created", "Issue:create") */
  eventType: string;
  /** Raw provider webhook payload */
  payload: unknown;
  /** Unix timestamp in milliseconds when the webhook was received */
  receivedAt: number;
  /** Cross-service correlation ID for distributed tracing */
  correlationId?: string;
}

// ── Gateway API Response Types ──

/**
 * Gateway connection response shape.
 * Returned by GET /gateway/:id
 */
export interface GatewayConnection {
  id: string;
  provider: string;
  externalId: string;
  orgId: string;
  status: string;
  resources: {
    id: string;
    providerResourceId: string;
    resourceName: string | null;
  }[];
}

/**
 * Gateway token response shape.
 * Returned by GET /gateway/:id/token
 */
export interface GatewayTokenResult {
  accessToken: string;
  provider: string;
  expiresIn: number | null;
}

// ── Provider Account Info ──

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
