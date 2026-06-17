import React from "react";
import { describe, expect, it } from "vitest";

import { DesktopQueryProvider } from "./query-provider";

describe("DesktopQueryProvider", () => {
  it("provides the renderer React Query client without a tRPC client", () => {
    const element = DesktopQueryProvider({
      children: React.createElement("div", null, "Desktop app"),
    });

    expect(React.isValidElement(element)).toBe(true);
  });
});
