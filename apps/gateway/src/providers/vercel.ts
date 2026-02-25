import { eq } from "drizzle-orm";
import { gwInstallations, gwTokens } from "@db/console/schema";
import type { GwInstallation } from "@db/console/schema";
import { db } from "@db/console/client";
import { nanoid } from "@repo/lib";
import type { Context } from "hono";
import { env } from "../env";
import { gatewayBaseUrl, notifyBackfillService } from "../lib/urls";
import { computeHmacSha1, decrypt, timingSafeEqual } from "../lib/crypto";
import { writeTokenRecord } from "../lib/token-store";
import { vercelOAuthResponseSchema, vercelWebhookPayloadSchema } from "./schemas";
import type { VercelWebhookPayload } from "./schemas";
import type {
  Provider,
  TokenResult,
  OAuthTokens,
  WebhookPayload,
  CallbackResult,
} from "./types";

const SIGNATURE_HEADER = "x-vercel-signature";
const DELIVERY_HEADER = "x-vercel-id";

export class VercelProvider implements Provider {
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

    if (!response.ok && response.status !== 204) {
      throw new Error(`Vercel token revocation failed: ${response.status}`);
    }
  }

  async verifyWebhook(
    payload: string,
    headers: Headers,
    secret: string,
  ): Promise<boolean> {
    const signature = headers.get(SIGNATURE_HEADER);
    if (!signature) return false;

    const expectedSig = await computeHmacSha1(payload, secret);
    return timingSafeEqual(signature, expectedSig);
  }

  parsePayload(raw: unknown): VercelWebhookPayload {
    return vercelWebhookPayloadSchema.parse(raw);
  }

  extractDeliveryId(headers: Headers, payload: WebhookPayload): string {
    const headerId = headers.get(DELIVERY_HEADER);
    if (headerId) return headerId;

    const p = payload as VercelWebhookPayload;
    if (p.id) return p.id;

    return crypto.randomUUID();
  }

  extractEventType(_headers: Headers, payload: WebhookPayload): string {
    const p = payload as VercelWebhookPayload;
    return p.type ?? "unknown";
  }

  extractResourceId(payload: WebhookPayload): string | null {
    const p = payload as VercelWebhookPayload;
    const projectId = p.payload?.project?.id;
    if (projectId != null) return String(projectId);

    const teamId = p.payload?.team?.id;
    if (teamId != null) return String(teamId);

    return null;
  }

  // ── Strategy methods ──

  async handleCallback(
    c: Context,
    stateData: Record<string, string>,
  ): Promise<CallbackResult> {
    const code = c.req.query("code");
    if (!code) throw new Error("missing code");

    const redirectUri = `${gatewayBaseUrl}/connections/${this.name}/callback`;
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

    // Notify backfill service for new connections (non-blocking)
    await notifyBackfillService({
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
