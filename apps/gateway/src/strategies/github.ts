import { and, eq } from "drizzle-orm";
import { gwInstallations } from "@db/console/schema";
import type { GwInstallation } from "@db/console/schema";
import { db } from "@db/console/client";
import type { Context } from "hono";
import type { ConnectionProvider, OAuthTokens } from "../providers/types";
import { getInstallationToken } from "../lib/github-jwt";
import { notifyBackfillService } from "../lib/backfill-notify";
import type { CallbackResult, ConnectionStrategy, TokenResult } from "./types";

export class GitHubStrategy implements ConnectionStrategy {
  async handleCallback(
    c: Context,
    _provider: ConnectionProvider,
    stateData: Record<string, string>,
  ): Promise<CallbackResult> {
    const installationId = c.req.query("installation_id");
    const setupAction = c.req.query("setup_action");

    if (!installationId) {
      throw new Error("missing installation_id");
    }

    // Upsert installation (idempotent)
    const existingRows = await db
      .select({ id: gwInstallations.id })
      .from(gwInstallations)
      .where(
        and(
          eq(gwInstallations.provider, "github"),
          eq(gwInstallations.externalId, installationId),
        ),
      )
      .limit(1);

    const existing = existingRows[0];

    const accountInfo = this.buildAccountInfo({ ...stateData, installationId });

    if (existing) {
      await db
        .update(gwInstallations)
        .set({
          status: "active",
          providerAccountInfo: accountInfo,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(gwInstallations.id, existing.id));

      return {
        status: "connected",
        installationId: existing.id,
        provider: "github",
        setupAction,
        reactivated: true,
      };
    }

    const rows = await db
      .insert(gwInstallations)
      .values({
        provider: "github",
        externalId: installationId,
        connectedBy: stateData.connectedBy ?? "unknown",
        orgId: stateData.orgId ?? "",
        status: "active",
        providerAccountInfo: accountInfo,
      })
      .returning({ id: gwInstallations.id });

    const row = rows[0];
    if (!row) throw new Error("insert_failed");

    // Notify backfill service for new connections (non-blocking)
    await notifyBackfillService({
      installationId: row.id,
      provider: "github",
      orgId: stateData.orgId ?? "",
    });

    return {
      status: "connected",
      installationId: row.id,
      provider: "github",
      setupAction,
    };
  }

  async resolveToken(installation: GwInstallation): Promise<TokenResult> {
    const token = await getInstallationToken(installation.externalId);
    return {
      accessToken: token,
      provider: "github",
      expiresIn: 3600, // GitHub installation tokens expire in 1 hour
    };
  }

  buildAccountInfo(
    stateData: Record<string, string>,
    _oauthTokens?: OAuthTokens,
  ): GwInstallation["providerAccountInfo"] {
    const id = stateData.installationId ?? "";
    return {
      version: 1,
      sourceType: "github",
      installations: [
        {
          id,
          accountId: id,
          accountLogin: stateData.accountLogin ?? "unknown",
          accountType: "Organization",
          avatarUrl: "",
          permissions: {},
          installedAt: new Date().toISOString(),
          lastValidatedAt: new Date().toISOString(),
        },
      ],
    };
  }
}
