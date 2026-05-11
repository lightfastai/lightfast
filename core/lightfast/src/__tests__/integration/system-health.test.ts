import { describe, expect, it } from "vitest";

import { createLightfast } from "../../index";

describe.skipIf(process.env.LIGHTFAST_RUN_INTEGRATION !== "1")("[integration] system.health end-to-end", () => {
  it("round-trips via SDK → live server → DB → SDK", async () => {
    const apiKey = process.env.__INTEGRATION_API_KEY__;
    const baseUrl = process.env.__INTEGRATION_BASE_URL__;
    if (!apiKey || !baseUrl) {
      throw new Error(
        "Integration globalSetup did not provision API key / baseUrl."
      );
    }

    const lf = createLightfast(apiKey, { baseUrl });
    const result = await lf.system.health();

    expect(result.status).toBe("ok");
    expect(result.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(typeof result.version).toBe("string");
  });

  it("rejects requests with an invalid key", async () => {
    const baseUrl = process.env.__INTEGRATION_BASE_URL__;
    if (!baseUrl) throw new Error("No baseUrl");

    const res = await fetch(`${baseUrl}/api/v1/system/health`, {
      headers: { authorization: "Bearer sk-lf-not-a-real-key" },
    });
    expect(res.status).toBe(401);
  });

  it("rejects requests with no Authorization header", async () => {
    const baseUrl = process.env.__INTEGRATION_BASE_URL__;
    if (!baseUrl) throw new Error("No baseUrl");

    const res = await fetch(`${baseUrl}/api/v1/system/health`);
    expect(res.status).toBe(401);
  });
});
