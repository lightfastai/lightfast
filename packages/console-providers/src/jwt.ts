/**
 * RS256 JWT utilities for GitHub App authentication.
 * Uses Web Crypto RSASSA-PKCS1-v1_5 — edge-compatible, no Node.js crypto.
 */

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
  const header = { alg: "RS256", typ: "JWT" };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signingInput = `${encodedHeader}.${encodedPayload}`;

  const key = await importPKCS8Key(privateKeyPem);
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(signingInput),
  );

  const encodedSignature = base64UrlEncodeBytes(new Uint8Array(signature));
  return `${signingInput}.${encodedSignature}`;
}

/**
 * Import a PKCS#8 PEM private key via Web Crypto.
 *
 * Handles common env var formats:
 *  - Raw PEM with literal `\n` characters (Vercel convention)
 *  - Raw PEM with actual newlines
 *  - Quoted PEM strings
 *  - Base64-encoded PEM (legacy: entire PEM wrapped in one more base64 layer)
 */
export async function importPKCS8Key(rawKey: string): Promise<CryptoKey> {
  // Normalize: strip quotes, replace literal \n with actual newlines
  let pem = rawKey
    .replace(/^["']|["']$/g, "")
    .replace(/\\n/g, "\n");

  // If it doesn't look like PEM, try base64-decoding (legacy format)
  if (!pem.includes("-----BEGIN")) {
    try {
      pem = atob(pem);
    } catch {
      throw new Error(
        "Private key is not a valid PEM key or base64-encoded PEM",
      );
    }
  }

  // GitHub issues PKCS#1 keys (BEGIN RSA PRIVATE KEY) but Web Crypto
  // only supports PKCS#8 (BEGIN PRIVATE KEY). Detect and reject early.
  if (pem.includes("-----BEGIN RSA PRIVATE KEY-----")) {
    throw new Error(
      "Private key is in PKCS#1 format (RSA PRIVATE KEY). " +
        "Web Crypto requires PKCS#8. Convert with: " +
        "openssl pkcs8 -topk8 -inform PEM -outform PEM -nocrypt -in key.pem",
    );
  }

  // Strip PEM headers and decode inner base64
  const pemContents = pem
    .replace(/-----BEGIN PRIVATE KEY-----/g, "")
    .replace(/-----END PRIVATE KEY-----/g, "")
    .replace(/\s/g, "");

  const binaryDer = atob(pemContents);
  const keyBytes = new Uint8Array(binaryDer.length);
  for (let i = 0; i < binaryDer.length; i++) {
    keyBytes[i] = binaryDer.charCodeAt(i);
  }

  return crypto.subtle.importKey(
    "pkcs8",
    keyBytes.buffer,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
}

function base64UrlEncode(str: string): string {
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlEncodeBytes(bytes: Uint8Array): string {
  const CHUNK_SIZE = 0x8000;
  let binary = "";
  for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK_SIZE));
  }
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}
