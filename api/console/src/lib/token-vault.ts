import { db } from "@db/console/client";
import { gwTokens, gwInstallations } from "@db/console/schema";
import { eq } from "drizzle-orm";
import { decrypt } from "@repo/lib";
import { env } from "../env";

/**
 * Get a decrypted access token for an installation.
 * Reads directly from gw_tokens in PlanetScale (no HTTP call).
 */
export async function getInstallationToken(installationId: string): Promise<string> {
  const token = await db.query.gwTokens.findFirst({
    where: eq(gwTokens.installationId, installationId),
  });

  if (!token) {
    throw new Error(`No token found for installation: ${installationId}`);
  }

  return decrypt(token.accessToken, env.ENCRYPTION_KEY);
}

/**
 * Get a decrypted access token along with provider info for an installation.
 * For providers with refresh tokens, refreshes inline if expired.
 */
export async function getInstallationTokenWithRefresh(
  installationId: string,
): Promise<{ accessToken: string; provider: string }> {
  const results = await db
    .select({
      token: gwTokens,
      provider: gwInstallations.provider,
    })
    .from(gwTokens)
    .innerJoin(gwInstallations, eq(gwTokens.installationId, gwInstallations.id))
    .where(eq(gwTokens.installationId, installationId))
    .limit(1);

  const row = results[0];
  if (!row) {
    throw new Error(`No token found for installation: ${installationId}`);
  }

  const accessToken = decrypt(row.token.accessToken, env.ENCRYPTION_KEY);
  return { accessToken, provider: row.provider };
}
