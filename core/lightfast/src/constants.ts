/**
 * API key prefix for Unkey-managed Lightfast keys
 *
 * Keys are created via Unkey with prefix "sk_lf", resulting in keys
 * with format: sk_lf_xxxxxxxxxxxxxxxx
 *
 * 📝 NOTE ON DUPLICATION:
 * This constant is intentionally defined in two places:
 * 1. Here (lightfast SDK) - source of truth for public consumers and MCP server
 * 2. @repo/console-api-key - source of truth for backend services
 *
 * Why not import from one place?
 * - The SDK is a published npm package with zero workspace dependencies
 * - @repo/console-api-key has heavy deps (@db/console, @trpc/server, drizzle-orm)
 * - Importing between them would create circular deps or force publishing internal packages
 * - Using devDep + re-export pattern risks bundler issues with runtime values
 *
 * This controlled duplication maintains clean package boundaries while avoiding
 * complex dependency management. If this value ever needs to change, both locations
 * must be updated together.
 */
export const LIGHTFAST_API_KEY_PREFIX = "sk_lf_";

/**
 * Length of the random secret portion of the API key
 * Unkey controls the exact key length — this is kept for backward compatibility
 * but is no longer used for validation.
 *
 * @deprecated Unkey controls key length. Use isValidApiKeyFormat for validation.
 */
export const API_KEY_SECRET_LENGTH = 43;

/**
 * Validate that a string matches the Lightfast API key format
 *
 * @param key - The string to validate
 * @returns true if the key has the correct prefix
 */
export function isValidApiKeyFormat(key: string): boolean {
  if (!key) return false;
  return key.startsWith(LIGHTFAST_API_KEY_PREFIX);
}
