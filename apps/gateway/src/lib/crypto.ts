/**
 * Web Crypto utilities for the Gateway service.
 * Pure Web Crypto API — no Node.js crypto.
 */

/**
 * Compute SHA-256 hash of a string. Returns hex-encoded hash.
 */
export async function sha256Hex(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Timing-safe comparison of two hex strings.
 */
export function timingSafeHexEqual(a: string, b: string): boolean {
  const aBytes = safeHexToBytes(a);
  const bBytes = safeHexToBytes(b);
  if (!aBytes || !bBytes) { return false; }

  let result = aBytes.length ^ bBytes.length;
  const maxLen = Math.max(aBytes.length, bBytes.length);
  for (let i = 0; i < maxLen; i++) {
    result |= (aBytes[i] ?? 0) ^ (bBytes[i] ?? 0);
  }
  return result === 0;
}

function safeHexToBytes(hex: string): Uint8Array | null {
  if (hex.length % 2 !== 0 || !/^[0-9a-fA-F]*$/.test(hex)) { return null; }
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  }
  return bytes;
}
