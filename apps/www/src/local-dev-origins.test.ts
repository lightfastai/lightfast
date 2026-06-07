import { describe, expect, it } from "vitest";
import { localAllowedDevOrigins } from "./local-dev-origins";

describe("www local dev origins", () => {
  it("allows env-injected local aggregate and direct service hosts", () => {
    expect(
      localAllowedDevOrigins([
        "https://app-tanstack.lightfast.localhost",
        "https://app-tanstack.www.lightfast.localhost",
        "https://app-tanstack.platform.lightfast.localhost",
      ])
    ).toEqual([
      "app-tanstack.lightfast.localhost",
      "app-tanstack.www.lightfast.localhost",
      "app-tanstack.platform.lightfast.localhost",
    ]);
  });

  it("drops production hosts and invalid URLs", () => {
    expect(
      localAllowedDevOrigins([
        "https://lightfast.ai",
        "https://www.lightfast.ai",
        "not-a-url",
      ])
    ).toEqual([]);
  });
});
