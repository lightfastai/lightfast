import type { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

function setupMocks(opts: {
  appUrl: string;
  vercelEnv: "development" | "preview" | "production" | undefined;
  platformUrl?: string;
  wwwUrl?: string;
}) {
  vi.doMock("~/origins", () => ({
    appUrl: opts.appUrl,
    wwwUrl: opts.wwwUrl ?? "https://www.lightfast.localhost",
    platformUrl: opts.platformUrl ?? "https://platform.lightfast.localhost",
  }));
  vi.doMock("~/env", () => ({
    env: { NEXT_PUBLIC_VERCEL_ENV: opts.vercelEnv },
  }));
}

beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  vi.doUnmock("~/origins");
  vi.doUnmock("~/env");
  vi.doUnmock("@api/platform");
  vi.doUnmock("@trpc/server/adapters/fetch");
  vi.unstubAllEnvs();
});

function mockRouteDependencies() {
  vi.doMock("@api/platform", () => ({
    createTRPCContext: vi.fn(),
    platformRouter: {},
  }));
  vi.doMock("@trpc/server/adapters/fetch", () => ({
    fetchRequestHandler: vi.fn(async () => new Response(null, { status: 204 })),
  }));
}

function optionsRequest(origin: string): NextRequest {
  const requestHeaders = new Headers({ origin });
  return { headers: requestHeaders } as NextRequest;
}

describe("platform isAllowedWebOrigin", () => {
  it("admits app origin in production", async () => {
    setupMocks({ appUrl: "https://lightfast.ai", vercelEnv: "production" });
    const { isAllowedWebOrigin } = await import("~/cors");
    expect(isAllowedWebOrigin("https://lightfast.ai")).toBe(true);
  });

  it("admits the exact direct local app origin in dev", async () => {
    setupMocks({
      appUrl: "https://app.lightfast.localhost",
      wwwUrl: "https://www.lightfast.localhost",
      platformUrl: "https://platform.lightfast.localhost",
      vercelEnv: undefined,
    });
    const { isAllowedWebOrigin } = await import("~/cors");
    expect(isAllowedWebOrigin("https://app.lightfast.localhost")).toBe(true);
  });

  it("rejects direct local www and platform origins in dev", async () => {
    setupMocks({
      appUrl: "https://app.lightfast.localhost",
      wwwUrl: "https://www.lightfast.localhost",
      platformUrl: "https://platform.lightfast.localhost",
      vercelEnv: undefined,
    });
    const { isAllowedWebOrigin } = await import("~/cors");
    expect(isAllowedWebOrigin("https://www.lightfast.localhost")).toBe(false);
    expect(isAllowedWebOrigin("https://platform.lightfast.localhost")).toBe(
      false
    );
  });

  it("does not wildcard uninjected worktree origins", async () => {
    setupMocks({
      appUrl: "https://app.lightfast.localhost",
      wwwUrl: "https://www.lightfast.localhost",
      platformUrl: "https://platform.lightfast.localhost",
      vercelEnv: undefined,
    });
    const { isAllowedWebOrigin } = await import("~/cors");
    expect(isAllowedWebOrigin("https://feature.app.lightfast.localhost")).toBe(
      false
    );
  });

  it("throws if appUrl resolves to production URL in dev", async () => {
    setupMocks({ appUrl: "https://lightfast.ai", vercelEnv: undefined });
    await expect(import("~/cors")).rejects.toThrow(
      /portless daemon likely not running/
    );
  });
});

describe("platform tRPC OPTIONS route CORS headers", () => {
  beforeEach(() => {
    setupMocks({
      appUrl: "https://app.lightfast.localhost",
      platformUrl: "https://platform.lightfast.localhost",
      vercelEnv: undefined,
      wwwUrl: "https://www.lightfast.localhost",
    });
    mockRouteDependencies();
  });

  it("echoes the direct app origin", async () => {
    const { OPTIONS } = await import("~/app/(trpc)/api/trpc/[trpc]/route");
    const response = OPTIONS(optionsRequest("https://app.lightfast.localhost"));

    expect(response.status).toBe(204);
    expect(response.headers.get("access-control-allow-origin")).toBe(
      "https://app.lightfast.localhost"
    );
    expect(response.headers.get("access-control-allow-methods")).toBe(
      "GET,POST,OPTIONS"
    );
    expect(response.headers.get("access-control-allow-credentials")).toBe(
      "true"
    );
    expect(response.headers.get("vary")).toBe("Origin");
  });

  it("omits CORS headers for direct www and aggregate origins", async () => {
    const { OPTIONS } = await import("~/app/(trpc)/api/trpc/[trpc]/route");

    for (const origin of [
      "https://www.lightfast.localhost",
      "https://lightfast.localhost",
    ]) {
      const response = OPTIONS(optionsRequest(origin));
      expect(response.status).toBe(204);
      expect(response.headers.get("access-control-allow-origin")).toBeNull();
      expect(
        response.headers.get("access-control-allow-credentials")
      ).toBeNull();
      expect(response.headers.get("vary")).toBeNull();
    }
  });
});
