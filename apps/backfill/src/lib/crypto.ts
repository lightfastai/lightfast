/**
 * Web Crypto utilities for the Backfill service.
 * Pure Web Crypto API — no Node.js crypto.
 */

/**
 * Timing-safe comparison of two arbitrary strings.
 * Computes SHA-256 digests of both inputs and compares the fixed-length
 * (32-byte) digests byte-by-byte with a constant-time XOR accumulator.
 */
export async function timingSafeStringEqual(
  a: string,
  b: string,
): Promise<boolean> {
  const encoder = new TextEncoder();
  const [digestA, digestB] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(a)),
    crypto.subtle.digest("SHA-256", encoder.encode(b)),
  ]);

  const bytesA = new Uint8Array(digestA);
  const bytesB = new Uint8Array(digestB);

  // Digests are always 32 bytes — constant iteration count
  let result = 0;
  for (let i = 0; i < bytesA.length; i++) {
    result |= bytesA[i]! ^ bytesB[i]!;
  }
  return result === 0;
}
