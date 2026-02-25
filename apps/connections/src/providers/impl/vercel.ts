import { eq } from "drizzle-orm";
import { gwInstallations, gwTokens } from "@db/console/schema";
import type { GwInstallation } from "@db/console/schema";
import { db } from "@db/console/client";
import { nanoid } from "@repo/lib";
import type { Context } from "hono";
import { env } from "../../env";
import { connectionsBaseUrl, notifyBackfillService } from "../../lib/urls";
import { decrypt } from "../../lib/crypto";
import { writeTokenRecord } from "../../lib/token-store";
import { vercelOAuthResponseSchema } from "../schemas";
import type {
  ConnectionProvider,
  TokenResult,
  OAuthTokens,
  CallbackResult,
} from "../types";

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
      scope: data.scope,
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
    if (!code) throw new Error("missing code");

    const redirectUri = `${connectionsBaseUrl}/connections/${this.name}/callback`;
    const oauthTokens = await this.exchangeCode(code, redirectUri);

    const externalId =
      (oauthTokens.raw.team_id as string | undefined)?.toString() ??
      (oauthTokens.raw.organization_id as string | undefined)?.toString() ??
      (oauthTokens.raw.installation as string | undefined)?.toString() ??
      nanoid();

    const rows = await db
      .insert(gwInstallations)
      .values({
        provider: this.name,
        externalId,
        connectedBy: stateData.connectedBy ?? "unknown",
        orgId: stateData.orgId ?? "",
        status: "active",
        providerAccountInfo: this.buildAccountInfo(stateData, oauthTokens),
      })
      .returning({ id: gwInstallations.id });

    const installation = rows[0];
    if (!installation) throw new Error("insert_failed");

    await writeTokenRecord(installation.id, oauthTokens);

    // Notify backfill service for new connections (fire-and-forget)
    void notifyBackfillService({
      installationId: installation.id,
      provider: this.name,
      orgId: stateData.orgId ?? "",
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
    if (!tokenRow) throw new Error("no_token_found");

    if (tokenRow.expiresAt && new Date(tokenRow.expiresAt) < new Date()) {
      throw new Error("token_expired");
    }

    const decryptedToken = await decrypt(tokenRow.accessToken, env.ENCRYPTION_KEY);
    return {
      accessToken: decryptedToken,
      provider: this.name,
      expiresIn: tokenRow.expiresAt
        ? Math.floor((new Date(tokenRow.expiresAt).getTime() - Date.now()) / 1000)
        : null,
    };
  }

  buildAccountInfo(
    stateData: Record<string, string>,
    oauthTokens?: OAuthTokens,
  ): GwInstallation["providerAccountInfo"] {
    const raw = oauthTokens?.raw ?? {};
    const externalId =
      (raw.team_id as string | undefined)?.toString() ??
      (raw.organization_id as string | undefined)?.toString() ??
      (raw.installation as string | undefined)?.toString() ??
      "";

    return {
      version: 1,
      sourceType: "vercel",
      userId: stateData.connectedBy ?? "unknown",
      teamId: (raw.team_id as string | undefined) ?? undefined,
      teamSlug: (raw.team_slug as string | undefined) ?? undefined,
      configurationId: externalId,
    };
  }
}
