/**
 * OAuth type definitions and interfaces
 *
 * This module provides type-safe interfaces for OAuth state management,
 * PKCE (Proof Key for Code Exchange), and token encryption.
 */

/**
 * OAuth state structure with security features
 *
 * @property token - Cryptographically random token (32 bytes hex)
 * @property timestamp - Unix timestamp (ms) when state was generated
 * @property nonce - One-time-use nonce to prevent replay attacks
 * @property redirectPath - Optional path to redirect to after OAuth completion
 */
export interface OAuthState {
  /** Cryptographically random token (32 bytes encoded as hex) */
  token: string;

  /** Unix timestamp in milliseconds when this state was generated */
  timestamp: number;

  /** One-time-use nonce to prevent replay attacks */
  nonce: string;

  /** Optional path to redirect to after successful OAuth flow */
  redirectPath?: string;
}

/**
 * Result of OAuth state generation
 *
 * @property state - The OAuth state object
 * @property encoded - Base64URL-encoded state for cookie storage
 */
export interface OAuthStateGenerationResult {
  /** The OAuth state object with security metadata */
  state: OAuthState;

  /** Base64URL-encoded state for storage in cookies or session */
  encoded: string;
}

/**
 * Error types for OAuth state validation failures
 */
export type OAuthStateValidationError =
  | "expired"
  | "mismatch"
  | "invalid_format"
  | "already_used";

/**
 * Result of OAuth state validation
 *
 * @property valid - Whether the state is valid
 * @property error - Error type if validation failed
 * @property state - Decoded OAuth state if valid
 */
export interface OAuthStateValidationResult {
  /** Whether the state passed all validation checks */
  valid: boolean;

  /** Error type if validation failed */
  error?: OAuthStateValidationError;

  /** Decoded OAuth state object if validation succeeded */
  state?: OAuthState;
}

/**
 * PKCE (Proof Key for Code Exchange) challenge structure
 *
 * Used for OAuth 2.1 PKCE flow to prevent authorization code interception attacks.
 *
 * @property codeVerifier - Random string (43-128 chars, base64url)
 * @property codeChallenge - SHA-256 hash of code verifier (base64url)
 * @property codeChallengeMethod - Always "S256" (SHA-256)
 */
export interface PKCEChallenge {
  /** Random code verifier string (43-128 characters, base64url-encoded) */
  codeVerifier: string;

  /** SHA-256 hash of the code verifier (base64url-encoded) */
  codeChallenge: string;

  /** Code challenge method, always "S256" for SHA-256 */
  codeChallengeMethod: "S256";
}

/**
 * OAuth token encryption result
 *
 * @property encryptedToken - AES-256-GCM encrypted token
 * @property iv - Initialization vector used for encryption
 * @property authTag - Authentication tag for GCM mode
 */
export interface EncryptedToken {
  /** Base64-encoded encrypted token data */
  encryptedToken: string;

  /** Base64-encoded initialization vector (IV) */
  iv: string;

  /** Base64-encoded authentication tag for GCM verification */
  authTag: string;
}

/**
 * Options for OAuth state generation
 */
export interface OAuthStateOptions {
  /** Optional redirect path to include in state */
  redirectPath?: string;
}

/**
 * Options for OAuth state validation
 */
export interface OAuthStateValidationOptions {
  /** Maximum age of state in milliseconds (default: 10 minutes) */
  maxAgeMs?: number;

  /** Whether to mark state as used (prevents replay attacks) */
  markAsUsed?: boolean;
}

/**
 * Options for token encryption
 */
export interface TokenEncryptionOptions {
  /** Encryption algorithm (default: AES-256-GCM) */
  algorithm?: "aes-256-gcm";
}

/**
 * Options for token decryption
 */
export interface TokenDecryptionOptions {
  /** Decryption algorithm (must match encryption) */
  algorithm?: "aes-256-gcm";
}
