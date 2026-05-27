import { describe, expect, it } from "vitest";

import {
  buildCodeChallenge,
  buildLoopbackRedirectUri,
  createCodeVerifier,
  createStateNonce,
} from "..";

describe("@repo/native-auth-node PKCE helpers", () => {
  it("creates verifier and nonce values with enough entropy for PKCE", () => {
    expect(createCodeVerifier()).toMatch(/^[A-Za-z0-9_-]{43,}$/);
    expect(createStateNonce()).toMatch(/^[A-Za-z0-9_-]{43,}$/);
  });

  it("builds an RFC 7636 S256 challenge", () => {
    expect(buildCodeChallenge("abc123")).toBe(
      "bKE9UspwyIPg8LsQHkJaiehiTeUdstI5JZOvaoQRgJA"
    );
  });

  it("builds loopback callback redirect URIs", () => {
    expect(buildLoopbackRedirectUri(51_010)).toBe(
      "http://127.0.0.1:51010/callback"
    );
  });
});
