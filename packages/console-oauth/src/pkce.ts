/**
 * PKCE (Proof Key for Code Exchange) Implementation
 *
 * This module provides PKCE challenge generation and verification for OAuth 2.1.
 * PKCE prevents authorization code interception attacks by requiring a code
 * challenge during authorization and verification during token exchange.
 *
 * Implements RFC 7636: https://datatracker.ietf.org/doc/html/rfc7636
 *
 * Security features:
 * - Uses Web Crypto API for secure random generation
 * - SHA-256 hashing (S256 method) for code challenge
 * - Base64URL encoding (URL-safe, no padding)
 * - Constant-time comparison for verification
 *
 * @example
 * ```ts
 * // Generate PKCE challenge for OAuth initiation
 * const { codeVerifier, codeChallenge } = generatePKCEChallenge();
 *
 * // Store codeVerifier in session/cookie
 * // Send codeChallenge to OAuth provider
 *
 * // In callback, verify the challenge
 * const isValid = await verifyPKCEChallenge(storedVerifier, receivedChallenge);
 * ```
 */

import type { PKCEChallenge } from "./types";

/**
 * Minimum length of code verifier (per RFC 7636)
 */
const CODE_VERIFIER_MIN_LENGTH = 43;

/**
 * Maximum length of code verifier (per RFC 7636)
 */
const CODE_VERIFIER_MAX_LENGTH = 128;

/**
 * Default length of code verifier (64 characters)
 */
const CODE_VERIFIER_DEFAULT_LENGTH = 64;

/**
 * Generate a cryptographically secure random Base64URL string
 *
 * @param length - Desired length of the output string
 * @returns Random Base64URL string
 */
function generateRandomBase64Url(length: number): string {
  // Calculate required number of bytes (4/3 ratio for Base64)
  const byteLength = Math.ceil((length * 3) / 4);
  const buffer = new Uint8Array(byteLength);
  crypto.getRandomValues(buffer);

  // Convert to Base64URL
  const base64 = Buffer.from(buffer).toString("base64");
  const base64Url = base64
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");

  // Truncate to exact length
  return base64Url.slice(0, length);
}

/**
 * Generate SHA-256 hash of a string and encode as Base64URL
 *
 * @param input - String to hash
 * @returns Base64URL-encoded SHA-256 hash
 */
async function sha256Base64Url(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);

  // Convert to Base64URL
  const base64 = Buffer.from(hashBuffer).toString("base64");
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
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
 * Generate a PKCE challenge for OAuth 2.1
 *
 * Creates a code verifier and derives a code challenge using SHA-256.
 * The code verifier should be stored securely on the client side,
 * while the code challenge is sent to the OAuth provider.
 *
 * Per RFC 7636:
 * - Code verifier: 43-128 character random string
 * - Code challenge: BASE64URL(SHA256(code_verifier))
 * - Code challenge method: S256
 *
 * @param length - Optional length of code verifier (default: 64)
 * @returns PKCE challenge with verifier, challenge, and method
 *
 * @example
 * ```ts
 * // Generate PKCE challenge
 * const pkce = await generatePKCEChallenge();
 *
 * // Store verifier in httpOnly cookie
 * response.cookies.set("pkce_verifier", pkce.codeVerifier, {
 *   httpOnly: true,
 *   secure: true,
 *   sameSite: "strict",
 *   maxAge: 600,
 * });
 *
 * // Send challenge to OAuth provider
 * const authUrl = new URL("https://provider.com/oauth/authorize");
 * authUrl.searchParams.set("code_challenge", pkce.codeChallenge);
 * authUrl.searchParams.set("code_challenge_method", pkce.codeChallengeMethod);
 * ```
 */
export async function generatePKCEChallenge(
  length: number = CODE_VERIFIER_DEFAULT_LENGTH
): Promise<PKCEChallenge> {
  // Validate length
  if (length < CODE_VERIFIER_MIN_LENGTH || length > CODE_VERIFIER_MAX_LENGTH) {
    throw new Error(
      `PKCE code verifier length must be between ${CODE_VERIFIER_MIN_LENGTH} and ${CODE_VERIFIER_MAX_LENGTH}`
    );
  }

  // Generate code verifier
  const codeVerifier = generateRandomBase64Url(length);

  // Generate code challenge (SHA-256 hash of verifier)
  const codeChallenge = await sha256Base64Url(codeVerifier);

  return {
    codeVerifier,
    codeChallenge,
    codeChallengeMethod: "S256",
  };
}

/**
 * Verify a PKCE code verifier against a code challenge
 *
 * Validates that the provided code verifier, when hashed with SHA-256,
 * matches the expected code challenge. Uses constant-time comparison
 * to prevent timing attacks.
 *
 * @param codeVerifier - Code verifier from client
 * @param expectedChallenge - Expected code challenge from initial request
 * @returns True if verification succeeds
 *
 * @example
 * ```ts
 * // In OAuth callback handler
 * const storedVerifier = request.cookies.get("pkce_verifier")?.value;
 * const storedChallenge = request.cookies.get("pkce_challenge")?.value;
 *
 * if (!storedVerifier || !storedChallenge) {
 *   return redirect("/?error=missing_pkce");
 * }
 *
 * const isValid = await verifyPKCEChallenge(storedVerifier, storedChallenge);
 * if (!isValid) {
 *   return redirect("/?error=invalid_pkce");
 * }
 *
 * // PKCE verification passed, proceed with token exchange
 * ```
 */
export async function verifyPKCEChallenge(
  codeVerifier: string,
  expectedChallenge: string
): Promise<boolean> {
  // Validate code verifier length
  if (
    codeVerifier.length < CODE_VERIFIER_MIN_LENGTH ||
    codeVerifier.length > CODE_VERIFIER_MAX_LENGTH
  ) {
    return false;
  }

  // Compute challenge from verifier
  const computedChallenge = await sha256Base64Url(codeVerifier);

  // Constant-time comparison
  return constantTimeCompare(computedChallenge, expectedChallenge);
}

/**
 * Validate PKCE code verifier format
 *
 * Checks that the code verifier:
 * - Has correct length (43-128 characters)
 * - Contains only Base64URL characters
 *
 * @param codeVerifier - Code verifier to validate
 * @returns True if format is valid
 *
 * @example
 * ```ts
 * if (!isValidCodeVerifierFormat(verifier)) {
 *   throw new Error("Invalid PKCE code verifier format");
 * }
 * ```
 */
export function isValidCodeVerifierFormat(codeVerifier: string): boolean {
  // Check length
  if (
    codeVerifier.length < CODE_VERIFIER_MIN_LENGTH ||
    codeVerifier.length > CODE_VERIFIER_MAX_LENGTH
  ) {
    return false;
  }

  // Check characters (Base64URL: A-Z, a-z, 0-9, -, _)
  const base64UrlPattern = /^[A-Za-z0-9\-_]+$/;
  return base64UrlPattern.test(codeVerifier);
}
