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
 * API key prefix for Unkey-managed Lightfast keys.
 * Keys are created via Unkey with prefix "sk_lf_", resulting in: sk_lf_xxxxxxxxxxxxxxxx
 *
 * @deprecated New keys are created by Unkey. This constant is kept for user-scoped
 * keys that still use the local key generation path.
 */
export const LIGHTFAST_API_KEY_PREFIX = "sk_lf_";

/**
 * Length of the random portion of the API key
 * 43 chars × 62-char alphabet = ~256 bits entropy
 *
 * @deprecated Unkey controls key length for org API keys. Only used for user-scoped keys.
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
 * @param prefix - The prefix to use (default: "sk_lf_")
 * @returns The generated API key with ~256 bits of entropy
 *
 * @example
 * ```ts
 * const key = generateApiKey();  // "sk_lf_AbC123xYz456..."
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
  /** Key prefix (e.g., "sk_lf_") */
  prefix: string;
  /** Last 4 characters of the key secret (for display) */
  suffix: string;
}

/**
 * Generate a new organization API key, returning all parts for storage
 *
 * @deprecated Org API keys are now created via Unkey. Use @vendor/unkey instead.
 * This function is still used by user-scoped API keys (user-api-keys.ts).
 *
 * @returns Object with full key, prefix, and suffix (last 4 chars)
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
 * const hash = await hashApiKey("sk_lf_abc123...");
 * // Returns: "abc123...def456" (64 character hex string)
 * ```
 */
/**
 * @deprecated Org API key verification is now handled by Unkey. Use @vendor/unkey instead.
 * Still used for user-scoped API keys and tRPC-level auth (api/console/src/trpc.ts).
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
 * @returns Preview string in format "sk_lf_...XXXX"
 */
export function extractKeyPreview(key: string): string {
  const suffix = key.slice(-API_KEY_PREVIEW_LENGTH);
  return `${LIGHTFAST_API_KEY_PREFIX}...${suffix}`;
}

/**
 * Validate that a string has the correct API key format
 *
 * @param key - The string to validate
 * @returns True if the key has the correct format
 */
export function isValidApiKeyFormat(key: string): boolean {
  if (!key) return false;
  // Prefix-only check: Unkey controls key length for org keys, so we
  // cannot enforce a fixed total length. Unkey handles full validation.
  return key.startsWith(LIGHTFAST_API_KEY_PREFIX);
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
