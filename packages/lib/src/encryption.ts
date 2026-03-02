/**
 * AES-256-GCM encryption using Web Crypto API.
 * Edge Runtime compatible — no Node.js crypto.
 *
 * Wire format: base64(IV[12] + authTag[16] + ciphertext)
 * This format is backward-compatible with the previous Node.js implementation.
 */

const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const KEY_LENGTH = 32;

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

function hexToBytes(hex: string): Uint8Array {
	if (hex.length % 2 !== 0 || !/^[0-9a-fA-F]*$/.test(hex)) {
		throw new Error("Invalid hex string");
	}
	const bytes = new Uint8Array(hex.length / 2);
	for (let i = 0; i < hex.length; i += 2) {
		bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
	}
	return bytes;
}

function base64ToBytes(b64: string): Uint8Array {
	const binary = atob(b64);
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i++) {
		bytes[i] = binary.charCodeAt(i);
	}
	return bytes;
}

function bytesToBase64(bytes: Uint8Array): string {
	let binary = "";
	for (const byte of bytes) {
		binary += String.fromCharCode(byte);
	}
	return btoa(binary);
}

function validateKey(key: string): Uint8Array {
	if (!key || typeof key !== "string") {
		throw new EncryptionError("Encryption key must be a non-empty string");
	}

	try {
		// Try hex first (preferred format: 64 hex chars = 32 bytes)
		const hexBytes = hexToBytes(key);
		if (hexBytes.length === KEY_LENGTH) return hexBytes;
	} catch {
		// Not valid hex, try base64
	}

	try {
		const b64Bytes = base64ToBytes(key);
		if (b64Bytes.length === KEY_LENGTH) return b64Bytes;
	} catch {
		// Not valid base64 either
	}

	throw new EncryptionError(
		`Encryption key must be ${KEY_LENGTH} bytes (64 hex chars or 44 base64 chars).`,
	);
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
 */
export async function encrypt(plaintext: string, key: string): Promise<string> {
	if (!plaintext || typeof plaintext !== "string") {
		throw new EncryptionError("Plaintext must be a non-empty string");
	}

	try {
		const keyBytes = validateKey(key);
		const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));

		const cryptoKey = await crypto.subtle.importKey(
			"raw",
			keyBytes as Uint8Array<ArrayBuffer>,
			"AES-GCM",
			false,
			["encrypt"],
		);

		const plaintextBytes = new TextEncoder().encode(plaintext);
		const encrypted = new Uint8Array(
			await crypto.subtle.encrypt(
				{ name: "AES-GCM", iv: iv as Uint8Array<ArrayBuffer>, tagLength: AUTH_TAG_LENGTH * 8 },
				cryptoKey,
				plaintextBytes as Uint8Array<ArrayBuffer>,
			),
		);

		// Web Crypto returns ciphertext || authTag
		// Our wire format is IV || authTag || ciphertext
		const ciphertext = encrypted.subarray(0, encrypted.length - AUTH_TAG_LENGTH);
		const authTag = encrypted.subarray(encrypted.length - AUTH_TAG_LENGTH);

		const result = new Uint8Array(IV_LENGTH + AUTH_TAG_LENGTH + ciphertext.length);
		result.set(iv, 0);
		result.set(authTag, IV_LENGTH);
		result.set(ciphertext, IV_LENGTH + AUTH_TAG_LENGTH);

		return bytesToBase64(result);
	} catch (error) {
		if (error instanceof EncryptionError) throw error;
		throw new EncryptionError("Failed to encrypt data", error);
	}
}

/**
 * Decrypts ciphertext encrypted with AES-256-GCM
 *
 * @param ciphertext - Base64-encoded encrypted string (from encrypt())
 * @param key - Encryption key (32 bytes as hex or base64 string)
 * @returns Decrypted plaintext string
 */
export async function decrypt(ciphertext: string, key: string): Promise<string> {
	if (!ciphertext || typeof ciphertext !== "string") {
		throw new DecryptionError("Ciphertext must be a non-empty string");
	}

	try {
		const keyBytes = validateKey(key);
		const buffer = base64ToBytes(ciphertext);

		if (buffer.length < IV_LENGTH + AUTH_TAG_LENGTH) {
			throw new DecryptionError("Ciphertext is too short - data may be corrupted");
		}

		const iv = buffer.subarray(0, IV_LENGTH);
		const authTag = buffer.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
		const encrypted = buffer.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

		// Web Crypto expects ciphertext || authTag
		const combined = new Uint8Array(encrypted.length + AUTH_TAG_LENGTH);
		combined.set(encrypted, 0);
		combined.set(authTag, encrypted.length);

		const cryptoKey = await crypto.subtle.importKey(
			"raw",
			keyBytes as Uint8Array<ArrayBuffer>,
			"AES-GCM",
			false,
			["decrypt"],
		);

		const decrypted = await crypto.subtle.decrypt(
			{ name: "AES-GCM", iv: iv as Uint8Array<ArrayBuffer>, tagLength: AUTH_TAG_LENGTH * 8 },
			cryptoKey,
			combined as Uint8Array<ArrayBuffer>,
		);

		return new TextDecoder().decode(decrypted);
	} catch (error) {
		if (error instanceof DecryptionError || error instanceof EncryptionError) {
			throw error;
		}

		const errorMessage = error instanceof Error ? error.message : String(error);

		if (errorMessage.includes("OperationError") || errorMessage.includes("The operation failed")) {
			throw new DecryptionError(
				"Authentication failed - data may be corrupted or key is incorrect",
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
 */
export async function generateEncryptionKey(): Promise<string> {
	const bytes = crypto.getRandomValues(new Uint8Array(KEY_LENGTH));
	return Array.from(bytes)
		.map((b) => b.toString(16).padStart(2, "0"))
		.join("");
}
