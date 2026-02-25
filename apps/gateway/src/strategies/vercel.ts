import { eq } from "drizzle-orm";
import { gwInstallations, gwTokens } from "@db/console/schema";
import type { GwInstallation } from "@db/console/schema";
import { db } from "@db/console/client";
import { nanoid } from "@repo/lib";
import type { Context } from "hono";
import type { ConnectionProvider, OAuthTokens } from "../providers/types";
import { decrypt } from "../lib/crypto";
import { env } from "../env";
import { gatewayBaseUrl } from "../lib/base-url";
import { writeTokenRecord } from "../lib/token-store";
import { notifyBackfillService } from "../lib/backfill-notify";
import type { CallbackResult, ConnectionStrategy, TokenResult } from "./types";

export class VercelStrategy implements ConnectionStrategy {
  async handleCallback(
    c: Context,
    provider: ConnectionProvider,
    stateData: Record<string, string>,
  ): Promise<CallbackResult> {
    const code = c.req.query("code");
    if (!code) throw new Error("missing code");

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

    if (tokenRow.expiresAt && new Date(tokenRow.expiresAt) < new Date()) {
      throw new Error("token_expired");
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
    stateData: Record<string, string>,
    oauthTokens?: OAuthTokens,
  ): GwInstallation["providerAccountInfo"] {
    const raw = oauthTokens?.raw ?? {};
    const externalId =
      (raw.team_id as string | undefined)?.toString() ??
      (raw.organization_id as string | undefined)?.toString() ??
      (raw.installation as string | undefined)?.toString() ??
      "";

    return {
      version: 1,
      sourceType: "vercel",
      userId: stateData.connectedBy ?? "unknown",
      teamId: (raw.team_id as string | undefined) ?? undefined,
      teamSlug: (raw.team_slug as string | undefined) ?? undefined,
      configurationId: externalId,
    };
  }
}
