/**
 * Service-to-service JWT utilities using HS256 (HMAC-SHA256).
 * Used by app/platform to authenticate calls to platform service.
 *
 * Short-lived (60s) tokens with explicit audience and issuer claims.
 * Edge-compatible via jose (no Node.js crypto dependency).
 */
import { jwtVerify, SignJWT } from "jose";

import { env } from "../env";

/** Closed set of services permitted to sign Bearer tokens for platform. */
export const SERVICE_CALLERS = ["app", "inngest", "cron"] as const;
export type ServiceCaller = (typeof SERVICE_CALLERS)[number];

const PLATFORM_AUDIENCE = "lightfast-platform";
const SERVICE_JWT_TTL_SECONDS = 60;

/** Verified JWT result returned to callers */
export interface VerifiedServiceJWT {
  caller: ServiceCaller;
}

function getSecretKey(): Uint8Array {
  return new TextEncoder().encode(env.SERVICE_JWT_SECRET);
}

function isServiceCaller(value: unknown): value is ServiceCaller {
  return (
    typeof value === "string" &&
    (SERVICE_CALLERS as readonly string[]).includes(value)
  );
}

/**
 * Sign a short-lived service JWT.
 *
 * @param caller - Identity of the calling service (must be a known ServiceCaller)
 * @returns Signed JWT string (valid for 60 seconds)
 */
export async function signServiceJWT(caller: ServiceCaller): Promise<string> {
  const now = Math.floor(Date.now() / 1000);

  return new SignJWT({} as Record<string, unknown>)
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuer(caller)
    .setAudience(PLATFORM_AUDIENCE)
    .setIssuedAt(now)
    .setExpirationTime(now + SERVICE_JWT_TTL_SECONDS)
    .sign(getSecretKey());
}

/**
 * Verify an incoming service JWT.
 *
 * @param token - JWT string from Authorization header
 * @returns Verified payload with caller identity narrowed to ServiceCaller
 * @throws {Error} If token is invalid, expired, audience mismatch, or issuer is not a known ServiceCaller
 */
export async function verifyServiceJWT(
  token: string
): Promise<VerifiedServiceJWT> {
  const { payload } = await jwtVerify(token, getSecretKey(), {
    audience: PLATFORM_AUDIENCE,
    algorithms: ["HS256"],
  });

  if (!isServiceCaller(payload.iss)) {
    throw new Error(
      `Invalid service JWT issuer: ${String(payload.iss)} (expected one of ${SERVICE_CALLERS.join(", ")})`
    );
  }

  return { caller: payload.iss };
}
