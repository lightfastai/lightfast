import { eq } from "drizzle-orm";
import { gwInstallations, gwTokens } from "@db/console/schema";
import type { GwInstallation } from "@db/console/schema";
import { db } from "@db/console/client";
import { nanoid } from "@repo/lib";
import type { Context } from "hono";
import { env } from "../env";
import { gatewayBaseUrl, notifyBackfillService } from "../lib/urls";
import { computeHmacSha256, decrypt, timingSafeEqual } from "../lib/crypto";
import { writeTokenRecord, updateTokenRecord } from "../lib/token-store";
import {
  decodeSentryToken,
  encodeSentryToken,
  sentryOAuthResponseSchema,
  sentryWebhookPayloadSchema,
} from "./schemas";
import type { SentryWebhookPayload } from "./schemas";
import type {
  Provider,
  TokenResult,
  OAuthTokens,
  WebhookPayload,
  CallbackResult,
} from "./types";

const SIGNATURE_HEADER = "sentry-hook-signature";
const RESOURCE_HEADER = "sentry-hook-resource";
const TIMESTAMP_HEADER = "sentry-hook-timestamp";

export class SentryProvider implements Provider {
  readonly name = "sentry" as const;
  readonly requiresWebhookRegistration = true as const;

  getAuthorizationUrl(state: string): string {
    const url = new URL(
      `https://sentry.io/sentry-apps/${env.SENTRY_CLIENT_ID}/external-install/`,
    );
    url.searchParams.set("state", state);
    return url.toString();
  }

  async exchangeCode(code: string, _redirectUri: string): Promise<OAuthTokens> {
    const { installationId, token: authCode } = decodeSentryToken(code);

    const response = await fetch(
      `https://sentry.io/api/0/sentry-app-installations/${installationId}/authorizations/`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${env.SENTRY_CLIENT_SECRET}`,
        },
        body: JSON.stringify({
          grant_type: "authorization_code",
          code: authCode,
          client_id: env.SENTRY_CLIENT_ID,
          client_secret: env.SENTRY_CLIENT_SECRET,
        }),
      },
    );

    if (!response.ok) {
      throw new Error(`Sentry token exchange failed: ${response.status}`);
    }

    const rawData: unknown = await response.json();
    const data = sentryOAuthResponseSchema.parse(rawData);

    return {
      accessToken: data.token,
      refreshToken: data.refreshToken,
      expiresIn: data.expiresAt
        ? Math.floor(
            (new Date(data.expiresAt).getTime() - Date.now()) / 1000,
          )
        : undefined,
      raw: rawData as Record<string, unknown>,
    };
  }

  async refreshToken(refreshToken: string): Promise<OAuthTokens> {
    const { installationId, token } = decodeSentryToken(refreshToken);

    const response = await fetch(
      `https://sentry.io/api/0/sentry-app-installations/${installationId}/authorizations/`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${env.SENTRY_CLIENT_SECRET}`,
        },
        body: JSON.stringify({
          grant_type: "refresh_token",
          refresh_token: token,
          client_id: env.SENTRY_CLIENT_ID,
          client_secret: env.SENTRY_CLIENT_SECRET,
        }),
      },
    );

    if (!response.ok) {
      throw new Error(`Sentry token refresh failed: ${response.status}`);
    }

    const rawData: unknown = await response.json();
    const data = sentryOAuthResponseSchema.parse(rawData);

    return {
      accessToken: data.token,
      refreshToken:
        installationId && data.refreshToken
          ? encodeSentryToken({ installationId, token: data.refreshToken })
          : data.refreshToken,
      expiresIn: data.expiresAt
        ? Math.floor(
            (new Date(data.expiresAt).getTime() - Date.now()) / 1000,
          )
        : undefined,
      raw: rawData as Record<string, unknown>,
    };
  }

  async revokeToken(accessToken: string): Promise<void> {
    const { installationId } = decodeSentryToken(accessToken);
    if (!installationId) return;

    const response = await fetch(
      `https://sentry.io/api/0/sentry-app-installations/${installationId}/`,
      {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${env.SENTRY_CLIENT_SECRET}`,
        },
      },
    );

    if (!response.ok && response.status !== 204) {
      throw new Error(`Sentry token revocation failed: ${response.status}`);
    }
  }

  async verifyWebhook(
    payload: string,
    headers: Headers,
    secret: string,
  ): Promise<boolean> {
    const signature = headers.get(SIGNATURE_HEADER);
    if (!signature) return false;

    const expectedSig = await computeHmacSha256(payload, secret);
    return timingSafeEqual(signature, expectedSig);
  }

  parsePayload(raw: unknown): SentryWebhookPayload {
    return sentryWebhookPayloadSchema.parse(raw);
  }

  extractDeliveryId(headers: Headers, _payload: WebhookPayload): string {
    const resource = headers.get(RESOURCE_HEADER);
    const timestamp = headers.get(TIMESTAMP_HEADER);
    if (resource && timestamp) return `${resource}:${timestamp}`;
    return crypto.randomUUID();
  }

  extractEventType(headers: Headers, _payload: WebhookPayload): string {
    return headers.get(RESOURCE_HEADER) ?? "unknown";
  }

  extractResourceId(payload: WebhookPayload): string | null {
    const p = payload as SentryWebhookPayload;
    return p.installation?.uuid ?? null;
  }

  registerWebhook(
    _connectionId: string,
    _callbackUrl: string,
    _secret: string,
  ): Promise<string> {
    // Sentry webhook URL is registered during the SentryApp configuration
    // in the Sentry developer settings, not via API.
    return Promise.resolve("sentry-webhook-registered");
  }

  async deregisterWebhook(
    _connectionId: string,
    _webhookId: string,
  ): Promise<void> {
    // Sentry webhooks are deregistered by revoking the installation
    // (handled by revokeToken). No separate deregistration needed.
  }

  // ── Strategy methods ──

  async handleCallback(
    c: Context,
    stateData: Record<string, string>,
  ): Promise<CallbackResult> {
    const code = c.req.query("code");
    if (!code) throw new Error("missing code");

    // Sentry's exchangeCode handles the composite installationId:authCode internally
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

    // Sentry requiresWebhookRegistration but registration is a no-op (registered in Sentry config)
    const webhookSecret = nanoid(32);
    const callbackUrl = `${gatewayBaseUrl}/webhooks/${this.name}`;

    try {
      const webhookId = await this.registerWebhook(
        installation.id,
        callbackUrl,
        webhookSecret,
      );

      await db
        .update(gwInstallations)
        .set({
          webhookSecret,
          metadata: { webhookId } as Record<string, unknown>,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(gwInstallations.id, installation.id));
    } catch (err) {
      await db
        .update(gwInstallations)
        .set({
          metadata: {
            webhookRegistrationError:
              err instanceof Error ? err.message : "unknown",
          } as Record<string, unknown>,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(gwInstallations.id, installation.id));
    }

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

    // Check expiry and refresh if needed (Sentry supports token refresh)
    if (tokenRow.expiresAt && new Date(tokenRow.expiresAt) < new Date()) {
      if (!tokenRow.refreshToken) {
        throw new Error("token_expired:no_refresh_token");
      }

      const decryptedRefresh = await decrypt(tokenRow.refreshToken, env.ENCRYPTION_KEY);
      const refreshed = await this.refreshToken(decryptedRefresh);

      await updateTokenRecord(tokenRow.id, refreshed, tokenRow.refreshToken);

      return {
        accessToken: refreshed.accessToken,
        provider: this.name,
        expiresIn: refreshed.expiresIn ?? null,
      };
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
    _stateData: Record<string, string>,
    _oauthTokens?: OAuthTokens,
  ): GwInstallation["providerAccountInfo"] {
    return { version: 1, sourceType: "sentry" };
  }
}
