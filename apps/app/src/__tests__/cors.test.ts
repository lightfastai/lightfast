import type { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

function setupMocks(opts: {
  appUrl: string;
  platformUrl?: string;
  vercelEnv: "development" | "preview" | "production" | undefined;
  wwwUrl?: string;
}) {
  vi.doMock("~/origins", () => ({
    appUrl: opts.appUrl,
    platformUrl: opts.platformUrl ?? "https://platform.lightfast.localhost",
    wwwUrl: opts.wwwUrl ?? "https://www.lightfast.localhost",
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
  vi.doUnmock("@api/app");
  vi.doUnmock("@trpc/server/adapters/fetch");
  vi.unstubAllEnvs();
});

function mockRouteDependencies() {
  vi.doMock("@api/app", () => ({
    appRouter: {},
    createTRPCContext: vi.fn(),
  }));
  vi.doMock("@trpc/server/adapters/fetch", () => ({
    fetchRequestHandler: vi.fn(async () => new Response(null, { status: 204 })),
  }));
}

function optionsRequest(
  origin: string,
  headers: HeadersInit = {}
): NextRequest {
  const requestHeaders = new Headers(headers);
  requestHeaders.set("origin", origin);
  return { headers: requestHeaders } as NextRequest;
}

describe("isAllowedWebOrigin (dev)", () => {
  beforeEach(() => {
    setupMocks({
      appUrl: "https://app.lightfast.localhost/",
      platformUrl: "https://platform.lightfast.localhost",
      vercelEnv: undefined,
      wwwUrl: "https://www.lightfast.localhost",
    });
  });

  it("admits the canonical app origin (matches even though appUrl has trailing slash)", async () => {
    const { isAllowedWebOrigin } = await import("~/cors");
    expect(isAllowedWebOrigin("https://app.lightfast.localhost")).toBe(true);
  });

  it("rejects the direct local www origin; browser app traffic uses the MFE root", async () => {
    const { isAllowedWebOrigin } = await import("~/cors");
    expect(isAllowedWebOrigin("https://www.lightfast.localhost")).toBe(false);
  });

  it("rejects the direct local platform origin", async () => {
    const { isAllowedWebOrigin } = await import("~/cors");
    expect(isAllowedWebOrigin("https://platform.lightfast.localhost")).toBe(
      false
    );
  });

  it("rejects a worktree-prefixed app origin that is not an exact env URL", async () => {
    const { isAllowedWebOrigin } = await import("~/cors");
    expect(isAllowedWebOrigin("https://feature.app.lightfast.localhost")).toBe(
      false
    );
  });

  it("rejects an unrelated origin", async () => {
    const { isAllowedWebOrigin } = await import("~/cors");
    expect(isAllowedWebOrigin("https://evil.com")).toBe(false);
  });

  it("rejects null/empty", async () => {
    const { isAllowedWebOrigin } = await import("~/cors");
    expect(isAllowedWebOrigin(null)).toBe(false);
    expect(isAllowedWebOrigin("")).toBe(false);
  });

  it("rejects malformed origin strings", async () => {
    const { isAllowedWebOrigin } = await import("~/cors");
    expect(isAllowedWebOrigin("not-a-url")).toBe(false);
  });
});

describe("isAllowedWebOrigin (production)", () => {
  beforeEach(() => {
    setupMocks({
      appUrl: "https://lightfast.ai",
      vercelEnv: "production",
    });
  });

  it("admits only the canonical appUrl in non-dev", async () => {
    const { isAllowedWebOrigin } = await import("~/cors");
    expect(isAllowedWebOrigin("https://lightfast.ai")).toBe(true);
  });

  it("rejects portless wildcard origins in non-dev", async () => {
    const { isAllowedWebOrigin } = await import("~/cors");
    expect(isAllowedWebOrigin("https://app.lightfast.localhost")).toBe(false);
    expect(isAllowedWebOrigin("https://feature.app.lightfast.localhost")).toBe(
      false
    );
  });
});

describe("cold-start guard", () => {
  it("throws if appUrl resolved to production URL while in dev", async () => {
    setupMocks({
      appUrl: "https://lightfast.ai",
      vercelEnv: undefined,
    });
    await expect(import("~/cors")).rejects.toThrow(
      /portless daemon likely not running/
    );
  });
});

describe("isDesktopDevOrigin", () => {
  it("admits localhost in dev", async () => {
    vi.stubEnv("NODE_ENV", "development");
    setupMocks({
      appUrl: "https://app.lightfast.localhost/",
      vercelEnv: undefined,
    });
    const { isDesktopDevOrigin } = await import("~/cors");
    expect(isDesktopDevOrigin("http://localhost:5173")).toBe(true);
    expect(isDesktopDevOrigin("https://localhost:5173")).toBe(true);
    vi.unstubAllEnvs();
  });

  it("rejects localhost outside dev", async () => {
    vi.stubEnv("NODE_ENV", "production");
    setupMocks({ appUrl: "https://lightfast.ai", vercelEnv: "production" });
    const { isDesktopDevOrigin } = await import("~/cors");
    expect(isDesktopDevOrigin("http://localhost:5173")).toBe(false);
    vi.unstubAllEnvs();
  });

  it("rejects null and non-localhost", async () => {
    vi.stubEnv("NODE_ENV", "development");
    setupMocks({
      appUrl: "https://app.lightfast.localhost/",
      vercelEnv: undefined,
    });
    const { isDesktopDevOrigin } = await import("~/cors");
    expect(isDesktopDevOrigin(null)).toBe(false);
    expect(isDesktopDevOrigin("https://evil.com")).toBe(false);
    vi.unstubAllEnvs();
  });
});

describe("isPackagedDesktopRequest", () => {
  it("admits Origin: 'null' (string) + marker header == '1'", async () => {
    setupMocks({ appUrl: "https://lightfast.ai", vercelEnv: "production" });
    const { isPackagedDesktopRequest } = await import("~/cors");
    const headers = new Headers({ "x-lightfast-desktop": "1" });
    expect(isPackagedDesktopRequest("null", headers)).toBe(true);
  });

  it("rejects when Origin is a real URL even with marker", async () => {
    setupMocks({ appUrl: "https://lightfast.ai", vercelEnv: "production" });
    const { isPackagedDesktopRequest } = await import("~/cors");
    const headers = new Headers({ "x-lightfast-desktop": "1" });
    expect(isPackagedDesktopRequest("https://lightfast.ai", headers)).toBe(
      false
    );
    expect(isPackagedDesktopRequest("https://evil.com", headers)).toBe(false);
  });

  it("rejects absent Origin header (JS null) — only string 'null' qualifies", async () => {
    setupMocks({ appUrl: "https://lightfast.ai", vercelEnv: "production" });
    const { isPackagedDesktopRequest } = await import("~/cors");
    const headers = new Headers({ "x-lightfast-desktop": "1" });
    expect(isPackagedDesktopRequest(null, headers)).toBe(false);
  });

  it("rejects when marker header is missing or not exactly '1'", async () => {
    setupMocks({ appUrl: "https://lightfast.ai", vercelEnv: "production" });
    const { isPackagedDesktopRequest } = await import("~/cors");
    expect(isPackagedDesktopRequest("null", new Headers())).toBe(false);
    expect(
      isPackagedDesktopRequest(
        "null",
        new Headers({ "x-lightfast-desktop": "0" })
      )
    ).toBe(false);
    expect(
      isPackagedDesktopRequest(
        "null",
        new Headers({ "x-lightfast-desktop": "true" })
      )
    ).toBe(false);
  });
});

describe("tRPC OPTIONS route CORS headers", () => {
  beforeEach(() => {
    setupMocks({
      appUrl: "https://app.lightfast.localhost/",
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

  it("omits CORS headers for the direct www origin", async () => {
    const { OPTIONS } = await import("~/app/(trpc)/api/trpc/[trpc]/route");
    const response = OPTIONS(optionsRequest("https://www.lightfast.localhost"));

    expect(response.status).toBe(204);
    expect(response.headers.get("access-control-allow-origin")).toBeNull();
    expect(response.headers.get("access-control-allow-credentials")).toBeNull();
    expect(response.headers.get("vary")).toBeNull();
  });

  it("echoes the desktop dev localhost origin", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const { OPTIONS } = await import("~/app/(trpc)/api/trpc/[trpc]/route");
    const response = OPTIONS(optionsRequest("http://localhost:5173"));

    expect(response.status).toBe(204);
    expect(response.headers.get("access-control-allow-origin")).toBe(
      "http://localhost:5173"
    );
  });

  it("echoes packaged desktop Origin null only with the marker header", async () => {
    const { OPTIONS } = await import("~/app/(trpc)/api/trpc/[trpc]/route");
    const response = OPTIONS(
      optionsRequest("null", { "x-lightfast-desktop": "1" })
    );

    expect(response.status).toBe(204);
    expect(response.headers.get("access-control-allow-origin")).toBe("null");
  });
});
