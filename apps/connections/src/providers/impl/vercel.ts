import { db } from "@db/console/client";
import { gwInstallations, gwTokens } from "@db/console/schema";
import type { GwInstallation } from "@db/console/schema";
import { decrypt } from "@repo/lib";
import { eq } from "drizzle-orm";
import type { Context } from "hono";
import type { z } from "zod";
import { env } from "../../env.js";
import { writeTokenRecord } from "../../lib/token-store.js";
import { connectionsBaseUrl, notifyBackfillService } from "../../lib/urls.js";
import { vercelOAuthResponseSchema } from "../schemas.js";
import type {
  ConnectionProvider,
  VercelAccountInfo,
  TokenResult,
  OAuthTokens,
  CallbackResult,
} from "../types.js";

const FETCH_TIMEOUT_MS = 15_000;

export class VercelProvider implements ConnectionProvider {
  readonly name = "vercel" as const;
  readonly requiresWebhookRegistration = false as const;

  getAuthorizationUrl(state: string): string {
    const url = new URL(
      `https://vercel.com/integrations/${env.VERCEL_INTEGRATION_SLUG}/new`,
    );
    url.searchParams.set("state", state);
    return url.toString();
  }

  async exchangeCode(code: string, redirectUri: string): Promise<OAuthTokens> {
    const body = new URLSearchParams({
      client_id: env.VERCEL_CLIENT_SECRET_ID,
      client_secret: env.VERCEL_CLIENT_INTEGRATION_SECRET,
      code,
      redirect_uri: redirectUri,
    });

    const response = await fetch(
      "https://api.vercel.com/v2/oauth/access_token",
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: body.toString(),
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      },
    );

    if (!response.ok) {
      throw new Error(`Vercel token exchange failed: ${response.status}`);
    }

    const rawData: unknown = await response.json();
    const data = vercelOAuthResponseSchema.parse(rawData);

    return {
      accessToken: data.access_token,
      tokenType: data.token_type,
      raw: rawData as Record<string, unknown>,
    };
  }

  refreshToken(_refreshToken: string): Promise<OAuthTokens> {
    return Promise.reject(new Error("Vercel tokens do not support refresh"));
  }

  async revokeToken(accessToken: string): Promise<void> {
    const response = await fetch(
      "https://api.vercel.com/v2/oauth/tokens/revoke",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      },
    );

    if (!response.ok) {
      throw new Error(`Vercel token revocation failed: ${response.status}`);
    }
  }

  // ── Strategy methods ──

  async handleCallback(
    c: Context,
    stateData: Record<string, string>,
  ): Promise<CallbackResult> {
    const code = c.req.query("code");
    if (!code) {throw new Error("missing code");}

    const redirectUri = `${connectionsBaseUrl}/connections/${this.name}/callback`;
    const oauthTokens = await this.exchangeCode(code, redirectUri);

    const parsed = vercelOAuthResponseSchema.parse(oauthTokens.raw);
    // team_id for team accounts, user_id for personal accounts
    const externalId = parsed.team_id ?? parsed.user_id;

    // Fetch integration configuration for scopes
    const config = await this.fetchConfiguration(
      parsed.installation_id,
      oauthTokens.accessToken,
    );

    const accountInfo = this.buildAccountInfo(parsed, config);

    const rows = await db
      .insert(gwInstallations)
      .values({
        provider: this.name,
        externalId,
        connectedBy: stateData.connectedBy ?? "unknown",
        orgId: stateData.orgId ?? "",
        status: "active",
        providerAccountInfo: accountInfo,
      })
      .onConflictDoUpdate({
        target: [gwInstallations.provider, gwInstallations.externalId],
        set: {
          status: "active",
          connectedBy: stateData.connectedBy ?? "unknown",
          orgId: stateData.orgId ?? "",
          providerAccountInfo: accountInfo,
        },
      })
      .returning({ id: gwInstallations.id });

    const installation = rows[0];
    if (!installation) {throw new Error("upsert_failed");}

    await writeTokenRecord(installation.id, oauthTokens);

    // Notify backfill service for new connections (fire-and-forget)
    notifyBackfillService({
      installationId: installation.id,
      provider: this.name,
      orgId: stateData.orgId ?? "",
    }).catch((err: unknown) => {
      console.error(
        `[${this.name}] backfill notification failed for installation=${installation.id} org=${stateData.orgId}`,
        err,
      );
    });

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

    if (tokenRow.expiresAt && new Date(tokenRow.expiresAt) < new Date()) {
      throw new Error("token_expired");
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

  /**
   * Fetch the integration configuration from Vercel to get scopes.
   * Gracefully degrades if the API call fails.
   */
  private async fetchConfiguration(
    configurationId: string,
    accessToken: string,
  ): Promise<{ scopes: string[] }> {
    try {
      const res = await fetch(
        `https://api.vercel.com/v1/integrations/configuration/${configurationId}`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
          signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        },
      );
      if (!res.ok) {
        console.warn(`[VercelProvider] Failed to fetch config: ${res.status}`);
        return { scopes: [] };
      }
      const data = (await res.json()) as Record<string, unknown>;
      console.log(data)
      return {
        scopes: Array.isArray(data.scopes) ? (data.scopes as string[]) : [],
      };
    } catch (err) {
      console.warn("[VercelProvider] Config fetch failed:", err);
      return { scopes: [] };
    }
  }

  buildAccountInfo(
    parsed: z.infer<typeof vercelOAuthResponseSchema>,
    config: { scopes: string[] },
  ): VercelAccountInfo {
    const now = new Date().toISOString();
    return {
      version: 1,
      sourceType: "vercel",
      scopes: config.scopes,
      events: [
        "deployment.created",
        "deployment.ready",
        "deployment.succeeded",
        "deployment.error",
        "deployment.canceled",
        "project.created",
        "project.removed",
        "integration-configuration.removed",
        "integration-configuration.permission-updated",
      ],
      installedAt: now,
      lastValidatedAt: now,
      userId: parsed.user_id,
      configurationId: parsed.installation_id,
      teamId: parsed.team_id ?? undefined,
    };
  }
}
