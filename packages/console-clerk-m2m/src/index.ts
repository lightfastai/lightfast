/**
 * Console Clerk M2M Package
 *
 * Machine-to-Machine authentication for the Console application using Clerk.
 * This package provides M2M token management and verification for internal services.
 *
 * @example
 * ```typescript
 * import { getM2MToken, verifyM2MToken, isM2MConfigured } from "@repo/console-clerk-m2m";
 *
 * // Get token for a service
 * const token = getM2MToken("webhook");
 *
 * // Verify incoming token
 * const verified = await verifyM2MToken(token);
 *
 * // Check if M2M is configured
 * if (isM2MConfigured("webhook")) {
 *   // Use M2M auth
 * }
 * ```
 */

export { consoleM2MEnv } from "./env";
export {
  createM2MToken,
  verifyM2MToken,
  isM2MConfigured,
  type M2MService,
} from "./m2m";
