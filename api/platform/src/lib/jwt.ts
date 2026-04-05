/**
 * Service-to-service JWT utilities using HS256 (HMAC-SHA256).
 * Used by app/platform to authenticate calls to platform service.
 *
 * Short-lived (60s) tokens with explicit audience and issuer claims.
 * Edge-compatible via jose (no Node.js crypto dependency).
 */
import { jwtVerify, SignJWT } from "jose";

import { env } from "../env";

/** Verified JWT result returned to callers */
export interface VerifiedServiceJWT {
  caller: string; // From `iss` claim
}

/**
 * Encode the shared secret as a CryptoKey for HS256.
 * Cached at module level -- jose requires Uint8Array or CryptoKey.
 */
function getSecretKey(): Uint8Array {
  return new TextEncoder().encode(env.SERVICE_JWT_SECRET);
}

/**
 * Sign a short-lived service JWT.
 *
 * @param caller - Identity of the calling service (e.g., "app", "platform")
 * @returns Signed JWT string (valid for 60 seconds)
 */
export async function signServiceJWT(caller: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000);

  return new SignJWT({} as Record<string, unknown>)
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuer(caller)
    .setAudience("lightfast-memory")
    .setIssuedAt(now)
    .setExpirationTime(now + 60)
    .sign(getSecretKey());
}

/**
 * Verify an incoming service JWT.
 *
 * @param token - JWT string from Authorization header
 * @returns Verified payload with caller identity
 * @throws {Error} If token is invalid, expired, or audience mismatch
 */
export async function verifyServiceJWT(
  token: string
): Promise<VerifiedServiceJWT> {
  const { payload } = await jwtVerify(token, getSecretKey(), {
    audience: "lightfast-memory",
    algorithms: ["HS256"],
  });

  const issuer = payload.iss;
  if (!issuer) {
    throw new Error("JWT missing issuer (iss) claim");
  }

  return { caller: issuer };
}
