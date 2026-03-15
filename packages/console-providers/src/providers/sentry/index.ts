import { z } from "zod";
import { computeHmac, timingSafeEqual } from "../../crypto";
import { actionEvent, defineProvider, simpleEvent } from "../../define";
import type { CallbackResult, OAuthTokens } from "../../types";
import { sentryApi } from "./api";
import type { SentryAccountInfo, SentryConfig } from "./auth";
import {
  decodeSentryToken,
  encodeSentryToken,
  sentryAccountInfoSchema,
  sentryConfigSchema,
  sentryOAuthResponseSchema,
  sentryProviderConfigSchema,
} from "./auth";
import { sentryBackfill } from "./backfill";
import {
  preTransformSentryErrorWebhookSchema,
  preTransformSentryEventAlertWebhookSchema,
  preTransformSentryIssueWebhookSchema,
  preTransformSentryMetricAlertWebhookSchema,
  sentryWebhookPayloadSchema,
} from "./schemas";
import {
  transformSentryError,
  transformSentryEventAlert,
  transformSentryIssue,
  transformSentryMetricAlert,
} from "./transformers";

// ── Standalone OAuth helpers (avoids circular self-reference in processCallback) ──

async function exchangeSentryCode(
  config: SentryConfig,
  code: string,
  _redirectUri: string
): Promise<OAuthTokens> {
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
    }
  );

  if (!response.ok) {
    const errorBody = await response.text();
    console.error("[sentry] token exchange failed:", {
      status: response.status,
      body: errorBody,
    });
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
}

// ── Provider Definition ──

export const sentry = defineProvider({
  envSchema: {
    SENTRY_APP_SLUG: z.string().min(1),
    SENTRY_CLIENT_ID: z.string().min(1),
    SENTRY_CLIENT_SECRET: z.string().min(1),
  },
  createConfig: (env, _runtime) =>
    sentryConfigSchema.parse({
      appSlug: env.SENTRY_APP_SLUG,
      clientId: env.SENTRY_CLIENT_ID,
      clientSecret: env.SENTRY_CLIENT_SECRET,
    }),
  name: "sentry",
  displayName: "Sentry",
  description: "Connect your Sentry projects",
  configSchema: sentryConfigSchema,
  accountInfoSchema: sentryAccountInfoSchema,
  providerConfigSchema: sentryProviderConfigSchema,

  categories: {
    issue: {
      label: "Issues",
      description:
        "Capture issue state changes (created, resolved, assigned, ignored)",
      type: "observation",
    },
    error: {
      label: "Errors",
      description: "Capture individual error events",
      type: "observation",
    },
    comment: {
      label: "Comments",
      description: "Capture issue comment activity",
      type: "observation",
    },
    event_alert: {
      label: "Event Alerts",
      description: "Capture event alert rule triggers",
      type: "observation",
    },
    metric_alert: {
      label: "Metric Alerts",
      description: "Capture metric alert triggers and resolutions",
      type: "observation",
    },
  },

  events: {
    issue: actionEvent({
      label: "Issues",
      weight: 55,
      schema: preTransformSentryIssueWebhookSchema,
      transform: transformSentryIssue,
      actions: {
        created: { label: "Issue Created", weight: 55 },
        resolved: { label: "Issue Resolved", weight: 50 },
        assigned: { label: "Issue Assigned", weight: 30 },
        ignored: { label: "Issue Ignored", weight: 25 },
        archived: { label: "Issue Archived", weight: 25 },
        unresolved: { label: "Issue Unresolved", weight: 45 },
      },
    }),
    error: simpleEvent({
      label: "Errors",
      weight: 45,
      schema: preTransformSentryErrorWebhookSchema,
      transform: transformSentryError,
    }),
    event_alert: simpleEvent({
      label: "Event Alerts",
      weight: 65,
      schema: preTransformSentryEventAlertWebhookSchema,
      transform: transformSentryEventAlert,
    }),
    metric_alert: simpleEvent({
      label: "Metric Alerts",
      weight: 70,
      schema: preTransformSentryMetricAlertWebhookSchema,
      transform: transformSentryMetricAlert,
    }),
  },

  defaultSyncEvents: ["issue", "error", "comment"],

  buildProviderConfig: ({ resourceId, defaultSyncEvents }) => ({
    version: 1 as const,
    sourceType: "sentry" as const,
    type: "project" as const,
    projectId: resourceId,
    sync: {
      events: [...defaultSyncEvents],
      autoSync: true,
    },
  }),

  // Sentry wire eventType maps 1:1 to event key (e.g., "issue" → "issue")
  resolveCategory: (eventType) => eventType,

  getBaseEventType: (sourceType) => {
    if (sourceType.startsWith("issue.")) {
      return "issue";
    }
    return sourceType.replace(/-/g, "_");
  },

  deriveObservationType: (sourceType) => sourceType,

  api: sentryApi,
  backfill: sentryBackfill,

  resourcePicker: {
    installationMode: "single",
    resourceLabel: "projects",

    enrichInstallation: async (executeApi, inst) => {
      try {
        const res = await executeApi({ endpointId: "list-organizations" });
        const orgs = res.data as Array<{ name?: string; slug?: string }>;
        const org = orgs[0];
        return {
          id: inst.id,
          externalId: inst.externalId,
          label: org?.name ?? "Sentry",
        };
      } catch {
        return { id: inst.id, externalId: inst.externalId, label: "Sentry" };
      }
    },

    listResources: async (executeApi) => {
      const res = await executeApi({ endpointId: "list-projects" });
      const projects = res.data as Array<{
        id: string;
        name: string;
        slug: string;
        platform?: string | null;
        organization?: { slug?: string };
      }>;
      return projects.map((p) => ({
        id: p.id,
        name: p.name,
        subtitle: p.slug,
        badge: p.platform ?? null,
        linkName: `${p.organization?.slug ?? ""}/${p.slug}`,
      }));
    },
  },

  edgeRules: [],

  webhook: {
    headersSchema: z.object({
      "sentry-hook-signature": z.string(),
      "sentry-hook-resource": z.string(),
      "sentry-hook-timestamp": z.string().optional(),
    }),
    extractSecret: (config) => config.clientSecret,
    verifySignature: (rawBody, headers, secret) => {
      const signature = headers.get("sentry-hook-signature");
      if (!signature) {
        return false;
      }
      const expected = computeHmac(rawBody, secret, "SHA-256");
      return timingSafeEqual(signature, expected);
    },
    extractEventType: (headers) =>
      headers.get("sentry-hook-resource") ?? "unknown",
    extractDeliveryId: (headers) => {
      const resource = headers.get("sentry-hook-resource");
      const timestamp = headers.get("sentry-hook-timestamp");
      if (resource && timestamp) {
        return `${resource}:${timestamp}`;
      }
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
      const url = new URL(
        `https://sentry.io/sentry-apps/${config.appSlug}/external-install/`
      );
      url.searchParams.set("state", state);
      return url.toString();
    },
    exchangeCode: exchangeSentryCode,
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
        }
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
          ? Math.floor((new Date(data.expiresAt).getTime() - Date.now()) / 1000)
          : undefined,
        raw: rawData as Record<string, unknown>,
      } satisfies OAuthTokens;
    },
    revokeToken: async (config, accessToken) => {
      if (!accessToken.includes(":")) {
        return;
      }
      const { installationId } = decodeSentryToken(accessToken);
      if (!installationId) {
        return;
      }

      const response = await fetch(
        `https://sentry.io/api/0/sentry-app-installations/${installationId}/`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${config.clientSecret}` },
        }
      );

      if (!response.ok) {
        throw new Error(`Sentry token revocation failed: ${response.status}`);
      }
    },
    usesStoredToken: true,
    getActiveToken: (_config, _storedExternalId, storedAccessToken) => {
      if (!storedAccessToken) {
        return Promise.reject(new Error("sentry: no stored access token"));
      }
      return Promise.resolve(storedAccessToken);
    },
    processCallback: async (config, query) => {
      const code = query.code;
      const sentryInstallationId = query.installationId;

      if (!code) {
        throw new Error("missing code");
      }
      if (!sentryInstallationId) {
        throw new Error("missing installationId query param");
      }

      const compositeCode = encodeSentryToken({
        installationId: sentryInstallationId,
        token: code,
      });
      const oauthTokens = await exchangeSentryCode(config, compositeCode, "");

      const rawData: unknown = oauthTokens.raw;
      const parsedData = sentryOAuthResponseSchema.parse(rawData);
      const now = new Date().toISOString();

      return {
        status: "connected",
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
      } satisfies CallbackResult<SentryAccountInfo>;
    },
  },
});
