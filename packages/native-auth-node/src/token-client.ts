import {
  type NativeOAuthConfig,
  oauthTokenResponseSchema,
  type TokenSet,
} from "@repo/native-auth-contract";

import { NativeAuthError } from "./errors";

async function postTokenRequest(input: {
  body: URLSearchParams;
  config: NativeOAuthConfig;
  fetchImpl?: typeof fetch;
}) {
  const fetchImpl = input.fetchImpl ?? fetch;
  const response = await fetchImpl(input.config.tokenEndpoint, {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/x-www-form-urlencoded",
    },
    body: input.body,
  });

  let json: unknown;
  try {
    json = await response.json();
  } catch {
    json = null;
  }

  if (!response.ok) {
    throw new NativeAuthError(
      "TOKEN_REQUEST_FAILED",
      `OAuth token request failed with status ${response.status}.`
    );
  }

  try {
    return oauthTokenResponseSchema.parse(json);
  } catch {
    throw new NativeAuthError(
      "TOKEN_RESPONSE_INVALID",
      "OAuth token response was invalid."
    );
  }
}

export async function exchangeAuthorizationCode(input: {
  code: string;
  codeVerifier: string;
  config: NativeOAuthConfig;
  fetchImpl?: typeof fetch;
  now?: () => number;
  redirectUri: string;
}): Promise<TokenSet> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: input.config.clientId,
    code: input.code,
    redirect_uri: input.redirectUri,
    code_verifier: input.codeVerifier,
  });
  const token = await postTokenRequest({
    body,
    config: input.config,
    fetchImpl: input.fetchImpl,
  });

  if (!token.refresh_token) {
    throw new NativeAuthError(
      "TOKEN_RESPONSE_INVALID",
      "OAuth token response did not include a refresh token."
    );
  }

  return {
    accessToken: token.access_token,
    expiresAt: (input.now ?? Date.now)() + token.expires_in * 1000,
    refreshToken: token.refresh_token,
    tokenType: token.token_type,
  };
}

export async function refreshAccessToken(input: {
  config: NativeOAuthConfig;
  fetchImpl?: typeof fetch;
  now?: () => number;
  refreshToken: string;
}): Promise<TokenSet> {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: input.config.clientId,
    refresh_token: input.refreshToken,
  });
  const token = await postTokenRequest({
    body,
    config: input.config,
    fetchImpl: input.fetchImpl,
  });

  return {
    accessToken: token.access_token,
    expiresAt: (input.now ?? Date.now)() + token.expires_in * 1000,
    refreshToken: token.refresh_token ?? input.refreshToken,
    tokenType: token.token_type,
  };
}
