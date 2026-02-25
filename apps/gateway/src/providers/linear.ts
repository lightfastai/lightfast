import { eq } from "drizzle-orm";
import { gwInstallations, gwTokens } from "@db/console/schema";
import type { GwInstallation } from "@db/console/schema";
import { db } from "@db/console/client";
import { nanoid } from "@repo/lib";
import type { Context } from "hono";
import { env } from "../env";
import { gatewayBaseUrl, notifyBackfillService } from "../lib/urls";
import { computeHmacSha256, decrypt, timingSafeEqual } from "../lib/crypto";
import { writeTokenRecord } from "../lib/token-store";
import { linearOAuthResponseSchema, linearWebhookPayloadSchema } from "./schemas";
import type { LinearWebhookPayload } from "./schemas";
import type {
  UnifiedProvider,
  LinearAuthOptions,
  TokenResult,
  OAuthTokens,
  WebhookPayload,
  WebhookRegistrant,
  CallbackResult,
} from "./types";

const SIGNATURE_HEADER = "linear-signature";
const DELIVERY_HEADER = "linear-delivery";

export class LinearProvider implements UnifiedProvider, WebhookRegistrant {
  readonly name = "linear" as const;
  readonly requiresWebhookRegistration = true as const;

  getAuthorizationUrl(state: string, options?: LinearAuthOptions): string {
    const url = new URL("https://linear.app/oauth/authorize");
    url.searchParams.set("client_id", env.LINEAR_CLIENT_ID);
    url.searchParams.set(
      "redirect_uri",
      `${gatewayBaseUrl}/connections/linear/callback`,
    );
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

    const rawData: unknown = await response.json();
    const data = linearOAuthResponseSchema.parse(rawData);

    return {
      accessToken: data.access_token,
      tokenType: data.token_type,
      scope: data.scope,
      expiresIn: data.expires_in,
      raw: rawData as Record<string, unknown>,
    };
  }

  refreshToken(_refreshToken: string): Promise<OAuthTokens> {
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

  parsePayload(raw: unknown): LinearWebhookPayload {
    return linearWebhookPayloadSchema.parse(raw);
  }

  extractDeliveryId(headers: Headers, _payload: WebhookPayload): string {
    return headers.get(DELIVERY_HEADER) ?? crypto.randomUUID();
  }

  extractEventType(_headers: Headers, payload: WebhookPayload): string {
    const p = payload as LinearWebhookPayload;
    if (p.type && p.action) return `${p.type}:${p.action}`;
    return p.type ?? "unknown";
  }

  extractResourceId(payload: WebhookPayload): string | null {
    const p = payload as LinearWebhookPayload;
    return p.organizationId ?? null;
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
      throw new Error(
        `Linear webhook registration failed: ${response.status}`,
      );
    }

    const result = (await response.json()) as {
      data?: {
        webhookCreate?: { success: boolean; webhook?: { id: string } };
      };
      errors?: unknown[];
    };

    if (result.errors?.length) {
      throw new Error(
        `Linear webhook registration error: ${JSON.stringify(result.errors)}`,
      );
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

  // ── Strategy methods ──

  async handleCallback(
    c: Context,
    stateData: Record<string, string>,
  ): Promise<CallbackResult> {
    const code = c.req.query("code");
    if (!code) throw new Error("missing code");

    const redirectUri = `${gatewayBaseUrl}/connections/${this.name}/callback`;
    const oauthTokens = await this.exchangeCode(code, redirectUri);

    const externalId =
      (oauthTokens.raw.team_id as string | undefined)?.toString() ??
      (oauthTokens.raw.organization_id as string | undefined)?.toString() ??
      (oauthTokens.raw.installation as string | undefined)?.toString() ??
      nanoid();

    const rows = await db
      .insert(gwInstallations)
      .values({
        provider: this.name,
        externalId,
        connectedBy: stateData.connectedBy ?? "unknown",
        orgId: stateData.orgId ?? "",
        status: "active",
        providerAccountInfo: this.buildAccountInfo(stateData, oauthTokens),
      })
      .returning({ id: gwInstallations.id });

    const installation = rows[0];
    if (!installation) throw new Error("insert_failed");

    await writeTokenRecord(installation.id, oauthTokens);

    // Register webhook (Linear requires API-level webhook registration)
    const webhookSecret = nanoid(32);
    const callbackUrl = `${gatewayBaseUrl}/webhooks/${this.name}`;

    try {
      const webhookId = await this.registerWebhook(
        installation.id,
        callbackUrl,
        webhookSecret,
      );

      await db
        .update(gwInstallations)
        .set({
          webhookSecret,
          metadata: { webhookId } as Record<string, unknown>,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(gwInstallations.id, installation.id));
    } catch (err) {
      await db
        .update(gwInstallations)
        .set({
          metadata: {
            webhookRegistrationError:
              err instanceof Error ? err.message : "unknown",
          } as Record<string, unknown>,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(gwInstallations.id, installation.id));
    }

    // Notify backfill service for new connections (non-blocking)
    await notifyBackfillService({
      installationId: installation.id,
      provider: this.name,
      orgId: stateData.orgId ?? "",
    });

    return {
      status: "connected",
      installationId: installation.id,
      provider: this.name,
    };
  }

  async resolveToken(installation: GwInstallation): Promise<TokenResult> {
    const tokenRows = await db
      .select()
      .from(gwTokens)
      .where(eq(gwTokens.installationId, installation.id))
      .limit(1);

    const tokenRow = tokenRows[0];
    if (!tokenRow) throw new Error("no_token_found");

    if (tokenRow.expiresAt && new Date(tokenRow.expiresAt) < new Date()) {
      throw new Error("token_expired");
    }

    const decryptedToken = await decrypt(tokenRow.accessToken, env.ENCRYPTION_KEY);
    return {
      accessToken: decryptedToken,
      provider: this.name,
      expiresIn: tokenRow.expiresAt
        ? Math.floor((new Date(tokenRow.expiresAt).getTime() - Date.now()) / 1000)
        : null,
    };
  }

  buildAccountInfo(
    _stateData: Record<string, string>,
    _oauthTokens?: OAuthTokens,
  ): GwInstallation["providerAccountInfo"] {
    return { version: 1, sourceType: "linear" };
  }
}
