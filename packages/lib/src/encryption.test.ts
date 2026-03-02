import { describe, expect, test } from "vitest";
import { decrypt, DecryptionError, encrypt, EncryptionError } from "./encryption";

const TEST_KEY = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

describe("encrypt / decrypt round-trip", () => {
	test("encrypts and decrypts a string", async () => {
		const plaintext = "my-secret-token";
		const ciphertext = await encrypt(plaintext, TEST_KEY);
		expect(ciphertext).not.toBe(plaintext);
		const decrypted = await decrypt(ciphertext, TEST_KEY);
		expect(decrypted).toBe(plaintext);
	});

	test("produces different ciphertext for the same plaintext (random IV)", async () => {
		const plaintext = "same-input";
		const c1 = await encrypt(plaintext, TEST_KEY);
		const c2 = await encrypt(plaintext, TEST_KEY);
		expect(c1).not.toBe(c2);
	});

	test("round-trips with base64 key", async () => {
		// 32-byte key encoded as base64
		const b64Key = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=";
		const ciphertext = await encrypt("hello", b64Key);
		const decrypted = await decrypt(ciphertext, b64Key);
		expect(decrypted).toBe("hello");
	});
});

describe("backward compatibility — decrypts Node.js-generated ciphertext", () => {
	test("decrypts ciphertext produced by the old Node.js crypto implementation", async () => {
		// Ciphertext pre-computed with the Node.js createCipheriv implementation
		// using key=TEST_KEY, IV=000102030405060708090a0b, plaintext="test-token-value"
		const legacyCiphertext = "AAECAwQFBgcICQoLGCz7T1/3lUdP7TAgw9NOhPVh6Wkrk01j/6XkZRbT16U=";
		const decrypted = await decrypt(legacyCiphertext, TEST_KEY);
		expect(decrypted).toBe("test-token-value");
	});
});

describe("encrypt error cases", () => {
	test("throws EncryptionError for empty plaintext", async () => {
		await expect(encrypt("", TEST_KEY)).rejects.toThrow(EncryptionError);
	});

	test("throws EncryptionError for invalid key", async () => {
		await expect(encrypt("hello", "tooshort")).rejects.toThrow(EncryptionError);
	});
});

describe("decrypt error cases", () => {
	test("throws DecryptionError for empty ciphertext", async () => {
		await expect(decrypt("", TEST_KEY)).rejects.toThrow(DecryptionError);
	});

	test("throws DecryptionError for wrong key", async () => {
		const ciphertext = await encrypt("hello", TEST_KEY);
		const wrongKey = "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff";
		await expect(decrypt(ciphertext, wrongKey)).rejects.toThrow(DecryptionError);
	});

	test("throws DecryptionError for tampered ciphertext", async () => {
		const ciphertext = await encrypt("hello", TEST_KEY);
		const bytes = Uint8Array.from(atob(ciphertext), (c) => c.charCodeAt(0));
		// Flip a byte in the ciphertext portion
		const lastIdx = bytes.length - 1;
		bytes[lastIdx] = (bytes[lastIdx] ?? 0) ^ 0xff;
		const tampered = btoa(Array.from(bytes, (b) => String.fromCharCode(b)).join(""));
		await expect(decrypt(tampered, TEST_KEY)).rejects.toThrow(DecryptionError);
	});
});
