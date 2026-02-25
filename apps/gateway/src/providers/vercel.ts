import { env } from "../env";
import { computeHmacSha1, timingSafeEqual } from "../lib/crypto";
import type { ConnectionProvider, OAuthTokens, ProviderOptions } from "./types";

const SIGNATURE_HEADER = "x-vercel-signature";
const DELIVERY_HEADER = "x-vercel-id";

export class VercelProvider implements ConnectionProvider {
  readonly name = "vercel";
  readonly requiresWebhookRegistration = false;

  getAuthorizationUrl(state: string, _options?: ProviderOptions): string {
    const url = new URL(
      `https://vercel.com/integrations/${env.VERCEL_INTEGRATION_SLUG}/new`,
    );
    url.searchParams.set("state", state);
    return url.toString();
  }

  async exchangeCode(code: string, redirectUri: string): Promise<OAuthTokens> {
    const body = new URLSearchParams({
      client_id: env.VERCEL_CLIENT_SECRET_ID,
      client_secret: env.VERCEL_CLIENT_INTEGRATION_SECRET,
      code,
      redirect_uri: redirectUri,
    });

    const response = await fetch("https://api.vercel.com/v2/oauth/access_token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });

    if (!response.ok) {
      throw new Error(`Vercel token exchange failed: ${response.status}`);
    }

    const data = (await response.json()) as Record<string, unknown>;

    return {
      accessToken: data.access_token as string,
      tokenType: data.token_type as string | undefined,
      scope: data.scope as string | undefined,
      raw: data,
    };
  }

  refreshToken(_refreshToken: string): Promise<OAuthTokens> {
    // Vercel integration tokens don't expire
    return Promise.reject(new Error("Vercel tokens do not support refresh"));
  }

  async revokeToken(accessToken: string): Promise<void> {
    const response = await fetch("https://api.vercel.com/v2/oauth/tokens/revoke", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok && response.status !== 204) {
      throw new Error(`Vercel token revocation failed: ${response.status}`);
    }
  }

  async verifyWebhook(
    payload: string,
    headers: Headers,
    secret: string,
  ): Promise<boolean> {
    const signature = headers.get(SIGNATURE_HEADER);
    if (!signature) return false;

    // Vercel uses HMAC-SHA1 with no prefix
    const expectedSig = await computeHmacSha1(payload, secret);
    return timingSafeEqual(signature, expectedSig);
  }

  extractDeliveryId(headers: Headers, payload: unknown): string {
    const headerId = headers.get(DELIVERY_HEADER);
    if (headerId) return headerId;

    // Fallback to payload id
    const p = payload as Record<string, unknown>;
    if (p.id && typeof p.id === "string") return p.id;

    return crypto.randomUUID();
  }

  extractEventType(_headers: Headers, payload: unknown): string {
    const p = payload as Record<string, unknown>;
    return (p.type as string | undefined) ?? "unknown";
  }

  extractResourceId(payload: unknown): string | null {
    const p = payload as Record<string, unknown>;
    const inner = p.payload as Record<string, unknown> | undefined;
    const project = inner?.project as Record<string, unknown> | undefined;
    const projectId = project?.id;
    if (projectId != null && (typeof projectId === "string" || typeof projectId === "number")) {
      return String(projectId);
    }

    // Fallback: team id
    const team = inner?.team as Record<string, unknown> | undefined;
    const teamId = team?.id;
    if (teamId != null && (typeof teamId === "string" || typeof teamId === "number")) {
      return String(teamId);
    }

    return null;
  }
}
