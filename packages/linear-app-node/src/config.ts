import { LinearAppNodeError } from "./errors";

export interface LinearEndpoints {
  apiOrigin: string;
  appOrigin: string;
  mcpEndpoint: string;
  oauthAuthorizeUrl: string;
  oauthRevokeUrl: string;
  oauthTokenUrl: string;
  viewerUrl: string;
}

export const DEFAULT_LINEAR_ENDPOINTS: LinearEndpoints = {
  apiOrigin: "https://api.linear.app",
  appOrigin: "https://linear.app",
  mcpEndpoint: "https://mcp.linear.app/mcp",
  oauthAuthorizeUrl: "https://linear.app/oauth/authorize",
  oauthRevokeUrl: "https://api.linear.app/oauth/revoke",
  oauthTokenUrl: "https://api.linear.app/oauth/token",
  viewerUrl: "https://api.linear.app/graphql",
};

export type LinearEndpointOverrides = Partial<LinearEndpoints>;

export function resolveLinearEndpoints(input: {
  endpointOverrides?: LinearEndpointOverrides;
  nodeEnv?: string;
}): LinearEndpoints {
  const overrides = input.endpointOverrides ?? {};
  const hasCustomEndpoint = Object.entries(overrides).some(
    ([key, value]) =>
      value !== undefined &&
      value !== DEFAULT_LINEAR_ENDPOINTS[key as keyof LinearEndpoints]
  );
  const nodeEnv = input.nodeEnv ?? process.env.NODE_ENV;

  if (hasCustomEndpoint && nodeEnv !== "development" && nodeEnv !== "test") {
    throw new LinearAppNodeError(
      "LINEAR_CUSTOM_ENDPOINT_FORBIDDEN",
      "Linear custom endpoints are only allowed in development and test."
    );
  }

  const apiOrigin = trimTrailingSlash(
    overrides.apiOrigin ?? DEFAULT_LINEAR_ENDPOINTS.apiOrigin
  );
  const appOrigin = trimTrailingSlash(
    overrides.appOrigin ?? DEFAULT_LINEAR_ENDPOINTS.appOrigin
  );

  return {
    apiOrigin,
    appOrigin,
    mcpEndpoint: overrides.mcpEndpoint ?? DEFAULT_LINEAR_ENDPOINTS.mcpEndpoint,
    oauthAuthorizeUrl:
      overrides.oauthAuthorizeUrl ??
      new URL("/oauth/authorize", appOrigin).toString(),
    oauthRevokeUrl:
      overrides.oauthRevokeUrl ??
      new URL("/oauth/revoke", apiOrigin).toString(),
    oauthTokenUrl:
      overrides.oauthTokenUrl ?? new URL("/oauth/token", apiOrigin).toString(),
    viewerUrl: overrides.viewerUrl ?? new URL("/graphql", apiOrigin).toString(),
  };
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}
