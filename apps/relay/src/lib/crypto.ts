/**
 * Service-level crypto utilities for the Relay service.
 *
 * NOTE: Webhook HMAC functions (computeHmac, timingSafeEqual) have moved to
 * @repo/console-providers. This file retains only the service-level utility
 * for timing-safe API key comparison.
 */

/**
 * Timing-safe comparison of two arbitrary strings.
 * Encodes both as UTF-8 and iterates to max length with XOR accumulator
 * to avoid timing-based length disclosure during comparison.
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
    result |= (bytesA[i] ?? 0) ^ (bytesB[i] ?? 0);
  }
  return result === 0;
}
