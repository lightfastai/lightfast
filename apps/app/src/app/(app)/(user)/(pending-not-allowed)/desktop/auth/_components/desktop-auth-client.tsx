"use client";

import { ClientAuthBridge } from "../../../_components/client-auth-bridge";

export function DesktopAuthClient() {
  return (
    <ClientAuthBridge
      title="Authenticating…"
      subtitle="You'll be redirected back to the desktop app shortly."
      jwtTemplate="lightfast-desktop"
      buildRedirectUrl={({ token, searchParams }) => {
        const state = searchParams.get("state");
        if (!state) return null;
        return `lightfast://auth/callback?token=${encodeURIComponent(
          token
        )}&state=${encodeURIComponent(state)}`;
      }}
    />
  );
}
