import { createHash, randomBytes } from "node:crypto";

function base64url(bytes: Buffer): string {
  return bytes.toString("base64url");
}

export interface GitHubPkcePair {
  codeChallenge: string;
  codeChallengeMethod: "S256";
  codeVerifier: string;
}

export function createGitHubPkcePair(): GitHubPkcePair {
  const codeVerifier = base64url(randomBytes(32));
  const codeChallenge = base64url(
    createHash("sha256").update(codeVerifier).digest()
  );
  return { codeChallenge, codeChallengeMethod: "S256", codeVerifier };
}
