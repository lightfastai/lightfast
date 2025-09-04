/**
 * API Key authentication middleware for Lightfast Cloud
 *
 * Handles extraction, validation, and authentication of API keys
 * for CLI and programmatic access to the platform.
 */

import { CloudApiKey } from "@db/cloud/schema";
import * as argon2 from "argon2";
import { and, eq } from "drizzle-orm";
import type { db as dbType } from "@db/cloud/client";

// API key constants
const API_KEY_PREFIX = "lf_";
const BEARER_PREFIX = "Bearer ";

/**
 * Authentication context returned from API key validation
 */
export interface ApiKeyAuthContext {
  userId: string;
  apiKeyId: string;
}

/**
 * Extract API key from Authorization header
 * Supports both "Bearer lf_..." and "lf_..." formats
 * 
 * @param request - The incoming request object
 * @returns The extracted API key or null if not found/invalid
 */
export async function extractApiKey(request: Request | Headers): Promise<string | null> {
  try {
    // Handle both Request and Headers objects
    const headers = request instanceof Request ? request.headers : request;
    
    // Get the authorization header
    const authHeader = headers.get("authorization");
    if (!authHeader) {
      return null;
    }

    // Extract the token from Bearer format
    let token = authHeader;
    if (authHeader.toLowerCase().startsWith(BEARER_PREFIX.toLowerCase())) {
      token = authHeader.slice(BEARER_PREFIX.length).trim();
    }

    // Validate the token format
    if (!token.startsWith(API_KEY_PREFIX)) {
      return null;
    }

    return token;
  } catch (error) {
    console.error("Error extracting API key:", error);
    return null;
  }
}

/**
 * Validate an API key against the database
 * 
 * This function:
 * 1. Checks if the key exists and is active
 * 2. Verifies the key hash matches
 * 3. Checks expiration status
 * 4. Updates lastUsedAt timestamp
 * 
 * @param apiKey - The API key to validate
 * @param db - Database connection
 * @returns Authentication context or null if invalid
 */
export async function validateApiKey(
  apiKey: string,
  db: typeof dbType
): Promise<ApiKeyAuthContext | null> {
  try {
    // Validate format
    if (!apiKey || !apiKey.startsWith(API_KEY_PREFIX)) {
      return null;
    }

    // Fetch all active API keys
    // Note: In production with high volume, consider implementing
    // a caching layer here to avoid frequent database queries
    const activeKeys = await db
      .select({
        id: CloudApiKey.id,
        keyHash: CloudApiKey.keyHash,
        clerkUserId: CloudApiKey.clerkUserId,
        expiresAt: CloudApiKey.expiresAt,
        active: CloudApiKey.active,
      })
      .from(CloudApiKey)
      .where(eq(CloudApiKey.active, true));

    // Find the matching key by verifying the hash
    let validKey = null;
    for (const dbKey of activeKeys) {
      try {
        const isValid = await argon2.verify(dbKey.keyHash, apiKey);
        if (isValid) {
          validKey = dbKey;
          break;
        }
      } catch (verifyError) {
        // Hash verification failed, continue to next key
        continue;
      }
    }

    // Check if key was found
    if (!validKey) {
      return null;
    }

    // Check if key is expired
    if (validKey.expiresAt && new Date(validKey.expiresAt) < new Date()) {
      console.info(`API key ${validKey.id} has expired`);
      return null;
    }

    // Update last used timestamp
    // Note: We don't await this to avoid blocking the request
    // This is a fire-and-forget operation for performance
    db.update(CloudApiKey)
      .set({
        lastUsedAt: new Date().toISOString(),
      })
      .where(eq(CloudApiKey.id, validKey.id))
      .then(() => {
        console.info(`Updated lastUsedAt for API key ${validKey.id}`);
      })
      .catch((error) => {
        console.error(`Failed to update lastUsedAt for API key ${validKey.id}:`, error);
      });

    // Return the authentication context
    return {
      userId: validKey.clerkUserId,
      apiKeyId: validKey.id,
    };
  } catch (error) {
    console.error("Error validating API key:", error);
    return null;
  }
}

/**
 * Combined helper to extract and validate API key in one call
 * 
 * @param request - The incoming request object or headers
 * @param db - Database connection
 * @returns Authentication context or null if invalid
 */
export async function authenticateApiKey(
  request: Request | Headers,
  db: typeof dbType
): Promise<ApiKeyAuthContext | null> {
  const apiKey = await extractApiKey(request);
  if (!apiKey) {
    return null;
  }

  return validateApiKey(apiKey, db);
}