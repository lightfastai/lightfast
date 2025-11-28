/**
 * @repo/console-oauth
 *
 * OAuth Security Utilities for Console Application
 *
 * This package provides cryptographic utilities for secure OAuth flows:
 * - OAuth state generation and validation with expiration
 * - PKCE challenge generation and verification (OAuth 2.1)
 * - OAuth token encryption/decryption (AES-256-GCM)
 *
 * Security Features:
 * - Web Crypto API for all cryptographic operations
 * - Timestamp-based expiration (default 10 minutes)
 * - One-time-use nonce for replay attack prevention
 * - PKCE with SHA-256 code challenge method
 * - AES-256-GCM authenticated encryption for tokens
 * - Constant-time comparisons to prevent timing attacks
 * - Base64URL encoding for cookie/session storage
 *
 * @example
 * ```ts
 * import {
 *   generateOAuthState,
 *   validateOAuthState,
 *   generatePKCEChallenge,
 *   verifyPKCEChallenge,
 *   encryptOAuthToken,
 *   decryptOAuthToken,
 * } from "@repo/console-oauth";
 *
 * // OAuth State Flow
 * const { state, encoded } = generateOAuthState({ redirectPath: "/settings" });
 * // Store 'encoded' in httpOnly cookie
 *
 * // In callback:
 * const result = validateOAuthState(receivedState, storedState);
 * if (result.valid) {
 *   // Proceed with OAuth flow
 * }
 *
 * // PKCE Flow
 * const pkce = await generatePKCEChallenge();
 * // Store pkce.codeVerifier, send pkce.codeChallenge to provider
 *
 * // Token Encryption
 * const encrypted = await encryptOAuthToken(token, encryptionKey);
 * // Store encrypted token in cookie
 * ```
 */

// OAuth State
export {
  generateOAuthState,
  validateOAuthState,
  DEFAULT_STATE_MAX_AGE_MS,
} from "./state";

// PKCE
export {
  generatePKCEChallenge,
  verifyPKCEChallenge,
  isValidCodeVerifierFormat,
} from "./pkce";

// Token Encryption
export {
  encryptOAuthToken,
  decryptOAuthToken,
  encryptOAuthTokenToCookie,
  decryptOAuthTokenFromCookie,
} from "./tokens";

// Types
export type {
  OAuthState,
  OAuthStateGenerationResult,
  OAuthStateValidationError,
  OAuthStateValidationResult,
  OAuthStateOptions,
  OAuthStateValidationOptions,
  PKCEChallenge,
  EncryptedToken,
  TokenEncryptionOptions,
  TokenDecryptionOptions,
} from "./types";
