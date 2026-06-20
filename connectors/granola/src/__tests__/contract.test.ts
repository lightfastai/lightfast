import { describe, expect, it } from "vitest";
import {
  granolaClientMetadata as runtimeGranolaClientMetadata,
  DEFAULT_GRANOLA_MCP_ENDPOINT as runtimeGranolaMcpEndpoint,
} from "../config";
import {
  DEFAULT_GRANOLA_MCP_ENDPOINT,
  granolaClientMetadata,
} from "../contract";

describe("Granola connector contract", () => {
  it("owns client-safe MCP endpoint and OAuth metadata separately from runtime code", () => {
    const redirectUrl =
      "https://app.lightfast.ai/api/connectors/granola/oauth/callback";

    expect(DEFAULT_GRANOLA_MCP_ENDPOINT).toBe("https://mcp.granola.ai/mcp");
    expect(granolaClientMetadata({ redirectUrl })).toEqual({
      client_name: "Lightfast",
      grant_types: ["authorization_code", "refresh_token"],
      redirect_uris: [redirectUrl],
      response_types: ["code"],
      token_endpoint_auth_method: "none",
    });
    expect(runtimeGranolaMcpEndpoint).toBe(DEFAULT_GRANOLA_MCP_ENDPOINT);
    expect(runtimeGranolaClientMetadata({ redirectUrl })).toEqual(
      granolaClientMetadata({ redirectUrl })
    );
  });
});
