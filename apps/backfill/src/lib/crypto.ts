/**
 * Web Crypto utilities for the Backfill service.
 * Pure Web Crypto API — no Node.js crypto.
 */

/**
 * Timing-safe comparison of two arbitrary strings.
 * Encodes both as UTF-8 and iterates to max length with XOR accumulator
 * to avoid timing-based length disclosure during comparison.
 */
export function timingSafeStringEqual(a: string, b: string): boolean {
  const encoder = new TextEncoder();
  const aBytes = encoder.encode(a);
  const bBytes = encoder.encode(b);

  let result = aBytes.length ^ bBytes.length;
  const maxLen = Math.max(aBytes.length, bBytes.length);
  for (let i = 0; i < maxLen; i++) {
    result |= (aBytes[i] ?? 0) ^ (bBytes[i] ?? 0);
  }
  return result === 0;
}
