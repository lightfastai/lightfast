import { defineProvider, defineEvent } from "../define.js";
import type { ProviderDefinition } from "../define.js";
import { sentryConfigSchema, encodeSentryToken, decodeSentryToken } from "../types.js";
import type { SentryConfig, OAuthTokens, CallbackResult } from "../types.js";
import { computeHmac, timingSafeEqual } from "../crypto.js";
import {
  preTransformSentryIssueWebhookSchema,
  preTransformSentryErrorWebhookSchema,
  preTransformSentryEventAlertWebhookSchema,
  preTransformSentryMetricAlertWebhookSchema,
  sentryWebhookPayloadSchema,
  sentryOAuthResponseSchema,
} from "../schemas/sentry.js";
import {
  transformSentryIssue,
  transformSentryError,
  transformSentryEventAlert,
  transformSentryMetricAlert,
} from "../transformers/sentry.js";

export const sentry: ProviderDefinition<SentryConfig> = defineProvider<SentryConfig>({
  name: "sentry",
  displayName: "Sentry",
  description: "Connect your Sentry projects",
  configSchema: sentryConfigSchema,

  categories: {
    issue: { label: "Issues", description: "Capture issue state changes (created, resolved, assigned, ignored)", type: "observation" },
    error: { label: "Errors", description: "Capture individual error events", type: "observation" },
    event_alert: { label: "Event Alerts", description: "Capture event alert rule triggers", type: "observation" },
    metric_alert: { label: "Metric Alerts", description: "Capture metric alert triggers and resolutions", type: "observation" },
  },

  events: {
    issue: defineEvent({ label: "Issues", weight: 55, schema: preTransformSentryIssueWebhookSchema, transform: transformSentryIssue }),
    error: defineEvent({ label: "Errors", weight: 45, schema: preTransformSentryErrorWebhookSchema, transform: transformSentryError }),
    event_alert: defineEvent({ label: "Event Alerts", weight: 65, schema: preTransformSentryEventAlertWebhookSchema, transform: transformSentryEventAlert }),
    metric_alert: defineEvent({ label: "Metric Alerts", weight: 70, schema: preTransformSentryMetricAlertWebhookSchema, transform: transformSentryMetricAlert }),
  },

  webhook: {
    extractSecret: (config) => config.clientSecret,
    verifySignature: async (rawBody, headers, secret) => {
      const signature = headers.get("sentry-hook-signature");
      if (!signature) return false;
      const expected = await computeHmac(rawBody, secret, "SHA-256");
      return timingSafeEqual(signature, expected);
    },
    extractEventType: (headers) => headers.get("sentry-hook-resource") ?? "unknown",
    extractDeliveryId: (headers) => {
      const resource = headers.get("sentry-hook-resource");
      const timestamp = headers.get("sentry-hook-timestamp");
      if (resource && timestamp) return `${resource}:${timestamp}`;
      return crypto.randomUUID();
    },
    extractResourceId: (payload) => {
      const p = payload as { installation?: { uuid?: string } };
      return p.installation?.uuid ?? null;
    },
    parsePayload: (raw) => sentryWebhookPayloadSchema.parse(raw),
  },

  oauth: {
    buildAuthUrl: (config, state) => {
      const url = new URL(`https://sentry.io/sentry-apps/${config.appSlug}/external-install/`);
      url.searchParams.set("state", state);
      return url.toString();
    },
    exchangeCode: async (config, code, _redirectUri) => {
      const { installationId, token: authCode } = decodeSentryToken(code);

      const response = await fetch(
        `https://sentry.io/api/0/sentry-app-installations/${installationId}/authorizations/`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${config.clientSecret}`,
          },
          body: JSON.stringify({
            grant_type: "authorization_code",
            code: authCode,
            client_id: config.clientId,
            client_secret: config.clientSecret,
          }),
        },
      );

      if (!response.ok) {
        const errorBody = await response.text();
        console.error("[sentry] token exchange failed:", { status: response.status, body: errorBody });
        throw new Error(`Sentry token exchange failed: ${response.status}`);
      }

      const rawData: unknown = await response.json();
      const data = sentryOAuthResponseSchema.parse(rawData);

      return {
        accessToken: data.token,
        refreshToken: data.refreshToken
          ? encodeSentryToken({ installationId, token: data.refreshToken })
          : undefined,
        expiresIn: data.expiresAt
          ? Math.floor((new Date(data.expiresAt).getTime() - Date.now()) / 1000)
          : undefined,
        raw: rawData as Record<string, unknown>,
      } satisfies OAuthTokens;
    },
    refreshToken: async (config, refreshToken) => {
      const { installationId, token } = decodeSentryToken(refreshToken);

      const response = await fetch(
        `https://sentry.io/api/0/sentry-app-installations/${installationId}/authorizations/`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${config.clientSecret}`,
          },
          body: JSON.stringify({
            grant_type: "refresh_token",
            refresh_token: token,
            client_id: config.clientId,
            client_secret: config.clientSecret,
          }),
        },
      );

      if (!response.ok) throw new Error(`Sentry token refresh failed: ${response.status}`);

      const rawData: unknown = await response.json();
      const data = sentryOAuthResponseSchema.parse(rawData);

      return {
        accessToken: data.token,
        refreshToken:
          installationId && data.refreshToken
            ? encodeSentryToken({ installationId, token: data.refreshToken })
            : data.refreshToken,
        expiresIn: data.expiresAt
          ? Math.floor((new Date(data.expiresAt).getTime() - Date.now()) / 1000)
          : undefined,
        raw: rawData as Record<string, unknown>,
      } satisfies OAuthTokens;
    },
    revokeToken: async (config, accessToken) => {
      if (!accessToken.includes(":")) return;
      const { installationId } = decodeSentryToken(accessToken);
      if (!installationId) return;

      const response = await fetch(
        `https://sentry.io/api/0/sentry-app-installations/${installationId}/`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${config.clientSecret}` },
        },
      );

      if (!response.ok) throw new Error(`Sentry token revocation failed: ${response.status}`);
    },
    processCallback: async (config, query) => {
      const code = query.code;
      const sentryInstallationId = query.installationId;

      if (!code) throw new Error("missing code");
      if (!sentryInstallationId) throw new Error("missing installationId query param");

      const compositeCode = encodeSentryToken({ installationId: sentryInstallationId, token: code });
      const oauthTokens = await sentry.oauth.exchangeCode(config, compositeCode, "");

      const rawData: unknown = oauthTokens.raw;
      const parsedData = sentryOAuthResponseSchema.parse(rawData);
      const now = new Date().toISOString();

      return {
        externalId: sentryInstallationId,
        accountInfo: {
          version: 1 as const,
          sourceType: "sentry" as const,
          events: ["installation", "issue", "error", "comment"],
          installedAt: now,
          lastValidatedAt: now,
          raw: {
            expiresAt: parsedData.expiresAt,
            scopes: parsedData.scopes,
          },
          installationId: sentryInstallationId,
        },
        tokens: oauthTokens,
      } satisfies CallbackResult;
    },
  },
});
