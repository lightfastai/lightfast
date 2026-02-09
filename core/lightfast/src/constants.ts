/**
 * Unified API key prefix for all Lightfast keys
 * Format: sk-{vendor}-{secret}
 *
 * ⚠️ CRITICAL: DO NOT CHANGE THIS VALUE
 * This prefix is part of the public API contract. Changing it would:
 * - Break all existing API keys in production
 * - Invalidate customer integrations
 * - Require coordinated migration across all services
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
 * must be updated together (see thoughts/shared/research/2026-02-09-type-system-standardization.md).
 */
export const LIGHTFAST_API_KEY_PREFIX = "sk-lf-";

/**
 * Length of the random secret portion of the API key
 * 43 chars × 62-char alphabet = ~256 bits entropy
 *
 * ⚠️ CRITICAL: DO NOT CHANGE THIS VALUE
 * Changing this would invalidate all existing API keys and break authentication.
 */
export const API_KEY_SECRET_LENGTH = 43;

/**
 * Validate that a string matches the Lightfast API key format
 *
 * @param key - The string to validate
 * @returns true if the key has the correct prefix and length
 */
export function isValidApiKeyFormat(key: string): boolean {
  if (!key.startsWith(LIGHTFAST_API_KEY_PREFIX)) {
    return false;
  }
  const expectedLength = LIGHTFAST_API_KEY_PREFIX.length + API_KEY_SECRET_LENGTH;
  return key.length === expectedLength;
}
