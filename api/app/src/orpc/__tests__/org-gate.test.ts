import { call } from "@orpc/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const isOrgBoundMock = vi.fn();

// `org-gate.ts` imports `db` from `@db/app/client` (eager DB-env validation)
// and `isOrgBound` from `@db/app`. Stub both — the middleware is the SUT.
vi.mock("@db/app/client", () => ({ db: {} }));
vi.mock("@db/app", () => ({ isOrgBound: isOrgBoundMock }));

const { orgGateMiddleware } = await import("../middleware/org-gate");

/**
 * Invoke the gate as it runs in production: after `authMiddleware` has resolved
 * a Clerk API key into `context.clerkOrgId`. The middleware is the only thing
 * standing between an API-key request and the handler.
 */
async function invokeGate(clerkOrgId: string) {
  const { os } = await import("@orpc/server");
  const proc = os
    .$context<{
      headers: Headers;
      requestId: string;
      apiKeyId: string;
      clerkOrgId: string;
      userId: string;
    }>()
    .use(orgGateMiddleware)
    .handler(() => "handler-reached");

  return call(proc, undefined, {
    context: {
      headers: new Headers(),
      requestId: "test-req",
      apiKeyId: "apk_test",
      clerkOrgId,
      userId: "user_test",
    },
  });
}

beforeEach(() => {
  isOrgBoundMock.mockReset();
});

describe("orgGateMiddleware", () => {
  it("accepts a bound org API key subject — reaches the handler", async () => {
    isOrgBoundMock.mockResolvedValueOnce(true);

    await expect(invokeGate("org_bound")).resolves.toBe("handler-reached");
    expect(isOrgBoundMock).toHaveBeenCalledWith(expect.anything(), "org_bound");
  });

  it("rejects an unbound org API key subject with FORBIDDEN", async () => {
    isOrgBoundMock.mockResolvedValueOnce(false);

    await expect(invokeGate("org_unbound")).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: expect.stringContaining("has not completed setup"),
    });
  });

  it("does not reach the handler when the org is unbound", async () => {
    isOrgBoundMock.mockResolvedValueOnce(false);

    await expect(invokeGate("org_unbound")).rejects.toBeDefined();
    // `isOrgBound` is consulted exactly once; the handler never runs.
    expect(isOrgBoundMock).toHaveBeenCalledTimes(1);
  });
});
