import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * Encryption algorithm configuration
 * AES-256-GCM provides:
 * - Strong encryption (256-bit key)
 * - Authenticated encryption (prevents tampering)
 * - Galois/Counter Mode for performance
 */
const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // 12 bytes for GCM (recommended)
const AUTH_TAG_LENGTH = 16; // 16 bytes for GCM
const KEY_LENGTH = 32; // 32 bytes for AES-256

/**
 * Encryption error types
 */
export class EncryptionError extends Error {
	constructor(message: string, cause?: unknown) {
		super(message);
		this.name = "EncryptionError";
		this.cause = cause;
	}
}

export class DecryptionError extends Error {
	constructor(message: string, cause?: unknown) {
		super(message);
		this.name = "DecryptionError";
		this.cause = cause;
	}
}

/**
 * Validates encryption key format and length
 *
 * @param key - Encryption key (hex string or base64)
 * @throws {EncryptionError} If key is invalid
 */
function validateKey(key: string): Buffer {
	if (!key || typeof key !== "string") {
		throw new EncryptionError("Encryption key must be a non-empty string");
	}

	try {
		// Try to decode as hex first (preferred format)
		const keyBuffer = Buffer.from(key, "hex");
		if (keyBuffer.length === KEY_LENGTH) {
			return keyBuffer;
		}

		// Try base64 if hex didn't work
		const keyBufferBase64 = Buffer.from(key, "base64");
		if (keyBufferBase64.length === KEY_LENGTH) {
			return keyBufferBase64;
		}

		throw new EncryptionError(
			`Encryption key must be ${KEY_LENGTH} bytes (64 hex chars or 44 base64 chars). Got ${key.length} chars resulting in ${keyBuffer.length} bytes.`,
		);
	} catch (error) {
		if (error instanceof EncryptionError) {
			throw error;
		}
		throw new EncryptionError("Invalid encryption key format", error);
	}
}

/**
 * Encrypts plaintext using AES-256-GCM
 *
 * Format: base64(iv + authTag + ciphertext)
 * - IV (12 bytes): Initialization vector (random, unique per encryption)
 * - Auth Tag (16 bytes): GCM authentication tag (prevents tampering)
 * - Ciphertext (variable): Encrypted data
 *
 * @param plaintext - The plaintext string to encrypt
 * @param key - Encryption key (32 bytes as hex or base64 string)
 * @returns Base64-encoded encrypted string (IV + Auth Tag + Ciphertext)
 * @throws {EncryptionError} If encryption fails or key is invalid
 *
 * @example
 * ```ts
 * const encrypted = encrypt("my-secret-token", process.env.ENCRYPTION_KEY);
 * // Returns: "AQIDBAUGBwgJCgsMDQ4P..." (base64)
 * ```
 */
export function encrypt(plaintext: string, key: string): string {
	if (!plaintext || typeof plaintext !== "string") {
		throw new EncryptionError("Plaintext must be a non-empty string");
	}

	try {
		// Validate and parse key
		const keyBuffer = validateKey(key);

		// Generate random IV for this encryption
		const iv = randomBytes(IV_LENGTH);

		// Create cipher with key and IV
		const cipher = createCipheriv(ALGORITHM, keyBuffer, iv);

		// Encrypt the plaintext
		const encrypted = Buffer.concat([
			cipher.update(plaintext, "utf8"),
			cipher.final(),
		]);

		// Get authentication tag (prevents tampering)
		const authTag = cipher.getAuthTag();

		// Combine: IV + Auth Tag + Encrypted Data
		const result = Buffer.concat([iv, authTag, encrypted]);

		// Return as base64 for easy storage
		return result.toString("base64");
	} catch (error) {
		if (error instanceof EncryptionError) {
			throw error;
		}
		throw new EncryptionError("Failed to encrypt data", error);
	}
}

/**
 * Decrypts ciphertext encrypted with AES-256-GCM
 *
 * @param ciphertext - Base64-encoded encrypted string (from encrypt())
 * @param key - Encryption key (32 bytes as hex or base64 string)
 * @returns Decrypted plaintext string
 * @throws {DecryptionError} If decryption fails, data is corrupted, or key is wrong
 *
 * @example
 * ```ts
 * const decrypted = decrypt(encryptedToken, process.env.ENCRYPTION_KEY);
 * // Returns: "my-secret-token"
 * ```
 */
export function decrypt(ciphertext: string, key: string): string {
	if (!ciphertext || typeof ciphertext !== "string") {
		throw new DecryptionError("Ciphertext must be a non-empty string");
	}

	try {
		// Validate and parse key
		const keyBuffer = validateKey(key);

		// Decode from base64
		const buffer = Buffer.from(ciphertext, "base64");

		// Extract components: IV + Auth Tag + Encrypted Data
		if (buffer.length < IV_LENGTH + AUTH_TAG_LENGTH) {
			throw new DecryptionError(
				"Ciphertext is too short - data may be corrupted",
			);
		}

		const iv = buffer.subarray(0, IV_LENGTH);
		const authTag = buffer.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
		const encrypted = buffer.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

		// Create decipher with key and IV
		const decipher = createDecipheriv(ALGORITHM, keyBuffer, iv);

		// Set authentication tag for verification
		decipher.setAuthTag(authTag);

		// Decrypt the data
		const decrypted = Buffer.concat([
			decipher.update(encrypted),
			decipher.final(), // This will throw if auth tag doesn't match (tampering detected)
		]);

		return decrypted.toString("utf8");
	} catch (error) {
		if (error instanceof DecryptionError || error instanceof EncryptionError) {
			throw error;
		}

		// Provide helpful error messages for common issues
		const errorMessage = error instanceof Error ? error.message : String(error);

		if (errorMessage.includes("Unsupported state or unable to authenticate")) {
			throw new DecryptionError(
				"Authentication failed - data may be corrupted or key is incorrect",
				error,
			);
		}

		if (errorMessage.includes("bad decrypt")) {
			throw new DecryptionError(
				"Decryption failed - incorrect key or corrupted data",
				error,
			);
		}

		throw new DecryptionError("Failed to decrypt data", error);
	}
}

/**
 * Generates a new encryption key suitable for AES-256-GCM
 *
 * @returns 32-byte key as hex string (64 characters)
 *
 * @example
 * ```ts
 * const key = generateEncryptionKey();
 * // Returns: "a1b2c3d4..." (64 hex chars = 32 bytes)
 * ```
 */
export function generateEncryptionKey(): string {
	return randomBytes(KEY_LENGTH).toString("hex");
}
