import { z } from "zod";

/**
 * Create a Zod schema for a vendor API key with prefix validation
 *
 * @param prefix - The expected prefix (e.g., "sk_", "re_", "phc_")
 * @returns Zod string schema with min(1) and startsWith validation
 *
 * @example
 * ```typescript
 * const env = createEnv({
 *   server: {
 *     RESEND_API_KEY: vendorApiKey("re_"),
 *     CLERK_SECRET_KEY: vendorApiKey("sk_"),
 *   },
 * });
 * ```
 */
export function vendorApiKey(prefix: string) {
  return z.string().min(1).startsWith(prefix);
}

/**
 * Optional variant of vendorApiKey
 */
export function optionalVendorApiKey(prefix: string) {
  return z.string().min(1).startsWith(prefix).optional();
}
