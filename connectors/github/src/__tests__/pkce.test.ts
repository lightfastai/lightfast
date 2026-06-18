import { describe, expect, it } from "vitest";
import { createGitHubPkcePair } from "../pkce";

describe("createGitHubPkcePair", () => {
  it("creates a S256 verifier and challenge", () => {
    const pair = createGitHubPkcePair();
    expect(pair.codeChallengeMethod).toBe("S256");
    expect(pair.codeVerifier).toMatch(/^[A-Za-z0-9_-]{43,}$/);
    expect(pair.codeChallenge).toMatch(/^[A-Za-z0-9_-]{43,}$/);
  });
});
