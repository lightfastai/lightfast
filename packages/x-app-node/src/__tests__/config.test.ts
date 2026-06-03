import { describe, expect, it } from "vitest";

import { DEFAULT_X_ENDPOINTS, resolveXEndpoints } from "../config";

describe("resolveXEndpoints", () => {
  it("resolves default production X endpoints", () => {
    expect(resolveXEndpoints()).toEqual(DEFAULT_X_ENDPOINTS);
  });

  it("rejects custom endpoints outside development and test", () => {
    expect(() =>
      resolveXEndpoints({
        endpointOverrides: {
          apiOrigin: "https://api.x.localhost",
        },
        nodeEnv: "production",
      })
    ).toThrow(expect.objectContaining({ code: "X_CUSTOM_ENDPOINT_FORBIDDEN" }));
  });

  it("allows custom endpoints in development", () => {
    expect(
      resolveXEndpoints({
        appOrigin: "https://app.lightfast.localhost",
        endpointOverrides: {
          apiOrigin: "https://api.x.localhost",
          mcpEndpoint: "https://app.lightfast.localhost/api/connectors/x/mcp",
          oauthOrigin: "https://x.localhost",
        },
        nodeEnv: "development",
      })
    ).toEqual({
      apiOrigin: "https://api.x.localhost",
      mcpEndpoint: "https://app.lightfast.localhost/api/connectors/x/mcp",
      oauthAuthorizeUrl: "https://x.localhost/i/oauth2/authorize",
      oauthRevokeUrl: "https://api.x.localhost/2/oauth2/revoke",
      oauthTokenUrl: "https://api.x.localhost/2/oauth2/token",
      viewerUrl: "https://api.x.localhost/2/users/me",
    });
  });
});
