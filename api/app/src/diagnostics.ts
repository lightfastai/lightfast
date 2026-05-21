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
import { type TRPC_ERROR_CODE_KEY, TRPCError } from "@trpc/server";

export const DIAGNOSTIC_CAUSE_KIND = "lightfast.diagnostic" as const;

export type DiagnosticCode =
  | "AUTH_REQUIRED"
  | "ORG_REQUIRED"
  | "ORG_SETUP_REQUIRED"
  | "PERMISSION_REQUIRED";

export interface Repair {
  /**
   * Optional client-navigable repair target. Set when the throwing surface
   * knows the concrete URL (e.g. the CLI setup route, which has the org slug);
   * omitted by transport-agnostic gates that only know the Clerk org id.
   */
  href?: string;
  /**
   * - `create-or-join-org`   — no active org; the user must create or join one.
   * - `bind-source-control` — the active org has not connected a source-control
   *   organization yet; product features stay locked until it is bound.
   */
  id: "create-or-join-org" | "bind-source-control";
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
