import { defineProvider, actionEvent } from "../define.js";
import { z } from "zod";
import { linearConfigSchema, linearAccountInfoSchema, linearOAuthRawSchema } from "../types.js";
import type { LinearConfig, OAuthTokens, CallbackResult, LinearAccountInfo } from "../types.js";
import { computeHmac, timingSafeEqual } from "../crypto.js";
import {
  preTransformLinearIssueWebhookSchema,
  preTransformLinearCommentWebhookSchema,
  preTransformLinearProjectWebhookSchema,
  preTransformLinearCycleWebhookSchema,
  preTransformLinearProjectUpdateWebhookSchema,
  linearWebhookPayloadSchema,
  linearOAuthResponseSchema,
} from "../schemas/linear.js";
import {
  transformLinearIssue,
  transformLinearComment,
  transformLinearProject,
  transformLinearCycle,
  transformLinearProjectUpdate,
} from "../transformers/linear.js";

// ── Linear-specific helpers ──

async function fetchLinearContext(accessToken: string): Promise<{
  externalId: string;
  organizationName?: string;
  organizationUrlKey?: string;
}> {
  const response = await fetch("https://api.linear.app/graphql", {
    method: "POST",
    signal: AbortSignal.timeout(15_000),
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
    return { externalId: org.id, organizationName: org.name, organizationUrlKey: org.urlKey };
  }

  const viewerId = result.data?.viewer?.id;
  if (viewerId) return { externalId: viewerId };

  throw new Error("Linear API did not return a viewer or organization ID");
}

/** Recursively sort object keys for deterministic serialization. */
function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return "[" + value.map(stableStringify).join(",") + "]";
  }
  const sorted = Object.keys(value as Record<string, unknown>)
    .sort()
    .map(
      (k) =>
        JSON.stringify(k) +
        ":" +
        stableStringify((value as Record<string, unknown>)[k]),
    );
  return "{" + sorted.join(",") + "}";
}

/** Deterministic fingerprint from payload for idempotent delivery IDs. */
function stableFingerprint(payload: unknown): string {
  const str = stableStringify(payload);
  let h1 = 0x811c9dc5;
  let h2 = 0x050c5d1f;
  let h3 = 0x1a47e90b;
  let h4 = 0x7fee3cb1;
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193);
    h2 = Math.imul(h2 ^ c, 0x01000193);
    h3 = Math.imul(h3 ^ c, 0x01000193);
    h4 = Math.imul(h4 ^ c, 0x01000193);
  }
  return [h1, h2, h3, h4]
    .map((h) => (h >>> 0).toString(16).padStart(8, "0"))
    .join("");
}

// ── Standalone OAuth helpers (avoids circular self-reference in processCallback) ──

async function exchangeLinearCode(config: LinearConfig, code: string, redirectUri: string): Promise<OAuthTokens> {
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

  if (!response.ok) throw new Error(`Linear token exchange failed: ${response.status}`);

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
  envSchema: {
    LINEAR_CLIENT_ID: z.string().min(1),
    LINEAR_CLIENT_SECRET: z.string().min(1),
    LINEAR_WEBHOOK_SIGNING_SECRET: z.string().min(1),
  },
  createConfig: (env, runtime) => linearConfigSchema.parse({
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

  categories: {
    Issue: { label: "Issues", description: "Capture issue creates, updates, and deletes", type: "observation" },
    Comment: { label: "Comments", description: "Capture comment activity on issues", type: "observation" },
    Project: { label: "Projects", description: "Capture project lifecycle events", type: "observation" },
    Cycle: { label: "Cycles", description: "Capture sprint/cycle lifecycle events", type: "observation" },
    ProjectUpdate: { label: "Project Updates", description: "Capture project status updates", type: "observation" },
  },

  events: {
    Issue: actionEvent({
      label: "Issues", weight: 50, schema: preTransformLinearIssueWebhookSchema, transform: transformLinearIssue,
      actions: {
        created: { label: "Issue Created", weight: 50 },
        updated: { label: "Issue Updated", weight: 35 },
        deleted: { label: "Issue Deleted", weight: 40 },
      },
    }),
    Comment: actionEvent({
      label: "Comments", weight: 25, schema: preTransformLinearCommentWebhookSchema, transform: transformLinearComment,
      actions: {
        created: { label: "Comment Added", weight: 25 },
        updated: { label: "Comment Updated", weight: 20 },
        deleted: { label: "Comment Deleted", weight: 20 },
      },
    }),
    Project: actionEvent({
      label: "Projects", weight: 45, schema: preTransformLinearProjectWebhookSchema, transform: transformLinearProject,
      actions: {
        created: { label: "Project Created", weight: 45 },
        updated: { label: "Project Updated", weight: 35 },
        deleted: { label: "Project Deleted", weight: 40 },
      },
    }),
    Cycle: actionEvent({
      label: "Cycles", weight: 40, schema: preTransformLinearCycleWebhookSchema, transform: transformLinearCycle,
      actions: {
        created: { label: "Cycle Created", weight: 40 },
        updated: { label: "Cycle Updated", weight: 30 },
        deleted: { label: "Cycle Deleted", weight: 35 },
      },
    }),
    ProjectUpdate: actionEvent({
      label: "Project Updates", weight: 45, schema: preTransformLinearProjectUpdateWebhookSchema, transform: transformLinearProjectUpdate,
      actions: {
        created: { label: "Project Update Posted", weight: 45 },
        updated: { label: "Project Update Edited", weight: 30 },
        deleted: { label: "Project Update Deleted", weight: 25 },
      },
    }),
  },

  // Wire eventType "Issue:create" → dispatch category "Issue"
  resolveCategory: (eventType) => eventType.split(":")[0] ?? eventType,

  webhook: {
    extractSecret: (config) => config.webhookSigningSecret,
    verifySignature: async (rawBody, headers, secret) => {
      const signature = headers.get("linear-signature");
      if (!signature) return false;
      const expected = await computeHmac(rawBody, secret, "SHA-256");
      return timingSafeEqual(signature, expected);
    },
    extractEventType: (_headers, payload) => {
      const p = payload as { type?: string; action?: string };
      if (p.type && p.action) return `${p.type}:${p.action}`;
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
      url.searchParams.set("redirect_uri", `${config.callbackBaseUrl}/gateway/linear/callback`);
      url.searchParams.set("response_type", "code");
      const scopes = (options?.scopes as string[] | undefined)?.join(",") ?? "read,write";
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

      if (!response.ok) throw new Error(`Linear token refresh failed: ${response.status}`);

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
      if (!response.ok) throw new Error(`Linear token revocation failed: ${response.status}`);
    },
    usesStoredToken: true,
    getActiveToken: (_config, _storedExternalId, storedAccessToken) => {
      if (!storedAccessToken) return Promise.reject(new Error("linear: no stored access token"));
      return Promise.resolve(storedAccessToken);
    },
    processCallback: async (config, query) => {
      const code = query.code;
      if (!code) throw new Error("missing code");

      const redirectUri = `${config.callbackBaseUrl}/gateway/linear/callback`;
      const oauthTokens = await exchangeLinearCode(config, code, redirectUri);

      const linearContext = await fetchLinearContext(oauthTokens.accessToken);
      const externalId = linearContext.externalId;
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
          ...(linearContext.organizationName || linearContext.organizationUrlKey
            ? {
                organization: {
                  id: linearContext.externalId,
                  name: linearContext.organizationName,
                  urlKey: linearContext.organizationUrlKey,
                },
              }
            : {}),
        },
        tokens: oauthTokens,
      } satisfies CallbackResult<LinearAccountInfo>;
    },
  },
});
