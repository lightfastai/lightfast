import { beforeEach, describe, expect, it, vi } from "vitest";

async function importCors() {
  vi.resetModules();
  return await import("~/cors");
}

describe("app-tanstack CORS", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("NEXT_PUBLIC_VERCEL_ENV", "development");
    vi.stubEnv("VITE_LIGHTFAST_APP_URL", "https://lightfast.localhost");
    vi.stubEnv(
      "PORTLESS_URL",
      "https://app-tanstack.app-tanstack.lightfast.localhost"
    );
  });

  it("allows the aggregate app origin", async () => {
    const { isAllowedWebOrigin } = await importCors();

    expect(isAllowedWebOrigin("https://lightfast.localhost")).toBe(true);
  });

  it("allows the direct app-tanstack Portless origin in dev", async () => {
    const { isAllowedWebOrigin } = await importCors();

    expect(
      isAllowedWebOrigin("https://app-tanstack.app-tanstack.lightfast.localhost")
    ).toBe(true);
  });

  it("rejects unrelated web origins", async () => {
    const { isAllowedWebOrigin } = await importCors();

    expect(isAllowedWebOrigin("https://example.com")).toBe(false);
  });

  it("echoes allowed origins on tRPC preflight responses", async () => {
    const { setCorsHeaders } = await importCors();
    const request = new Request("https://lightfast.localhost/api/trpc/ping", {
      headers: { origin: "https://lightfast.localhost" },
      method: "OPTIONS",
    });

    const response = setCorsHeaders(
      request,
      new Response(null, { status: 204 })
    );

    expect(response.headers.get("Access-Control-Allow-Origin")).toBe(
      "https://lightfast.localhost"
    );
    expect(response.headers.get("Access-Control-Allow-Credentials")).toBe(
      "true"
    );
  });
});
