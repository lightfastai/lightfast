import { afterEach, describe, expect, it, vi } from "vitest";
import { makeFinalizeNavigate } from "~/auth/navigate";

describe("makeFinalizeNavigate", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("decorates and assigns the target when there is no blocking Clerk task", () => {
    const location = { href: "https://app.test/sign-in" };
    vi.stubGlobal("window", { location });

    makeFinalizeNavigate("/agents")({
      decorateUrl: (target) => `https://app.test${target}`,
      session: { currentTask: { key: "choose-organization" } },
    });

    expect(location.href).toBe("https://app.test/agents");
  });

  it("does not navigate when Clerk reports an unfinished non-org task", () => {
    const location = { href: "https://app.test/sign-in" };
    const onBlockedTask = vi.fn();
    vi.stubGlobal("window", { location });

    makeFinalizeNavigate("/agents", { onBlockedTask })({
      decorateUrl: (target) => `https://app.test${target}`,
      session: { currentTask: { key: "verify-email-address" } },
    });

    expect(location.href).toBe("https://app.test/sign-in");
    expect(onBlockedTask).toHaveBeenCalledWith("verify-email-address");
  });
});
