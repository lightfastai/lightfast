import { parseError } from "@vendor/observability/error/next";
import { log } from "@vendor/observability/log/next";

import { verifyServiceJWT } from "../lib/jwt";
import type { PlatformAuthContext } from "./context";
import { serviceAuth } from "./context";

/**
 * Service-JWT transport — internal-service callers (app, inngest, cron).
 *
 *   undefined           → no Bearer header; orchestrator falls back to UNAUTH
 *   PlatformAuthContext → resolved service auth
 *
 * On verification failure logs at warn level and returns undefined. We
 * don't return a "rejected" variant because there's currently only one
 * transport: rejected ≡ unauth.
 */
async function tryServiceJWT(
  headers: Headers,
  source: string
): Promise<PlatformAuthContext | undefined> {
  const match = /^Bearer\s+(\S+)\s*$/i.exec(headers.get("authorization") ?? "");
  const token = match?.[1];
  if (!token) {
    return;
  }

  try {
    const { caller } = await verifyServiceJWT(token);
    return serviceAuth(caller);
  } catch (error) {
    log.warn("[trpc] JWT verification error", {
      source,
      error: parseError(error),
    });
    return;
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
