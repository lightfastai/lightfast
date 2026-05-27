import { afterEach, describe, expect, it } from "vitest";

import { resolveE2EApiKey } from "./env";

const ORIGINAL_ENV = { ...process.env };

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe("resolveE2EApiKey", () => {
  it("accepts lf_ API keys", () => {
    process.env.LIGHTFAST_E2E_API_KEY = "lf_test_key";

    expect(resolveE2EApiKey()).toBe("lf_test_key");
  });

  it("rejects legacy ak_ API keys", () => {
    process.env.LIGHTFAST_E2E_API_KEY = "ak_legacy_key";

    expect(() => resolveE2EApiKey()).toThrow(/lf_ prefix/);
  });
});
