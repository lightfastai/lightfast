import { describe, expect, it, vi } from "vitest";

import { createLightfast } from "../index";

describe("createLightfast", () => {
  it("rejects non-sk-lf- keys", () => {
    expect(() => createLightfast("not-a-key")).toThrow(
      /Invalid Lightfast API key/
    );
  });

  it("attaches Authorization: Bearer <apiKey>", async () => {
    let lastRequest: { url: string; authHeader: string | null } | undefined;
    const fetchMock = vi.fn(async (input: Request) => {
      lastRequest = {
        url: input.url,
        authHeader: input.headers.get("authorization"),
      };
      return new Response(
        JSON.stringify({
          status: "ok",
          timestamp: "2026-05-10T00:00:00Z",
          version: "test",
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      );
    });

    const lf = createLightfast("sk-lf-test-key", {
      baseUrl: "https://example.test",
      fetch: fetchMock as unknown as typeof fetch,
    });

    const result = await lf.system.health();

    expect(result).toEqual({
      status: "ok",
      timestamp: "2026-05-10T00:00:00Z",
      version: "test",
    });
    expect(lastRequest?.authHeader).toBe("Bearer sk-lf-test-key");
    expect(lastRequest?.url).toBe("https://example.test/api/v1/system/health");
  });

  it("strips trailing slash from baseUrl", async () => {
    let capturedUrl = "";
    const fetchMock = vi.fn(async (input: Request) => {
      capturedUrl = input.url;
      return new Response(
        JSON.stringify({ status: "ok", timestamp: "x", version: "x" }),
        { status: 200, headers: { "content-type": "application/json" } }
      );
    });

    const lf = createLightfast("sk-lf-test", {
      baseUrl: "https://example.test/",
      fetch: fetchMock as unknown as typeof fetch,
    });
    await lf.system.health();

    expect(capturedUrl).toBe("https://example.test/api/v1/system/health");
  });
});
