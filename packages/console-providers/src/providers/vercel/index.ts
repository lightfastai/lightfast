import { defineProvider, actionEvent } from "../../define";
import { z } from "zod";
import { vercelConfigSchema, vercelAccountInfoSchema, vercelOAuthResponseSchema, vercelProviderConfigSchema } from "./auth";
import type { VercelConfig, VercelAccountInfo, VercelOAuthRaw } from "./auth";
import type { OAuthTokens, CallbackResult } from "../../types";
import { computeHmac, timingSafeEqual } from "../../crypto";
import {
  preTransformVercelWebhookPayloadSchema,
  vercelWebhookPayloadSchema,
} from "./schemas";
import { transformVercelDeployment } from "./transformers";

// ── Standalone OAuth helpers (avoids circular self-reference in processCallback) ──

async function exchangeVercelCode(config: VercelConfig, code: string, redirectUri: string): Promise<OAuthTokens> {
  const body = new URLSearchParams({
    client_id: config.clientSecretId,
    client_secret: config.clientIntegrationSecret,
    code,
    redirect_uri: redirectUri,
  });

  const response = await fetch("https://api.vercel.com/v2/oauth/access_token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
    signal: AbortSignal.timeout(15_000),
  });

  if (!response.ok) throw new Error(`Vercel token exchange failed: ${response.status}`);

  const rawData: unknown = await response.json();
  const data = vercelOAuthResponseSchema.parse(rawData);

  return {
    accessToken: data.access_token,
    tokenType: data.token_type,
    raw: rawData as Record<string, unknown>,
  } satisfies OAuthTokens;
}

// ── Provider Definition ──

export const vercel = defineProvider({
  envSchema: {
    VERCEL_INTEGRATION_SLUG: z.string().min(1),
    VERCEL_CLIENT_SECRET_ID: z.string().min(1),
    VERCEL_CLIENT_INTEGRATION_SECRET: z.string().min(1),
  },
  createConfig: (env, runtime) => vercelConfigSchema.parse({
    integrationSlug: env.VERCEL_INTEGRATION_SLUG,
    clientSecretId: env.VERCEL_CLIENT_SECRET_ID,
    clientIntegrationSecret: env.VERCEL_CLIENT_INTEGRATION_SECRET,
    callbackBaseUrl: runtime.callbackBaseUrl,
  }),
  name: "vercel",
  displayName: "Vercel",
  description: "Connect your Vercel projects",
  configSchema: vercelConfigSchema,
  accountInfoSchema: vercelAccountInfoSchema,
  providerConfigSchema: vercelProviderConfigSchema,

  // Fine-grained categories for UI/PROVIDER_REGISTRY compatibility
  categories: {
    "deployment.created": { label: "Deployment Started", description: "Capture when new deployments begin", type: "observation" },
    "deployment.succeeded": { label: "Deployment Succeeded", description: "Capture successful deployment completions", type: "observation" },
    "deployment.ready": { label: "Deployment Ready", description: "Capture when deployments are live", type: "observation" },
    "deployment.error": { label: "Deployment Failed", description: "Capture deployment failures", type: "observation" },
    "deployment.canceled": { label: "Deployment Canceled", description: "Capture canceled deployments", type: "observation" },
    "deployment.check-rerequested": { label: "Check Re-requested", description: "Capture deployment check re-request events", type: "observation" },
  },

  // Coarse-grained events for dispatch (resolveCategory strips dot-suffix)
  events: {
    deployment: actionEvent({
      label: "Deployment",
      weight: 40,
      schema: preTransformVercelWebhookPayloadSchema,
      transform: transformVercelDeployment,
      actions: {
        created: { label: "Deployment Started", weight: 30 },
        succeeded: { label: "Deployment Succeeded", weight: 40 },
        ready: { label: "Deployment Ready", weight: 40 },
        error: { label: "Deployment Failed", weight: 70 },
        canceled: { label: "Deployment Canceled", weight: 65 },
        "check-rerequested": { label: "Deployment Check Re-requested", weight: 25 },
      },
    }),
  },

  defaultSyncEvents: [
    "deployment.created",
    "deployment.succeeded",
    "deployment.ready",
    "deployment.error",
    "deployment.canceled",
  ],

  buildProviderConfig: ({ resourceId, providerAccountInfo, defaultSyncEvents }) => {
    if (providerAccountInfo?.sourceType !== "vercel") {
      throw new Error("Invalid provider account info for vercel");
    }
    const raw = providerAccountInfo.raw as VercelOAuthRaw;
    return {
      version: 1 as const,
      sourceType: "vercel" as const,
      type: "project" as const,
      projectId: resourceId,
      teamId: raw.team_id ?? undefined,
      configurationId: raw.installation_id,
      sync: {
        events: [...defaultSyncEvents],
        autoSync: true,
      },
    };
  },

  // Wire eventType "deployment.created" → dispatch category "deployment"
  resolveCategory: (eventType) => eventType.split(".")[0] ?? eventType,

  getBaseEventType: (sourceType) => sourceType,

  deriveObservationType: (sourceType) => sourceType.replace(".", "_"),

  webhook: {
    headersSchema: z.object({
      "x-vercel-signature": z.string(),
    }),
    // Vercel webhooks use HMAC-SHA1 (imposed by Vercel's webhook infrastructure)
    extractSecret: (config) => config.clientIntegrationSecret,
    verifySignature: (rawBody, headers, secret) => {
      const signature = headers.get("x-vercel-signature");
      if (!signature) return false;
      const expected = computeHmac(rawBody, secret, "SHA-1");
      return timingSafeEqual(signature, expected);
    },
    extractEventType: (_headers, payload) => {
      const p = payload as { type?: string };
      return p.type ?? "unknown";
    },
    extractDeliveryId: (_headers, payload) => {
      const p = payload as { id?: string };
      if (p.id) return p.id;
      return crypto.randomUUID();
    },
    extractResourceId: (payload) => {
      const p = payload as { payload?: { project?: { id?: string | number }; team?: { id?: string | number } } };
      const projectId = p.payload?.project?.id;
      if (projectId != null) return String(projectId);
      const teamId = p.payload?.team?.id;
      if (teamId != null) return String(teamId);
      return null;
    },
    parsePayload: (raw) => vercelWebhookPayloadSchema.parse(raw),
  },

  oauth: {
    buildAuthUrl: (config, state) => {
      const url = new URL(`https://vercel.com/integrations/${config.integrationSlug}/new`);
      url.searchParams.set("state", state);
      return url.toString();
    },
    exchangeCode: exchangeVercelCode,
    refreshToken: (): Promise<OAuthTokens> => {
      return Promise.reject(new Error("Vercel tokens do not support refresh"));
    },
    revokeToken: async (_config, accessToken) => {
      const response = await fetch("https://api.vercel.com/v2/oauth/tokens/revoke", {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        signal: AbortSignal.timeout(15_000),
      });
      if (!response.ok) throw new Error(`Vercel token revocation failed: ${response.status}`);
    },
    usesStoredToken: true,
    getActiveToken: (_config, _storedExternalId, storedAccessToken) => {
      if (!storedAccessToken) return Promise.reject(new Error("vercel: no stored access token"));
      return Promise.resolve(storedAccessToken);
    },
    processCallback: async (config, query) => {
      const code = query.code;
      const configurationId = query.configurationId;
      const next = query.next;

      if (!code) throw new Error("missing code");
      if (!configurationId) throw new Error("missing configurationId");

      const redirectUri = `${config.callbackBaseUrl}/gateway/vercel/callback`;
      const oauthTokens = await exchangeVercelCode(config, code, redirectUri);

      const parsed = vercelOAuthResponseSchema.parse(oauthTokens.raw);

      if (parsed.installation_id !== configurationId) {
        throw new Error(
          `configurationId mismatch: callback=${configurationId} token=${parsed.installation_id}`,
        );
      }

      const externalId = parsed.team_id ?? parsed.user_id;
      const now = new Date().toISOString();

      const accountInfo = {
        version: 1 as const,
        sourceType: "vercel" as const,
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
        raw: {
          token_type: parsed.token_type,
          installation_id: parsed.installation_id,
          user_id: parsed.user_id,
          team_id: parsed.team_id,
        },
      };

      if (next) {
        return {
          status: "connected-redirect",
          externalId,
          accountInfo,
          tokens: oauthTokens,
          nextUrl: next,
        } satisfies CallbackResult<VercelAccountInfo>;
      }

      return {
        status: "connected",
        externalId,
        accountInfo,
        tokens: oauthTokens,
      } satisfies CallbackResult<VercelAccountInfo>;
    },
  },
});
