import { z } from "zod";
import { defineProvider, defineEvent } from "../define.js";
import { githubConfigSchema } from "../types.js";
import type { GitHubConfig, OAuthTokens, CallbackResult } from "../types.js";
import { computeHmac, timingSafeEqual } from "../crypto.js";
import { createRS256JWT } from "../jwt.js";
import {
  preTransformGitHubPushEventSchema,
  preTransformGitHubPullRequestEventSchema,
  preTransformGitHubIssuesEventSchema,
  preTransformGitHubReleaseEventSchema,
  preTransformGitHubDiscussionEventSchema,
  githubWebhookPayloadSchema,
} from "../schemas/github.js";
import {
  transformGitHubPush,
  transformGitHubPullRequest,
  transformGitHubIssue,
  transformGitHubRelease,
  transformGitHubDiscussion,
} from "../transformers/github.js";

// ── OAuth Response Schema ──

const githubOAuthResponseSchema = z.union([
  z.object({ access_token: z.string(), token_type: z.string(), scope: z.string() }),
  z.object({ error: z.string(), error_description: z.string(), error_uri: z.string() }),
]);

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
): Promise<{
  account: { login: string; id: number; type: string; avatar_url: string };
  permissions: Record<string, string>;
  events: string[];
  created_at: string;
}> {
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

export const github = defineProvider<GitHubConfig>({
  name: "github",
  displayName: "GitHub",
  description: "Connect your GitHub repositories",
  configSchema: githubConfigSchema,

  categories: {
    push: { label: "Push", description: "Sync files and capture observations when code is pushed", type: "sync+observation" },
    pull_request: { label: "Pull Requests", description: "Capture PR opens, merges, closes, and reopens", type: "observation" },
    issues: { label: "Issues", description: "Capture issue opens, closes, and reopens", type: "observation" },
    release: { label: "Releases", description: "Capture published releases", type: "observation" },
    discussion: { label: "Discussions", description: "Capture discussion threads and answers", type: "observation" },
  },

  events: {
    push: defineEvent({ label: "Push", weight: 30, schema: preTransformGitHubPushEventSchema, transform: transformGitHubPush }),
    pull_request: defineEvent({ label: "Pull Requests", weight: 50, schema: preTransformGitHubPullRequestEventSchema, transform: transformGitHubPullRequest }),
    issues: defineEvent({ label: "Issues", weight: 45, schema: preTransformGitHubIssuesEventSchema, transform: transformGitHubIssue }),
    release: defineEvent({ label: "Releases", weight: 75, schema: preTransformGitHubReleaseEventSchema, transform: transformGitHubRelease }),
    discussion: defineEvent({ label: "Discussions", weight: 35, schema: preTransformGitHubDiscussionEventSchema, transform: transformGitHubDiscussion }),
  },

  webhook: {
    extractSecret: (config) => config.webhookSecret,
    verifySignature: async (rawBody, headers, secret) => {
      const sig = headers.get("x-hub-signature-256");
      if (!sig) return false;
      const received = sig.startsWith("sha256=") ? sig.slice(7) : sig;
      const expected = await computeHmac(rawBody, secret, "SHA-256");
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
    processCallback: async (config, query) => {
      const installationId = query.installation_id;
      const setupAction = query.setup_action;

      if (setupAction === "request") throw new Error("setup_action=request is not yet implemented");
      if (setupAction === "update") throw new Error("setup_action=update is not yet implemented");
      if (!installationId) throw new Error("missing installation_id");

      const details = await getInstallationDetails(config, installationId);
      return {
        externalId: installationId,
        accountInfo: {
          version: 1 as const,
          sourceType: "github" as const,
          events: details.events,
          installedAt: details.created_at,
          lastValidatedAt: new Date().toISOString(),
          raw: details,
        },
        setupAction,
      } satisfies CallbackResult;
    },
  },

  capabilities: {
    createAppJWT: (config: unknown) => createGitHubAppJWT(config as GitHubConfig),
    getInstallationToken: (config: unknown, installationId: unknown) =>
      getInstallationToken(config as GitHubConfig, installationId as string),
    getInstallationDetails: (config: unknown, installationId: unknown) =>
      getInstallationDetails(config as GitHubConfig, installationId as string),
  },
});
