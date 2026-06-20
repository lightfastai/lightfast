export interface GranolaOAuthClientMetadata {
  client_name: string;
  grant_types: ["authorization_code", "refresh_token"];
  redirect_uris: string[];
  response_types: ["code"];
  token_endpoint_auth_method: "none";
}

export const DEFAULT_GRANOLA_MCP_ENDPOINT = "https://mcp.granola.ai/mcp";

export function granolaClientMetadata(input: {
  redirectUrl: string | URL;
}): GranolaOAuthClientMetadata {
  return {
    client_name: "Lightfast",
    grant_types: ["authorization_code", "refresh_token"],
    redirect_uris: [input.redirectUrl.toString()],
    response_types: ["code"],
    token_endpoint_auth_method: "none",
  };
}
