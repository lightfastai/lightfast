import { env } from "../env";
import { computeHmacSha1, timingSafeEqual } from "../lib/crypto";
import { vercelOAuthResponseSchema, vercelWebhookPayloadSchema } from "./schemas";
import type { VercelWebhookPayload } from "./schemas";
import type { ConnectionProvider, OAuthTokens, WebhookPayload } from "./types";

const SIGNATURE_HEADER = "x-vercel-signature";
const DELIVERY_HEADER = "x-vercel-id";

export class VercelProvider implements ConnectionProvider {
  readonly name = "vercel" as const;
  readonly requiresWebhookRegistration = false as const;

  getAuthorizationUrl(state: string): string {
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

    const response = await fetch(
      "https://api.vercel.com/v2/oauth/access_token",
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: body.toString(),
      },
    );

    if (!response.ok) {
      throw new Error(`Vercel token exchange failed: ${response.status}`);
    }

    const rawData: unknown = await response.json();
    const data = vercelOAuthResponseSchema.parse(rawData);

    return {
      accessToken: data.access_token,
      tokenType: data.token_type,
      scope: data.scope,
      raw: rawData as Record<string, unknown>,
    };
  }

  refreshToken(_refreshToken: string): Promise<OAuthTokens> {
    return Promise.reject(new Error("Vercel tokens do not support refresh"));
  }

  async revokeToken(accessToken: string): Promise<void> {
    const response = await fetch(
      "https://api.vercel.com/v2/oauth/tokens/revoke",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      },
    );

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

    const expectedSig = await computeHmacSha1(payload, secret);
    return timingSafeEqual(signature, expectedSig);
  }

  parsePayload(raw: unknown): VercelWebhookPayload {
    return vercelWebhookPayloadSchema.parse(raw);
  }

  extractDeliveryId(headers: Headers, payload: WebhookPayload): string {
    const headerId = headers.get(DELIVERY_HEADER);
    if (headerId) return headerId;

    const p = payload as VercelWebhookPayload;
    if (p.id) return p.id;

    return crypto.randomUUID();
  }

  extractEventType(_headers: Headers, payload: WebhookPayload): string {
    const p = payload as VercelWebhookPayload;
    return p.type ?? "unknown";
  }

  extractResourceId(payload: WebhookPayload): string | null {
    const p = payload as VercelWebhookPayload;
    const projectId = p.payload?.project?.id;
    if (projectId != null) return String(projectId);

    const teamId = p.payload?.team?.id;
    if (teamId != null) return String(teamId);

    return null;
  }
}
