/**
 * Crypto utilities for webhook signature verification.
 * Uses @noble/hashes — audited, edge-compatible, no Node.js crypto.
 */
import { hmac } from "@noble/hashes/hmac.js";
import { sha1 } from "@noble/hashes/legacy.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, hexToBytes, utf8ToBytes } from "@noble/hashes/utils.js";

/**
 * Compute HMAC signature of a message using the given algorithm.
 * Returns hex-encoded signature.
 */
export function computeHmac(
  message: string,
  secret: string,
  algorithm: "SHA-256" | "SHA-1"
): string {
  const hashFn = algorithm === "SHA-256" ? sha256 : sha1;
  return bytesToHex(hmac(hashFn, utf8ToBytes(secret), utf8ToBytes(message)));
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

  if (aBytes.length !== bBytes.length) {
    return false;
  }

  return constantTimeEqual(aBytes, bBytes);
}

/**
 * Compute SHA-256 hash of a string. Returns hex-encoded hash.
 */
export function sha256Hex(value: string): string {
  return bytesToHex(sha256(utf8ToBytes(value)));
}

/**
 * Timing-safe comparison of two arbitrary strings.
 * Computes SHA-256 digests of both inputs and compares the fixed-length
 * (32-byte) digests with a constant-time XOR accumulator.
 */
export function timingSafeStringEqual(a: string, b: string): boolean {
  const aDigest = sha256(utf8ToBytes(a));
  const bDigest = sha256(utf8ToBytes(b));
  return constantTimeEqual(aDigest, bDigest);
}

// ── Helpers ──

/** Constant-time byte-array comparison (same length assumed). */
function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= (a[i] ?? 0) ^ (b[i] ?? 0);
  }
  return result === 0;
}
