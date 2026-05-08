import { verifyServiceJWT } from "@api/platform";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createPlatformClient } from "./index";

interface CapturedCall {
  url: string;
  init: RequestInit;
}

function installFetchMock(body: unknown): CapturedCall[] {
  const calls: CapturedCall[] = [];
  const fetchMock = vi.fn(async (input: string, init: RequestInit) => {
    calls.push({ url: input, init });
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  });
  globalThis.fetch = fetchMock as unknown as typeof fetch;
  return calls;
}

describe("createPlatformClient", () => {
  beforeEach(() => {
    process.env.SERVICE_JWT_SECRET = "x".repeat(48);
  });

  it("attaches a verifiable service JWT to outbound requests", async () => {
    const calls = installFetchMock([
      {
        result: {
          data: {
            json: {
              status: "ok",
              timestamp: "2026-05-08T00:00:00Z",
              caller: "app",
            },
          },
        },
      },
    ]);

    const client = createPlatformClient({
      caller: "app",
      baseUrl: "https://platform.test",
    });

    const result = await client.system.health.query();
    expect(result.status).toBe("ok");
    expect(calls[0]?.url).toContain("https://platform.test/api/trpc");

    const headers = new Headers(calls[0]?.init.headers);
    const authHeader = headers.get("authorization");
    expect(authHeader).toMatch(/^Bearer eyJ/);

    const token = authHeader!.slice("Bearer ".length);
    const verified = await verifyServiceJWT(token);
    expect(verified.caller).toBe("app");
  });

  it("emits x-trpc-source header tagged with caller", async () => {
    const calls = installFetchMock([
      {
        result: {
          data: {
            json: { status: "ok", timestamp: "x", caller: "inngest" },
          },
        },
      },
    ]);

    const client = createPlatformClient({
      caller: "inngest",
      baseUrl: "https://platform.test",
    });
    await client.system.health.query();

    const headers = new Headers(calls[0]?.init.headers);
    expect(headers.get("x-trpc-source")).toBe("service:inngest");
  });
});
