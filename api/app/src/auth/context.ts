import type { AuthIdentity } from "./identity/types";

/**
 * Authentication Context.
 *
 *   identity   answers "who is this request from?"
 *
 * Identity is the only auth dimension: a vendor-agnostic state type with a
 * dedicated resolver (Clerk). Downstream code narrows it at the procedure
 * layer (see `requireActiveIdentity` in `trpc.ts`).
 */
export interface AuthContext {
  identity: AuthIdentity;
}

export const UNAUTH = {
  identity: { type: "unauthenticated" },
} as const satisfies AuthContext;

export type { AuthIdentity } from "./identity/types";
