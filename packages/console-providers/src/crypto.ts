/**
 * Web Crypto utilities for webhook signature verification.
 * Pure Web Crypto API — no Node.js crypto.
 */

/**
 * Compute HMAC signature of a message using the given algorithm.
 * Returns hex-encoded signature.
 */
export async function computeHmac(
  message: string,
  secret: string,
  algorithm: "SHA-256" | "SHA-1",
): Promise<string> {
  const secretBytes = new TextEncoder().encode(secret);
  const key = await crypto.subtle.importKey(
    "raw",
    secretBytes,
    { name: "HMAC", hash: algorithm },
    false,
    ["sign"],
  );

  const messageBytes = new TextEncoder().encode(message);
  const signature = await crypto.subtle.sign("HMAC", key, messageBytes);

  return bytesToHex(new Uint8Array(signature));
}

/**
 * Timing-safe comparison of two hex strings.
 * Returns false (rather than throwing) if either input is not valid hex.
 */
export function timingSafeEqual(a: string, b: string): boolean {
  let aBytes: Uint8Array;
  let bBytes: Uint8Array;
  try {
    aBytes = hexToBytes(a);
    bBytes = hexToBytes(b);
  } catch {
    return false;
  }

  let result = aBytes.length ^ bBytes.length;
  const maxLen = Math.max(aBytes.length, bBytes.length);
  for (let i = 0; i < maxLen; i++) {
    result |= (aBytes[i] ?? 0) ^ (bBytes[i] ?? 0);
  }
  return result === 0;
}

// Helpers

function hexToBytes(hex: string): Uint8Array {
  if (hex.length % 2 !== 0 || !/^[0-9a-fA-F]*$/.test(hex)) {
    throw new Error("hexToBytes: invalid hex string");
  }
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
