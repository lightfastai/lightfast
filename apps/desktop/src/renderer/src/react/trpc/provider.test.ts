import React from "react";
import { describe, expect, it } from "vitest";

import { DesktopTRPCProvider } from "./provider";

describe("DesktopTRPCProvider", () => {
  it("normalizes bridge auth headers before passing them to tRPC", async () => {
    (
      globalThis as unknown as {
        window: {
          lightfastBridge?: {
            auth?: {
              getRequestHeaders?: () => Record<string, string | undefined>;
            };
          };
        };
      }
    ).window = {
      lightfastBridge: {
        auth: {
          getRequestHeaders: () => ({
            authorization: "Bearer access",
            "x-lightfast-org": undefined,
          }),
        },
      },
    };

    const element = DesktopTRPCProvider({
      baseUrl: "https://app.lightfast.localhost",
      children: React.createElement("div", null, "Desktop app"),
    });

    expect(React.isValidElement(element)).toBe(true);

    const { options } = element.props as {
      options: {
        getAuthHeaders: () => Promise<Record<string, string>>;
      };
    };

    await expect(options.getAuthHeaders()).resolves.toStrictEqual({
      authorization: "Bearer access",
    });
  });
});
