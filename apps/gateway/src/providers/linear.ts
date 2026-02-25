import { env } from "../env";
import { computeHmacSha256, timingSafeEqual } from "../lib/crypto";
import type { ConnectionProvider, OAuthTokens, ProviderOptions } from "./types";

const SIGNATURE_HEADER = "linear-signature";
const DELIVERY_HEADER = "linear-delivery";

export class LinearProvider implements ConnectionProvider {
  readonly name = "linear";
  readonly requiresWebhookRegistration = true;

  getAuthorizationUrl(state: string, options?: ProviderOptions): string {
    const url = new URL("https://linear.app/oauth/authorize");
    url.searchParams.set("client_id", env.LINEAR_CLIENT_ID);
    url.searchParams.set("redirect_uri", `${env.GATEWAY_BASE_URL}/connections/linear/callback`);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", options?.scopes?.join(",") ?? "read,write");
    url.searchParams.set("state", state);
    return url.toString();
  }

  async exchangeCode(code: string, redirectUri: string): Promise<OAuthTokens> {
    const response = await fetch("https://api.linear.app/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: env.LINEAR_CLIENT_ID,
        client_secret: env.LINEAR_CLIENT_SECRET,
        redirect_uri: redirectUri,
        code,
        grant_type: "authorization_code",
      }).toString(),
    });

    if (!response.ok) {
      throw new Error(`Linear token exchange failed: ${response.status}`);
    }

    const data = (await response.json()) as Record<string, unknown>;

    return {
      accessToken: data.access_token as string,
      tokenType: data.token_type as string | undefined,
      scope: data.scope as string | undefined,
      expiresIn: data.expires_in as number | undefined,
      raw: data,
    };
  }

  refreshToken(_refreshToken: string): Promise<OAuthTokens> {
    // Linear uses long-lived tokens
    return Promise.reject(new Error("Linear tokens do not support refresh"));
  }

  async revokeToken(accessToken: string): Promise<void> {
    const response = await fetch("https://api.linear.app/oauth/revoke", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok && response.status !== 204) {
      throw new Error(`Linear token revocation failed: ${response.status}`);
    }
  }

  async verifyWebhook(
    payload: string,
    headers: Headers,
    secret: string,
  ): Promise<boolean> {
    const signature = headers.get(SIGNATURE_HEADER);
    if (!signature) return false;

    const expectedSig = await computeHmacSha256(payload, secret);
    return timingSafeEqual(signature, expectedSig);
  }

  extractDeliveryId(headers: Headers, _payload: unknown): string {
    return headers.get(DELIVERY_HEADER) ?? crypto.randomUUID();
  }

  extractEventType(_headers: Headers, payload: unknown): string {
    const p = payload as Record<string, unknown>;
    const type = p.type as string | undefined;
    const action = p.action as string | undefined;
    if (type && action) return `${type}:${action}`;
    return type ?? "unknown";
  }

  extractResourceId(payload: unknown): string | null {
    const p = payload as Record<string, unknown>;
    if (p.organizationId && typeof p.organizationId === "string") {
      return p.organizationId;
    }
    return null;
  }

  async registerWebhook(
    _connectionId: string,
    callbackUrl: string,
    secret: string,
  ): Promise<string> {
    const mutation = `
      mutation WebhookCreate($input: WebhookCreateInput!) {
        webhookCreate(input: $input) {
          success
          webhook {
            id
          }
        }
      }
    `;

    const response = await fetch("https://api.linear.app/graphql", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // Token will be passed via env or per-connection context;
        // for now use the client secret for app-level auth
        Authorization: `Bearer ${env.LINEAR_CLIENT_SECRET}`,
      },
      body: JSON.stringify({
        query: mutation,
        variables: {
          input: {
            url: callbackUrl,
            secret,
            resourceTypes: [
              "Issue",
              "Comment",
              "IssueLabel",
              "Project",
              "Cycle",
            ],
          },
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Linear webhook registration failed: ${response.status}`);
    }

    const result = (await response.json()) as {
      data?: { webhookCreate?: { success: boolean; webhook?: { id: string } } };
      errors?: unknown[];
    };

    if (result.errors?.length) {
      throw new Error(`Linear webhook registration error: ${JSON.stringify(result.errors)}`);
    }

    const webhookId = result.data?.webhookCreate?.webhook?.id;
    if (!webhookId) {
      throw new Error("Linear webhook registration did not return an ID");
    }

    return webhookId;
  }

  async deregisterWebhook(
    _connectionId: string,
    webhookId: string,
  ): Promise<void> {
    const mutation = `
      mutation WebhookDelete($id: String!) {
        webhookDelete(id: $id) {
          success
        }
      }
    `;

    const response = await fetch("https://api.linear.app/graphql", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.LINEAR_CLIENT_SECRET}`,
      },
      body: JSON.stringify({
        query: mutation,
        variables: { id: webhookId },
      }),
    });

    if (!response.ok) {
      throw new Error(
        `Linear webhook deregistration failed: ${response.status}`,
      );
    }
  }
}
