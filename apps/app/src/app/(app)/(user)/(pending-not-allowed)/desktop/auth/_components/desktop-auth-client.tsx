"use client";

import { ClientAuthBridge } from "../../../_components/client-auth-bridge";

const ALLOWED_REDIRECT_URIS = new Set([
  "lightfast://auth/callback",
  "lightfast-dev://auth/callback",
]);

export function DesktopAuthClient() {
  return (
    <ClientAuthBridge
      buildExchangeRequest={({ searchParams }) => {
        const state = searchParams.get("state");
        const codeChallenge = searchParams.get("code_challenge");
        const method = searchParams.get("code_challenge_method");
        const redirectUri = searchParams.get("redirect_uri");
        if (!state || !codeChallenge || method !== "S256" || !redirectUri) {
          return null;
        }
        if (!ALLOWED_REDIRECT_URIS.has(redirectUri)) {
          return null;
        }
        return { state, codeChallenge, redirectUri };
      }}
      jwtTemplate="lightfast-desktop"
      mode="code-redirect"
      subtitle="Returning you to the Lightfast desktop app…"
      title="Authenticating…"
    />
  );
}
