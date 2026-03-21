import { z } from "zod";
import { PROVIDER_DISPLAY } from "../../client/display";
import { defineWebhookProvider } from "../../factory/index";
import { actionEvent, hmac } from "../../provider/index";
import type { CallbackResult } from "../../provider/primitives";
import { createRS256JWT } from "../../runtime/jwt";
import {
  githubApi,
  githubAppInstallationSchema,
  githubInstallationReposSchema,
} from "./api";
import type { GitHubAccountInfo, GitHubConfig } from "./auth";
import {
  githubAccountInfoSchema,
  githubConfigSchema,
  githubProviderConfigSchema,
} from "./auth";
import { githubBackfill } from "./backfill";
import {
  githubWebhookPayloadSchema,
  preTransformGitHubIssuesEventSchema,
  preTransformGitHubPullRequestEventSchema,
} from "./schemas";
import {
  transformGitHubIssue,
  transformGitHubPullRequest,
} from "./transformers";

// ── GitHub-Specific Capabilities ──

async function createGitHubAppJWT(config: GitHubConfig): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  return createRS256JWT(
    { iss: config.appId, iat: now - 60, exp: now + 600 },
    config.privateKey
  );
}

async function getInstallationToken(
  config: GitHubConfig,
  installationId: string
): Promise<string> {
  if (!/^\d+$/.test(installationId)) {
    throw new Error("Invalid GitHub installation ID: must be numeric");
  }

  const jwt = await createGitHubAppJWT(config);
  const response = await fetch(
    `https://api.github.com/app/installations/${installationId}/access_tokens`,
    {
      method: "POST",
      signal: AbortSignal.timeout(10_000),
      headers: {
        Authorization: `Bearer ${jwt}`,
        Accept: "application/vnd.github+json",
        "User-Agent": "lightfast-platform",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    }
  );
  if (!response.ok) {
    throw new Error(
      `GitHub installation token request failed: ${response.status}`
    );
  }

  const data = (await response.json()) as Record<string, unknown>;
  if (typeof data.token !== "string" || data.token.length === 0) {
    throw new Error("GitHub installation token response missing valid token");
  }
  return data.token;
}

// ── Provider Definition ──

export const github = defineWebhookProvider({
  ...PROVIDER_DISPLAY.github,
  configSchema: githubConfigSchema,
  accountInfoSchema: githubAccountInfoSchema,
  providerConfigSchema: githubProviderConfigSchema,

  categories: {
    pull_request: {
      label: "Pull Requests",
      description: "Capture PR opens, merges, closes, and reopens",
      type: "observation",
    },
    issues: {
      label: "Issues",
      description: "Capture issue opens, closes, and reopens",
      type: "observation",
    },
  },

  events: {
    pull_request: actionEvent({
      label: "Pull Requests",
      weight: 50,
      schema: preTransformGitHubPullRequestEventSchema,
      transform: transformGitHubPullRequest,
      actions: {
        opened: { label: "PR Opened", weight: 50 },
        closed: { label: "PR Closed", weight: 45 },
        merged: { label: "PR Merged", weight: 60 },
        reopened: { label: "PR Reopened", weight: 40 },
        "ready-for-review": { label: "Ready for Review", weight: 45 },
      },
    }),
    issues: actionEvent({
      label: "Issues",
      weight: 45,
      schema: preTransformGitHubIssuesEventSchema,
      transform: transformGitHubIssue,
      actions: {
        opened: { label: "Issue Opened", weight: 45 },
        closed: { label: "Issue Closed", weight: 40 },
        reopened: { label: "Issue Reopened", weight: 40 },
      },
    }),
  },

  webhook: {
    headersSchema: z.object({
      "x-hub-signature-256": z.string(),
      "x-github-event": z.string(),
      "x-github-delivery": z.string(),
    }),
    extractSecret: (config) => config.webhookSecret,
    signatureScheme: hmac({
      algorithm: "sha256",
      signatureHeader: "x-hub-signature-256",
      prefix: "sha256=",
    }),
    extractEventType: (headers) => headers.get("x-github-event") ?? "unknown",
    extractDeliveryId: (headers) =>
      headers.get("x-github-delivery") ?? crypto.randomUUID(),
    extractResourceId: (payload) => {
      const p = payload as {
        repository?: { id: number | string };
        installation?: { id: number | string };
      };
      if (p.repository?.id != null) {
        return String(p.repository.id);
      }
      if (p.installation?.id != null) {
        return String(p.installation.id);
      }
      return null;
    },
    parsePayload: (raw) => githubWebhookPayloadSchema.parse(raw),
  },

  auth: {
    kind: "app-token" as const,
    buildInstallUrl: (config, state) => {
      const url = new URL(
        `https://github.com/apps/${config.appSlug}/installations/new`
      );
      url.searchParams.set("state", state);
      return url.toString();
    },
    usesStoredToken: false as const,
    getActiveToken: async (config, storedExternalId, _storedAccessToken) => {
      return getInstallationToken(config, storedExternalId);
    },
    getAppToken: async (config) => createGitHubAppJWT(config),
    revokeAccess: async (config, _externalId) => {
      // GitHub App installations are revoked via the GitHub UI or GitHub API.
      // Installation tokens expire automatically; no explicit revocation call needed.
      // The app can be uninstalled via DELETE /app/installations/:installation_id.
      const jwt = await createGitHubAppJWT(config);
      const response = await fetch(
        `https://api.github.com/app/installations/${_externalId}`,
        {
          method: "DELETE",
          signal: AbortSignal.timeout(15_000),
          headers: {
            Authorization: `Bearer ${jwt}`,
            Accept: "application/vnd.github+json",
            "User-Agent": "lightfast-platform",
            "X-GitHub-Api-Version": "2022-11-28",
          },
        }
      );
      // 204 = success, 404 = already uninstalled — both are fine
      if (!response.ok && response.status !== 404) {
        throw new Error(
          `GitHub installation revocation failed: ${response.status}`
        );
      }
    },
    processCallback: (_config, query) => {
      const installationId = query.installation_id;
      const setupAction = query.setup_action;

      if (setupAction === "request") {
        return Promise.reject(
          new Error("setup_action=request is not yet implemented")
        );
      }
      if (setupAction === "update") {
        return Promise.reject(
          new Error("setup_action=update is not yet implemented")
        );
      }
      if (!installationId) {
        return Promise.reject(new Error("missing installation_id"));
      }

      const now = new Date().toISOString();
      return Promise.resolve({
        status: "connected-no-token",
        externalId: installationId,
        accountInfo: {
          version: 1 as const,
          sourceType: "github" as const,
          events: ["pull_request", "issues"],
          installedAt: now,
          lastValidatedAt: now,
          raw: {},
        },
      } satisfies CallbackResult<GitHubAccountInfo>);
    },
  },

  defaultSyncEvents: ["pull_request", "issues"],

  buildProviderConfig: ({ defaultSyncEvents }) => ({
    provider: "github" as const,
    type: "repository" as const,
    sync: {
      events: [...defaultSyncEvents],
      autoSync: true,
    },
  }),

  // GitHub wire eventType maps 1:1 to event key (e.g., "push" → "push")
  resolveCategory: (eventType) => eventType,

  getBaseEventType: (sourceType) => {
    const dotIndex = sourceType.indexOf(".");
    if (dotIndex > 0) {
      const base = sourceType.substring(0, dotIndex);
      const configBase = base.replace(/-/g, "_");
      return configBase === "issue" ? "issues" : configBase;
    }
    return sourceType;
  },

  deriveObservationType: (sourceType) => sourceType,

  api: githubApi,
  backfill: githubBackfill,

  healthCheck: {
    check: async (config, externalId, _accessToken) => {
      const jwt = await createGitHubAppJWT(config);
      const response = await fetch(
        `https://api.github.com/app/installations/${externalId}`,
        {
          method: "GET",
          signal: AbortSignal.timeout(10_000),
          headers: {
            Authorization: `Bearer ${jwt}`,
            Accept: "application/vnd.github+json",
            "User-Agent": "lightfast-platform",
            "X-GitHub-Api-Version": "2022-11-28",
          },
        }
      );
      if (response.status === 200) {
        return "healthy";
      }
      if (response.status === 404) {
        return "revoked";
      }
      throw new Error(`GitHub health check failed: ${response.status}`);
    },
  },

  resourcePicker: {
    installationMode: "multi",
    resourceLabel: "repositories",

    enrichInstallation: async (executeApi, inst) => {
      try {
        const res = await executeApi({
          endpointId: "get-app-installation",
          pathParams: { installation_id: inst.externalId },
        });
        const data = githubAppInstallationSchema.parse(res.data);
        return {
          id: inst.id,
          externalId: inst.externalId,
          label: data.account?.login ?? inst.externalId,
          avatarUrl: data.account?.avatar_url ?? null,
        };
      } catch {
        return {
          id: inst.id,
          externalId: inst.externalId,
          label: inst.externalId,
          avatarUrl: null,
        };
      }
    },

    listResources: async (executeApi) => {
      const res = await executeApi({
        endpointId: "list-installation-repos",
        queryParams: { per_page: "100" },
      });
      const data = githubInstallationReposSchema.parse(res.data);
      return (data.repositories ?? []).map((r) => ({
        id: String(r.id),
        name: r.full_name ?? r.name,
        subtitle: r.description ?? null,
        badge: r.private ? "Private" : null,
      }));
    },
  },

  edgeRules: [
    // GitHub commit deploys to Vercel deployment (entity co-occurrence)
    {
      refType: "commit",
      matchProvider: "vercel",
      matchRefType: "deployment",
      relationshipType: "deploys",
      confidence: 1.0,
    },
    // GitHub issue fixes another issue (self-referential, from extractLinkedIssues)
    {
      refType: "issue",
      selfLabel: "fixes",
      matchProvider: "*",
      matchRefType: "issue",
      relationshipType: "fixes",
      confidence: 1.0,
    },
    // GitHub issue references another issue
    {
      refType: "issue",
      matchProvider: "*",
      matchRefType: "issue",
      relationshipType: "references",
      confidence: 0.8,
    },
  ],

  envSchema: {
    GITHUB_APP_SLUG: z.string().min(1),
    GITHUB_APP_ID: z.string().min(1),
    GITHUB_APP_PRIVATE_KEY: z.string().min(1),
    GITHUB_CLIENT_ID: z.string().min(1),
    GITHUB_CLIENT_SECRET: z.string().min(1),
    GITHUB_WEBHOOK_SECRET: z.string().default(""),
  },
  createConfig: (env, _runtime) =>
    githubConfigSchema.parse({
      appSlug: env.GITHUB_APP_SLUG,
      appId: env.GITHUB_APP_ID,
      privateKey: env.GITHUB_APP_PRIVATE_KEY,
      clientId: env.GITHUB_CLIENT_ID,
      clientSecret: env.GITHUB_CLIENT_SECRET,
      webhookSecret: env.GITHUB_WEBHOOK_SECRET ?? "",
    }),
});
