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
 * API key prefix for Console CLI authentication (default)
 */
export const API_KEY_PREFIX = "console_sk_";

/**
 * Lightfast API key prefix for general use
 */
export const LIGHTFAST_API_KEY_PREFIX = "lf_";

/**
 * Length of the random portion of the API key
 */
export const API_KEY_SECRET_LENGTH = 32;

/**
 * Number of characters to show in the key preview
 */
export const API_KEY_PREVIEW_LENGTH = 4;

/**
 * Generate a new API key with configurable prefix
 *
 * @param prefix - The prefix to use (default: "console_sk_")
 * @returns The generated API key
 *
 * @example
 * ```ts
 * const key = generateApiKey();           // "console_sk_abc123...xyz789"
 * const lfKey = generateApiKey("lf_");    // "lf_abc123...xyz789"
 * ```
 */
export function generateApiKey(prefix: string = API_KEY_PREFIX): string {
  const keySecret = nanoid(API_KEY_SECRET_LENGTH);
  return `${prefix}${keySecret}`;
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
 * const hash = await hashApiKey("console_sk_abc123");
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
 * Returns the last N characters of the secret portion (after the prefix).
 * This is safe to show in UIs and logs.
 *
 * @param key - The full API key
 * @param prefix - The prefix to remove (default: auto-detect from known prefixes)
 * @returns Preview string in format "...XXXX"
 *
 * @example
 * ```ts
 * const preview = extractKeyPreview("console_sk_abc123xyz789");
 * // Returns: "...9789" (last 4 chars of the secret)
 *
 * const lfPreview = extractKeyPreview("lf_abc123xyz789");
 * // Returns: "...9789" (auto-detects lf_ prefix)
 * ```
 */
export function extractKeyPreview(key: string, prefix?: string): string {
  // Auto-detect prefix if not provided
  let detectedPrefix = prefix;
  if (!detectedPrefix) {
    if (key.startsWith(LIGHTFAST_API_KEY_PREFIX)) {
      detectedPrefix = LIGHTFAST_API_KEY_PREFIX;
    } else if (key.startsWith(API_KEY_PREFIX)) {
      detectedPrefix = API_KEY_PREFIX;
    } else {
      detectedPrefix = "";
    }
  }

  // Remove the prefix and get the secret portion
  const keySecret = key.replace(detectedPrefix, "");
  // Get the last N characters
  const preview = keySecret.slice(-API_KEY_PREVIEW_LENGTH);
  return `...${preview}`;
}

/**
 * Validate that a string has the correct API key format
 *
 * Checks that the key:
 * - Starts with a valid prefix (console_sk_ or lf_)
 * - Has the minimum expected length
 *
 * @param key - The string to validate
 * @param prefix - Optional specific prefix to validate against (validates any known prefix if not provided)
 * @returns True if the key has the correct format
 *
 * @example
 * ```ts
 * isValidApiKeyFormat("console_sk_abc123");  // true
 * isValidApiKeyFormat("lf_abc123");          // true
 * isValidApiKeyFormat("invalid_key");        // false
 * isValidApiKeyFormat("console_sk_");        // false (too short)
 * isValidApiKeyFormat("lf_abc", "lf_");      // true (specific prefix check)
 * ```
 */
export function isValidApiKeyFormat(key: string, prefix?: string): boolean {
  const validPrefixes = prefix ? [prefix] : [API_KEY_PREFIX, LIGHTFAST_API_KEY_PREFIX];

  // Check if key starts with any valid prefix
  const matchedPrefix = validPrefixes.find(p => key.startsWith(p));
  if (!matchedPrefix) {
    return false;
  }

  const minLength = matchedPrefix.length + 1;
  return key.length >= minLength;
}
