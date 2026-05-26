import {
  hasRequiredNativeOAuthScopes,
  type NativeClient,
  type NativeOAuthConfig,
  NATIVE_OAUTH_SCOPES,
  nativeOAuthConfigSchema,
} from "@repo/native-auth-contract";
import { getClerkFrontendApi } from "@vendor/clerk/env";

import { env } from "../env";

export function getNativeOAuthClientId(client: NativeClient): string | null {
  switch (client) {
    case "cli":
      return env.CLERK_CLI_OAUTH_CLIENT_ID ?? null;
    case "desktop":
      return env.CLERK_DESKTOP_OAUTH_CLIENT_ID ?? null;
  }
}

export function getNativeOAuthConfig(
  client: NativeClient
): NativeOAuthConfig | null {
  const issuer = getClerkFrontendApi().replace(/\/$/, "");
  const clientId = getNativeOAuthClientId(client);

  if (!(issuer && clientId)) {
    return null;
  }

  return nativeOAuthConfigSchema.parse({
    authorizationEndpoint: `${issuer}/oauth/authorize`,
    client,
    clientId,
    issuer,
    scopes: NATIVE_OAUTH_SCOPES,
    supportsDynamicLoopbackPort: true,
    tokenEndpoint: `${issuer}/oauth/token`,
  });
}

export function buildClerkAuthorizeUrl(input: {
  codeChallenge: string;
  config: NativeOAuthConfig;
  redirectUri: string;
  state: string;
}): string {
  const url = new URL(input.config.authorizationEndpoint);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", input.config.clientId);
  url.searchParams.set("redirect_uri", input.redirectUri);
  url.searchParams.set("scope", input.config.scopes.join(" "));
  url.searchParams.set("state", input.state);
  url.searchParams.set("code_challenge", input.codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");
  return url.toString();
}

export function isExpectedNativeOAuthAccess(input: {
  client: NativeClient;
  clientId: string;
  scopes: readonly string[];
}): boolean {
  const clientId = getNativeOAuthClientId(input.client);
  return (
    !!clientId &&
    input.clientId === clientId &&
    hasRequiredNativeOAuthScopes(input.scopes)
  );
}
