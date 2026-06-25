import { describe, expect, it } from "vitest";

import {
  buildCodeChallenge,
  buildNativeAuthStartUrl,
  createCodeVerifier,
  createStateNonce,
} from "../auth/oauth";

describe("OAuth primitives", () => {
  it("re-exports shared PKCE verifier, state nonce, and S256 code challenge", () => {
    expect(createCodeVerifier()).toMatch(/^[A-Za-z0-9_-]{43,128}$/);
    expect(createStateNonce()).toMatch(/^[A-Za-z0-9_-]{43,128}$/);
    expect(
      buildCodeChallenge("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk")
    ).toBe("E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM");
  });

  it("builds an app OAuth start URL with PKCE parameters", () => {
    const url = new URL(
      buildNativeAuthStartUrl({
        appUrl: "https://app.lightfast.test",
        client: "cli",
        codeChallenge: "challenge",
        redirectUri: "http://127.0.0.1:54321/callback",
        stateNonce: "nonce_1234567890",
      })
    );

    expect(url.pathname).toBe("/oauth/cli/start");
    expect(url.searchParams.get("redirect_uri")).toBe(
      "http://127.0.0.1:54321/callback"
    );
    expect(url.searchParams.get("state")).toBe("nonce_1234567890");
    expect(url.searchParams.get("code_challenge")).toBe("challenge");
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
  });
});
