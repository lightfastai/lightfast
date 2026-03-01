import { db } from "@db/console/client";
import { gwInstallations, gwTokens } from "@db/console/schema";
import type { GwInstallation } from "@db/console/schema";
import { decrypt } from "@repo/lib";
import { eq } from "drizzle-orm";
import type { Context } from "hono";
import { env } from "../../env.js";
import { writeTokenRecord, updateTokenRecord } from "../../lib/token-store.js";
import { connectionsBaseUrl } from "../../lib/urls.js";
import { linearOAuthResponseSchema } from "../schemas.js";
import type {
  ConnectionProvider,
  LinearAccountInfo,
  LinearAuthOptions,
  TokenResult,
  OAuthTokens,
  CallbackResult,
  CallbackStateData,
} from "../types.js";

const FETCH_TIMEOUT_MS = 15_000;

export class LinearProvider implements ConnectionProvider {
  readonly name = "linear" as const;
  readonly requiresWebhookRegistration = false as const;
  private readonly clientId: string;
  private readonly clientSecret: string;

  constructor() {
    if (!env.LINEAR_CLIENT_ID || !env.LINEAR_CLIENT_SECRET) {
      throw new Error(
        "LinearProvider requires LINEAR_CLIENT_ID and LINEAR_CLIENT_SECRET",
      );
    }
    this.clientId = env.LINEAR_CLIENT_ID;
    this.clientSecret = env.LINEAR_CLIENT_SECRET;
  }

  getAuthorizationUrl(state: string, options?: LinearAuthOptions): string {
    const url = new URL("https://linear.app/oauth/authorize");
    url.searchParams.set("client_id", this.clientId);
    url.searchParams.set(
      "redirect_uri",
      `${connectionsBaseUrl}/connections/linear/callback`,
    );
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", options?.scopes?.join(",") ?? "read,write");
    url.searchParams.set("state", state);
    return url.toString();
  }

  async exchangeCode(code: string, redirectUri: string): Promise<OAuthTokens> {
    const response = await fetch("https://api.linear.app/oauth/token", {
      method: "POST",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        redirect_uri: redirectUri,
        code,
        grant_type: "authorization_code",
      }).toString(),
    });

    if (!response.ok) {
      throw new Error(`Linear token exchange failed: ${response.status}`);
    }

    const rawData: unknown = await response.json();
    const data = linearOAuthResponseSchema.parse(rawData);

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      tokenType: data.token_type,
      scope: data.scope,
      expiresIn: data.expires_in,
      raw: rawData as Record<string, unknown>,
    };
  }

  async refreshToken(refreshToken: string): Promise<OAuthTokens> {
    const response = await fetch("https://api.linear.app/oauth/token", {
      method: "POST",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      }).toString(),
    });

    if (!response.ok) {
      throw new Error(`Linear token refresh failed: ${response.status}`);
    }

    const rawData: unknown = await response.json();
    const data = linearOAuthResponseSchema.parse(rawData);

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      tokenType: data.token_type,
      scope: data.scope,
      expiresIn: data.expires_in,
      raw: rawData as Record<string, unknown>,
    };
  }

  async revokeToken(accessToken: string): Promise<void> {
    const response = await fetch("https://api.linear.app/oauth/revoke", {
      method: "POST",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Linear token revocation failed: ${response.status}`);
    }
  }

  // ── Strategy methods ──

  /**
   * Fetch the viewer's organization info from the Linear API.
   * Returns the external ID (org or viewer) plus organization metadata.
   */
  private async fetchLinearContext(accessToken: string): Promise<{
    externalId: string;
    organizationName?: string;
    organizationUrlKey?: string;
  }> {
    const response = await fetch("https://api.linear.app/graphql", {
      method: "POST",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        query: `{ viewer { id organization { id name urlKey } } }`,
      }),
    });

    if (!response.ok) {
      throw new Error(`Linear viewer query failed: ${response.status}`);
    }

    const result = (await response.json()) as {
      data?: {
        viewer?: {
          id: string;
          organization?: { id: string; name?: string; urlKey?: string };
        };
      };
    };

    const org = result.data?.viewer?.organization;
    if (org?.id) {
      return {
        externalId: org.id,
        organizationName: org.name,
        organizationUrlKey: org.urlKey,
      };
    }

    const viewerId = result.data?.viewer?.id;
    if (viewerId) {return { externalId: viewerId };}

    throw new Error("Linear API did not return a viewer or organization ID");
  }

  async handleCallback(
    c: Context,
    stateData: CallbackStateData,
  ): Promise<CallbackResult> {
    const code = c.req.query("code");
    if (!code) {throw new Error("missing code");}

    const redirectUri = `${connectionsBaseUrl}/connections/${this.name}/callback`;
    const oauthTokens = await this.exchangeCode(code, redirectUri);

    const linearContext = await this.fetchLinearContext(oauthTokens.accessToken);
    const externalId = linearContext.externalId;
    const now = new Date().toISOString();

    // Extract raw Linear response (Zod-validated in exchangeCode, so fields are guaranteed present)
    const raw = oauthTokens.raw as { token_type: string; scope: string; expires_in: number };

    const accountInfo: LinearAccountInfo = {
      version: 1,
      sourceType: "linear",
      events: ["Issue", "Comment", "IssueLabel", "Project", "Cycle"],
      installedAt: now,
      lastValidatedAt: now,
      raw: {
        token_type: raw.token_type,
        scope: raw.scope,
        expires_in: raw.expires_in,
      },
      ...(linearContext.organizationName || linearContext.organizationUrlKey
        ? {
            organization: {
              id: linearContext.externalId,
              name: linearContext.organizationName,
              urlKey: linearContext.organizationUrlKey,
            },
          }
        : {}),
    };

    // Idempotent upsert keyed on unique (provider, externalId) constraint
    const rows = await db
      .insert(gwInstallations)
      .values({
        provider: this.name,
        externalId,
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
          updatedAt: now,
        },
      })
      .returning({
        id: gwInstallations.id,
      });

    const installation = rows[0];
    if (!installation) {throw new Error("upsert_failed");}

    await writeTokenRecord(installation.id, oauthTokens);

    return {
      status: "connected",
      installationId: installation.id,
      provider: this.name,
    };
  }

  async resolveToken(installation: GwInstallation): Promise<TokenResult> {
    const tokenRows = await db
      .select()
      .from(gwTokens)
      .where(eq(gwTokens.installationId, installation.id))
      .limit(1);

    const tokenRow = tokenRows[0];
    if (!tokenRow) {throw new Error("no_token_found");}

    // Check expiry and refresh if needed
    if (tokenRow.expiresAt && new Date(tokenRow.expiresAt) < new Date()) {
      if (!tokenRow.refreshToken) {
        throw new Error("token_expired:no_refresh_token");
      }

      const decryptedRefresh = decrypt(tokenRow.refreshToken, env.ENCRYPTION_KEY);
      const refreshed = await this.refreshToken(decryptedRefresh);

      await updateTokenRecord(tokenRow.id, refreshed, tokenRow.refreshToken, tokenRow.expiresAt);

      return {
        accessToken: refreshed.accessToken,
        provider: this.name,
        expiresIn: refreshed.expiresIn ?? null,
      };
    }

    const decryptedToken = decrypt(tokenRow.accessToken, env.ENCRYPTION_KEY);
    return {
      accessToken: decryptedToken,
      provider: this.name,
      expiresIn: tokenRow.expiresAt
        ? Math.floor((new Date(tokenRow.expiresAt).getTime() - Date.now()) / 1000)
        : null,
    };
  }
}
