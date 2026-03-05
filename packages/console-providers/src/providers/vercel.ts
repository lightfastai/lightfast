import { defineProvider, defineEvent } from "../define.js";
import type { ProviderDefinition } from "../define.js";
import { z } from "zod";
import { vercelConfigSchema } from "../types.js";
import type { VercelConfig, OAuthTokens, CallbackResult } from "../types.js";
import { computeHmac, timingSafeEqual } from "../crypto.js";
import {
  preTransformVercelWebhookPayloadSchema,
  vercelWebhookPayloadSchema,
  vercelOAuthResponseSchema,
} from "../schemas/vercel.js";
import { transformVercelDeployment } from "../transformers/vercel.js";

export const vercel: ProviderDefinition<VercelConfig> = defineProvider<VercelConfig>({
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
    deployment: defineEvent({
      label: "Deployment",
      weight: 40,
      schema: preTransformVercelWebhookPayloadSchema,
      transform: transformVercelDeployment,
    }),
  },

  // Wire eventType "deployment.created" → dispatch category "deployment"
  resolveCategory: (eventType) => eventType.split(".")[0] ?? eventType,

  webhook: {
    // Vercel webhooks use HMAC-SHA1 (imposed by Vercel's webhook infrastructure)
    extractSecret: (config) => config.clientIntegrationSecret,
    verifySignature: async (rawBody, headers, secret) => {
      const signature = headers.get("x-vercel-signature");
      if (!signature) return false;
      const expected = await computeHmac(rawBody, secret, "SHA-1");
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
    exchangeCode: async (config, code, redirectUri) => {
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
    },
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
    processCallback: async (config, query) => {
      const code = query.code;
      const configurationId = query.configurationId;
      const next = query.next;

      if (!code) throw new Error("missing code");
      if (!configurationId) throw new Error("missing configurationId");

      const redirectUri = `${config.callbackBaseUrl}/gateway/vercel/callback`;
      const oauthTokens = await vercel.oauth.exchangeCode(config, code, redirectUri);

      const parsed = vercelOAuthResponseSchema.parse(oauthTokens.raw);

      if (parsed.installation_id !== configurationId) {
        throw new Error(
          `configurationId mismatch: callback=${configurationId} token=${parsed.installation_id}`,
        );
      }

      const externalId = parsed.team_id ?? parsed.user_id;
      const now = new Date().toISOString();

      return {
        externalId,
        accountInfo: {
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
        },
        tokens: oauthTokens,
        ...(next ? { nextUrl: next } : {}),
      } satisfies CallbackResult;
    },
  },
});
