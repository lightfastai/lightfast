/**
 * API Key cryptographic utilities
 *
 * Provides functions for:
 * - Generating API keys with the correct format
 * - Hashing keys using SHA-256
 * - Extracting key previews for display
 */

import { nanoid } from "@repo/lib";

/**
 * Unified API key prefix for all Lightfast keys
 * Format follows industry conventions: sk-{vendor}-{secret}
 */
export const LIGHTFAST_API_KEY_PREFIX = "sk-lf-";

/**
 * Length of the random portion of the API key
 * 43 chars × 62-char alphabet = ~256 bits entropy
 */
export const API_KEY_SECRET_LENGTH = 43;

/**
 * Number of characters to show in the key preview
 */
export const API_KEY_PREVIEW_LENGTH = 4;

/**
 * @deprecated Legacy prefix - do not use for new keys
 */
export const API_KEY_PREFIX = "console_sk_";

/**
 * Generate a new API key with the unified Lightfast format
 *
 * @param prefix - The prefix to use (default: "sk-lf-")
 * @returns The generated API key with ~256 bits of entropy
 *
 * @example
 * ```ts
 * const key = generateApiKey();  // "sk-lf-AbC123xYz456..."
 * ```
 */
export function generateApiKey(
  prefix: string = LIGHTFAST_API_KEY_PREFIX
): string {
  const keySecret = nanoid(API_KEY_SECRET_LENGTH);
  return `${prefix}${keySecret}`;
}

/**
 * Result from generateOrgApiKey containing all parts needed for storage
 */
export interface OrgApiKeyResult {
  /** Full API key (only returned once, never stored) */
  key: string;
  /** Key prefix (e.g., "sk-lf-") */
  prefix: string;
  /** Last 4 characters of the key secret (for display) */
  suffix: string;
}

/**
 * Generate a new organization API key, returning all parts for storage
 *
 * This is used for org-scoped API keys where we store
 * the prefix and suffix separately for display purposes.
 *
 * @returns Object with full key, prefix, and suffix (last 4 chars)
 *
 * @example
 * ```ts
 * const { key, prefix, suffix } = generateOrgApiKey();
 * // key: "sk-lf-AbC123...XyZ789" (full key - return once)
 * // prefix: "sk-lf-"
 * // suffix: "Z789" (last 4 chars)
 * ```
 */
export function generateOrgApiKey(): OrgApiKeyResult {
  const keySecret = nanoid(API_KEY_SECRET_LENGTH);
  const key = `${LIGHTFAST_API_KEY_PREFIX}${keySecret}`;
  const suffix = keySecret.slice(-API_KEY_PREVIEW_LENGTH);

  return {
    key,
    prefix: LIGHTFAST_API_KEY_PREFIX,
    suffix,
  };
}

/**
 * Hash an API key using SHA-256
 *
 * This is used to:
 * - Store the key hash in the database (never store plaintext)
 * - Verify incoming keys by hashing and comparing
 *
 * @param key - The API key to hash
 * @returns Hex-encoded SHA-256 hash of the key
 *
 * @example
 * ```ts
 * const hash = await hashApiKey("sk-lf-abc123...");
 * // Returns: "abc123...def456" (64 character hex string)
 * ```
 */
export async function hashApiKey(key: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(key);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Extract a preview of the API key for display purposes
 *
 * @param key - The full API key
 * @returns Preview string in format "sk-lf-...XXXX"
 */
export function extractKeyPreview(key: string): string {
  const suffix = key.slice(-API_KEY_PREVIEW_LENGTH);
  return `sk-lf-...${suffix}`;
}

/**
 * Validate that a string has the correct API key format
 *
 * @param key - The string to validate
 * @returns True if the key has the correct format
 */
export function isValidApiKeyFormat(key: string): boolean {
  // Must start with sk-lf-
  if (!key.startsWith(LIGHTFAST_API_KEY_PREFIX)) {
    return false;
  }

  // Must have correct length: prefix (6) + secret (43) = 49
  const expectedLength =
    LIGHTFAST_API_KEY_PREFIX.length + API_KEY_SECRET_LENGTH;
  return key.length === expectedLength;
}

/**
 * @deprecated Use OrgApiKeyResult instead
 */
export type WorkspaceApiKeyResult = OrgApiKeyResult;

/**
 * @deprecated Use generateOrgApiKey instead
 */
export function generateWorkspaceApiKey(
  _prefix: string = "sk_live_"
): OrgApiKeyResult {
  // Ignores the prefix parameter and uses the new unified format
  return generateOrgApiKey();
}
