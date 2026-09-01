import { describe, expect, it } from "vitest";
import { getLightfastMcpConfig } from "../config";

describe("getLightfastMcpConfig", () => {
  it("requires an API key", () => {
    expect(() =>
      getLightfastMcpConfig({
        LIGHTFAST_API_URL: "https://api.example.test",
      })
    ).toThrow(/LIGHTFAST_API_KEY/);
  });

  it("requires an explicit API URL", () => {
    expect(() =>
      getLightfastMcpConfig({
        LIGHTFAST_API_KEY: "lf_test",
      })
    ).toThrow(/LIGHTFAST_API_URL/);
  });

  it("returns the configured API key and URL", () => {
    expect(
      getLightfastMcpConfig({
        LIGHTFAST_API_KEY: "lf_test",
        LIGHTFAST_API_URL: "https://api.example.test",
      })
    ).toEqual({
      apiKey: "lf_test",
      baseUrl: "https://api.example.test",
    });
  });
});
