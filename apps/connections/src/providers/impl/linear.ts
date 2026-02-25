import { eq } from "drizzle-orm";
import { gwInstallations, gwTokens } from "@db/console/schema";
import type { GwInstallation } from "@db/console/schema";
import { db } from "@db/console/client";
import { nanoid } from "@repo/lib";
import type { Context } from "hono";
import { env } from "../../env";
import { connectionsBaseUrl, gatewayBaseUrl, notifyBackfillService } from "../../lib/urls";
import { decrypt } from "../../lib/crypto";
import { writeTokenRecord } from "../../lib/token-store";
import { linearOAuthResponseSchema } from "../schemas";
import type {
  ConnectionProvider,
  LinearAuthOptions,
  TokenResult,
  OAuthTokens,
  CallbackResult,
} from "../types";

export class LinearProvider implements ConnectionProvider {
  readonly name = "linear" as const;
  readonly requiresWebhookRegistration = true as const;

  getAuthorizationUrl(state: string, options?: LinearAuthOptions): string {
    const url = new URL("https://linear.app/oauth/authorize");
    url.searchParams.set("client_id", env.LINEAR_CLIENT_ID);
    url.searchParams.set(
      "redirect_uri",
      `${connectionsBaseUrl}/connections/linear/callback`,
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

  /**
   * Fetch the viewer's organization ID from the Linear API.
   * Returns the org ID or the viewer's own ID as a stable external identifier.
   */
  private async fetchLinearExternalId(accessToken: string): Promise<string> {
    const response = await fetch("https://api.linear.app/graphql", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        query: `{ viewer { id organization { id } } }`,
      }),
    });

    if (!response.ok) {
      throw new Error(`Linear viewer query failed: ${response.status}`);
    }

    const result = (await response.json()) as {
      data?: { viewer?: { id: string; organization?: { id: string } } };
    };

    const orgId = result.data?.viewer?.organization?.id;
    if (orgId) return orgId;

    const viewerId = result.data?.viewer?.id;
    if (viewerId) return viewerId;

    throw new Error("Linear API did not return a viewer or organization ID");
  }

  async handleCallback(
    c: Context,
    stateData: Record<string, string>,
  ): Promise<CallbackResult> {
    const code = c.req.query("code");
    if (!code) throw new Error("missing code");

    const redirectUri = `${connectionsBaseUrl}/connections/${this.name}/callback`;
    const oauthTokens = await this.exchangeCode(code, redirectUri);

    const externalId = await this.fetchLinearExternalId(oauthTokens.accessToken);
    const accountInfo = this.buildAccountInfo(stateData, oauthTokens);
    const now = new Date().toISOString();

    // Idempotent upsert keyed on unique (provider, externalId) constraint
    const rows = await db
      .insert(gwInstallations)
      .values({
        provider: this.name,
        externalId,
        connectedBy: stateData.connectedBy ?? "unknown",
        orgId: stateData.orgId ?? "",
        status: "active",
        providerAccountInfo: accountInfo,
      })
      .onConflictDoUpdate({
        target: [gwInstallations.provider, gwInstallations.externalId],
        set: {
          status: "active",
          connectedBy: stateData.connectedBy ?? "unknown",
          orgId: stateData.orgId ?? "",
          providerAccountInfo: accountInfo,
          updatedAt: now,
        },
      })
      .returning({
        id: gwInstallations.id,
        createdAt: gwInstallations.createdAt,
      });

    const installation = rows[0];
    if (!installation) throw new Error("upsert_failed");

    await writeTokenRecord(installation.id, oauthTokens);

    const reactivated = installation.createdAt !== now;

    // Register webhook only for new connections (Linear requires API-level webhook registration)
    // CRITICAL: webhook callback URL must point at the gateway, not the connections service
    if (!reactivated) {
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
            status: "error",
            metadata: {
              webhookRegistrationError:
                err instanceof Error ? err.message : "unknown",
            } as Record<string, unknown>,
            updatedAt: new Date().toISOString(),
          })
          .where(eq(gwInstallations.id, installation.id));
      }

      // Notify backfill service for new connections (fire-and-forget)
      notifyBackfillService({
        installationId: installation.id,
        provider: this.name,
        orgId: stateData.orgId ?? "",
      }).catch(() => {});
    }

    return {
      status: "connected",
      installationId: installation.id,
      provider: this.name,
      ...(reactivated && { reactivated: true }),
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
