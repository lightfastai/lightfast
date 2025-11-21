/**
 * OAuth State Generation and Validation
 *
 * This module provides secure OAuth state generation and validation with:
 * - Cryptographically random tokens
 * - Timestamp-based expiration (default 10 minutes)
 * - One-time-use nonce for replay attack prevention
 * - Base64URL encoding for cookie/session storage
 *
 * Security features:
 * - Uses Web Crypto API for random generation
 * - Prevents state replay attacks with one-time nonces
 * - Validates state age to prevent stale state usage
 * - Constant-time comparison for token matching
 *
 * @example
 * ```ts
 * // Generate state for OAuth initiation
 * const { state, encoded } = generateOAuthState({ redirectPath: "/settings" });
 * // Store 'encoded' in httpOnly cookie
 *
 * // Validate state in OAuth callback
 * const result = validateOAuthState(receivedState, storedState);
 * if (result.valid) {
 *   const redirectPath = result.state?.redirectPath;
 * } else {
 *   console.error("Invalid state:", result.error);
 * }
 * ```
 */

import type {
  OAuthState,
  OAuthStateGenerationResult,
  OAuthStateOptions,
  OAuthStateValidationOptions,
  OAuthStateValidationResult,
} from "./types";

/**
 * Default maximum age for OAuth state (10 minutes in milliseconds)
 */
export const DEFAULT_STATE_MAX_AGE_MS = 10 * 60 * 1000;

/**
 * Length of random token in bytes (32 bytes = 256 bits)
 */
const TOKEN_BYTE_LENGTH = 32;

/**
 * Length of nonce in bytes (16 bytes = 128 bits)
 */
const NONCE_BYTE_LENGTH = 16;

/**
 * In-memory set of used nonces (for one-time-use enforcement)
 * In production, consider using Redis or database for distributed systems
 */
const usedNonces = new Set<string>();

/**
 * Generate a cryptographically secure random string
 *
 * @param byteLength - Number of random bytes to generate
 * @returns Hex-encoded random string
 */
function generateRandomHex(byteLength: number): string {
  const buffer = new Uint8Array(byteLength);
  crypto.getRandomValues(buffer);
  return Array.from(buffer)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Encode a string to Base64URL format (URL-safe, no padding)
 *
 * @param str - String to encode
 * @returns Base64URL-encoded string
 */
function base64UrlEncode(str: string): string {
  const base64 = Buffer.from(str, "utf-8").toString("base64");
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

/**
 * Decode a Base64URL-encoded string
 *
 * @param str - Base64URL-encoded string
 * @returns Decoded string
 */
function base64UrlDecode(str: string): string {
  // Add padding if needed
  const padded = str + "===".slice((str.length + 3) % 4);
  // Convert URL-safe characters back to standard Base64
  const base64 = padded.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(base64, "base64").toString("utf-8");
}

/**
 * Constant-time string comparison to prevent timing attacks
 *
 * @param a - First string
 * @param b - Second string
 * @returns True if strings are equal
 */
function constantTimeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }

  return result === 0;
}

/**
 * Generate a new OAuth state with security features
 *
 * Creates an OAuth state with:
 * - Cryptographically random token (32 bytes)
 * - Current timestamp for expiration checking
 * - One-time-use nonce for replay prevention
 * - Optional redirect path
 *
 * @param options - Optional configuration
 * @returns OAuth state and Base64URL-encoded string for storage
 *
 * @example
 * ```ts
 * const { state, encoded } = generateOAuthState({ redirectPath: "/dashboard" });
 *
 * // Store in httpOnly cookie
 * response.cookies.set("oauth_state", encoded, {
 *   httpOnly: true,
 *   secure: true,
 *   sameSite: "strict",
 *   maxAge: 600, // 10 minutes
 * });
 * ```
 */
export function generateOAuthState(
  options?: OAuthStateOptions
): OAuthStateGenerationResult {
  const token = generateRandomHex(TOKEN_BYTE_LENGTH);
  const nonce = generateRandomHex(NONCE_BYTE_LENGTH);
  const timestamp = Date.now();

  const state: OAuthState = {
    token,
    timestamp,
    nonce,
    ...(options?.redirectPath && { redirectPath: options.redirectPath }),
  };

  const encoded = base64UrlEncode(JSON.stringify(state));

  return { state, encoded };
}

/**
 * Validate an OAuth state against a stored state
 *
 * Performs the following security checks:
 * 1. Format validation (valid JSON, required fields)
 * 2. Token matching (constant-time comparison)
 * 3. Expiration check (default 10 minutes)
 * 4. Replay prevention (one-time-use nonce)
 *
 * @param receivedEncoded - State received from OAuth provider
 * @param storedEncoded - State stored in cookie/session
 * @param options - Validation options
 * @returns Validation result with success/error information
 *
 * @example
 * ```ts
 * // In OAuth callback handler
 * const receivedState = searchParams.get("state");
 * const storedState = request.cookies.get("oauth_state")?.value;
 *
 * const result = validateOAuthState(receivedState, storedState, {
 *   maxAgeMs: 10 * 60 * 1000, // 10 minutes
 *   markAsUsed: true,         // Prevent replay
 * });
 *
 * if (!result.valid) {
 *   return redirect(`/?error=${result.error}`);
 * }
 *
 * // State is valid, proceed with OAuth flow
 * const redirectPath = result.state?.redirectPath ?? "/";
 * ```
 */
export function validateOAuthState(
  receivedEncoded: string | null | undefined,
  storedEncoded: string | null | undefined,
  options?: OAuthStateValidationOptions
): OAuthStateValidationResult {
  const maxAgeMs = options?.maxAgeMs ?? DEFAULT_STATE_MAX_AGE_MS;

  // Check if both states exist
  if (!receivedEncoded || !storedEncoded) {
    return { valid: false, error: "invalid_format" };
  }

  try {
    // Decode both states
    const receivedJson = base64UrlDecode(receivedEncoded);
    const storedJson = base64UrlDecode(storedEncoded);

    const receivedState = JSON.parse(receivedJson) as OAuthState;
    const storedState = JSON.parse(storedJson) as OAuthState;

    // Validate required fields
    if (
      !receivedState.token ||
      !receivedState.timestamp ||
      !receivedState.nonce
    ) {
      return { valid: false, error: "invalid_format" };
    }

    if (!storedState.token || !storedState.timestamp || !storedState.nonce) {
      return { valid: false, error: "invalid_format" };
    }

    // Check token match (constant-time comparison)
    if (!constantTimeCompare(receivedState.token, storedState.token)) {
      return { valid: false, error: "mismatch" };
    }

    // Check nonce match
    if (!constantTimeCompare(receivedState.nonce, storedState.nonce)) {
      return { valid: false, error: "mismatch" };
    }

    // Check if nonce has been used (replay attack prevention)
    if (usedNonces.has(storedState.nonce)) {
      return { valid: false, error: "already_used" };
    }

    // Check expiration
    const age = Date.now() - storedState.timestamp;
    if (age > maxAgeMs) {
      return { valid: false, error: "expired" };
    }

    // Mark nonce as used if requested
    if (options?.markAsUsed !== false) {
      usedNonces.add(storedState.nonce);

      // Clean up old nonces after 1 hour to prevent memory leak
      setTimeout(() => {
        usedNonces.delete(storedState.nonce);
      }, 60 * 60 * 1000);
    }

    // All checks passed
    return { valid: true, state: storedState };
  } catch (error) {
    // JSON parsing or decoding error
    return { valid: false, error: "invalid_format" };
  }
}

/**
 * Clear all used nonces (for testing purposes)
 *
 * @internal
 */
export function clearUsedNonces(): void {
  usedNonces.clear();
}

/**
 * Check if a nonce has been used (for testing purposes)
 *
 * @internal
 */
export function isNonceUsed(nonce: string): boolean {
  return usedNonces.has(nonce);
}
