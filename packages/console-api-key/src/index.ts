/**
 * @repo/console-api-key
 *
 * API Key cryptographic utilities for Console CLI authentication
 *
 * This package provides cryptographic utilities for:
 * - Generating API keys with the correct format
 * - Hashing API keys using SHA-256
 * - Extracting key previews for display
 * - Validating API key format
 *
 * @example
 * ```ts
 * // Generate and hash a key
 * import { generateApiKey, hashApiKey, extractKeyPreview } from "@repo/console-api-key";
 * const key = generateApiKey();
 * const hash = await hashApiKey(key);
 * const preview = extractKeyPreview(key);
 * ```
 */

export * from "./crypto";
