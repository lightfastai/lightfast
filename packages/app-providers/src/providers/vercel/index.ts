import { z } from "zod";
import { PROVIDER_DISPLAY } from "../../client/display";
import { defineWebhookProvider } from "../../factory/index";
import { actionEvent, hmac } from "../../provider/index";
import type { CallbackResult, OAuthTokens } from "../../provider/primitives";
import { readErrorBody } from "../../runtime/http";
import {
  vercelApi,
  vercelProjectsListSchema,
  vercelTeamResponseSchema,
  vercelUserResponseSchema,
} from "./api";
import type { VercelAccountInfo, VercelConfig } from "./auth";
import {
  vercelAccountInfoSchema,
  vercelConfigSchema,
  vercelOAuthResponseSchema,
  vercelProviderConfigSchema,
} from "./auth";
import { vercelBackfill } from "./backfill";
import {
  preTransformVercelWebhookPayloadSchema,
  vercelWebhookPayloadSchema,
} from "./schemas";
import { transformVercelDeployment } from "./transformers";

// ── Standalone OAuth helpers (avoids circular self-reference in processCallback) ──

async function exchangeVercelCode(
  config: VercelConfig,
  code: string,
  redirectUri: string
): Promise<OAuthTokens> {
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

  if (!response.ok) {
    const body = await readErrorBody(response);
    throw new Error(`Vercel token exchange failed: ${response.status} ${body}`);
  }

  const rawData: unknown = await response.json();
  const data = vercelOAuthResponseSchema.parse(rawData);

  return {
    accessToken: data.access_token,
    tokenType: data.token_type,
    raw: rawData as Record<string, unknown>,
  } satisfies OAuthTokens;
}

// ── Provider Definition ──

export const vercel = defineWebhookProvider({
  optional: true,
  envSchema: {
    VERCEL_INTEGRATION_SLUG: z.string().min(1).optional(),
    VERCEL_CLIENT_SECRET_ID: z.string().min(1).optional(),
    VERCEL_CLIENT_INTEGRATION_SECRET: z.string().min(1).optional(),
  },
  createConfig: (env, runtime): VercelConfig | null => {
    const integrationSlug = env.VERCEL_INTEGRATION_SLUG;
    const clientSecretId = env.VERCEL_CLIENT_SECRET_ID;
    const clientIntegrationSecret = env.VERCEL_CLIENT_INTEGRATION_SECRET;
    if (!(integrationSlug && clientSecretId && clientIntegrationSecret)) {
      return null;
    }
    return vercelConfigSchema.parse({
      integrationSlug,
      clientSecretId,
      clientIntegrationSecret,
      callbackBaseUrl: runtime.callbackBaseUrl,
    });
  },
  ...PROVIDER_DISPLAY.vercel,
  configSchema: vercelConfigSchema,
  accountInfoSchema: vercelAccountInfoSchema,
  providerConfigSchema: vercelProviderConfigSchema,

  // Fine-grained categories for UI/PROVIDER_REGISTRY compatibility
  categories: {
    "deployment.created": {
      label: "Deployment Started",
      description: "Capture when new deployments begin",
      type: "observation",
    },
    "deployment.succeeded": {
      label: "Deployment Succeeded",
      description: "Capture successful deployment completions",
      type: "observation",
    },
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
      },
    }),
  },

  defaultSyncEvents: ["deployment.created", "deployment.succeeded"],

  buildProviderConfig: ({ defaultSyncEvents }) => ({
    provider: "vercel" as const,
    type: "project" as const,
    sync: {
      events: [...defaultSyncEvents],
      autoSync: true,
    },
  }),

  // Wire eventType "deployment.created" → dispatch category "deployment"
  resolveCategory: (eventType) => eventType.split(".")[0] ?? eventType,

  getBaseEventType: (sourceType) => sourceType,

  deriveObservationType: (sourceType) => sourceType.replace(".", "_"),

  api: vercelApi,
  backfill: vercelBackfill,

  healthCheck: {
    check: async (_config, _externalId, accessToken) => {
      if (!accessToken) {
        return "revoked";
      }
      const response = await fetch("https://api.vercel.com/v2/user", {
        method: "GET",
        signal: AbortSignal.timeout(10_000),
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });
      if (response.status === 200) {
        return "healthy";
      }
      if (response.status === 401 || response.status === 403) {
        return "revoked";
      }
      throw new Error(`Vercel health check failed: ${response.status}`);
    },
  },

  resourcePicker: {
    installationMode: "multi",
    resourceLabel: "projects",

    enrichInstallation: async (executeApi, inst) => {
      const info = inst.providerAccountInfo;
      try {
        if (info?.raw?.team_id) {
          const res = await executeApi({
            endpointId: "get-team",
            pathParams: { team_id: info.raw.team_id },
          });
          const data = vercelTeamResponseSchema.parse(res.data);
          return {
            id: inst.id,
            externalId: inst.externalId,
            label: data.slug ?? info.raw.team_id,
          };
        }
        const res = await executeApi({ endpointId: "get-user" });
        const data = vercelUserResponseSchema.parse(res.data);
        return {
          id: inst.id,
          externalId: inst.externalId,
          label: data.user?.username ?? inst.externalId,
        };
      } catch {
        const fallbackLabel =
          info?.raw?.team_id ?? info?.raw?.user_id ?? inst.externalId;
        return {
          id: inst.id,
          externalId: inst.externalId,
          label: fallbackLabel,
        };
      }
    },

    listResources: async (executeApi, installation) => {
      const info = installation.providerAccountInfo;
      const queryParams: Record<string, string> = { limit: "100" };
      if (info?.raw?.team_id) {
        queryParams.teamId = info.raw.team_id;
      }

      const res = await executeApi({
        endpointId: "list-projects",
        queryParams,
      });
      const data = vercelProjectsListSchema.parse(res.data);
      return data.projects.map((p) => ({
        id: String(p.id),
        name: p.name,
        badge: p.framework ?? null,
        subtitle: null,
      }));
    },

    resolveProxyResources: async (executeApi, installation) => {
      const info = installation.providerAccountInfo as {
        raw?: { team_id?: string };
      } | null;
      const queryParams: Record<string, string> = { limit: "100" };
      if (info?.raw?.team_id) {
        queryParams.teamId = info.raw.team_id;
      }

      const result = await executeApi({
        endpointId: "list-projects",
        queryParams,
      });
      const parsed = vercelProjectsListSchema.parse(result.data);

      return parsed.projects.map((p) => ({
        providerResourceId: String(p.id),
        name: p.name,
        params: { projectId: String(p.id) },
      }));
    },
  },

  edgeRules: [],

  webhook: {
    headersSchema: z.object({
      "x-vercel-signature": z.string(),
    }),
    // Vercel webhooks use HMAC-SHA1 (imposed by Vercel's webhook infrastructure)
    extractSecret: (config) => config.clientIntegrationSecret,
    signatureScheme: hmac({
      algorithm: "sha1",
      signatureHeader: "x-vercel-signature",
    }),
    extractEventType: (_headers, payload) => {
      const p = payload as { type?: string };
      return p.type ?? "unknown";
    },
    extractDeliveryId: (_headers, payload) => {
      const p = payload as { id?: string };
      if (p.id) {
        return p.id;
      }
      return crypto.randomUUID();
    },
    extractResourceId: (payload) => {
      const p = payload as {
        payload?: {
          project?: { id?: string | number };
          team?: { id?: string | number };
        };
      };
      const projectId = p.payload?.project?.id;
      if (projectId != null) {
        return String(projectId);
      }
      const teamId = p.payload?.team?.id;
      if (teamId != null) {
        return String(teamId);
      }
      return null;
    },
    parsePayload: (raw) => vercelWebhookPayloadSchema.parse(raw),
  },

  auth: {
    kind: "oauth" as const,
    buildAuthUrl: (config, state) => {
      const url = new URL(
        `https://vercel.com/integrations/${config.integrationSlug}/new`
      );
      url.searchParams.set("state", state);
      return url.toString();
    },
    exchangeCode: exchangeVercelCode,
    refreshToken: (_config, _refreshToken): Promise<OAuthTokens> => {
      return Promise.reject(new Error("Vercel tokens do not support refresh"));
    },
    revokeToken: async (_config, accessToken) => {
      const response = await fetch(
        "https://api.vercel.com/v2/oauth/tokens/revoke",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          signal: AbortSignal.timeout(15_000),
        }
      );
      if (!response.ok) {
        const body = await readErrorBody(response);
        throw new Error(
          `Vercel token revocation failed: ${response.status} ${body}`
        );
      }
    },
    usesStoredToken: true,
    getActiveToken: (_config, _storedExternalId, storedAccessToken) => {
      if (!storedAccessToken) {
        return Promise.reject(new Error("vercel: no stored access token"));
      }
      return Promise.resolve(storedAccessToken);
    },
    processCallback: async (config, query) => {
      const code = query.code;
      const configurationId = query.configurationId;
      if (!code) {
        throw new Error("missing code");
      }
      if (!configurationId) {
        throw new Error("missing configurationId");
      }

      const redirectUri = `${config.callbackBaseUrl}/api/connect/vercel/callback`;
      const oauthTokens = await exchangeVercelCode(config, code, redirectUri);

      const parsed = vercelOAuthResponseSchema.parse(oauthTokens.raw);

      if (parsed.installation_id !== configurationId) {
        throw new Error(
          `configurationId mismatch: callback=${configurationId} token=${parsed.installation_id}`
        );
      }

      const externalId = parsed.team_id ?? parsed.user_id;
      const now = new Date().toISOString();

      const accountInfo = {
        version: 1 as const,
        sourceType: "vercel" as const,
        events: [
          "deployment.created",
          "deployment.succeeded",
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

      return {
        status: "connected",
        externalId,
        accountInfo,
        tokens: oauthTokens,
      } satisfies CallbackResult<VercelAccountInfo>;
    },
  },
});
