import { z } from "zod";
import { defineProvider, simpleEvent, actionEvent } from "../../define.js";
import { githubConfigSchema, githubAccountInfoSchema, githubOAuthResponseSchema } from "./auth.js";
import type { GitHubConfig, GitHubAccountInfo, GitHubInstallationRaw } from "./auth.js";
import type { OAuthTokens, CallbackResult } from "../../types.js";
import { computeHmac, timingSafeEqual } from "../../crypto.js";
import { createRS256JWT } from "../../jwt.js";
import {
  preTransformGitHubPushEventSchema,
  preTransformGitHubPullRequestEventSchema,
  preTransformGitHubIssuesEventSchema,
  preTransformGitHubReleaseEventSchema,
  preTransformGitHubDiscussionEventSchema,
  githubWebhookPayloadSchema,
} from "./schemas.js";
import {
  transformGitHubPush,
  transformGitHubPullRequest,
  transformGitHubIssue,
  transformGitHubRelease,
  transformGitHubDiscussion,
} from "./transformers.js";

// ── GitHub-Specific Capabilities ──

async function createGitHubAppJWT(config: GitHubConfig): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  return createRS256JWT(
    { iss: config.appId, iat: now - 60, exp: now + 600 },
    config.privateKey,
  );
}

async function getInstallationToken(config: GitHubConfig, installationId: string): Promise<string> {
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
        "User-Agent": "lightfast-gateway",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    },
  );
  if (!response.ok) {
    throw new Error(`GitHub installation token request failed: ${response.status}`);
  }

  const data = (await response.json()) as Record<string, unknown>;
  if (typeof data.token !== "string" || data.token.length === 0) {
    throw new Error("GitHub installation token response missing valid token");
  }
  return data.token;
}

async function getInstallationDetails(
  config: GitHubConfig,
  installationId: string,
): Promise<GitHubInstallationRaw> {
  if (!/^\d+$/.test(installationId)) {
    throw new Error("Invalid GitHub installation ID: must be numeric");
  }

  const jwt = await createGitHubAppJWT(config);
  const response = await fetch(
    `https://api.github.com/app/installations/${installationId}`,
    {
      method: "GET",
      signal: AbortSignal.timeout(10_000),
      headers: {
        Authorization: `Bearer ${jwt}`,
        Accept: "application/vnd.github+json",
        "User-Agent": "lightfast-gateway",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    },
  );
  if (!response.ok) {
    throw new Error(`GitHub installation details fetch failed: ${response.status}`);
  }

  const data = (await response.json()) as Record<string, unknown>;
  const account = data.account as Record<string, unknown> | null;
  if (!account || typeof account.login !== "string") {
    throw new Error("GitHub installation response missing account data");
  }

  return {
    account: {
      login: account.login,
      id: account.id as number,
      type: account.type === "User" ? "User" : "Organization",
      avatar_url: (account.avatar_url as string | undefined) ?? "",
    },
    permissions: (data.permissions as Record<string, string> | undefined) ?? {},
    events: (data.events as string[] | undefined) ?? [],
    created_at: (data.created_at as string | undefined) ?? new Date().toISOString(),
  };
}

// ── Provider Definition ──

export const github = defineProvider({
  name: "github",
  displayName: "GitHub",
  description: "Connect your GitHub repositories",
  configSchema: githubConfigSchema,
  accountInfoSchema: githubAccountInfoSchema,
  resourceMetaSchema: z.object({ fullName: z.string().optional() }),

  categories: {
    push: { label: "Push", description: "Sync files and capture observations when code is pushed", type: "sync+observation" },
    pull_request: { label: "Pull Requests", description: "Capture PR opens, merges, closes, and reopens", type: "observation" },
    issues: { label: "Issues", description: "Capture issue opens, closes, and reopens", type: "observation" },
    release: { label: "Releases", description: "Capture published releases", type: "observation" },
    discussion: { label: "Discussions", description: "Capture discussion threads and answers", type: "observation" },
  },

  events: {
    push: simpleEvent({ label: "Push", weight: 30, schema: preTransformGitHubPushEventSchema, transform: transformGitHubPush }),
    pull_request: actionEvent({
      label: "Pull Requests", weight: 50, schema: preTransformGitHubPullRequestEventSchema, transform: transformGitHubPullRequest,
      actions: {
        opened: { label: "PR Opened", weight: 50 },
        closed: { label: "PR Closed", weight: 45 },
        merged: { label: "PR Merged", weight: 60 },
        reopened: { label: "PR Reopened", weight: 40 },
        "ready-for-review": { label: "Ready for Review", weight: 45 },
      },
    }),
    issues: actionEvent({
      label: "Issues", weight: 45, schema: preTransformGitHubIssuesEventSchema, transform: transformGitHubIssue,
      actions: {
        opened: { label: "Issue Opened", weight: 45 },
        closed: { label: "Issue Closed", weight: 40 },
        reopened: { label: "Issue Reopened", weight: 40 },
      },
    }),
    release: actionEvent({
      label: "Releases", weight: 75, schema: preTransformGitHubReleaseEventSchema, transform: transformGitHubRelease,
      actions: {
        published: { label: "Release Published", weight: 75 },
        created: { label: "Release Created", weight: 70 },
      },
    }),
    discussion: actionEvent({
      label: "Discussions", weight: 35, schema: preTransformGitHubDiscussionEventSchema, transform: transformGitHubDiscussion,
      actions: {
        created: { label: "Discussion Created", weight: 35 },
        answered: { label: "Discussion Answered", weight: 40 },
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
    verifySignature: (rawBody, headers, secret) => {
      const sig = headers.get("x-hub-signature-256");
      if (!sig) return false;
      const received = sig.startsWith("sha256=") ? sig.slice(7) : sig;
      const expected = computeHmac(rawBody, secret, "SHA-256");
      return timingSafeEqual(received, expected);
    },
    extractEventType: (headers) => headers.get("x-github-event") ?? "unknown",
    extractDeliveryId: (headers) => headers.get("x-github-delivery") ?? crypto.randomUUID(),
    extractResourceId: (payload) => {
      const p = payload as { repository?: { id: number | string }; installation?: { id: number | string } };
      if (p.repository?.id != null) return String(p.repository.id);
      if (p.installation?.id != null) return String(p.installation.id);
      return null;
    },
    parsePayload: (raw) => githubWebhookPayloadSchema.parse(raw),
  },

  oauth: {
    buildAuthUrl: (config, state) => {
      const url = new URL(`https://github.com/apps/${config.appSlug}/installations/new`);
      url.searchParams.set("state", state);
      return url.toString();
    },
    exchangeCode: async (config, code, redirectUri) => {
      const response = await fetch("https://github.com/login/oauth/access_token", {
        method: "POST",
        signal: AbortSignal.timeout(15_000),
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          client_id: config.clientId,
          client_secret: config.clientSecret,
          code,
          redirect_uri: redirectUri,
        }),
      });
      if (!response.ok) throw new Error(`GitHub token exchange failed: ${response.status}`);
      const data = githubOAuthResponseSchema.parse(await response.json());
      if ("error" in data) throw new Error(`GitHub OAuth error: ${data.error_description}`);
      return {
        accessToken: data.access_token,
        scope: data.scope,
        tokenType: data.token_type,
        raw: data as Record<string, unknown>,
      } satisfies OAuthTokens;
    },
    refreshToken: (): Promise<OAuthTokens> => {
      return Promise.reject(new Error("GitHub user tokens do not support refresh"));
    },
    revokeToken: async (config, accessToken) => {
      const credentials = btoa(`${config.clientId}:${config.clientSecret}`);
      const response = await fetch(`https://api.github.com/applications/${config.clientId}/token`, {
        method: "DELETE",
        signal: AbortSignal.timeout(15_000),
        headers: {
          Authorization: `Basic ${credentials}`,
          "Content-Type": "application/json",
          Accept: "application/vnd.github.v3+json",
        },
        body: JSON.stringify({ access_token: accessToken }),
      });
      if (!response.ok) throw new Error(`GitHub token revocation failed: ${response.status}`);
    },
    usesStoredToken: false,
    getActiveToken: async (config, storedExternalId, _storedAccessToken) => {
      return getInstallationToken(config, storedExternalId);
    },
    processCallback: async (config, query) => {
      const installationId = query.installation_id;
      const setupAction = query.setup_action;

      if (setupAction === "request") throw new Error("setup_action=request is not yet implemented");
      if (setupAction === "update") throw new Error("setup_action=update is not yet implemented");
      if (!installationId) throw new Error("missing installation_id");

      const details = await getInstallationDetails(config, installationId);
      return {
        status: "connected-no-token",
        externalId: installationId,
        accountInfo: {
          version: 1 as const,
          sourceType: "github" as const,
          events: details.events,
          installedAt: details.created_at,
          lastValidatedAt: new Date().toISOString(),
          raw: details,
        },
      } satisfies CallbackResult<GitHubAccountInfo>;
    },
  },

  defaultSyncEvents: ["push", "pull_request", "issues", "release", "discussion"],

  buildProviderConfig: ({ resourceId, installationExternalId, defaultSyncEvents }) => ({
    version: 1 as const,
    sourceType: "github" as const,
    type: "repository" as const,
    installationId: installationExternalId,
    repoId: resourceId,
    sync: {
      branches: ["main"],
      paths: ["**/*"],
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

  envSchema: {
    GITHUB_APP_SLUG: z.string().min(1),
    GITHUB_APP_ID: z.string().min(1),
    GITHUB_APP_PRIVATE_KEY: z.string().min(1),
    GITHUB_CLIENT_ID: z.string().min(1),
    GITHUB_CLIENT_SECRET: z.string().min(1),
    GITHUB_WEBHOOK_SECRET: z.string().default(""),
  },
  createConfig: (env, _runtime) => githubConfigSchema.parse({
    appSlug: env.GITHUB_APP_SLUG,
    appId: env.GITHUB_APP_ID,
    privateKey: env.GITHUB_APP_PRIVATE_KEY,
    clientId: env.GITHUB_CLIENT_ID,
    clientSecret: env.GITHUB_CLIENT_SECRET,
    webhookSecret: env.GITHUB_WEBHOOK_SECRET ?? "",
  }),
});
