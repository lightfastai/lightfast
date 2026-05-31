/**
 * Diagnostic envelope for tRPC errors.
 *
 * Every gate-style failure (auth, identity, …) attaches a structured `cause`
 * here so the `errorFormatter` in `./trpc.ts` can flatten it onto
 * `data.diagnostics` generically. Bearer transports (desktop, CLI, agents)
 * pattern-match on `code` and dispatch on `repair.id` instead of parsing
 * prose messages.
 *
 * Wire shape (inside the existing tRPC `data` envelope):
 *
 *   data: {
 *     ...,
 *     diagnostics: [
 *       { code: "ORG_REQUIRED", message: "...", repair: { id: "create-or-join-org" } }
 *     ]
 *   }
 *
 * `diagnostics` is always an array — empty `[]` when the error did not
 * originate from `throwDiagnostic`. The array shape is forward-compatible
 * with future compound errors (e.g. "session expired AND org missing").
 */

import type { OrgSetupRepairId } from "@repo/app-setup-contract";
import { type TRPC_ERROR_CODE_KEY, TRPCError } from "@trpc/server";

export const DIAGNOSTIC_CAUSE_KIND = "lightfast.diagnostic" as const;

export type DiagnosticCode =
  | "AUTH_REQUIRED"
  | "GITHUB_USER_ACCOUNT_REQUIRED"
  | "NATIVE_OAUTH_REQUIRED"
  | "ORG_REQUIRED"
  | "ORG_SETUP_REQUIRED"
  | "PERMISSION_REQUIRED";

export interface Repair {
  /**
   * Optional client-navigable repair target. Set when the throwing surface
   * knows the concrete URL (e.g. a route handler with the active org slug);
   * omitted by transport-agnostic gates that only know the Clerk org id.
   */
  href?: string;
  /**
   * - `create-or-join-org`   — no active org; the user must create or join one.
   * - setup GitHub repair ids — the active org has not completed the named
   *   setup requirement yet; product features stay locked until setup is bound.
   * - `connect-github-account` — the active user has not connected a GitHub
   *   account yet; product features stay locked until it is connected.
   */
  id: "connect-github-account" | "create-or-join-org" | OrgSetupRepairId;
}

export interface Diagnostic {
  code: DiagnosticCode;
  message: string;
  repair?: Repair;
}

interface DiagnosticCause {
  diagnostics: Diagnostic[];
  kind: typeof DIAGNOSTIC_CAUSE_KIND;
}

export function isDiagnosticCause(cause: unknown): cause is DiagnosticCause {
  return (
    !!cause &&
    typeof cause === "object" &&
    "kind" in cause &&
    (cause as { kind?: unknown }).kind === DIAGNOSTIC_CAUSE_KIND
  );
}

export function throwDiagnostic(args: {
  trpcCode: TRPC_ERROR_CODE_KEY;
  diagnostic: Diagnostic;
}): never {
  const cause: DiagnosticCause = {
    kind: DIAGNOSTIC_CAUSE_KIND,
    diagnostics: [args.diagnostic],
  };
  throw new TRPCError({
    code: args.trpcCode,
    message: args.diagnostic.message,
    cause,
  });
}
