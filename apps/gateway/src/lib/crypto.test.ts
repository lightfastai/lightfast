import { describe, it, expect } from "vitest";
import { computeHmacSha256, computeHmacSha1, timingSafeEqual } from "./crypto";

describe("computeHmacSha256", () => {
  it("produces correct hex signature for known input", async () => {
    // RFC 4231 test vector #2 (key="Jefe", data="what do ya want for nothing?")
    const sig = await computeHmacSha256("what do ya want for nothing?", "Jefe");
    expect(sig).toBe(
      "5bdcc146bf60754e6a042426089575c75a003f089d2739839dec58b964ec3843",
    );
  });

  it("different secrets produce different signatures", async () => {
    const sig1 = await computeHmacSha256("hello", "secret-a");
    const sig2 = await computeHmacSha256("hello", "secret-b");
    expect(sig1).not.toBe(sig2);
  });

  it("handles unicode/emoji in message body", async () => {
    const body = '{"message":"Deploy from 東京 🚀","author":"田中太郎"}';
    const sig = await computeHmacSha256(body, "secret");
    // Signature is deterministic — same input always produces same output
    const sig2 = await computeHmacSha256(body, "secret");
    expect(sig).toBe(sig2);
    expect(sig).toHaveLength(64); // SHA-256 = 32 bytes = 64 hex chars
  });

  it("handles empty message body", async () => {
    const sig = await computeHmacSha256("", "secret");
    expect(sig).toHaveLength(64);
  });
});

describe("computeHmacSha1", () => {
  it("produces correct hex signature for known input", async () => {
    // RFC 2202 test vector #2 (key="Jefe", data="what do ya want for nothing?")
    const sig = await computeHmacSha1("what do ya want for nothing?", "Jefe");
    expect(sig).toBe("effcdf6ae5eb2fa2d27416d5f184df9c259a7c79");
  });
});

describe("timingSafeEqual", () => {
  it("returns true for equal strings", () => {
    expect(timingSafeEqual("abc123", "abc123")).toBe(true);
  });

  it("returns false for different strings of same length", () => {
    expect(timingSafeEqual("abc123", "abc124")).toBe(false);
  });

  it("returns false for different lengths", () => {
    expect(timingSafeEqual("short", "longer-string")).toBe(false);
  });

  it("returns false for empty vs non-empty", () => {
    expect(timingSafeEqual("", "a")).toBe(false);
  });

  it("returns true for two empty strings", () => {
    expect(timingSafeEqual("", "")).toBe(true);
  });
});
