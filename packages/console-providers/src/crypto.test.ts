import { describe, it, expect } from "vitest";
import { timingSafeStringEqual, sha256Hex } from "./crypto.js";

describe("timingSafeStringEqual", () => {
  it("returns true for identical strings", () => {
    expect(timingSafeStringEqual("test-api-key", "test-api-key")).toBe(true);
  });

  it("returns false for different strings", () => {
    expect(timingSafeStringEqual("test-api-key", "wrong-key")).toBe(false);
  });

  it("returns false for empty vs non-empty", () => {
    expect(timingSafeStringEqual("", "something")).toBe(false);
  });

  it("returns true for two empty strings", () => {
    expect(timingSafeStringEqual("", "")).toBe(true);
  });

  it("returns false for same-length strings that differ", () => {
    expect(timingSafeStringEqual("aaaa", "aaab")).toBe(false);
  });
});

describe("sha256Hex", () => {
  it("returns consistent hex hash", () => {
    const hash = sha256Hex("hello");
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(sha256Hex("hello")).toBe(hash);
  });

  it("returns different hashes for different inputs", () => {
    expect(sha256Hex("a")).not.toBe(sha256Hex("b"));
  });
});
