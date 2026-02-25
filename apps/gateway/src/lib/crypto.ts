/**
 * Web Crypto utilities for the Gateway service.
 *
 * Uses AES-256-GCM for token encryption and HMAC-SHA256 for
 * webhook signature verification. Pure Web Crypto API — no Node.js crypto.
 */

const ALGORITHM = "AES-GCM";
const IV_LENGTH = 12; // 96-bit IV for GCM

/**
 * Derive an AES-GCM CryptoKey from a hex-encoded secret
 */
async function deriveKey(hexSecret: string): Promise<CryptoKey> {
  const keyBytes = hexToBytes(hexSecret.padEnd(64, "0").slice(0, 64));
  return crypto.subtle.importKey("raw", keyBytes, { name: ALGORITHM }, false, [
    "encrypt",
    "decrypt",
  ]);
}

/**
 * Encrypt a plaintext string with AES-256-GCM.
 * Returns a base64-encoded string of IV + ciphertext.
 */
export async function encrypt(
  plaintext: string,
  hexSecret: string,
): Promise<string> {
  const key = await deriveKey(hexSecret);
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const encoded = new TextEncoder().encode(plaintext);

  const ciphertext = await crypto.subtle.encrypt(
    { name: ALGORITHM, iv },
    key,
    encoded,
  );

  const combined = new Uint8Array(iv.length + ciphertext.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ciphertext), iv.length);

  return bytesToBase64(combined);
}

/**
 * Decrypt an AES-256-GCM encrypted string.
 * Expects a base64-encoded string of IV + ciphertext.
 */
export async function decrypt(
  encryptedBase64: string,
  hexSecret: string,
): Promise<string> {
  const key = await deriveKey(hexSecret);
  const combined = base64ToBytes(encryptedBase64);

  const iv = combined.slice(0, IV_LENGTH);
  const ciphertext = combined.slice(IV_LENGTH);

  const plaintext = await crypto.subtle.decrypt(
    { name: ALGORITHM, iv },
    key,
    ciphertext,
  );

  return new TextDecoder().decode(plaintext);
}

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

function bytesToBase64(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes));
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}
