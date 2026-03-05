import { describe, it, expect } from "vitest";
import { timingSafeStringEqual } from "./crypto.js";

describe("timingSafeStringEqual", () => {
  it("returns true for identical strings", async () => {
    expect(await timingSafeStringEqual("test-api-key", "test-api-key")).toBe(true);
  });

  it("returns false for different strings", async () => {
    expect(await timingSafeStringEqual("test-api-key", "wrong-key")).toBe(false);
  });

  it("returns false for empty vs non-empty", async () => {
    expect(await timingSafeStringEqual("", "something")).toBe(false);
  });

  it("returns true for two empty strings", async () => {
    expect(await timingSafeStringEqual("", "")).toBe(true);
  });

  it("returns false for same-length strings that differ", async () => {
    expect(await timingSafeStringEqual("aaaa", "aaab")).toBe(false);
  });
});
