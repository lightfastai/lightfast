import type { AuthIdentity } from "./identity/types";
import type { AuthReadiness } from "./readiness/types";

/**
 * Authentication Context — composite of two orthogonal primitives.
 *
 *   identity   answers "who is this request from?"
 *   readiness  answers "is this principal qualified to proceed?"
 *
 * Each primitive owns a vendor-agnostic state type and a dedicated
 * resolver (Clerk for identity, Lightfast tasks for readiness in v1).
 * Downstream code narrows each dimension independently — there is no
 * collapsed top-level discriminator. The composition lives at the
 * procedure layer (see `pendingNotAllowedProcedure` in `trpc.ts`).
 */
export interface AuthContext {
  identity: AuthIdentity;
  readiness: AuthReadiness;
}

export const UNAUTH = {
  identity: { type: "unauthenticated" },
  readiness: { type: "n/a" },
} as const satisfies AuthContext;

export type { AuthIdentity } from "./identity/types";
export type { AuthReadiness } from "./readiness/types";
