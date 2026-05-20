import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeFinalizeNavigate } from "./auth-navigate";

let hrefValue = "";

Object.defineProperty(window, "location", {
  configurable: true,
  value: {
    get href() {
      return hrefValue;
    },
    set href(v: string) {
      hrefValue = v;
    },
  },
});

beforeEach(() => {
  hrefValue = "";
});

describe("makeFinalizeNavigate", () => {
  it("navigates choose-organization sessions to the post-auth relay", () => {
    const onBlockedTask = vi.fn();
    const navigate = makeFinalizeNavigate("/account/welcome", {
      onBlockedTask,
    });

    navigate({
      decorateUrl: (url) => `/decorated${url}`,
      session: { currentTask: { key: "choose-organization" } },
    });

    expect(hrefValue).toBe("/decorated/account/welcome");
    expect(onBlockedTask).not.toHaveBeenCalled();
  });

  it("waits on unsupported Clerk session tasks", () => {
    let blockedTask: string | null = null;
    const navigate = makeFinalizeNavigate("/account/welcome", {
      onBlockedTask: (taskKey) => {
        blockedTask = taskKey;
      },
    });

    navigate({
      decorateUrl: (url) => `/decorated${url}`,
      session: { currentTask: { key: "reset-password" } },
    });

    expect(hrefValue).toBe("");
    expect(blockedTask).toBe("reset-password");
  });
});
