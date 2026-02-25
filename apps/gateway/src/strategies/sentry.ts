import { eq } from "drizzle-orm";
import { gwInstallations, gwTokens } from "@db/console/schema";
import type { GwInstallation } from "@db/console/schema";
import { db } from "@db/console/client";
import { nanoid } from "@repo/lib";
import type { Context } from "hono";
import type { ConnectionProvider, OAuthTokens, WebhookRegistrant } from "../providers/types";
import { decrypt } from "../lib/crypto";
import { env } from "../env";
import { gatewayBaseUrl } from "../lib/base-url";
import { writeTokenRecord, updateTokenRecord } from "../lib/token-store";
import { notifyBackfillService } from "../lib/backfill-notify";
import type { CallbackResult, ConnectionStrategy, TokenResult } from "./types";

export class SentryStrategy implements ConnectionStrategy {
  async handleCallback(
    c: Context,
    provider: ConnectionProvider,
    stateData: Record<string, string>,
  ): Promise<CallbackResult> {
    const code = c.req.query("code");
    if (!code) throw new Error("missing code");

    // Sentry's exchangeCode handles the composite installationId:authCode internally
    const redirectUri = `${gatewayBaseUrl}/connections/${provider.name}/callback`;
    const oauthTokens = await provider.exchangeCode(code, redirectUri);

    const externalId =
      (oauthTokens.raw.team_id as string | undefined)?.toString() ??
      (oauthTokens.raw.organization_id as string | undefined)?.toString() ??
      (oauthTokens.raw.installation as string | undefined)?.toString() ??
      nanoid();

    const rows = await db
      .insert(gwInstallations)
      .values({
        provider: provider.name,
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

    // Sentry requiresWebhookRegistration but deregistration is a no-op (registered in Sentry config)
    if (provider.requiresWebhookRegistration) {
      const registrant = provider as WebhookRegistrant;
      const webhookSecret = nanoid(32);
      const callbackUrl = `${gatewayBaseUrl}/webhooks/${provider.name}`;

      try {
        const webhookId = await registrant.registerWebhook(
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
    }

    // Notify backfill service for new connections (non-blocking)
    await notifyBackfillService({
      installationId: installation.id,
      provider: provider.name,
      orgId: stateData.orgId ?? "",
    });

    return {
      status: "connected",
      installationId: installation.id,
      provider: provider.name,
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

    // Check expiry and refresh if needed (Sentry supports token refresh)
    if (tokenRow.expiresAt && new Date(tokenRow.expiresAt) < new Date()) {
      if (!tokenRow.refreshToken) {
        throw new Error("token_expired:no_refresh_token");
      }

      const { getProvider } = await import("../providers");
      const provider = getProvider("sentry");
      const decryptedRefresh = await decrypt(tokenRow.refreshToken, env.ENCRYPTION_KEY);
      const refreshed = await provider.refreshToken(decryptedRefresh);

      await updateTokenRecord(tokenRow.id, refreshed, tokenRow.refreshToken);

      return {
        accessToken: refreshed.accessToken,
        provider: installation.provider,
        expiresIn: refreshed.expiresIn ?? null,
      };
    }

    const decryptedToken = await decrypt(tokenRow.accessToken, env.ENCRYPTION_KEY);
    return {
      accessToken: decryptedToken,
      provider: installation.provider,
      expiresIn: tokenRow.expiresAt
        ? Math.floor((new Date(tokenRow.expiresAt).getTime() - Date.now()) / 1000)
        : null,
    };
  }

  buildAccountInfo(
    _stateData: Record<string, string>,
    _oauthTokens?: OAuthTokens,
  ): GwInstallation["providerAccountInfo"] {
    return { version: 1, sourceType: "sentry" };
  }
}
