/**
 * @repo/app-api-key
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
 * import { generateApiKey, hashApiKey, extractKeyPreview } from "@repo/app-api-key";
 * const key = generateApiKey();
 * const hash = hashApiKey(key);
 * const preview = extractKeyPreview(key);
 * ```
 */

export {
  API_KEY_PREVIEW_LENGTH,
  API_KEY_SECRET_LENGTH,
  extractKeyPreview,
  generateApiKey,
  generateOrgApiKey,
  hashApiKey,
  isValidApiKeyFormat,
  LIGHTFAST_API_KEY_PREFIX,
  type OrgApiKeyResult,
} from "./crypto";
