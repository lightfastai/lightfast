import { describe, it, expect } from "vitest";
import { encrypt, decrypt } from "./crypto";

const TEST_KEY = "a]b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2";

describe("crypto", () => {
  it("round-trips plaintext through encrypt → decrypt", async () => {
    const plaintext = "ghu_abc123_secret_token";
    const encrypted = await encrypt(plaintext, TEST_KEY);
    const decrypted = await decrypt(encrypted, TEST_KEY);
    expect(decrypted).toBe(plaintext);
  });

  it("produces different ciphertext for the same plaintext (random IV)", async () => {
    const plaintext = "same-input";
    const a = await encrypt(plaintext, TEST_KEY);
    const b = await encrypt(plaintext, TEST_KEY);
    expect(a).not.toBe(b);

    // Both decrypt to the same value
    expect(await decrypt(a, TEST_KEY)).toBe(plaintext);
    expect(await decrypt(b, TEST_KEY)).toBe(plaintext);
  });

  it("handles empty string", async () => {
    const encrypted = await encrypt("", TEST_KEY);
    const decrypted = await decrypt(encrypted, TEST_KEY);
    expect(decrypted).toBe("");
  });

  it("handles unicode content", async () => {
    const plaintext = "token-with-emoji-\u{1F680}-and-kanji-\u{6F22}\u{5B57}";
    const encrypted = await encrypt(plaintext, TEST_KEY);
    const decrypted = await decrypt(encrypted, TEST_KEY);
    expect(decrypted).toBe(plaintext);
  });

  it("handles long tokens", async () => {
    const plaintext = "x".repeat(10_000);
    const encrypted = await encrypt(plaintext, TEST_KEY);
    const decrypted = await decrypt(encrypted, TEST_KEY);
    expect(decrypted).toBe(plaintext);
  });

  it("fails to decrypt with a different key", async () => {
    const encrypted = await encrypt("secret", TEST_KEY);
    const wrongKey = "ff".repeat(32);
    await expect(decrypt(encrypted, wrongKey)).rejects.toThrow();
  });

  it("fails to decrypt tampered ciphertext", async () => {
    const encrypted = await encrypt("secret", TEST_KEY);
    // Flip a character in the middle of the base64 string
    const chars = encrypted.split("");
    const mid = Math.floor(chars.length / 2);
    chars[mid] = chars[mid] === "A" ? "B" : "A";
    const tampered = chars.join("");
    await expect(decrypt(tampered, TEST_KEY)).rejects.toThrow();
  });

  it("pads short keys to 32 bytes", async () => {
    const shortKey = "abcdef";
    const encrypted = await encrypt("test", shortKey);
    const decrypted = await decrypt(encrypted, shortKey);
    expect(decrypted).toBe("test");
  });
});
