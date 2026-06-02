import { XAppNodeError } from "./errors";

export interface XEndpoints {
  apiOrigin: string;
  mcpEndpoint: string;
  oauthAuthorizeUrl: string;
  oauthRevokeUrl: string;
  oauthTokenUrl: string;
  viewerUrl: string;
}

export interface XEndpointOverrides extends Partial<XEndpoints> {
  oauthOrigin?: string;
}

export const DEFAULT_X_ENDPOINTS: XEndpoints = {
  apiOrigin: "https://api.x.com",
  mcpEndpoint: "https://app.invalid/api/connectors/x/mcp",
  oauthAuthorizeUrl: "https://x.com/i/oauth2/authorize",
  oauthRevokeUrl: "https://api.x.com/2/oauth2/revoke",
  oauthTokenUrl: "https://api.x.com/2/oauth2/token",
  viewerUrl: "https://api.x.com/2/users/me",
};

export function assertXEndpointAllowed(input: {
  defaultValue: string;
  nodeEnv?: string;
  value: string;
}): void {
  if (input.value === input.defaultValue) {
    return;
  }

  const nodeEnv = input.nodeEnv ?? process.env.NODE_ENV;
  if (nodeEnv === "development" || nodeEnv === "test") {
    return;
  }

  throw new XAppNodeError(
    "X_CUSTOM_ENDPOINT_FORBIDDEN",
    "X custom endpoints are only allowed in development and test."
  );
}

export function resolveXEndpoints(
  input: {
    appOrigin?: string;
    endpointOverrides?: XEndpointOverrides;
    nodeEnv?: string;
  } = {}
): XEndpoints {
  const appOrigin = trimTrailingSlash(input.appOrigin ?? "https://app.invalid");
  const overrides = input.endpointOverrides ?? {};
  const hasCustomEndpoint = Object.values(overrides).some(
    (value) => value !== undefined
  );
  const nodeEnv = input.nodeEnv ?? process.env.NODE_ENV;

  if (hasCustomEndpoint && nodeEnv !== "development" && nodeEnv !== "test") {
    assertXEndpointAllowed({
      defaultValue: "",
      nodeEnv,
      value: "__x_custom_endpoint__",
    });
  }

  const apiOrigin = trimTrailingSlash(
    overrides.apiOrigin ?? DEFAULT_X_ENDPOINTS.apiOrigin
  );
  const oauthOrigin = trimTrailingSlash(
    overrides.oauthOrigin ?? "https://x.com"
  );

  return {
    apiOrigin,
    mcpEndpoint:
      overrides.mcpEndpoint ??
      new URL("/api/connectors/x/mcp", appOrigin).toString(),
    oauthAuthorizeUrl:
      overrides.oauthAuthorizeUrl ??
      new URL("/i/oauth2/authorize", oauthOrigin).toString(),
    oauthRevokeUrl:
      overrides.oauthRevokeUrl ??
      new URL("/2/oauth2/revoke", apiOrigin).toString(),
    oauthTokenUrl:
      overrides.oauthTokenUrl ??
      new URL("/2/oauth2/token", apiOrigin).toString(),
    viewerUrl:
      overrides.viewerUrl ?? new URL("/2/users/me", apiOrigin).toString(),
  };
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}
