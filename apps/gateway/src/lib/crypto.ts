/**
 * Web Crypto utilities for the Gateway service.
 *
 * HMAC-SHA256 and HMAC-SHA1 for webhook signature verification.
 * Pure Web Crypto API — no Node.js crypto.
 */

/**
 * Compute HMAC-SHA256 signature of a message.
 * Returns hex-encoded signature.
 */
export async function computeHmacSha256(
  message: string,
  secret: string,
): Promise<string> {
  const secretBytes = new TextEncoder().encode(secret);
  const key = await crypto.subtle.importKey(
    "raw",
    secretBytes,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const messageBytes = new TextEncoder().encode(message);
  const signature = await crypto.subtle.sign("HMAC", key, messageBytes);

  return bytesToHex(new Uint8Array(signature));
}

/**
 * Compute HMAC-SHA1 signature of a message.
 * Returns hex-encoded signature (used by Vercel webhooks).
 */
export async function computeHmacSha1(
  message: string,
  secret: string,
): Promise<string> {
  const secretBytes = new TextEncoder().encode(secret);
  const key = await crypto.subtle.importKey(
    "raw",
    secretBytes,
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"],
  );

  const messageBytes = new TextEncoder().encode(message);
  const signature = await crypto.subtle.sign("HMAC", key, messageBytes);

  return bytesToHex(new Uint8Array(signature));
}

/**
 * Timing-safe comparison of two hex strings.
 */
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;

  const aBytes = hexToBytes(a.padEnd(64, "0").slice(0, 64));
  const bBytes = hexToBytes(b.padEnd(64, "0").slice(0, 64));

  let result = 0;
  for (let i = 0; i < aBytes.length; i++) {
    result |= (aBytes[i] ?? 0) ^ (bBytes[i] ?? 0);
  }
  return result === 0 && a === b;
}

// Helpers

function hexToBytes(hex: string): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  }
  return bytes;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
