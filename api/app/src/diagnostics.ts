/**
 * Diagnostic payloads for gate-style auth and identity failures.
 *
 * Transports can attach this neutral cause shape to their own error envelope so
 * clients can pattern-match on `code` and dispatch on `repair.id` instead of
 * parsing prose messages.
 */

import type { OrgSetupRepairId } from "@repo/api-contract";

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

export interface DiagnosticCause {
  diagnostics: Diagnostic[];
  kind: typeof DIAGNOSTIC_CAUSE_KIND;
}

export function createDiagnosticCause(diagnostic: Diagnostic): DiagnosticCause {
  return {
    kind: DIAGNOSTIC_CAUSE_KIND,
    diagnostics: [diagnostic],
  };
}

export function isDiagnosticCause(cause: unknown): cause is DiagnosticCause {
  return (
    !!cause &&
    typeof cause === "object" &&
    "kind" in cause &&
    (cause as { kind?: unknown }).kind === DIAGNOSTIC_CAUSE_KIND
  );
}
