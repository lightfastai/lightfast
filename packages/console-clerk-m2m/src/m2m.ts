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

import { consoleM2MEnv } from "./env";

/**
 * Service types for M2M authentication
 * Each sender service has its own long-lived token
 */
export type M2MService = "webhook" | "inngest";

/**
 * Get M2M token for a specific service
 *
 * Returns the long-lived token from environment variables.
 * These tokens are created once in Clerk Dashboard with 365-day expiration.
 *
 * @param service - Which service's token to get
 * @returns The M2M token for Authorization header
 *
 * @example
 * ```typescript
 * // For webhook handlers
 * const token = getM2MToken("webhook");
 * headers.set("authorization", `Bearer ${token}`);
 *
 * // For Inngest workflows
 * const token = getM2MToken("inngest");
 * headers.set("authorization", `Bearer ${token}`);
 * ```
 */
export function getM2MToken(service: M2MService): string {
  if (service === "webhook") {
    return consoleM2MEnv.CLERK_M2M_TOKEN_WEBHOOK;
  }

  if (service === "inngest") {
    return consoleM2MEnv.CLERK_M2M_TOKEN_INNGEST;
  }

  throw new Error(`Unknown M2M service: ${service}`);
}

/**
 * Get expected machine ID for a specific service
 *
 * Returns the machine ID that we expect tokens from this service to have.
 * Used to validate the `subject` field from verified tokens.
 *
 * @param service - Which service's machine ID to get
 * @returns The expected machine ID (mch_xxx)
 */
export function getExpectedMachineId(service: M2MService): string {
  if (service === "webhook") {
    return consoleM2MEnv.CLERK_M2M_MACHINE_ID_WEBHOOK;
  }

  if (service === "inngest") {
    return consoleM2MEnv.CLERK_M2M_MACHINE_ID_INNGEST;
  }

  throw new Error(`Unknown M2M service: ${service}`);
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
  const { clerkClient } = await import("@vendor/clerk/server");
  const clerk = await clerkClient();

  // Use the tRPC machine secret to verify ALL incoming tokens
  const machineSecretKey = consoleM2MEnv.CLERK_MACHINE_SECRET_KEY_TRPC;

  console.log(`[M2M] Verifying token with tRPC machine secret`);

  // Verify token using Clerk's M2M API
  const verified = await clerk.m2m.verifyToken({
    token,
    machineSecretKey,
  });

  console.log(`[M2M] Token verified. Created by machine: ${verified.subject}`);

  return {
    id: verified.id,
    subject: verified.subject,
    scopes: verified.scopes,
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
 * - Service has a token to send (CLERK_M2M_TOKEN_WEBHOOK or CLERK_M2M_TOKEN_INNGEST)
 * - tRPC has machine secret to verify (CLERK_MACHINE_SECRET_KEY_TRPC)
 *
 * @param service - Which service to check
 * @returns true if service token and tRPC machine secret are configured
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
    const token = getM2MToken(service);
    const trpcSecretKey = consoleM2MEnv.CLERK_MACHINE_SECRET_KEY_TRPC;
    return !!token && token.startsWith("mt_") && !!trpcSecretKey && trpcSecretKey.startsWith("ak_");
  } catch {
    return false;
  }
}
