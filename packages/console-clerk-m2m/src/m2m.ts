/**
 * Clerk Machine-to-Machine (M2M) Authentication for Console App
 *
 * Provides Clerk's M2M token system for server-to-server authentication.
 * Uses long-lived tokens (365-day expiration) created once in Clerk Dashboard.
 *
 * Architecture:
 * - tRPC Machine (receiver): Verifies ALL incoming M2M tokens using its secret key
 * - Webhook Machine (sender): Sends pre-created token to authenticate with tRPC
 * - Inngest Machine (sender): Sends pre-created token to authenticate with tRPC
 *
 * One-Time Setup in Clerk Dashboard:
 * 1. Create 3 machines: "tRPC API", "Webhook Handler", "Inngest Workflows"
 * 2. Configure scopes:
 *    - Webhook Handler can communicate with tRPC API
 *    - Inngest Workflows can communicate with tRPC API
 *    - tRPC API can communicate with both
 * 3. Generate long-lived tokens (365 days):
 *    - From Webhook Handler machine → Copy token (mt_xxx) and machine ID (mch_xxx)
 *    - From Inngest Workflows machine → Copy token (mt_xxx) and machine ID (mch_xxx)
 * 4. Store in environment:
 *    - CLERK_MACHINE_SECRET_KEY_TRPC (tRPC's secret to verify all tokens)
 *    - CLERK_M2M_TOKEN_WEBHOOK (webhook's pre-created token)
 *    - CLERK_M2M_MACHINE_ID_WEBHOOK (webhook's machine ID for validation)
 *    - CLERK_M2M_TOKEN_INNGEST (inngest's pre-created token)
 *    - CLERK_M2M_MACHINE_ID_INNGEST (inngest's machine ID for validation)
 *
 * How it works:
 * 1. Webhook/Inngest sends request with their pre-created token in Authorization header
 * 2. tRPC verifies token using CLERK_MACHINE_SECRET_KEY_TRPC
 * 3. tRPC checks verified.subject matches expected machine ID
 *
 * @see https://clerk.com/docs/machine-auth/m2m-tokens
 */

import { createClerkClient } from "@clerk/backend";
import { consoleM2MEnv } from "./env";

/**
 * Service types for M2M authentication
 * Each sender service creates tokens on-demand
 */
export type M2MService = "webhook" | "inngest";

/**
 * Get machine secret key for a specific service
 * Helper function to retrieve the correct secret key based on service type
 *
 * @param service - Which service to get the key for
 * @returns The machine secret key for the service
 * @throws {Error} If service is unknown
 */
function getMachineSecretKey(service: M2MService): string {
  if (service === "webhook") {
    return consoleM2MEnv.CLERK_MACHINE_SECRET_KEY_WEBHOOK;
  } else if (service === "inngest") {
    return consoleM2MEnv.CLERK_MACHINE_SECRET_KEY_INNGEST;
  } else {
    throw new Error(`Unknown M2M service: ${service}`);
  }
}

/**
 * Create M2M token on-demand for a specific service
 *
 * Creates a short-lived token (30 seconds) for security.
 * Follows Clerk's recommended pattern of creating tokens per request.
 *
 * @param service - Which service is creating the token
 * @returns The M2M token object with token and expiration
 *
 * @example
 * ```typescript
 * // For webhook handlers
 * const { token } = await createM2MToken("webhook");
 * headers.set("authorization", `Bearer ${token}`);
 *
 * // For Inngest workflows
 * const { token } = await createM2MToken("inngest");
 * headers.set("authorization", `Bearer ${token}`);
 * ```
 */
export async function createM2MToken(service: M2MService): Promise<{
  token: string;
  expiration: number;
}> {
  // Get the machine secret key for this service
  const machineSecretKey = getMachineSecretKey(service);

  console.log(`[M2M] Creating token for ${service} with secret: ${machineSecretKey.substring(0, 10)}...`);

  // Create a Clerk client with this machine's secret key
  const clerk = createClerkClient({
    secretKey: machineSecretKey,
  });

  // Create a short-lived token (30 seconds)
  // This is more secure than long-lived tokens
  const m2mObject = await clerk.m2m.createToken({
    secondsUntilExpiration: 30,
  });

  if (!m2mObject.token) {
    throw new Error(`[M2M] Failed to create token for ${service}: token is undefined`);
  }

  console.log(`[M2M] Created token: ${m2mObject.token.substring(0, 10)}... (expires in 30s)`);

  return {
    token: m2mObject.token,
    expiration: m2mObject.expiration ?? 0,
  };
}

/**
 * Verify M2M token from incoming request
 *
 * Uses the tRPC machine secret to verify ALL incoming M2M tokens.
 * The `subject` field in the response identifies which machine created the token.
 *
 * Validates that the token:
 * - Was created by an authorized machine (webhook or inngest)
 * - Has not been revoked
 * - Has not expired
 *
 * @param token - The token string from Authorization header (without "Bearer " prefix)
 * @returns Token verification result with subject (machine ID that created token)
 * @throws {Error} If token is invalid, revoked, or expired
 *
 * @example
 * ```typescript
 * // In tRPC context
 * const authHeader = request.headers.get("authorization");
 * const token = authHeader?.replace("Bearer ", "");
 * const verified = await verifyM2MToken(token);
 *
 * if (verified.expired || verified.revoked) {
 *   throw new Error("Invalid token");
 * }
 *
 * // Check which machine sent the request
 * console.log("Request from machine:", verified.subject);
 * ```
 */
export async function verifyM2MToken(token: string): Promise<{
  id: string;
  subject: string; // Machine ID that created the token (webhook or inngest machine)
  scopes: string[]; // Allowed machine IDs this token can communicate with
  claims: Record<string, unknown> | null;
  revoked: boolean;
  expired: boolean;
  expiration: number | null;
}> {
  // Use the tRPC machine secret to verify ALL incoming tokens
  // Following Clerk's example pattern exactly
  const machineSecretKey = consoleM2MEnv.CLERK_MACHINE_SECRET_KEY_TRPC;

  console.log(`[M2M] Verifying token with tRPC machine secret`);
  console.log(`[M2M] Token prefix: ${token.substring(0, 10)}...`);
  console.log(`[M2M] Machine secret prefix: ${machineSecretKey.substring(0, 10)}...`);

  // Create a Clerk client with the tRPC machine's secret key
  // This allows it to verify tokens created by webhook/inngest machines
  const clerk = createClerkClient({
    secretKey: machineSecretKey,
  });

  // Verify token using Clerk's M2M API
  // No need to pass machineSecretKey - it's already in the client
  const verified = await clerk.m2m.verifyToken({
    token,
  });

  console.log(`[M2M] Token verified. Created by machine: ${verified.subject}`);

  return {
    id: verified.id,
    subject: verified.subject, // Machine ID that created the token
    scopes: verified.scopes, // Allowed machine IDs
    claims: verified.claims,
    revoked: verified.revoked,
    expired: verified.expired,
    expiration: verified.expiration,
  };
}

/**
 * Check if M2M is configured for a specific service
 * Useful for conditional logic or graceful degradation
 *
 * Checks:
 * - Service has a machine secret key (CLERK_MACHINE_SECRET_KEY_WEBHOOK or CLERK_MACHINE_SECRET_KEY_INNGEST)
 * - tRPC has machine secret to verify (CLERK_MACHINE_SECRET_KEY_TRPC)
 *
 * @param service - Which service to check
 * @returns true if service secret key and tRPC machine secret are configured
 *
 * @example
 * ```typescript
 * if (isM2MConfigured("webhook")) {
 *   const caller = await createWebhookCaller();
 * } else {
 *   // Fallback to legacy auth
 * }
 * ```
 */
export function isM2MConfigured(service: M2MService): boolean {
  try {
    const secretKey = getMachineSecretKey(service);
    const trpcSecretKey = consoleM2MEnv.CLERK_MACHINE_SECRET_KEY_TRPC;
    return !!secretKey && secretKey.startsWith("ak_") && !!trpcSecretKey && trpcSecretKey.startsWith("ak_");
  } catch {
    return false;
  }
}
