import { db } from "@db/console/client";
import { gwInstallations } from "@db/console/schema";
import type { GwInstallation } from "@db/console/schema";
import { and, eq } from "drizzle-orm";
import type { Context } from "hono";
import { env } from "../../env.js";
import { getInstallationToken, getInstallationDetails } from "../../lib/github-jwt.js";
import {
  githubOAuthResponseSchema,
} from "../schemas.js";
import type {
  ConnectionProvider,
  GitHubAccountInfo,
  GitHubAuthOptions,
  JwtTokenResult,
  OAuthTokens,
  CallbackResult,
  CallbackStateData,
} from "../types.js";

const FETCH_TIMEOUT_MS = 15_000;

export class GitHubProvider implements ConnectionProvider {
  readonly name = "github" as const;
  readonly requiresWebhookRegistration = false as const;

  getAuthorizationUrl(state: string, _options?: GitHubAuthOptions): string {
    // GitHub uses App installation flow (not OAuth).
    // handleCallback expects installation_id from the redirect.
    return this.getInstallationUrl(state);
  }

  /** Build GitHub App installation URL (GitHub-specific, not on interface) */
  getInstallationUrl(state: string, targetId?: string): string {
    const url = new URL(
      `https://github.com/apps/${env.GITHUB_APP_SLUG}/installations/new`,
    );
    url.searchParams.set("state", state);
    if (targetId) {url.searchParams.set("target_id", targetId);}
    return url.toString();
  }

  async exchangeCode(code: string, redirectUri: string): Promise<OAuthTokens> {
    const response = await fetch(
      "https://github.com/login/oauth/access_token",
      {
        method: "POST",
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          client_id: env.GITHUB_CLIENT_ID,
          client_secret: env.GITHUB_CLIENT_SECRET,
          code,
          redirect_uri: redirectUri,
        }),
      },
    );

    if (!response.ok) {
      throw new Error(`GitHub token exchange failed: ${response.status}`);
    }

    const data = githubOAuthResponseSchema.parse(await response.json());

    if ("error" in data && data.error) {
      const errorData = data as { error: string; error_description: string };
      throw new Error(`GitHub OAuth error: ${errorData.error_description}`);
    }

    const successData = data as { access_token: string; token_type: string; scope: string };

    return {
      accessToken: successData.access_token,
      scope: successData.scope,
      tokenType: successData.token_type,
      raw: successData,
    };
  }

  refreshToken(_refreshToken: string): Promise<OAuthTokens> {
    return Promise.reject(
      new Error("GitHub user tokens do not support refresh"),
    );
  }

  async revokeToken(accessToken: string): Promise<void> {
    const credentials = btoa(
      `${env.GITHUB_CLIENT_ID}:${env.GITHUB_CLIENT_SECRET}`,
    );

    const response = await fetch(
      `https://api.github.com/applications/${env.GITHUB_CLIENT_ID}/token`,
      {
        method: "DELETE",
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        headers: {
          Authorization: `Basic ${credentials}`,
          "Content-Type": "application/json",
          Accept: "application/vnd.github.v3+json",
        },
        body: JSON.stringify({ access_token: accessToken }),
      },
    );

    if (!response.ok) {
      throw new Error(`GitHub token revocation failed: ${response.status}`);
    }
  }

  // ── Strategy methods ──

  async handleCallback(
    c: Context,
    stateData: CallbackStateData,
  ): Promise<CallbackResult> {
    const installationId = c.req.query("installation_id");
    const setupAction = c.req.query("setup_action");

    // ── Explicit setup_action routing ──

    if (setupAction === "request") {
      // GitHub sends setup_action=request when org admin approval is required.
      // installation_id is absent — the installation only gets an ID when approved (via webhook).
      throw new Error("setup_action=request is not yet implemented");
    }

    if (setupAction === "update") {
      // GitHub sends setup_action=update when installation permissions/repos change.
      // installation_id IS present. For now, treat as unimplemented.
      throw new Error("setup_action=update is not yet implemented");
    }

    // ── setup_action=install (or undefined for GitHub-initiated redirects) ──

    if (!installationId) {
      throw new Error("missing installation_id");
    }

    const installationDetails = await getInstallationDetails(installationId);
    const now = new Date().toISOString();

    const accountInfo: GitHubAccountInfo = {
      version: 1,
      sourceType: "github",
      events: installationDetails.events,
      installedAt: installationDetails.created_at,
      lastValidatedAt: now,
      raw: installationDetails,
    };

    // Check if this installation already exists (reactivation vs new)
    const existing = await db
      .select({ id: gwInstallations.id })
      .from(gwInstallations)
      .where(
        and(
          eq(gwInstallations.provider, "github"),
          eq(gwInstallations.externalId, installationId),
        ),
      )
      .limit(1);

    const reactivated = existing.length > 0;

    // Idempotent upsert keyed on unique (provider, externalId) constraint
    const rows = await db
      .insert(gwInstallations)
      .values({
        provider: "github",
        externalId: installationId,
        connectedBy: stateData.connectedBy,
        orgId: stateData.orgId,
        status: "active",
        providerAccountInfo: accountInfo,
      })
      .onConflictDoUpdate({
        target: [gwInstallations.provider, gwInstallations.externalId],
        set: {
          status: "active",
          connectedBy: stateData.connectedBy,
          orgId: stateData.orgId,
          providerAccountInfo: accountInfo,
        },
      })
      .returning({
        id: gwInstallations.id,
      });

    const row = rows[0];
    if (!row) {throw new Error("upsert_failed");}

    return {
      status: "connected",
      installationId: row.id,
      provider: "github",
      setupAction,
      ...(reactivated && { reactivated: true }),
    };
  }

  async resolveToken(installation: GwInstallation): Promise<JwtTokenResult> {
    const token = await getInstallationToken(installation.externalId);
    return {
      accessToken: token,
      provider: "github",
      expiresIn: 3600, // GitHub installation tokens expire in 1 hour
    };
  }
}
