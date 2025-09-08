/**
 * API Key authentication middleware for Lightfast Cloud
 *
 * Handles extraction, validation, and authentication of API keys
 * for CLI and programmatic access to the platform.
 */

import { CloudApiKey } from "@db/cloud/schema";
import { and, eq } from "drizzle-orm";
import type { db as dbType } from "@db/cloud/client";

import {
  verifyApiKey,
  generateKeyLookup,
} from "../lib/api-key-crypto";

// API key constants
const API_KEY_PREFIX = "lf_";
const BEARER_PREFIX = "Bearer ";


/**
 * Authentication context returned from API key validation
 */
export interface ApiKeyAuthContext {
  userId: string;
  apiKeyId: string;
  organizationId: string;
  organizationRole: string;
  createdByUserId: string;
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
 * Validate an API key against the database with high performance
 * 
 * This function:
 * 1. Uses O(1) keyLookup hash for fast database lookup
 * 2. Performs constant-time hash verification to prevent timing attacks
 * 3. Checks expiration status and active flag
 * 4. Updates lastUsedAt timestamp asynchronously
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

    // Generate lookup hash for O(1) database query
    const keyLookup = await generateKeyLookup(apiKey);

    // Fast O(1) lookup using indexed keyLookup field
    const candidates = await db
      .select({
        id: CloudApiKey.id,
        keyHash: CloudApiKey.keyHash,
        clerkUserId: CloudApiKey.clerkUserId, // Deprecated, for migration compatibility
        clerkOrgId: CloudApiKey.clerkOrgId,
        createdByUserId: CloudApiKey.createdByUserId,
        expiresAt: CloudApiKey.expiresAt,
        active: CloudApiKey.active,
      })
      .from(CloudApiKey)
      .where(and(
        eq(CloudApiKey.keyLookup, keyLookup),
        eq(CloudApiKey.active, true)
      ))
      .limit(1); // Only expect one match

    if (candidates.length === 0) {
      return null;
    }

    const candidate = candidates[0]!; // Safe because we checked length above

    // Verify the actual key hash (constant time operation)
    const isValidHash = await verifyApiKey(apiKey, candidate.keyHash);
    
    if (!isValidHash) {
      return null;
    }

    // Check if key is expired
    if (candidate.expiresAt && candidate.expiresAt < new Date()) {
      console.info(`API key ${candidate.id} has expired`);
      return null;
    }

    // Update last used timestamp
    // Note: We don't await this to avoid blocking the request
    // This is a fire-and-forget operation for performance
    db.update(CloudApiKey)
      .set({
        lastUsedAt: new Date(),
      })
      .where(eq(CloudApiKey.id, candidate.id))
      .then(() => {
        console.info(`Updated lastUsedAt for API key ${candidate.id}`);
      })
      .catch((error) => {
        console.error(`Failed to update lastUsedAt for API key ${candidate.id}:`, error);
      });

    // Return the authentication context with organization information
    return {
      userId: candidate.clerkUserId || candidate.createdByUserId, // Fallback during migration
      apiKeyId: candidate.id,
      organizationId: candidate.clerkOrgId,
      organizationRole: 'member', // TODO: Fetch actual role from Clerk organization API
      createdByUserId: candidate.createdByUserId,
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