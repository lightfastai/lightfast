import type { NativeClient } from "./contract";

export { startLoopbackServer } from "./loopback";
export { assertNativeOAuthState } from "./oauth-state";
export {
  buildCodeChallenge,
  buildLoopbackRedirectUri,
  createCodeVerifier,
  createStateNonce,
} from "./pkce";

export function buildNativeAuthStartUrl(input: {
  appUrl: string;
  client: NativeClient;
  codeChallenge: string;
  redirectUri: string;
  stateNonce: string;
}): string {
  const baseUrl = input.appUrl.replace(/\/$/, "");
  const url = new URL(`/oauth/${input.client}/start`, baseUrl);
  url.searchParams.set("redirect_uri", input.redirectUri);
  url.searchParams.set("state", input.stateNonce);
  url.searchParams.set("code_challenge", input.codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");
  return url.toString();
}
