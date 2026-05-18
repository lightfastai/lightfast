/**
 * Diagnostic envelope for tRPC errors.
 *
 * Every gate-style failure (auth, identity, readiness, …) attaches a
 * structured `cause` here so the `errorFormatter` in `./trpc.ts` can flatten
 * it onto `data.diagnostics` generically. Bearer transports (desktop, CLI,
 * agents) pattern-match on `code` and dispatch on `repair.id` instead of
 * parsing prose messages.
 *
 * Wire shape (inside the existing tRPC `data` envelope):
 *
 *   data: {
 *     ...,
 *     diagnostics: [
 *       { code: "READINESS_PENDING", message: "...", repair: { id: "complete-lightfast-task", ... } }
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
  | "READINESS_PENDING";

export type Repair =
  | { id: "create-or-join-org" }
  | {
      id: "complete-lightfast-task";
      current: string | null;
      remaining: string[];
    };

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
