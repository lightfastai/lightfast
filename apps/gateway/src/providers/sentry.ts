import { env } from "../env";
import { computeHmacSha256, timingSafeEqual } from "../lib/crypto";
import {
  decodeSentryToken,
  encodeSentryToken,
  sentryOAuthResponseSchema,
  sentryWebhookPayloadSchema,
} from "./schemas";
import type { SentryWebhookPayload } from "./schemas";
import type { OAuthTokens, WebhookPayload, WebhookRegistrant } from "./types";

const SIGNATURE_HEADER = "sentry-hook-signature";
const RESOURCE_HEADER = "sentry-hook-resource";
const TIMESTAMP_HEADER = "sentry-hook-timestamp";

export class SentryProvider implements WebhookRegistrant {
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
}
