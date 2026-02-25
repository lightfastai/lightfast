import { env } from "../env";
import { computeHmacSha256, timingSafeEqual } from "../lib/crypto";
import type { ConnectionProvider, OAuthTokens, ProviderOptions } from "./types";

const SIGNATURE_HEADER = "sentry-hook-signature";
const RESOURCE_HEADER = "sentry-hook-resource";
const TIMESTAMP_HEADER = "sentry-hook-timestamp";

export class SentryProvider implements ConnectionProvider {
  readonly name = "sentry";
  readonly requiresWebhookRegistration = true;

  getAuthorizationUrl(state: string, _options?: ProviderOptions): string {
    // Sentry uses external-install flow for SentryApp integrations
    const url = new URL(
      `https://sentry.io/sentry-apps/${env.SENTRY_CLIENT_ID}/external-install/`,
    );
    url.searchParams.set("state", state);
    return url.toString();
  }

  async exchangeCode(code: string, _redirectUri: string): Promise<OAuthTokens> {
    // For Sentry SentryApps, the code exchange requires the installation UUID.
    // The installationId comes from the initial webhook payload, not redirectUri.
    // We extract it from the code param which Sentry sends as installation:code
    const [installationId, authCode] = code.includes(":")
      ? code.split(":", 2)
      : ["", code];

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

    const data = (await response.json()) as Record<string, unknown>;

    return {
      accessToken: data.token as string,
      refreshToken: data.refreshToken as string | undefined,
      expiresIn: data.expiresAt
        ? Math.floor(
            (new Date(data.expiresAt as string).getTime() - Date.now()) / 1000,
          )
        : undefined,
      raw: data,
    };
  }

  async refreshToken(refreshToken: string): Promise<OAuthTokens> {
    // Sentry SentryApp refresh token flow
    // We need the installationId — stored as part of the refresh token context.
    // By convention, we store it as `installationId:refreshToken`.
    const [installationId, token] = refreshToken.includes(":")
      ? refreshToken.split(":", 2)
      : ["", refreshToken];

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

    const data = (await response.json()) as Record<string, unknown>;

    return {
      accessToken: data.token as string,
      // Carry installationId in refreshToken for next refresh
      refreshToken: installationId
        ? `${installationId}:${typeof data.refreshToken === "string" ? data.refreshToken : ""}`
        : (data.refreshToken as string | undefined),
      expiresIn: data.expiresAt
        ? Math.floor(
            (new Date(data.expiresAt as string).getTime() - Date.now()) / 1000,
          )
        : undefined,
      raw: data,
    };
  }

  async revokeToken(accessToken: string): Promise<void> {
    // accessToken stored as `installationId:token` by convention
    const [installationId] = accessToken.includes(":")
      ? accessToken.split(":", 2)
      : ["", accessToken];

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

  extractDeliveryId(headers: Headers, _payload: unknown): string {
    const resource = headers.get(RESOURCE_HEADER);
    const timestamp = headers.get(TIMESTAMP_HEADER);
    if (resource && timestamp) return `${resource}:${timestamp}`;
    return crypto.randomUUID();
  }

  extractEventType(headers: Headers, _payload: unknown): string {
    return headers.get(RESOURCE_HEADER) ?? "unknown";
  }

  extractResourceId(payload: unknown): string | null {
    const p = payload as Record<string, unknown>;
    const installation = p.installation as Record<string, unknown> | undefined;
    if (installation?.uuid && typeof installation.uuid === "string") {
      return installation.uuid;
    }
    return null;
  }

  registerWebhook(
    _connectionId: string,
    _callbackUrl: string,
    _secret: string,
  ): Promise<string> {
    // Sentry webhook URL is registered during the SentryApp configuration
    // in the Sentry developer settings, not via API. The callbackUrl is the
    // public Gateway endpoint. Return a placeholder ID.
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
