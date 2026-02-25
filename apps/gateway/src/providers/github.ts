import { env } from "../env";
import { gatewayBaseUrl } from "../lib/base-url";
import { computeHmacSha256, timingSafeEqual } from "../lib/crypto";
import {
  githubOAuthResponseSchema,
  githubWebhookPayloadSchema,
} from "./schemas";
import type { GitHubWebhookPayload } from "./schemas";
import type {
  ConnectionProvider,
  GitHubAuthOptions,
  OAuthTokens,
  WebhookPayload,
} from "./types";

const SIGNATURE_HEADER = "x-hub-signature-256";
const DELIVERY_HEADER = "x-github-delivery";
const EVENT_HEADER = "x-github-event";
const SIGNATURE_PREFIX = "sha256=";

export class GitHubProvider implements ConnectionProvider {
  readonly name = "github" as const;
  readonly requiresWebhookRegistration = false as const;

  getAuthorizationUrl(state: string, options?: GitHubAuthOptions): string {
    const url = new URL("https://github.com/login/oauth/authorize");
    url.searchParams.set("client_id", env.GITHUB_CLIENT_ID);
    url.searchParams.set("state", state);
    if (options?.redirectPath) {
      const redirectUri = `${gatewayBaseUrl}/connections/github/callback`;
      url.searchParams.set("redirect_uri", redirectUri);
    }
    return url.toString();
  }

  /** Build GitHub App installation URL (GitHub-specific, not on interface) */
  getInstallationUrl(state: string, targetId?: string): string {
    const url = new URL(
      `https://github.com/apps/${env.GITHUB_APP_SLUG}/installations/new`,
    );
    url.searchParams.set("state", state);
    if (targetId) url.searchParams.set("target_id", targetId);
    return url.toString();
  }

  async exchangeCode(code: string, redirectUri: string): Promise<OAuthTokens> {
    const response = await fetch(
      "https://github.com/login/oauth/access_token",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          client_id: env.GITHUB_CLIENT_ID,
          client_secret: env.GITHUB_CLIENT_SECRET,
          code,
          redirect_uri: redirectUri,
        }),
      },
    );

    if (!response.ok) {
      throw new Error(`GitHub token exchange failed: ${response.status}`);
    }

    const rawData: unknown = await response.json();
    const data = githubOAuthResponseSchema.parse(rawData);

    if (data.error) {
      const desc = data.error_description ?? data.error;
      throw new Error(`GitHub OAuth error: ${desc}`);
    }

    return {
      accessToken: data.access_token,
      scope: data.scope,
      tokenType: data.token_type,
      raw: rawData as Record<string, unknown>,
    };
  }

  refreshToken(_refreshToken: string): Promise<OAuthTokens> {
    return Promise.reject(
      new Error("GitHub user tokens do not support refresh"),
    );
  }

  async revokeToken(accessToken: string): Promise<void> {
    const credentials = Buffer.from(
      `${env.GITHUB_CLIENT_ID}:${env.GITHUB_CLIENT_SECRET}`,
    ).toString("base64");

    const response = await fetch(
      `https://api.github.com/applications/${env.GITHUB_CLIENT_ID}/token`,
      {
        method: "DELETE",
        headers: {
          Authorization: `Basic ${credentials}`,
          "Content-Type": "application/json",
          Accept: "application/vnd.github.v3+json",
        },
        body: JSON.stringify({ access_token: accessToken }),
      },
    );

    if (!response.ok && response.status !== 204) {
      throw new Error(`GitHub token revocation failed: ${response.status}`);
    }
  }

  async verifyWebhook(
    payload: string,
    headers: Headers,
    secret: string,
  ): Promise<boolean> {
    const signature = headers.get(SIGNATURE_HEADER);
    if (!signature) return false;

    const receivedSig = signature.startsWith(SIGNATURE_PREFIX)
      ? signature.slice(SIGNATURE_PREFIX.length)
      : signature;

    const expectedSig = await computeHmacSha256(payload, secret);
    return timingSafeEqual(receivedSig, expectedSig);
  }

  parsePayload(raw: unknown): GitHubWebhookPayload {
    return githubWebhookPayloadSchema.parse(raw);
  }

  extractDeliveryId(headers: Headers, _payload: WebhookPayload): string {
    return headers.get(DELIVERY_HEADER) ?? crypto.randomUUID();
  }

  extractEventType(headers: Headers, _payload: WebhookPayload): string {
    return headers.get(EVENT_HEADER) ?? "unknown";
  }

  extractResourceId(payload: WebhookPayload): string | null {
    const p = payload as GitHubWebhookPayload;
    const repoId = p.repository?.id;
    if (repoId != null) return String(repoId);

    const installId = p.installation?.id;
    if (installId != null) return String(installId);

    return null;
  }
}
