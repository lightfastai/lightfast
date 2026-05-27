import { createHash, randomBytes } from "node:crypto";

import { NATIVE_OAUTH_CALLBACK_PATH } from "@repo/native-auth-contract";

function base64url(bytes: Buffer): string {
  return bytes.toString("base64url");
}

export function createCodeVerifier(): string {
  return base64url(randomBytes(32));
}

export function createStateNonce(): string {
  return base64url(randomBytes(32));
}

export function buildCodeChallenge(verifier: string): string {
  return base64url(createHash("sha256").update(verifier).digest());
}

export function buildLoopbackRedirectUri(port: number): string {
  return `http://127.0.0.1:${port}${NATIVE_OAUTH_CALLBACK_PATH}`;
}
