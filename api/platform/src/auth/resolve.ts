import { parseError } from "@vendor/observability/error/next";
import { log } from "@vendor/observability/log/next";

import { verifyServiceJWT } from "../lib/jwt";
import type { PlatformAuthContext } from "./context";
import { serviceAuth, UNAUTH } from "./context";

/**
 * Service-JWT transport — internal-service callers (app, inngest, cron).
 *
 *   undefined           → no Authorization header, or non-Bearer scheme;
 *                         orchestrator falls back to UNAUTH
 *   PlatformAuthContext → definitive answer for Bearer requests:
 *                           - valid JWT       → service auth
 *                           - malformed Bearer or rejected JWT → unauthenticated
 *
 * Mirrors the structural contract of api/app's tryBearer for parity, even
 * though platform has only one transport today (so undefined and UNAUTH
 * collapse to the same observable behavior at the orchestrator boundary).
 */
async function tryServiceJWT(
  headers: Headers,
  source: string
): Promise<PlatformAuthContext | undefined> {
  const authorization = headers.get("authorization");
  if (!authorization) {
    return;
  }
  if (!/^Bearer\b/i.test(authorization)) {
    return;
  }
  const match = /^Bearer\s+(\S+)\s*$/i.exec(authorization);
  const token = match?.[1];
  if (!token) {
    return UNAUTH;
  }

  try {
    const { caller } = await verifyServiceJWT(token);
    return serviceAuth(caller);
  } catch (error) {
    log.warn("[trpc] JWT verification error", {
      source,
      error: parseError(error),
    });
    return UNAUTH;
  }
}

/**
 * Resolve platform auth from one of the supported transports.
 * Today only service JWT exists; structured to accept additions.
 *
 * Returns `undefined` (not UNAUTH) so the caller can detect "no transport
 * produced an answer" and emit a single uniform log line at the boundary.
 */
export async function resolveAuth(
  headers: Headers,
  source: string
): Promise<PlatformAuthContext | undefined> {
  return tryServiceJWT(headers, source);
}
