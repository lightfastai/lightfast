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
      isAllowedWebOrigin(
        "https://app-tanstack.app-tanstack.lightfast.localhost"
      )
    ).toBe(true);
  });

  it("rejects unrelated web origins", async () => {
    const { isAllowedWebOrigin } = await importCors();

    expect(isAllowedWebOrigin("https://example.com")).toBe(false);
  });

  it("allows localhost desktop dev origins only in development", async () => {
    const { isDesktopDevOrigin } = await importCors();

    expect(isDesktopDevOrigin("http://localhost:5173")).toBe(true);
    expect(isDesktopDevOrigin("https://localhost:443")).toBe(true);
    expect(isDesktopDevOrigin("https://127.0.0.1:5173")).toBe(false);

    vi.stubEnv("NODE_ENV", "production");
    const productionCors = await importCors();

    expect(productionCors.isDesktopDevOrigin("http://localhost:5173")).toBe(
      false
    );
  });

  it("allows packaged desktop requests with the native desktop marker", async () => {
    const { isPackagedDesktopRequest, setCorsHeaders } = await importCors();
    const request = new Request("https://lightfast.localhost/api/trpc/ping", {
      headers: {
        origin: "null",
        "x-lightfast-desktop": "1",
      },
      method: "OPTIONS",
    });

    expect(isPackagedDesktopRequest("null", request.headers)).toBe(true);

    const response = setCorsHeaders(
      request,
      new Response(null, { status: 204 })
    );

    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("null");
    expect(response.headers.get("Access-Control-Allow-Headers")).toContain(
      "x-lightfast-desktop"
    );
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
