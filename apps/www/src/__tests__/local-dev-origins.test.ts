import { describe, expect, it } from "vitest";
import { localAllowedDevOrigins } from "~/local-dev-origins";

describe("www local dev origins", () => {
  it("allows env-injected local aggregate and direct service hosts", () => {
    expect(
      localAllowedDevOrigins([
        "https://app.lightfast.localhost",
        "https://app.www.lightfast.localhost",
      ])
    ).toEqual(["app.lightfast.localhost", "app.www.lightfast.localhost"]);
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
