import { db } from "@db/app/client";
import { gatewayInstallations, gatewayTokens } from "@db/app/schema";
import { decrypt } from "@repo/lib";
import { eq } from "drizzle-orm";
import { env } from "../env";

/**
 * Get a decrypted access token for an installation.
 * Reads directly from gw_tokens in PlanetScale (no HTTP call).
 *
 * No logging here: callers own error handling. Logging at this layer
 * would create unpredictable double-logging for callers that also log.
 * Failures propagate as thrown Errors and are handled upstream.
 */
export async function getInstallationToken(
  installationId: string
): Promise<string> {
  const token = await db.query.gatewayTokens.findFirst({
    where: eq(gatewayTokens.installationId, installationId),
  });

  if (!token) {
    throw new Error(`No token found for installation: ${installationId}`);
  }

  return await decrypt(token.accessToken, env.ENCRYPTION_KEY);
}

/**
 * Get a decrypted access token along with provider info for an installation.
 * Reads and decrypts the stored token and returns the provider.
 */
export async function getInstallationTokenWithRefresh(
  installationId: string
): Promise<{ accessToken: string; provider: string }> {
  const results = await db
    .select({
      token: gatewayTokens,
      provider: gatewayInstallations.provider,
    })
    .from(gatewayTokens)
    .innerJoin(
      gatewayInstallations,
      eq(gatewayTokens.installationId, gatewayInstallations.id)
    )
    .where(eq(gatewayTokens.installationId, installationId))
    .limit(1);

  const row = results[0];
  if (!row) {
    throw new Error(`No token found for installation: ${installationId}`);
  }

  const accessToken = await decrypt(row.token.accessToken, env.ENCRYPTION_KEY);
  return { accessToken, provider: row.provider };
}
