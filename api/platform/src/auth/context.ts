import type { ServiceCaller } from "../lib/jwt";

/**
 * Discriminated union for platform service authentication.
 * Every request resolves to exactly one variant.
 *
 *   service        — verified service JWT (app, inngest, cron)
 *   internal       — trusted in-process caller (test harness, future
 *                    createInternalCaller). Never produced by createTRPCContext;
 *                    only injected by callers constructing context manually.
 *   unauthenticated — no valid credential
 */
export type PlatformAuthContext =
  | { type: "service"; caller: ServiceCaller }
  | { type: "internal"; source: string }
  | { type: "unauthenticated" };

/**
 * Explicit context type — must be wider than what `createTRPCContext`
 * produces, because in-process callers inject `internal` directly.
 *
 * If you add fields to createTRPCContext's return type, add them here too.
 */
export interface PlatformContext {
  auth: PlatformAuthContext;
  headers: Headers;
}

export const UNAUTH = {
  type: "unauthenticated",
} as const satisfies PlatformAuthContext;

/** Build a service-auth PlatformAuthContext from a verified caller. */
export function serviceAuth(caller: ServiceCaller): PlatformAuthContext {
  return { type: "service", caller };
}
