/**
 * RS256 JWT utilities for GitHub App authentication.
 * Uses jose — edge-compatible, no Node.js crypto.
 */
import { SignJWT, importPKCS8 } from "jose";

/**
 * Create a signed RS256 JWT.
 *
 * @param payload - JWT claims (iss, iat, exp, etc.)
 * @param privateKeyPem - PKCS#8 PEM private key string (from env)
 */
export async function createRS256JWT(
  payload: Record<string, unknown>,
  privateKeyPem: string,
): Promise<string> {
  const pem = normalizePem(privateKeyPem);
  const key = await importPKCS8(pem, "RS256");

  return new SignJWT(payload)
    .setProtectedHeader({ alg: "RS256", typ: "JWT" })
    .sign(key);
}

/**
 * Normalize PEM key from common env var formats:
 *  - Quoted strings → strip quotes
 *  - Literal \n → real newlines (Vercel convention)
 *  - Base64-encoded PEM (legacy) → decode
 *  - PKCS#1 (BEGIN RSA PRIVATE KEY) → reject with guidance
 */
function normalizePem(rawKey: string): string {
  let pem = rawKey
    .replace(/^["']|["']$/g, "")
    .replace(/\\n/g, "\n");

  if (!pem.includes("-----BEGIN")) {
    try {
      pem = atob(pem);
    } catch {
      throw new Error(
        "Private key is not a valid PEM key or base64-encoded PEM",
      );
    }
  }

  if (pem.includes("-----BEGIN RSA PRIVATE KEY-----")) {
    throw new Error(
      "Private key is in PKCS#1 format (RSA PRIVATE KEY). " +
        "Web Crypto requires PKCS#8. Convert with: " +
        "openssl pkcs8 -topk8 -inform PEM -outform PEM -nocrypt -in key.pem",
    );
  }

  return pem;
}
