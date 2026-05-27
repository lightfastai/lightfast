import { call } from "@orpc/server";
import { describe, expect, it } from "vitest";

const { orgGateMiddleware } = await import("../middleware/org-gate");

/**
 * Invoke the gate as it runs in production: after `authMiddleware` has resolved
 * an Unkey API key into the shared `context.auth.identity` contract.
 */
async function invokeGate(bindingStatus: "bound" | "unbound" | "revoked") {
  const { os } = await import("@orpc/server");
  const proc = os
    .$context<{
      apiKeyId: string;
      auth: {
        identity: {
          orgGate: { bindingStatus: "bound" | "unbound" | "revoked" };
          orgId: string;
          type: "active";
          userId: string;
        };
      };
      headers: Headers;
      requestId: string;
    }>()
    .use(orgGateMiddleware)
    .handler(() => "handler-reached");

  return call(proc, undefined, {
    context: {
      apiKeyId: "apk_test",
      auth: {
        identity: {
          orgGate: { bindingStatus },
          orgId: "org_test",
          type: "active",
          userId: "user_test",
        },
      },
      headers: new Headers(),
      requestId: "test-req",
    },
  });
}

describe("orgGateMiddleware", () => {
  it("accepts a bound org API key identity — reaches the handler", async () => {
    await expect(invokeGate("bound")).resolves.toBe("handler-reached");
  });

  it("rejects an unbound org API key identity with FORBIDDEN", async () => {
    await expect(invokeGate("unbound")).rejects.toMatchObject({
      code: "FORBIDDEN",
      data: {
        diagnostics: [expect.objectContaining({ code: "ORG_SETUP_REQUIRED" })],
      },
      message: expect.stringContaining("has not completed setup"),
    });
  });

  it("rejects a revoked org API key identity with FORBIDDEN", async () => {
    await expect(invokeGate("revoked")).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });
});
