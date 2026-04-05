/**
 * Token refresh cron function
 *
 * Ported from apps/gateway/src/functions/token-refresh.ts
 *
 * KEY CHANGES vs gateway service:
 * - Function ID: platform/token.refresh (was apps-gateway/token.refresh)
 * - Uses providerConfigs from memory lib (was gateway env + runtime)
 */

import { db } from "@db/app/client";
import { gatewayInstallations, gatewayTokens } from "@db/app/schema";
import type { SourceType } from "@repo/app-providers";
import { getProvider } from "@repo/app-providers";
import { decrypt } from "@repo/lib";
import { and, eq, isNotNull, lt } from "@vendor/db";
import { parseError } from "@vendor/observability/error/next";
import { log } from "@vendor/observability/log/next";
import { getEncryptionKey } from "../../lib/encryption";
import { providerConfigs } from "../../lib/provider-configs";
import { updateTokenRecord } from "../../lib/token-store";
import { inngest } from "../client";

/** Refresh tokens expiring within this window. */
const REFRESH_WINDOW_MS = 10 * 60 * 1000; // 10 minutes

export const tokenRefresh = inngest.createFunction(
  {
    id: "platform/token.refresh",
    name: "Token Refresh (5m cron)",
    retries: 2,
    concurrency: [{ limit: 1 }],
  },
  { cron: "*/5 * * * *" },
  async ({ step }) => {
    // -- Step 1: Find installations with expiring tokens --------------------
    const expiringSoon = await step.run("list-expiring-tokens", async () => {
      const cutoff = new Date(Date.now() + REFRESH_WINDOW_MS).toISOString();

      return db
        .select({
          installationId: gatewayTokens.installationId,
          tokenId: gatewayTokens.id,
          encryptedRefreshToken: gatewayTokens.refreshToken,
          expiresAt: gatewayTokens.expiresAt,
          provider: gatewayInstallations.provider,
          externalId: gatewayInstallations.externalId,
          orgId: gatewayInstallations.orgId,
        })
        .from(gatewayTokens)
        .innerJoin(
          gatewayInstallations,
          eq(gatewayTokens.installationId, gatewayInstallations.id)
        )
        .where(
          and(
            eq(gatewayInstallations.status, "active"),
            isNotNull(gatewayTokens.refreshToken),
            isNotNull(gatewayTokens.expiresAt),
            lt(gatewayTokens.expiresAt, cutoff)
          )
        );
    });

    log.info("[token-refresh] tokens expiring soon", {
      count: expiringSoon.length,
    });

    // -- Step 2: Refresh each token -----------------------------------------
    let refreshedCount = 0;

    for (const row of expiringSoon) {
      await step.run(`refresh-${row.installationId}`, async () => {
        const providerName = row.provider as SourceType;
        const providerDef = getProvider(providerName);

        if (!providerDef) {
          return;
        }

        const auth = providerDef.auth;
        if (auth.kind !== "oauth" || !auth.refreshToken) {
          // Provider doesn't support token refresh — skip
          return;
        }

        const config = providerConfigs[providerName];

        if (!config) {
          log.warn("[token-refresh] provider not configured — skipping", {
            provider: providerName,
            installationId: row.installationId,
          });
          return;
        }

        try {
          const decryptedRefresh = await decrypt(
            row.encryptedRefreshToken!,
            getEncryptionKey()
          );
          const refreshed = await auth.refreshToken(
            config as never,
            decryptedRefresh
          );
          await updateTokenRecord(
            row.tokenId,
            refreshed,
            row.encryptedRefreshToken,
            row.expiresAt
          );

          refreshedCount++;
          log.info("[token-refresh] token refreshed", {
            installationId: row.installationId,
            provider: providerName,
          });
        } catch (err) {
          // Refresh failure is logged but not fatal — the request-time refresh
          // path in getActiveTokenForInstallation() is the fallback.
          log.warn("[token-refresh] refresh failed", {
            installationId: row.installationId,
            provider: providerName,
            error: parseError(err),
          });
        }
      });
    }

    return { refreshed: refreshedCount };
  }
);
