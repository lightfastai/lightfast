import { describe, expect, it } from "vitest";

import { DEFAULT_LINEAR_ENDPOINTS, resolveLinearEndpoints } from "../config";

describe("resolveLinearEndpoints", () => {
  it("rejects custom endpoints outside development and test", () => {
    expect(() =>
      resolveLinearEndpoints({
        endpointOverrides: {
          apiOrigin: "https://api.linear.localhost",
        },
        nodeEnv: "production",
      })
    ).toThrow(
      expect.objectContaining({ code: "LINEAR_CUSTOM_ENDPOINT_FORBIDDEN" })
    );
  });

  it("allows custom endpoints in development", () => {
    expect(
      resolveLinearEndpoints({
        endpointOverrides: {
          apiOrigin: "https://api.linear.localhost",
          mcpEndpoint: "https://mcp.linear.localhost/mcp",
        },
        nodeEnv: "development",
      })
    ).toEqual({
      ...DEFAULT_LINEAR_ENDPOINTS,
      apiOrigin: "https://api.linear.localhost",
      mcpEndpoint: "https://mcp.linear.localhost/mcp",
      oauthRevokeUrl: "https://api.linear.localhost/oauth/revoke",
      oauthTokenUrl: "https://api.linear.localhost/oauth/token",
      viewerUrl: "https://api.linear.localhost/graphql",
    });
  });
});
