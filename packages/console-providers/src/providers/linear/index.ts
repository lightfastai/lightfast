import { z } from "zod";
import { computeHmac, timingSafeEqual } from "../../crypto";
import { actionEvent, defineProvider } from "../../define";
import type { CallbackResult, OAuthTokens } from "../../types";
import { linearApi } from "./api";
import type { LinearAccountInfo, LinearConfig } from "./auth";
import {
  linearAccountInfoSchema,
  linearConfigSchema,
  linearOAuthRawSchema,
  linearOAuthResponseSchema,
  linearProviderConfigSchema,
} from "./auth";
import { linearBackfill } from "./backfill";
import {
  linearWebhookPayloadSchema,
  preTransformLinearCommentWebhookSchema,
  preTransformLinearCycleWebhookSchema,
  preTransformLinearIssueWebhookSchema,
  preTransformLinearProjectUpdateWebhookSchema,
  preTransformLinearProjectWebhookSchema,
} from "./schemas";
import {
  transformLinearComment,
  transformLinearCycle,
  transformLinearIssue,
  transformLinearProject,
  transformLinearProjectUpdate,
} from "./transformers";

// ── Linear-specific helpers ──

/**
 * Minimal viewer query — returns org ID (preferred) or viewer ID (fallback).
 * Used only by processCallback for the externalId field.
 * Display data resolved live in connections.linear.get.
 */
async function fetchLinearExternalId(accessToken: string): Promise<string> {
  const response = await fetch("https://api.linear.app/graphql", {
    method: "POST",
    signal: AbortSignal.timeout(15_000),
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      query: "{ viewer { id organization { id } } }",
    }),
  });

  if (!response.ok) {
    throw new Error(`Linear viewer query failed: ${response.status}`);
  }

  const result = (await response.json()) as {
    data?: { viewer?: { id: string; organization?: { id: string } } };
  };

  const orgId = result.data?.viewer?.organization?.id;
  if (orgId) {
    return orgId;
  }

  const viewerId = result.data?.viewer?.id;
  if (viewerId) {
    return viewerId;
  }

  throw new Error("Linear API did not return a viewer or organization ID");
}

/** Recursively sort object keys for deterministic serialization. */
function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }
  const sorted = Object.keys(value as Record<string, unknown>)
    .sort()
    .map(
      (k) =>
        JSON.stringify(k) +
        ":" +
        stableStringify((value as Record<string, unknown>)[k])
    );
  return `{${sorted.join(",")}}`;
}

/** Deterministic fingerprint from payload for idempotent delivery IDs. */
function stableFingerprint(payload: unknown): string {
  const str = stableStringify(payload);
  let h1 = 0x81_1c_9d_c5;
  let h2 = 0x05_0c_5d_1f;
  let h3 = 0x1a_47_e9_0b;
  let h4 = 0x7f_ee_3c_b1;
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01_00_01_93);
    h2 = Math.imul(h2 ^ c, 0x01_00_01_93);
    h3 = Math.imul(h3 ^ c, 0x01_00_01_93);
    h4 = Math.imul(h4 ^ c, 0x01_00_01_93);
  }
  return [h1, h2, h3, h4]
    .map((h) => (h >>> 0).toString(16).padStart(8, "0"))
    .join("");
}

// ── Standalone OAuth helpers (avoids circular self-reference in processCallback) ──

async function exchangeLinearCode(
  config: LinearConfig,
  code: string,
  redirectUri: string
): Promise<OAuthTokens> {
  const response = await fetch("https://api.linear.app/oauth/token", {
    method: "POST",
    signal: AbortSignal.timeout(15_000),
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
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
  } satisfies OAuthTokens;
}

// ── Provider Definition ──

export const linear = defineProvider({
  optional: true,
  envSchema: {
    LINEAR_CLIENT_ID: z.string().min(1),
    LINEAR_CLIENT_SECRET: z.string().min(1),
    LINEAR_WEBHOOK_SIGNING_SECRET: z.string().min(1),
  },
  createConfig: (env, runtime) =>
    linearConfigSchema.parse({
      clientId: env.LINEAR_CLIENT_ID,
      clientSecret: env.LINEAR_CLIENT_SECRET,
      webhookSigningSecret: env.LINEAR_WEBHOOK_SIGNING_SECRET,
      callbackBaseUrl: runtime.callbackBaseUrl,
    }),
  name: "linear",
  displayName: "Linear",
  description: "Connect your Linear workspace",
  configSchema: linearConfigSchema,
  accountInfoSchema: linearAccountInfoSchema,
  providerConfigSchema: linearProviderConfigSchema,

  categories: {
    Issue: {
      label: "Issues",
      description: "Capture issue creates, updates, and deletes",
      type: "observation",
    },
    Comment: {
      label: "Comments",
      description: "Capture comment activity on issues",
      type: "observation",
    },
    IssueLabel: {
      label: "Issue Labels",
      description: "Capture issue label changes",
      type: "observation",
    },
    Project: {
      label: "Projects",
      description: "Capture project lifecycle events",
      type: "observation",
    },
    Cycle: {
      label: "Cycles",
      description: "Capture sprint/cycle lifecycle events",
      type: "observation",
    },
    ProjectUpdate: {
      label: "Project Updates",
      description: "Capture project status updates",
      type: "observation",
    },
  },

  events: {
    Issue: actionEvent({
      label: "Issues",
      weight: 50,
      schema: preTransformLinearIssueWebhookSchema,
      transform: transformLinearIssue,
      actions: {
        created: { label: "Issue Created", weight: 50 },
        updated: { label: "Issue Updated", weight: 35 },
        deleted: { label: "Issue Deleted", weight: 40 },
      },
    }),
    Comment: actionEvent({
      label: "Comments",
      weight: 25,
      schema: preTransformLinearCommentWebhookSchema,
      transform: transformLinearComment,
      actions: {
        created: { label: "Comment Added", weight: 25 },
        updated: { label: "Comment Updated", weight: 20 },
        deleted: { label: "Comment Deleted", weight: 20 },
      },
    }),
    Project: actionEvent({
      label: "Projects",
      weight: 45,
      schema: preTransformLinearProjectWebhookSchema,
      transform: transformLinearProject,
      actions: {
        created: { label: "Project Created", weight: 45 },
        updated: { label: "Project Updated", weight: 35 },
        deleted: { label: "Project Deleted", weight: 40 },
      },
    }),
    Cycle: actionEvent({
      label: "Cycles",
      weight: 40,
      schema: preTransformLinearCycleWebhookSchema,
      transform: transformLinearCycle,
      actions: {
        created: { label: "Cycle Created", weight: 40 },
        updated: { label: "Cycle Updated", weight: 30 },
        deleted: { label: "Cycle Deleted", weight: 35 },
      },
    }),
    ProjectUpdate: actionEvent({
      label: "Project Updates",
      weight: 45,
      schema: preTransformLinearProjectUpdateWebhookSchema,
      transform: transformLinearProjectUpdate,
      actions: {
        created: { label: "Project Update Posted", weight: 45 },
        updated: { label: "Project Update Edited", weight: 30 },
        deleted: { label: "Project Update Deleted", weight: 25 },
      },
    }),
  },

  defaultSyncEvents: ["Issue", "Comment", "IssueLabel", "Project", "Cycle"],

  buildProviderConfig: ({ defaultSyncEvents }) => ({
    provider: "linear" as const,
    type: "team" as const,
    sync: {
      events: [...defaultSyncEvents],
      autoSync: true,
    },
  }),

  // Wire eventType "Issue:create" → dispatch category "Issue"
  resolveCategory: (eventType) => eventType.split(":")[0] ?? eventType,

  getBaseEventType: (sourceType) => {
    const dotIndex = sourceType.indexOf(".");
    if (dotIndex > 0) {
      const base = sourceType.substring(0, dotIndex);
      return base
        .split("-")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join("");
    }
    return sourceType;
  },

  deriveObservationType: (sourceType) => sourceType,

  api: linearApi,
  backfill: linearBackfill,

  resourcePicker: {
    installationMode: "merged",
    resourceLabel: "teams",

    enrichInstallation: async (executeApi, inst) => {
      try {
        const res = await executeApi({
          endpointId: "graphql",
          body: { query: "{ viewer { organization { name urlKey } } }" },
        });
        const data = res.data as {
          data?: { viewer?: { organization?: { name?: string } } };
        };
        return {
          id: inst.id,
          externalId: inst.externalId,
          label: data.data?.viewer?.organization?.name ?? inst.id,
        };
      } catch {
        return { id: inst.id, externalId: inst.externalId, label: inst.id };
      }
    },

    listResources: async (executeApi) => {
      const res = await executeApi({
        endpointId: "graphql",
        body: {
          query: "{ teams { nodes { id name key description color } } }",
        },
      });
      const data = res.data as {
        data?: {
          teams?: {
            nodes?: Array<{
              id: string;
              name: string;
              key: string;
              description?: string | null;
              color?: string | null;
            }>;
          };
        };
      };
      const teams = data.data?.teams?.nodes ?? [];
      return teams.map((t) => ({
        id: t.id,
        name: t.name,
        subtitle: t.description ?? null,
        badge: t.key,
        iconColor: t.color ?? null,
        iconLabel: t.key.substring(0, 2),
      }));
    },
  },

  edgeRules: [
    // Linear issue references another issue
    {
      refType: "issue",
      matchProvider: "*",
      matchRefType: "issue",
      relationshipType: "references",
      confidence: 0.8,
    },
  ],

  webhook: {
    headersSchema: z.object({
      "linear-signature": z.string(),
      "linear-delivery": z.string().optional(),
    }),
    extractSecret: (config) => config.webhookSigningSecret,
    verifySignature: (rawBody, headers, secret) => {
      const signature = headers.get("linear-signature");
      if (!signature) {
        return false;
      }
      const expected = computeHmac(rawBody, secret, "SHA-256");
      return timingSafeEqual(signature, expected);
    },
    extractEventType: (_headers, payload) => {
      const p = payload as { type?: string; action?: string };
      if (p.type && p.action) {
        return `${p.type}:${p.action}`;
      }
      return p.type ?? "unknown";
    },
    extractDeliveryId: (headers, payload) => {
      return headers.get("linear-delivery") ?? stableFingerprint(payload);
    },
    extractResourceId: (payload) => {
      const p = payload as { organizationId?: string };
      return p.organizationId ?? null;
    },
    parsePayload: (raw) => linearWebhookPayloadSchema.parse(raw),
  },

  oauth: {
    buildAuthUrl: (config, state, options) => {
      const url = new URL("https://linear.app/oauth/authorize");
      url.searchParams.set("client_id", config.clientId);
      url.searchParams.set(
        "redirect_uri",
        `${config.callbackBaseUrl}/gateway/linear/callback`
      );
      url.searchParams.set("response_type", "code");
      const scopes =
        (options?.scopes as string[] | undefined)?.join(",") ?? "read,write";
      url.searchParams.set("scope", scopes);
      url.searchParams.set("state", state);
      return url.toString();
    },
    exchangeCode: exchangeLinearCode,
    refreshToken: async (config, refreshToken) => {
      const response = await fetch("https://api.linear.app/oauth/token", {
        method: "POST",
        signal: AbortSignal.timeout(15_000),
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: config.clientId,
          client_secret: config.clientSecret,
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
      } satisfies OAuthTokens;
    },
    revokeToken: async (_config, accessToken) => {
      const response = await fetch("https://api.linear.app/oauth/revoke", {
        method: "POST",
        signal: AbortSignal.timeout(15_000),
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: `Bearer ${accessToken}`,
        },
      });
      if (!response.ok) {
        throw new Error(`Linear token revocation failed: ${response.status}`);
      }
    },
    usesStoredToken: true,
    getActiveToken: (_config, _storedExternalId, storedAccessToken) => {
      if (!storedAccessToken) {
        return Promise.reject(new Error("linear: no stored access token"));
      }
      return Promise.resolve(storedAccessToken);
    },
    processCallback: async (config, query) => {
      const code = query.code;
      if (!code) {
        throw new Error("missing code");
      }

      const redirectUri = `${config.callbackBaseUrl}/gateway/linear/callback`;
      const oauthTokens = await exchangeLinearCode(config, code, redirectUri);

      // Minimal viewer query for externalId only (org ID or viewer ID).
      // Display data (org name, urlKey) resolved live in connections.linear.get.
      const externalId = await fetchLinearExternalId(oauthTokens.accessToken);
      const now = new Date().toISOString();

      const raw = linearOAuthRawSchema.parse(oauthTokens.raw);

      return {
        status: "connected",
        externalId,
        accountInfo: {
          version: 1 as const,
          sourceType: "linear" as const,
          events: ["Issue", "Comment", "IssueLabel", "Project", "Cycle"],
          installedAt: now,
          lastValidatedAt: now,
          raw: {
            token_type: raw.token_type,
            scope: raw.scope,
            expires_in: raw.expires_in,
          },
        },
        tokens: oauthTokens,
      } satisfies CallbackResult<LinearAccountInfo>;
    },
  },
});
