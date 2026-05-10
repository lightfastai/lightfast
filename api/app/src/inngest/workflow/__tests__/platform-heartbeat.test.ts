import { verifyServiceJWT } from "@api/platform";
import { beforeEach, describe, expect, it, vi } from "vitest";

interface CapturedCall {
  init: RequestInit;
  url: string;
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

const PLATFORM_HEALTH_BODY = [
  {
    result: {
      data: {
        json: {
          status: "ok",
          timestamp: "2026-05-10T00:00:00Z",
          caller: "inngest",
        },
      },
    },
  },
];

describe("platform-heartbeat workflow", () => {
  beforeEach(() => {
    process.env.SERVICE_JWT_SECRET = "x".repeat(48);
  });

  it("callPlatformHealthAsInngest signs as caller=inngest", async () => {
    const calls = installFetchMock(PLATFORM_HEALTH_BODY);
    const { callPlatformHealthAsInngest } = await import(
      "../platform-heartbeat"
    );

    const result = await callPlatformHealthAsInngest("https://platform.test");
    expect(result.status).toBe("ok");
    expect(calls[0]?.url).toContain("https://platform.test/api/trpc");

    const headers = new Headers(calls[0]?.init.headers);
    const authHeader = headers.get("authorization");
    expect(authHeader).toMatch(/^Bearer eyJ/);

    const token = authHeader!.slice("Bearer ".length);
    const verified = await verifyServiceJWT(token);
    expect(verified.caller).toBe("inngest");

    expect(headers.get("x-trpc-source")).toBe("service:inngest");
  });

  it("platformHeartbeat exposes the expected id and name", async () => {
    const { platformHeartbeat } = await import("../platform-heartbeat");

    expect(platformHeartbeat.id()).toBe("app/platform-heartbeat");
    expect(platformHeartbeat.name).toBe("Platform Heartbeat");
  });
});
