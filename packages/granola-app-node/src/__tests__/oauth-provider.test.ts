import type {
  OAuthClientInformationMixed,
  OAuthClientMetadata,
  OAuthTokens,
} from "@vendor/mcp";
import { describe, expect, it, vi } from "vitest";

import { DEFAULT_GRANOLA_MCP_ENDPOINT, granolaClientMetadata } from "../config";
import { GranolaOAuthClientProvider } from "../oauth-provider";

describe("Granola OAuth client provider", () => {
  const redirectUrl =
    "https://app.lightfast.ai/api/connectors/granola/oauth/callback";
  const clientMetadata: OAuthClientMetadata = {
    client_name: "Lightfast",
    grant_types: ["authorization_code", "refresh_token"],
    redirect_uris: [redirectUrl],
    response_types: ["code"],
    token_endpoint_auth_method: "none",
  };
  const clientInformation: OAuthClientInformationMixed = {
    client_id: "granola-client-id",
  };
  const tokens: OAuthTokens = {
    access_token: "granola-access-token",
    refresh_token: "granola-refresh-token",
    token_type: "Bearer",
  };

  it("builds Lightfast browser OAuth metadata for dynamic client registration", () => {
    expect(DEFAULT_GRANOLA_MCP_ENDPOINT).toBe("https://mcp.granola.ai/mcp");
    expect(granolaClientMetadata({ redirectUrl })).toEqual({
      client_name: "Lightfast",
      grant_types: ["authorization_code", "refresh_token"],
      redirect_uris: [redirectUrl],
      response_types: ["code"],
      token_endpoint_auth_method: "none",
    });
  });

  it("captures authorization URLs and stores client information, verifier, and tokens", async () => {
    const initialClientInformation: OAuthClientInformationMixed = {
      client_id: "granola-client-initial",
    };
    const initialTokens: OAuthTokens = {
      access_token: "initial-access-token",
      refresh_token: "initial-refresh-token",
      token_type: "Bearer",
    };
    const onAuthorizationUrl = vi.fn();
    const provider = new GranolaOAuthClientProvider({
      clientInformation: initialClientInformation,
      clientMetadata,
      codeVerifier: "initial-code-verifier",
      onAuthorizationUrl,
      redirectUrl,
      tokens: initialTokens,
    });

    expect(provider.redirectUrl).toBe(redirectUrl);
    expect(provider.clientMetadata).toEqual(clientMetadata);
    expect(await provider.clientInformation()).toEqual(
      initialClientInformation
    );
    expect(await provider.codeVerifier()).toBe("initial-code-verifier");
    expect(await provider.tokens()).toEqual(initialTokens);

    const nextClientInformation: OAuthClientInformationMixed = {
      client_id: "granola-client-next",
      client_secret: "granola-client-secret",
    };
    const nextTokens: OAuthTokens = {
      access_token: "next-access-token",
      expires_in: 3600,
      refresh_token: "next-refresh-token",
      token_type: "Bearer",
    };

    await provider.saveClientInformation(nextClientInformation);
    await provider.saveCodeVerifier("next-code-verifier");
    await provider.saveTokens(nextTokens);
    await provider.redirectToAuthorization(
      new URL(
        "https://granola.ai/oauth/authorize?client_id=granola-client-next"
      )
    );

    expect(onAuthorizationUrl).toHaveBeenCalledWith(
      new URL(
        "https://granola.ai/oauth/authorize?client_id=granola-client-next"
      )
    );
    expect(await provider.clientInformation()).toEqual(nextClientInformation);
    expect(await provider.codeVerifier()).toBe("next-code-verifier");
    expect(await provider.tokens()).toEqual(nextTokens);
    expect(provider.snapshot()).toEqual({
      clientInformation: nextClientInformation,
      codeVerifier: "next-code-verifier",
      tokens: nextTokens,
    });
  });

  it("invalidates stored credentials by SDK scope while preserving snapshots", async () => {
    const newProvider = () =>
      new GranolaOAuthClientProvider({
        clientInformation,
        clientMetadata,
        codeVerifier: "granola-code-verifier",
        redirectUrl,
        tokens,
      });

    const tokenInvalidatedProvider = newProvider();
    await tokenInvalidatedProvider.invalidateCredentials("tokens");
    expect(tokenInvalidatedProvider.snapshot()).toEqual({
      clientInformation,
      codeVerifier: "granola-code-verifier",
      tokens: undefined,
    });

    const clientInvalidatedProvider = newProvider();
    await clientInvalidatedProvider.invalidateCredentials("client");
    expect(clientInvalidatedProvider.snapshot()).toEqual({
      clientInformation: undefined,
      codeVerifier: "granola-code-verifier",
      tokens,
    });

    const verifierInvalidatedProvider = newProvider();
    await verifierInvalidatedProvider.invalidateCredentials("verifier");
    expect(verifierInvalidatedProvider.snapshot()).toEqual({
      clientInformation,
      codeVerifier: undefined,
      tokens,
    });
    expect(() => verifierInvalidatedProvider.codeVerifier()).toThrow(
      "No code verifier saved."
    );

    const discoveryInvalidatedProvider = newProvider();
    await discoveryInvalidatedProvider.invalidateCredentials("discovery");
    expect(discoveryInvalidatedProvider.snapshot()).toEqual({
      clientInformation,
      codeVerifier: "granola-code-verifier",
      tokens,
    });

    const allInvalidatedProvider = newProvider();
    await allInvalidatedProvider.invalidateCredentials("all");
    expect(allInvalidatedProvider.snapshot()).toEqual({
      clientInformation: undefined,
      codeVerifier: undefined,
      tokens: undefined,
    });
  });
});
