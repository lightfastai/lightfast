/**
 * OAuth Token Encryption and Decryption
 *
 * This module provides secure encryption/decryption for OAuth tokens using
 * AES-256-GCM (Galois/Counter Mode) with Web Crypto API.
 *
 * Security features:
 * - AES-256-GCM authenticated encryption
 * - Random initialization vector (IV) per encryption
 * - Authentication tag for integrity verification
 * - Base64 encoding for cookie/storage compatibility
 *
 * Use cases:
 * - Encrypting GitHub access tokens before storing in cookies
 * - Encrypting refresh tokens for secure storage
 * - Encrypting any OAuth credentials in transit or at rest
 *
 * @example
 * ```ts
 * // Encrypt a token before storing
 * const encrypted = await encryptOAuthToken(
 *   "ghp_abc123...",
 *   process.env.ENCRYPTION_KEY
 * );
 *
 * // Store encrypted token in cookie
 * response.cookies.set("github_token", encrypted.encryptedToken, {
 *   httpOnly: true,
 *   secure: true,
 * });
 *
 * // Decrypt token when needed
 * const token = await decryptOAuthToken(
 *   encryptedCookie,
 *   process.env.ENCRYPTION_KEY
 * );
 * ```
 */

import type { EncryptedToken } from "./types";

/**
 * AES-GCM algorithm name
 */
const ALGORITHM = "AES-GCM";

/**
 * Key length in bits (256 bits = 32 bytes)
 */
const KEY_LENGTH_BITS = 256;

/**
 * IV length in bytes (12 bytes recommended for GCM)
 */
const IV_LENGTH_BYTES = 12;

/**
 * Authentication tag length in bits (128 bits recommended)
 */
const TAG_LENGTH_BITS = 128;

/**
 * Derive a CryptoKey from a hex or base64 string
 *
 * @param keyString - Encryption key as hex (64 chars) or base64 (44 chars)
 * @returns CryptoKey for AES-GCM
 */
async function deriveKey(keyString: string): Promise<CryptoKey> {
  // Validate key length
  const isHex = /^[0-9a-f]{64}$/i.test(keyString);
  const isBase64 = /^[A-Za-z0-9+/]{43}=$/i.test(keyString);

  if (!isHex && !isBase64) {
    throw new Error(
      "Encryption key must be 32 bytes (64 hex chars or 44 base64 chars)"
    );
  }

  // Convert to Uint8Array
  let keyData: Uint8Array;
  if (isHex) {
    // Parse hex string
    const bytes = keyString.match(/.{1,2}/g)?.map((byte) => parseInt(byte, 16));
    if (!bytes || bytes.length !== 32) {
      throw new Error("Invalid hex key format");
    }
    keyData = new Uint8Array(bytes);
  } else {
    // Parse base64 string
    const buffer = Buffer.from(keyString, "base64");
    keyData = new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  }

  // Import key for AES-GCM
  return crypto.subtle.importKey(
    "raw",
    keyData.buffer as ArrayBuffer,
    { name: ALGORITHM, length: KEY_LENGTH_BITS },
    false, // not extractable
    ["encrypt", "decrypt"]
  );
}

/**
 * Generate a random initialization vector (IV)
 *
 * @returns Random IV as Uint8Array
 */
function generateIV(): Uint8Array {
  const iv = new Uint8Array(IV_LENGTH_BYTES);
  crypto.getRandomValues(iv);
  return iv;
}

/**
 * Encrypt an OAuth token using AES-256-GCM
 *
 * Uses AES-256-GCM authenticated encryption with:
 * - Random 12-byte IV per encryption
 * - 128-bit authentication tag
 * - Base64 encoding for storage compatibility
 *
 * @param token - Plaintext OAuth token to encrypt
 * @param encryptionKey - 32-byte encryption key (hex or base64)
 * @returns Encrypted token with IV and auth tag
 *
 * @throws Error if encryption fails or key is invalid
 *
 * @example
 * ```ts
 * const encrypted = await encryptOAuthToken(
 *   "ghp_abc123xyz789",
 *   "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
 * );
 *
 * // Store all three components
 * response.cookies.set("token", encrypted.encryptedToken);
 * response.cookies.set("token_iv", encrypted.iv);
 * response.cookies.set("token_tag", encrypted.authTag);
 *
 * // Or combine into single cookie
 * const combined = `${encrypted.encryptedToken}.${encrypted.iv}.${encrypted.authTag}`;
 * response.cookies.set("token", combined, {
 *   httpOnly: true,
 *   secure: true,
 *   sameSite: "strict",
 *   maxAge: 300, // 5 minutes
 * });
 * ```
 */
export async function encryptOAuthToken(
  token: string,
  encryptionKey: string
): Promise<EncryptedToken> {
  if (!token) {
    throw new Error("Token cannot be empty");
  }

  if (!encryptionKey) {
    throw new Error("Encryption key is required");
  }

  // Derive CryptoKey
  const key = await deriveKey(encryptionKey);

  // Generate random IV
  const iv = generateIV();

  // Encode token as Uint8Array
  const encoder = new TextEncoder();
  const data = encoder.encode(token);

  // Encrypt with AES-GCM
  const encryptedBuffer = await crypto.subtle.encrypt(
    {
      name: ALGORITHM,
      iv: iv.buffer as ArrayBuffer,
      tagLength: TAG_LENGTH_BITS,
    },
    key,
    data.buffer as ArrayBuffer
  );

  // Extract ciphertext and auth tag
  // GCM appends the tag to the end of the ciphertext
  const encryptedArray = new Uint8Array(encryptedBuffer);
  const tagLengthBytes = TAG_LENGTH_BITS / 8;
  const ciphertext = encryptedArray.slice(0, -tagLengthBytes);
  const authTag = encryptedArray.slice(-tagLengthBytes);

  // Encode to Base64
  return {
    encryptedToken: Buffer.from(ciphertext).toString("base64"),
    iv: Buffer.from(iv).toString("base64"),
    authTag: Buffer.from(authTag).toString("base64"),
  };
}

/**
 * Decrypt an OAuth token using AES-256-GCM
 *
 * Decrypts a token encrypted with `encryptOAuthToken`, verifying
 * the authentication tag to ensure integrity.
 *
 * @param encrypted - Encrypted token data
 * @param encryptionKey - 32-byte encryption key (same as used for encryption)
 * @returns Decrypted plaintext token
 *
 * @throws Error if decryption fails, auth tag invalid, or key mismatch
 *
 * @example
 * ```ts
 * // Decrypt from separate cookies
 * const encrypted = {
 *   encryptedToken: request.cookies.get("token")?.value,
 *   iv: request.cookies.get("token_iv")?.value,
 *   authTag: request.cookies.get("token_tag")?.value,
 * };
 *
 * const token = await decryptOAuthToken(encrypted, process.env.ENCRYPTION_KEY);
 *
 * // Or from combined cookie
 * const combined = request.cookies.get("token")?.value;
 * const [encryptedToken, iv, authTag] = combined.split(".");
 * const token = await decryptOAuthToken(
 *   { encryptedToken, iv, authTag },
 *   process.env.ENCRYPTION_KEY
 * );
 * ```
 */
export async function decryptOAuthToken(
  encrypted: EncryptedToken,
  encryptionKey: string
): Promise<string> {
  if (!encrypted.encryptedToken || !encrypted.iv || !encrypted.authTag) {
    throw new Error("Missing required encrypted token components");
  }

  if (!encryptionKey) {
    throw new Error("Encryption key is required");
  }

  try {
    // Derive CryptoKey
    const key = await deriveKey(encryptionKey);

    // Decode from Base64
    const ciphertextBuffer = Buffer.from(encrypted.encryptedToken, "base64");
    const ivBuffer = Buffer.from(encrypted.iv, "base64");
    const authTagBuffer = Buffer.from(encrypted.authTag, "base64");

    const ciphertext = new Uint8Array(ciphertextBuffer.buffer, ciphertextBuffer.byteOffset, ciphertextBuffer.byteLength);
    const iv = new Uint8Array(ivBuffer.buffer, ivBuffer.byteOffset, ivBuffer.byteLength);
    const authTag = new Uint8Array(authTagBuffer.buffer, authTagBuffer.byteOffset, authTagBuffer.byteLength);

    // Reconstruct encrypted buffer (ciphertext + tag)
    const encryptedBuffer = new Uint8Array(ciphertext.length + authTag.length);
    encryptedBuffer.set(ciphertext, 0);
    encryptedBuffer.set(authTag, ciphertext.length);

    // Decrypt with AES-GCM
    const decryptedBuffer = await crypto.subtle.decrypt(
      {
        name: ALGORITHM,
        iv: iv.buffer as ArrayBuffer,
        tagLength: TAG_LENGTH_BITS,
      },
      key,
      encryptedBuffer.buffer as ArrayBuffer
    );

    // Decode to string
    const decoder = new TextDecoder();
    return decoder.decode(decryptedBuffer);
  } catch (error) {
    // Decryption failure (wrong key, tampered data, or invalid auth tag)
    throw new Error(
      `Failed to decrypt OAuth token: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}

/**
 * Encrypt and encode OAuth token to single string for cookie storage
 *
 * Convenience function that encrypts a token and combines the components
 * into a single dot-separated string for easy cookie storage.
 *
 * @param token - Plaintext OAuth token
 * @param encryptionKey - 32-byte encryption key
 * @returns Single string: "encryptedToken.iv.authTag"
 *
 * @example
 * ```ts
 * const encrypted = await encryptOAuthTokenToCookie(
 *   "ghp_abc123",
 *   process.env.ENCRYPTION_KEY
 * );
 *
 * response.cookies.set("github_token", encrypted, {
 *   httpOnly: true,
 *   secure: true,
 *   sameSite: "strict",
 * });
 * ```
 */
export async function encryptOAuthTokenToCookie(
  token: string,
  encryptionKey: string
): Promise<string> {
  const encrypted = await encryptOAuthToken(token, encryptionKey);
  return `${encrypted.encryptedToken}.${encrypted.iv}.${encrypted.authTag}`;
}

/**
 * Decrypt OAuth token from cookie string
 *
 * Convenience function that parses a dot-separated encrypted token string
 * from a cookie and decrypts it.
 *
 * @param cookieValue - Encrypted cookie value: "encryptedToken.iv.authTag"
 * @param encryptionKey - 32-byte encryption key
 * @returns Decrypted plaintext token
 *
 * @example
 * ```ts
 * const cookieValue = request.cookies.get("github_token")?.value;
 * if (!cookieValue) {
 *   throw new Error("Missing token cookie");
 * }
 *
 * const token = await decryptOAuthTokenFromCookie(
 *   cookieValue,
 *   process.env.ENCRYPTION_KEY
 * );
 * ```
 */
export async function decryptOAuthTokenFromCookie(
  cookieValue: string,
  encryptionKey: string
): Promise<string> {
  const parts = cookieValue.split(".");
  if (parts.length !== 3) {
    throw new Error("Invalid encrypted token format");
  }

  const [encryptedToken, iv, authTag] = parts as [string, string, string];
  return decryptOAuthToken({ encryptedToken, iv, authTag }, encryptionKey);
}
