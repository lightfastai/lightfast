import { call } from "@orpc/server";
import { describe, expect, it } from "vitest";
import type { AuthContext, InitialContext } from "../context";

const { orgGateMiddleware } = await import("../middleware/org-gate");

function orgGate(bindingStatus: "bound" | "unbound") {
  return bindingStatus === "bound"
    ? ({ bindingStatus: "bound", nextSetupRequirement: null } as const)
    : ({
        bindingStatus: "unbound",
        nextSetupRequirement: "github_org",
      } as const);
}

/**
 * Invoke the gate as it runs in production: after `authMiddleware` has resolved
 * an Unkey API key into the shared `context.auth.identity` contract.
 */
async function invokeGate(bindingStatus: "bound" | "unbound") {
  const { os } = await import("@orpc/server");
  const proc = os
    .$context<InitialContext & AuthContext>()
    .use(orgGateMiddleware)
    .handler(() => "handler-reached");

  return call(proc, undefined, {
    context: {
      apiKeyId: "apk_test",
      auth: {
        identity: {
          orgGate: orgGate(bindingStatus),
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
});
