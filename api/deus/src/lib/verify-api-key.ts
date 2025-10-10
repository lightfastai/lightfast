/**
 * API Key verification logic
 *
 * Provides functions for:
 * - Verifying API keys from Authorization headers
 * - Validating key status (revoked, expired)
 * - Updating last used timestamp
 */

import { eq, sql } from "drizzle-orm";

import { db } from "@db/deus/client";
import { DeusApiKey } from "@db/deus/schema";

import { API_KEY_PREFIX, hashApiKey } from "@repo/deus-api-key";

/**
 * API key authentication context
 *
 * Returned when an API key is successfully verified.
 * Contains user and organization information for authorization.
 */
export interface ApiKeyAuthContext {
  type: "apiKey";
  userId: string;
  organizationId: string;
  scopes: string[];
}

/**
 * Verify an API key from an Authorization header
 *
 * This function:
 * 1. Extracts the key from the "Bearer <key>" format
 * 2. Hashes the key and looks it up in the database
 * 3. Validates the key is not revoked or expired
 * 4. Updates the lastUsedAt timestamp asynchronously
 * 5. Returns the auth context
 *
 * @param authHeader - The Authorization header value (e.g., "Bearer deus_sk_...")
 * @returns API key auth context if valid, null otherwise
 *
 * @example
 * ```ts
 * const authContext = await verifyApiKey(
 *   request.headers.get("authorization")
 * );
 *
 * if (authContext) {
 *   console.log("Authenticated user:", authContext.userId);
 *   console.log("Organization:", authContext.organizationId);
 * }
 * ```
 */
export async function verifyApiKey(
  authHeader: string | null,
): Promise<ApiKeyAuthContext | null> {
  // Check for Bearer token with correct prefix
  if (!authHeader?.startsWith(`Bearer ${API_KEY_PREFIX}`)) {
    return null;
  }

  // Extract the key from "Bearer <key>" format
  const key = authHeader.replace("Bearer ", "");

  try {
    // Hash the provided key for lookup
    const keyHash = await hashApiKey(key);

    // Find the API key by hash
    const keyResult = await db
      .select({
        id: DeusApiKey.id,
        userId: DeusApiKey.userId,
        organizationId: DeusApiKey.organizationId,
        scopes: DeusApiKey.scopes,
        expiresAt: DeusApiKey.expiresAt,
        revokedAt: DeusApiKey.revokedAt,
      })
      .from(DeusApiKey)
      .where(eq(DeusApiKey.keyHash, keyHash))
      .limit(1);

    const apiKey = keyResult[0];

    // Key not found
    if (!apiKey) {
      return null;
    }

    // Key has been revoked
    if (apiKey.revokedAt) {
      return null;
    }

    // Key has expired
    const isExpired =
      apiKey.expiresAt && new Date(apiKey.expiresAt) < new Date();
    if (isExpired) {
      return null;
    }

    // Update lastUsedAt asynchronously (don't block request)
    void db
      .update(DeusApiKey)
      .set({ lastUsedAt: sql`CURRENT_TIMESTAMP` })
      .where(eq(DeusApiKey.id, apiKey.id));

    // Return auth context
    return {
      type: "apiKey",
      userId: apiKey.userId,
      organizationId: apiKey.organizationId,
      scopes: apiKey.scopes,
    };
  } catch (error) {
    // Log error but don't expose details to caller
    console.error("Error verifying API key:", error);
    return null;
  }
}

/**
 * Verify an API key and throw an error if invalid
 *
 * Same as verifyApiKey but throws a descriptive error instead of returning null.
 * Useful when API key authentication is required.
 *
 * @param authHeader - The Authorization header value
 * @returns API key auth context
 * @throws Error if the key is invalid, revoked, or expired
 *
 * @example
 * ```ts
 * try {
 *   const authContext = await verifyApiKeyOrThrow(
 *     request.headers.get("authorization")
 *   );
 *   // Proceed with authenticated user
 * } catch (error) {
 *   return Response.json({ error: error.message }, { status: 401 });
 * }
 * ```
 */
export async function verifyApiKeyOrThrow(
  authHeader: string | null,
): Promise<ApiKeyAuthContext> {
  const authContext = await verifyApiKey(authHeader);

  if (!authContext) {
    throw new Error(
      "Invalid API key. Provide a valid API key in the Authorization header: 'Bearer deus_sk_...'",
    );
  }

  return authContext;
}
